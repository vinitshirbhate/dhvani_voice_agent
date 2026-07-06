import glob
import os
import time

import numpy as np
import soundfile as sf

from .config import SAMPLE_RATE, SAFETY_MARGIN
from .ollama_client import ollama_stream
from .tts_engine import TTSStreamEngine


class StreamSpeaker:
    def __init__(self):
        self.engine = TTSStreamEngine()

    @staticmethod
    def extract_completed_sentences(buffer):
        completed = []
        start = 0
        i = 0

        while i < len(buffer):
            if buffer[i] in ".!?":
                sentence = buffer[start : i + 1].strip()
                if sentence:
                    completed.append(sentence)
                start = i + 1
                while start < len(buffer) and buffer[start].isspace():
                    start += 1
                i = start
                continue
            i += 1

        return completed, buffer[start:]

    def speak_from_ollama(self, prompt, ref_audio_path, ref_text, nfe_step=16, safety_margin=SAFETY_MARGIN):
        all_chunks = []
        next_play_time = time.time()
        pending_text = ""
        chunk_index = 0

        for chunk in ollama_stream(prompt):
            print(chunk, end="", flush=True)
            pending_text += chunk
            completed_sentences, pending_text = self.extract_completed_sentences(pending_text)

            for sentence in completed_sentences:
                audio, next_play_time = self.engine.speak_sentence(
                    sentence,
                    ref_audio_path=ref_audio_path,
                    ref_text=ref_text,
                    nfe_step=nfe_step,
                    safety_margin=safety_margin,
                    next_play_time=next_play_time,
                    chunk_index=chunk_index,
                )
                all_chunks.append(audio)
                chunk_index += 1

        if pending_text.strip():
            audio, next_play_time = self.engine.speak_sentence(
                pending_text.strip(),
                ref_audio_path=ref_audio_path,
                ref_text=ref_text,
                nfe_step=nfe_step,
                safety_margin=safety_margin,
                next_play_time=next_play_time,
                chunk_index=chunk_index,
            )
            all_chunks.append(audio)

        wait_needed = next_play_time - time.time()
        if wait_needed > 0:
            time.sleep(wait_needed)

        if all_chunks:
            full_audio = np.concatenate(all_chunks)
            sf.write("output.wav", full_audio, samplerate=SAMPLE_RATE)
            print("\nDone. Saved combined audio to output.wav")
        else:
            print("\nNo audio generated.")

        for temp_file in glob.glob("_stream_chunk_*.wav"):
            try:
                os.remove(temp_file)
            except OSError:
                pass
