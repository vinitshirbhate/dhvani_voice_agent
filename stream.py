from .config import DEFAULT_PROMPT, REF_AUDIO_PATH, REF_TEXT
from .streaming import StreamSpeaker


def main():
    speaker = StreamSpeaker()
    speaker.speak_from_ollama(
        DEFAULT_PROMPT,
        REF_AUDIO_PATH,
        REF_TEXT,
        nfe_step=16,
    )


if __name__ == "__main__":
    main()
