import os
os.environ["TORCHDYNAMO_DISABLE"] = "1"

import time
import numpy as np
import soundfile as sf
import torch
from transformers import AutoModel
from huggingface_hub import list_repo_files, hf_hub_download

print("Starting...")
device = "cuda" if torch.cuda.is_available() else "cpu"
repo_id = "ai4bharat/IndicF5"

print("Loading model architecture...")
model = AutoModel.from_pretrained(repo_id, trust_remote_code=True)

# --- Fix the _orig_mod. prefix mismatch caused by disabling torch.compile ---
print("Locating checkpoint file in repo...")
files = list_repo_files(repo_id)
ckpt_candidates = [f for f in files if f.endswith((".safetensors", ".bin", ".pt")) and "vocos" not in f.lower()]
print("Found candidate checkpoint files:", ckpt_candidates)

ckpt_file = ckpt_candidates[0]  # adjust index if multiple show up and the wrong one is picked
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
t = time.time()
audio = model(
    "आज सर्व शिक्षा अभियान चे सर्व कर्मचारी पर्मनंट झालेत.",
    ref_audio_path="vivek.wav",
    ref_text="अरे call चालू छै अजून?"
)
print("Generated in", round(time.time() - t, 2), "s")

if audio.dtype == np.int16:
    audio = audio.astype(np.float32) / 32768.0

sf.write("output.wav", audio, samplerate=24000)
print("Done. Saved to output.wav")