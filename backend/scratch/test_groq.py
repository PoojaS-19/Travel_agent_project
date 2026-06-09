import os
from dotenv import load_dotenv
from groq import Groq

load_dotenv()
api_key = os.getenv("GROQ_API_KEY")
print("API Key loaded:", api_key[:15] + "..." if api_key else "None")

try:
    client = Groq(api_key=api_key)
    completion = client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[{"role": "user", "content": "Hello"}],
        temperature=0.7,
        max_tokens=100,
    )
    print("Success! Response:")
    print(completion.choices[0].message.content)
except Exception as e:
    print("Error calling Groq API:")
    print(type(e))
    print(e)
