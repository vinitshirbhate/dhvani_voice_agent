import os
os.environ["TORCHDYNAMO_DISABLE"] = "1"

import shutil
import subprocess
import tempfile
import time
from pathlib import Path
from typing import Literal, Optional

import numpy as np
import soundfile as sf
import torch
from aksharamukha import transliterate
from fastapi import FastAPI, File, HTTPException, Request, UploadFile
from fastapi.responses import FileResponse
from huggingface_hub import hf_hub_download, list_repo_files
from pydantic import BaseModel
from transformers import AutoModel

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
    audio_type: Literal["hindi", "marathi", "custom"] = "hindi"
    lang: Optional[str] = None
    ref_audio: Optional[str] = None
    ref_text: Optional[str] = None
    output_path: str = "output.wav"
    sample_rate: int = 24000
    device: Optional[str] = None


def get_default_device():
    try:
        import torch
        return "cuda" if torch.cuda.is_available() else "cpu"
    except Exception:
        return "cpu"


def normalize_audio_type(audio_type=None, language=None):
    if audio_type is None and language is None:
        return "hindi"

    value = str(audio_type or language or "hindi").strip().lower()
    if value in {"h", "hi", "hin", "hindi"}:
        return "hindi"
    if value in {"m", "mr", "mar", "marathi"}:
        return "marathi"
    if value in {"custom", "upload", "custom-audio"}:
        return "custom"
    raise ValueError("audio_type must be one of: hindi, marathi, custom.")


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


def resolve_language_settings(audio_type=None, language=None, ref_audio=None, ref_text=None):
    normalized_audio_type = normalize_audio_type(audio_type, language)

    if normalized_audio_type == "custom":
        resolved_audio = resolve_audio_path(ref_audio) if ref_audio else None
        resolved_text = ref_text
        return normalized_audio_type, resolved_audio, resolved_text

    if normalized_audio_type == "hindi":
        resolved_audio = resolve_audio_path(ref_audio or "hindi.wav")
        resolved_text = ref_text or HINDI_REF_TEXT
    else:
        resolved_audio = resolve_audio_path(ref_audio or "mar.wav")
        resolved_text = ref_text or MARATHI_REF_TEXT

    return normalized_audio_type, resolved_audio, resolved_text


def save_uploaded_audio(audio_file: UploadFile):
    if audio_file is None or not getattr(audio_file, "filename", None):
        return None

    suffix = Path(audio_file.filename).suffix or ".wav"
    temp_file = tempfile.NamedTemporaryFile(suffix=suffix, delete=False)
    temp_path = Path(temp_file.name)
    temp_file.close()

    with temp_path.open("wb") as out_file:
        shutil.copyfileobj(audio_file.file, out_file)

    return temp_path


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
        "supported_audio_types": ["hindi", "marathi", "custom"],
        "default_device": get_default_device()
    }


async def _parse_payload(request: Request):
    content_type = request.headers.get("content-type", "")
    if "multipart/form-data" in content_type:
        form = await request.form()
        data = {
            "text": form.get("text"),
            "audio_type": form.get("audio_type"),
            "lang": form.get("lang"),
            "ref_audio": form.get("ref_audio"),
            "ref_text": form.get("ref_text"),
            "output_path": form.get("output_path", "output.wav"),
            "sample_rate": form.get("sample_rate", 24000),
            "device": form.get("device"),
        }
        return data, form.get("audio_file")

    payload = await request.json()
    return payload, None


async def _run_synthesis(request: Request, download_response: bool = False):
    try:
        payload, audio_file = await _parse_payload(request)
        text = payload.get("text") or ""
        if not text:
            raise HTTPException(status_code=400, detail="Text is required")

        audio_type = normalize_audio_type(payload.get("audio_type"), payload.get("lang"))
        ref_audio = payload.get("ref_audio")
        ref_text = payload.get("ref_text")
        output_path = payload.get("output_path") or "output.wav"
        sample_rate = int(payload.get("sample_rate", 24000))
        device = payload.get("device") or get_default_device()

        if audio_type == "custom":
            if audio_file is not None:
                uploaded_path = save_uploaded_audio(audio_file)
                try:
                    ref_audio = convert_to_wav_if_needed(str(uploaded_path))
                    ref_text = ref_text or transcribe_audio(ref_audio)
                finally:
                    if uploaded_path and uploaded_path.exists():
                        uploaded_path.unlink(missing_ok=True)
            elif ref_audio:
                ref_audio = convert_to_wav_if_needed(ref_audio)
            else:
                raise ValueError("Custom audio mode requires an uploaded audio file or a valid ref_audio path.")

            if not ref_text:
                raise ValueError("Custom audio mode requires transcribed text. Please upload an audio file or provide ref_text.")
        else:
            _, ref_audio, ref_text = resolve_language_settings(
                audio_type=audio_type,
                language=payload.get("lang"),
                ref_audio=ref_audio,
                ref_text=ref_text,
            )
            if ref_audio:
                ref_audio = convert_to_wav_if_needed(ref_audio)

        print(f"TTS Request: audio_type={audio_type}, text={text[:50]}...")
        print(f"Using reference audio: {ref_audio}")
        print(f"Using reference text: {ref_text}")

        model = load_model(device=device)

        print("Generating...")
        start_time = time.time()

        result = transliterate.process("HK", "Devanagari", text)
        audio = model(result, ref_audio_path=ref_audio, ref_text=ref_text)

        generation_time = round(time.time() - start_time, 2)
        print(f"Generated in {generation_time}s")

        if audio.dtype == np.int16:
            audio = audio.astype(np.float32) / 32768.0

        output_file = Path(output_path)
        output_file.parent.mkdir(parents=True, exist_ok=True)
        sf.write(str(output_file), audio, samplerate=sample_rate)
        print(f"Saved to {output_file}")

        if download_response:
            return FileResponse(
                str(output_file),
                media_type="audio/wav",
                filename=output_file.name,
            )

        return {
            "status": "success",
            "message": "Audio generated successfully",
            "output_path": str(output_file),
            "audio_type": audio_type,
            "generation_time_seconds": generation_time,
            "sample_rate": sample_rate,
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


@app.post("/synthesize")
async def synthesize(request: Request):
    return await _run_synthesis(request, download_response=False)


@app.post("/synthesize-and-download")
async def synthesize_and_download(request: Request):
    return await _run_synthesis(request, download_response=True)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
