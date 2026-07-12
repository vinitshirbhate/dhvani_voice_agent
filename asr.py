import torch
import librosa
from transformers import WhisperProcessor, WhisperForConditionalGeneration

import transformers


# Device
DEVICE = "cuda" if torch.cuda.is_available() else "cpu"
print("Using:", DEVICE)

# Load multilingual Whisper model
MODEL_NAME = "openai/whisper-small"

processor = WhisperProcessor.from_pretrained(MODEL_NAME)
model = WhisperForConditionalGeneration.from_pretrained(MODEL_NAME).to(DEVICE)

# Load audio (Whisper expects 16 kHz mono)
audio, sr = librosa.load("gemma_tts\samples\hindi.wav", sr=16000, mono=True)

print(f"Sample rate: {sr}")
print(f"Duration: {len(audio)/sr:.2f} seconds")

# Create input features
inputs = processor(
    audio,
    sampling_rate=16000,
    return_tensors="pt"
)

input_features = inputs.input_features.to(DEVICE)

# Generate Marathi transcription
predicted_ids = model.generate(
    input_features,
    language="mr",
    task="transcribe"
)

# Decode
transcription = processor.batch_decode(
    predicted_ids,
    skip_special_tokens=True
)[0]

print("\nTranscription:")
print(transcription)


print("Transformers:", transformers.__version__)
print("Torch:", torch.__version__)
print("Duration:", len(audio)/sr)
print("Model:", MODEL_NAME)