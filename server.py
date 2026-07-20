import os
os.environ["TORCHDYNAMO_DISABLE"] = "1"

import shutil
import subprocess
import time
from pathlib import Path
from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel
import numpy as np
import soundfile as sf
import torch
from huggingface_hub import hf_hub_download, list_repo_files
from transformers import AutoModel
from aksharamukha import transliterate

from asr import transcribe_audio

HINDI_REF_TEXT = "चीन में मोबाइल फ़ोन की लत के कारण एक युवक बड़ी मुसीबत में फँस गया।"
MARATHI_REF_TEXT = "भावा, डिझेल से धर घसरलेत वाटायत हो देयत, पुलकुरु तक्तक की."
SAMPLES_DIR = Path(__file__).resolve().parent / "samples"

app = FastAPI(title="TTS API", description="Text-to-Speech API using IndicF5 model")

# Global model cache
_model = None
_model_lock = None


class TTSRequest(BaseModel):
    text: str
    lang: str = None
    ref_audio: str = None
    ref_text: str = None
    output_path: str = "output.wav"
    sample_rate: int = 24000
    device: str = None


def get_default_device():
    try:
        import torch
        return "cuda" if torch.cuda.is_available() else "cpu"
    except Exception:
        return "cpu"


def normalize_language(language):
    if language is None:
        return None
    lang = str(language).strip().lower()
    if lang in {"h", "hi", "hin", "hindi"}:
        return "hindi"
    if lang in {"m", "mr", "mar", "marathi"}:
        return "marathi"
    raise ValueError("Please choose either hindi or marathi.")


def resolve_audio_path(ref_audio):
    if not ref_audio:
        return None
    path = Path(ref_audio)
    if path.is_absolute() or path.exists():
        return str(path)
    candidate = SAMPLES_DIR / path
    if candidate.exists():
        return str(candidate)
    return str(path)


