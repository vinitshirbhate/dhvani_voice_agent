# IndicF5 TTS for Hindi and Marathi

This project provides a simple text-to-speech workflow for Hindi and Marathi using the IndicF5 model. It currently supports:

- a command-line interface for generating WAV files
- a FastAPI server for HTTP-based synthesis
- custom voice mode using a reference audio file and optional ASR transcription

## Requirements

- Python 3.10
- ffmpeg (required for converting non-WAV reference audio)
- GPU is recommended for faster inference

## Installation

```bash
conda create -n indicf5 python=3.10 -y
conda activate indicf5
pip install git+https://github.com/ai4bharat/IndicF5.git
pip install -r requirement.txt
conda env update -f environment.yml
```

If ffmpeg is not installed, install it before using custom audio input.

## CLI usage

Generate speech from the command line:

```bash
python main.py "नमस्ते दुनिया" --lang hindi --output output.wav
```

Example for Marathi:

```bash
python main.py "भावा, डिझेल से धर घसरलेत वाटायत हो देयत." --lang marathi --ref-audio samples/mar.wav
```

Useful options:

- `--lang`: `hindi` or `marathi`
- `--ref-audio`: path to a reference audio file
- `--ref-text`: style/reference text for the voice
- `--output`: output WAV path
- `--device`: `cuda` or `cpu`

## API server

Start the FastAPI server:

```bash
python server.py
```

Or with Uvicorn directly:

```bash
uvicorn server:app --host 0.0.0.0 --port 8000
```

Available endpoints:

- `GET /health`
- `GET /model-info`
- `POST /synthesize`
- `POST /synthesize-and-download`

Example request:

```bash
curl -X POST http://localhost:8000/synthesize \
  -H "Content-Type: application/json" \
  -d '{"text": "नमस्ते", "audio_type": "hindi"}'
```

## Custom voice mode

Set `audio_type` to `custom` and provide either:

- an uploaded audio file, or
- a `ref_audio` path

The server will try to transcribe the audio and use it as the reference text when available.

## Project files

- `main.py`: CLI entry point
- `server.py`: FastAPI service for synthesis
- `asr.py`: speech-to-text support for custom audio
- `samples/`: bundled reference audio and sample assets
