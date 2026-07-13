from functools import lru_cache

import torch

DEFAULT_MODEL_NAME = "openai/whisper-small"


def get_default_device():
    try:
        return "cuda" if torch.cuda.is_available() else "cpu"
    except Exception:
        return "cpu"


@lru_cache(maxsize=1)
def load_whisper_model(model_name=DEFAULT_MODEL_NAME, device=None):
    from transformers import WhisperForConditionalGeneration, WhisperProcessor

    resolved_device = device or get_default_device()
    processor = WhisperProcessor.from_pretrained(model_name)
    model = WhisperForConditionalGeneration.from_pretrained(model_name).to(resolved_device)
    return processor, model, resolved_device


def transcribe_audio(audio_path, language=None, model_name=DEFAULT_MODEL_NAME, device=None):
    import librosa

    processor, model, resolved_device = load_whisper_model(model_name=model_name, device=device)

    audio, sr = librosa.load(audio_path, sr=16000, mono=True)
    inputs = processor(audio, sampling_rate=16000, return_tensors="pt")
    input_features = inputs.input_features.to(resolved_device)

    generate_kwargs = {"task": "transcribe"}
    if language:
        generate_kwargs["language"] = language

    predicted_ids = model.generate(input_features, **generate_kwargs)
    return processor.batch_decode(predicted_ids, skip_special_tokens=True)[0]