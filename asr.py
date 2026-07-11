from transformers import pipeline

# Load the ASR pipeline
pipe = pipeline(
    task="automatic-speech-recognition",
    model="parthiv11/indic_whisper_nodcil",
    device="cuda:0"  
)

# Transcribe an audio file
result = pipe("audio.wav")

print(result["text"])