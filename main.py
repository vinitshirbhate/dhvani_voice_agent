import os
os.environ["TORCHDYNAMO_DISABLE"] = "1"

import argparse
import shutil
import subprocess
import time
from pathlib import Path

from asr import transcribe_audio

HINDI_REF_TEXT = "चीन में मोबाइल फ़ोन की लत के कारण एक युवक बड़ी मुसीबत में फँस गया।"
MARATHI_REF_TEXT = "भावा, डिझेल से धर घसरलेत वाटायत हो देयत, पुलकुरु तक्तक की."
SAMPLES_DIR = Path(__file__).resolve().parent / "samples"


def get_default_device():
    try:
        import torch
        return "cuda" if torch.cuda.is_available() else "cpu"
    except Exception:
        return "cpu"


def build_parser():
    parser = argparse.ArgumentParser(description="Generate TTS audio with IndicF5 model")
    parser.add_argument("text", nargs="?", help="Input text to generate audio for")
    parser.add_argument("--lang", dest="lang", default=None, help="Language: hindi or marathi")
    parser.add_argument("--ref-audio", dest="ref_audio", default=None, help="Reference audio path")
    parser.add_argument("--ref-text", dest="ref_text", default=None, help="Reference text for style")
    parser.add_argument("--output", dest="output", default="output.wav", help="Output WAV filepath")
    parser.add_argument("--repo-id", dest="repo_id", default="ai4bharat/IndicF5", help="HuggingFace repo id")
    parser.add_argument("--samplerate", dest="samplerate", type=int, default=24000, help="Output sample rate")
    parser.add_argument("--device", dest="device", default=get_default_device(), help="Device to run model on")
    return parser


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


def resolve_text_input(text):
    if text and str(text).strip():
        return str(text).strip()
    return input("Enter the text to synthesize: ").strip()


def resolve_language_settings(language=None, ref_audio=None, ref_text=None):
    lang = normalize_language(language)
    if lang is None:
        choice = input("Do you want Hindi or Marathi audio? [h/m]: ").strip().lower()
        if choice in {"h", "hi", "hin", "hindi"}:
            lang = "hindi"
        elif choice in {"m", "mr", "mar", "marathi"}:
            lang = "marathi"
        else:
            raise ValueError("Please enter 'h' for Hindi or 'm' for Marathi.")

    if lang == "hindi":
        resolved_audio = resolve_audio_path(ref_audio or "hindi.wav")
        resolved_text = ref_text or HINDI_REF_TEXT
    else:
        resolved_audio = resolve_audio_path(ref_audio or "mar.wav")
        resolved_text = ref_text or MARATHI_REF_TEXT

    return lang, resolved_audio, resolved_text


def ask_for_custom_voice(lang, ref_audio=None, ref_text=None):
    choice = input("Do you want to use a custom voice/reference audio? [y/n]: ").strip().lower()
    if choice not in {"y", "yes", "1", "true"}:
        return False, ref_audio, ref_text

    custom_audio = input("Enter the reference audio path (press Enter to use the default sample): ").strip()
    if custom_audio:
        resolved_audio = resolve_audio_path(custom_audio)
        resolved_audio = convert_to_wav_if_needed(resolved_audio)
        # When custom audio is provided, always transcribe it with ASR
        asr_language = "hi" if lang == "hindi" else "mr"
        try:
            print("Transcribing custom audio with ASR...")
            transcript = transcribe_audio(resolved_audio, language=asr_language)
            print("ASR transcript:", transcript)
            return True, resolved_audio, transcript
        except Exception as exc:
            print(f"ASR transcription failed: {exc}")
            fallback_text = HINDI_REF_TEXT if lang == "hindi" else MARATHI_REF_TEXT
            return True, resolved_audio, fallback_text
    else:
        # No custom audio, use defaults
        resolved_audio = resolve_audio_path(ref_audio)
        resolved_audio = convert_to_wav_if_needed(resolved_audio)
        resolved_text = ref_text or (HINDI_REF_TEXT if lang == "hindi" else MARATHI_REF_TEXT)
        return True, resolved_audio, resolved_text


def main():
    import numpy as np
    import soundfile as sf
    import torch
    from huggingface_hub import hf_hub_download, list_repo_files
    from transformers import AutoModel
    from aksharamukha import transliterate

    print("Starting...")
    parser = build_parser()
    args = parser.parse_args()

    text = resolve_text_input(args.text)
    lang, ref_audio, ref_text = resolve_language_settings(args.lang, args.ref_audio, args.ref_text)
    use_custom_voice, ref_audio, ref_text = ask_for_custom_voice(lang, ref_audio, ref_text)
    ref_audio = convert_to_wav_if_needed(ref_audio)
    print(f"Selected language: {lang}")
    print(f"Using custom voice: {use_custom_voice}")
    print(f"Using reference audio: {ref_audio}")
    print(f"Using reference text: {ref_text}")

    device = args.device
    repo_id = args.repo_id

    print("Loading model architecture...")
    model = AutoModel.from_pretrained(repo_id, trust_remote_code=True)

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

    missing, unexpected = model.load_state_dict(fixed_state, strict=False)
    print(f"After prefix fix -> missing: {len(missing)}, unexpected: {len(unexpected)}")
    if len(missing) > 20:
        print("Still lots missing, sample:", missing[:10])

    model = model.to(device)
    model.eval()
    print("Model is on:", device)

    print("Generating...")
    start_time = time.time()

    result = transliterate.process("HK", "Devanagari", text)
    audio = model(result, ref_audio_path=ref_audio, ref_text=ref_text)
    print("Generated in", round(time.time() - start_time, 2), "s")

    if audio.dtype == np.int16:
        audio = audio.astype(np.float32) / 32768.0

    sf.write(args.output, audio, samplerate=args.samplerate)
    print(f"Done. Saved to {args.output}")


if __name__ == "__main__":
    main()
