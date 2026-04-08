import random
import uuid
from datetime import datetime
import json
from fastapi import APIRouter, HTTPException
from app.models.requests import DemoBookRequest
from app.database import get_db_connection
from app.utils.mock_data import get_mock_trains

router = APIRouter()

def generate_mock_pnr():
    return str(random.randint(10**9, 10**10 - 1))

@router.get("/trains")
def trains_endpoint(from_code: str, to_code: str, date: str):
    """
    Return train list (mock for now, but structured for provider).
    """
    return {"trains": get_mock_trains(from_code, to_code)}

@router.post("/demo-book")
def demo_book_endpoint(payload: DemoBookRequest):
    """
    Create a demo booking (fake) and save to SQLite.
    """
    pnr = generate_mock_pnr()
    booking_id = str(uuid.uuid4())
    created_at = datetime.utcnow().isoformat()

    conn = get_db_connection()
    c = conn.cursor()
    c.execute(
        """
        INSERT INTO demo_bookings (id, pnr, train_no, train_name, from_code, to_code, date, class_type, passengers, contact, status, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            booking_id,
            pnr,
            payload.train_no,
            payload.train_name or "",
            payload.from_code,
            payload.to_code,
            payload.date,
            payload.class_type,
            json.dumps(payload.passengers),
            json.dumps(payload.contact) if payload.contact else "{}",
            "CONFIRMED_DEMO",
            created_at,
        ),
    )
    conn.commit()
    conn.close()

    return {
        "success": True,
        "message": "Demo booking created.",
        "booking": {
            "id": booking_id,
            "pnr": pnr,
            "status": "CONFIRMED_DEMO"
        }
    }

@router.get("/demo-book/{pnr}")
def get_demo_booking_endpoint(pnr: str):
    conn = get_db_connection()
    c = conn.cursor()
    c.execute("SELECT * FROM demo_bookings WHERE pnr = ?", (pnr,))
    row = c.fetchone()
    conn.close()
    if not row:
        raise HTTPException(status_code=404, detail="PNR not found")
    # In a real app we'd map this to a Pydantic model properly
    return {"pnr": pnr, "status": row[10]}