def convert_to_wav_if_needed(audio_path):
    if audio_path is None:
        return None

    path = Path(audio_path)
    if path.suffix.lower() == ".wav":
        return str(path)

    if not shutil.which("ffmpeg"):
        raise RuntimeError("ffmpeg is required to convert audio files to WAV format. Please install ffmpeg and try again.")

    if not path.exists():
        raise FileNotFoundError(f"Reference audio file not found: {path}")

    wav_path = path.with_suffix(".wav")
    command = [
        "ffmpeg",
        "-y",
        "-i",
        str(path),
        "-ar",
        "16000",
        "-ac",
        "1",
        "-c:a",
        "pcm_s16le",
        str(wav_path),
    ]
    subprocess.run(command, check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    return str(wav_path)


def resolve_language_settings(language=None, ref_audio=None, ref_text=None):
    lang = normalize_language(language)
    if lang is None:
        raise ValueError("Language must be specified (hindi or marathi)")

    if lang == "hindi":
        resolved_audio = resolve_audio_path(ref_audio or "hindi.wav")
        resolved_text = ref_text or HINDI_REF_TEXT
    else:
        resolved_audio = resolve_audio_path(ref_audio or "mar.wav")
        resolved_text = ref_text or MARATHI_REF_TEXT

    return lang, resolved_audio, resolved_text


def load_model(repo_id: str = "ai4bharat/IndicF5", device: str = None):
    global _model
    if _model is not None:
        return _model
    
    if device is None:
        device = get_default_device()
    
    print("Loading model architecture...")
    _model = AutoModel.from_pretrained(repo_id, trust_remote_code=True)

    print("Locating checkpoint file in repo...")
    files = list_repo_files(repo_id)
    ckpt_candidates = [f for f in files if f.endswith((".safetensors", ".bin", ".pt")) and "vocos" not in f.lower()]
    print("Found candidate checkpoint files:", ckpt_candidates)

    ckpt_file = ckpt_candidates[0]
    ckpt_path = hf_hub_download(repo_id, filename=ckpt_file)

    if ckpt_path.endswith(".safetensors"):
        from safetensors.torch import load_file
        raw_state = load_file(ckpt_path, device="cpu")
    else:
        raw_state = torch.load(ckpt_path, map_location="cpu")

    fixed_state = {k.replace("_orig_mod.", ""): v for k, v in raw_state.items()}

    missing, unexpected = _model.load_state_dict(fixed_state, strict=False)
    print(f"After prefix fix -> missing: {len(missing)}, unexpected: {len(unexpected)}")
    if len(missing) > 20:
        print("Still lots missing, sample:", missing[:10])

    _model = _model.to(device)
    _model.eval()
    print("Model is on:", device)
    
    return _model


@app.on_event("startup")
async def startup_event():
    print("TTS API starting up...")


@app.on_event("shutdown")
async def shutdown_event():
    print("TTS API shutting down...")


@app.get("/")
async def root():
    return {
        "message": "TTS API using IndicF5 model",
        "endpoints": {
            "synthesize": "/synthesize",
            "health": "/health",
            "model-info": "/model-info"
        }
    }


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.get("/model-info")
async def model_info():
    return {
        "model": "IndicF5",
        "supported_languages": ["hindi", "marathi"],
        "default_device": get_default_device()
    }


@app.post("/synthesize")
async def synthesize(request: TTSRequest):
    try:
        if not request.text:
            raise HTTPException(status_code=400, detail="Text is required")
        
        # Resolve language settings
        lang, ref_audio, ref_text = resolve_language_settings(
            request.lang,
            request.ref_audio,
            request.ref_text
        )
        
        # Convert audio to WAV if needed
        ref_audio = convert_to_wav_if_needed(ref_audio)
        
        device = request.device or get_default_device()
        
        print(f"TTS Request: lang={lang}, text={request.text[:50]}...")
        print(f"Using reference audio: {ref_audio}")
        print(f"Using reference text: {ref_text}")
        
        # Load model
        model = load_model(device=device)
        
        # Generate audio
        print("Generating...")
        start_time = time.time()
        
        result = transliterate.process("HK", "Devanagari", request.text)
        audio = model(result, ref_audio_path=ref_audio, ref_text=ref_text)
        
        generation_time = round(time.time() - start_time, 2)
        print(f"Generated in {generation_time}s")
        
        # Convert audio format if needed
        if audio.dtype == np.int16:
            audio = audio.astype(np.float32) / 32768.0
        
        # Save audio
        output_path = request.output_path
        sf.write(output_path, audio, samplerate=request.sample_rate)
        print(f"Saved to {output_path}")
        
        return {
            "status": "success",
            "message": "Audio generated successfully",
            "output_path": output_path,
            "language": lang,
            "generation_time_seconds": generation_time,
            "sample_rate": request.sample_rate
        }
    
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e))
    except Exception as e:
        print(f"Error during TTS generation: {e}")
        raise HTTPException(status_code=500, detail=f"TTS generation failed: {str(e)}")


@app.post("/synthesize-and-download")
async def synthesize_and_download(request: TTSRequest):
    try:
        if not request.text:
            raise HTTPException(status_code=400, detail="Text is required")
        
        # Resolve language settings
        lang, ref_audio, ref_text = resolve_language_settings(
            request.lang,
            request.ref_audio,
            request.ref_text
        )
        
        # Convert audio to WAV if needed
        ref_audio = convert_to_wav_if_needed(ref_audio)
        
        device = request.device or get_default_device()
        
        print(f"TTS Request: lang={lang}, text={request.text[:50]}...")
        
        # Load model
        model = load_model(device=device)
        
        # Generate audio
        print("Generating...")
        start_time = time.time()
        
        result = transliterate.process("HK", "Devanagari", request.text)
        audio = model(result, ref_audio_path=ref_audio, ref_text=ref_text)
        
        generation_time = round(time.time() - start_time, 2)
        print(f"Generated in {generation_time}s")
        
        # Convert audio format if needed
        if audio.dtype == np.int16:
            audio = audio.astype(np.float32) / 32768.0
        
        # Save audio temporarily
        output_path = request.output_path
        sf.write(output_path, audio, samplerate=request.sample_rate)
        
        return FileResponse(
            output_path,
            media_type="audio/wav",
            filename="output.wav"
        )
    
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e))
    except Exception as e:
        print(f"Error during TTS generation: {e}")
        raise HTTPException(status_code=500, detail=f"TTS generation failed: {str(e)}")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
