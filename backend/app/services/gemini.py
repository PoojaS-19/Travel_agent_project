"""
Compatibility shim: previously used google-generativeai.
Now internally calls Groq so all callers (recommendation_service, etc.)
continue to work without any changes.
"""
import os
from dotenv import load_dotenv

load_dotenv(override=True)

from app.services.groq_service import get_groq_response as _groq_response, get_groq_stream as _groq_stream


class _FakeResponse:
    """Mimics the old Gemini response object so callers using .text still work."""
    def __init__(self, text: str):
        self.text = text


def get_gemini_response(prompt: str, stream: bool = False):
    """
    Drop-in replacement for the old Gemini helper.
    Returns a response object with a .text attribute (or a stream iterator).
    """
    if stream:
        return _groq_stream(prompt)
    text = _groq_response(prompt)
    return _FakeResponse(text)
