import os
import time

import numpy as np
import soundfile as sf
import torch
import winsound
from huggingface_hub import hf_hub_download
from safetensors.torch import load_file
from transformers import AutoModel
from f5_tts.infer.utils_infer import infer_process, preprocess_ref_audio_text

from .config import DEVICE, NFE_STEP, REF_AUDIO_PATH, REF_TEXT, REPO_ID, SAMPLE_RATE


class TTSStreamEngine:
    def __init__(self):
        print("Loading model architecture...")
        self.device = DEVICE
        self.model = AutoModel.from_pretrained(REPO_ID, trust_remote_code=True)

        ckpt_path = hf_hub_download(REPO_ID, filename="model.safetensors", local_files_only=True)
        raw_state = load_file(ckpt_path, device="cpu")
        fixed_state = {k.replace("_orig_mod.", ""): v for k, v in raw_state.items()}
        self.model.load_state_dict(fixed_state, strict=False)
        self.model = self.model.to(self.device)
        self.model.eval()
        print("Model is on:", self.device)

    def generate_fast(self, text, ref_audio_path=REF_AUDIO_PATH, ref_text=REF_TEXT, nfe_step=NFE_STEP, speed=1.0):
        ref_audio, ref_text_processed = preprocess_ref_audio_text(ref_audio_path, ref_text)

        audio, final_sample_rate, _ = infer_process(
            ref_audio,
            ref_text_processed,
            text,
            self.model.ema_model,
            self.model.vocoder,
            mel_spec_type="vocos",
            speed=speed,
            nfe_step=nfe_step,
            device=self.device,
        )
        return audio, final_sample_rate

    def speak_sentence(self, sentence, ref_audio_path=REF_AUDIO_PATH, ref_text=REF_TEXT, nfe_step=NFE_STEP, safety_margin=0.4, next_play_time=None, chunk_index=0):
        print("Generating:", sentence)
        t = time.time()
        audio, sr = self.generate_fast(sentence, ref_audio_path=ref_audio_path, ref_text=ref_text, nfe_step=nfe_step)
        if audio.dtype == np.int16:
            audio = audio.astype(np.float32) / 32768.0

        duration = len(audio) / sr
        print(f"Generated in {time.time() - t:.2f}s, audio is {duration:.2f}s long")

        temp_path = f"_stream_chunk_{chunk_index}.wav"
        sf.write(temp_path, audio, samplerate=sr)

        if next_play_time is None:
            next_play_time = time.time()

        wait_needed = next_play_time - time.time()
        if wait_needed > 0:
            time.sleep(wait_needed)

        print("Playing:", sentence)
        winsound.PlaySound(temp_path, winsound.SND_FILENAME | winsound.SND_ASYNC)
        next_play_time = time.time() + duration + safety_margin

        return audio, next_play_time
