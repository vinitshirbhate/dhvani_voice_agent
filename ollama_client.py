import json
import requests

from .config import OLLAMA_MODEL, OLLAMA_URL


def ollama_stream(prompt):
    response = requests.post(
        OLLAMA_URL,
        json={"model": OLLAMA_MODEL, "prompt": prompt, "stream": True},
        stream=True,
        timeout=600,
    )
    response.raise_for_status()

    for line in response.iter_lines():
        if not line:
            continue

        chunk = json.loads(line)
        if "response" in chunk:
            yield chunk["response"]

        if chunk.get("done"):
            break
