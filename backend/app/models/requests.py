from pydantic import BaseModel
from typing import List, Optional

class IncidentRequest(BaseModel):
    lat: float
    lon: float

class DemoBookRequest(BaseModel):
    train_no: str
    train_name: Optional[str] = ""
    from_code: str
    to_code: str
    date: str
    class_type: Optional[str] = "SL"
    passengers: List[dict]
    contact: Optional[dict] = None

class ItineraryRequest(BaseModel):
    start_city: Optional[str] = "your current location"
    destination: str
    days: int = 1
    theme: Optional[str] = "General"
    preferences: Optional[str] = ""
    start_date: Optional[str] = None
    language: Optional[str] = "English"

class ChatbotRequest(BaseModel):
    question: str
    lat: Optional[float] = None
    lon: Optional[float] = None
    language: Optional[str] = "English"
    history: Optional[List[dict]] = []
