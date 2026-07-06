import os

os.environ.setdefault("HF_HUB_OFFLINE", "1")
os.environ.setdefault("TRANSFORMERS_OFFLINE", "1")
os.environ.setdefault("TORCHDYNAMO_DISABLE", "1")

DEVICE = "cuda" if os.environ.get("CUDA_VISIBLE_DEVICES") else "cpu"
REPO_ID = "ai4bharat/IndicF5"
SAMPLE_RATE = 24000
REF_AUDIO_PATH = "samples/mar.wav"
REF_TEXT = "भावा, डिझेल से धर घसरलेत वाटायत हो देयत, पुलकुरु तक्तक की."
DEFAULT_PROMPT = "मराठीत सांग की महाराष्ट्रातील तीन प्रसिद्ध किल्ल्यांची नावे कोणती आहेत?"
NFE_STEP = 16
SAFETY_MARGIN = 0.4
OLLAMA_URL = "http://localhost:11434/api/generate"
OLLAMA_MODEL = "gemma3:4b"
