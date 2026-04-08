import os
import google.generativeai as genai
from dotenv import load_dotenv

load_dotenv()

# Configure Gemini
api_key = os.getenv("GEMINI_API_KEY")
if api_key:
    genai.configure(api_key=api_key)

# Initialize model
model = genai.GenerativeModel("gemini-1.5-flash-latest")

def get_gemini_response(prompt: str, stream: bool = False):
    """
    General helper to get a response from Gemini.
    """
    if stream:
        return model.generate_content(prompt, stream=True)
    return model.generate_content(prompt)
