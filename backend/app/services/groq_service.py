import os
from groq import Groq
from dotenv import load_dotenv

load_dotenv(override=True)

# Initialize Groq client
GROQ_API_KEY = os.getenv("GROQ_API_KEY")
GROQ_MODEL = "llama-3.1-8b-instant"

client = Groq(api_key=GROQ_API_KEY) if GROQ_API_KEY else None


def get_groq_response(prompt: str) -> str:
    """
    Get a text response from Groq. Returns the response text string.
    """
    if not client:
        raise RuntimeError("GROQ_API_KEY is not set in environment variables.")

    completion = client.chat.completions.create(
        model=GROQ_MODEL,
        messages=[{"role": "user", "content": prompt}],
        temperature=0.7,
        max_tokens=2500,
    )
    return completion.choices[0].message.content


def get_groq_stream(prompt: str):
    """
    Get a streaming response from Groq. Yields text chunks.
    """
    if not client:
        raise RuntimeError("GROQ_API_KEY is not set in environment variables.")

    stream = client.chat.completions.create(
        model=GROQ_MODEL,
        messages=[{"role": "user", "content": prompt}],
        temperature=0.7,
        max_tokens=2500,
        stream=True,
    )
    for chunk in stream:
        delta = chunk.choices[0].delta.content
        if delta:
            yield delta
