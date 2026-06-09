import os
import shutil
import uuid
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.models import TravelJournal, Itinerary
from app.routers.auth import get_current_user_id
from fastapi.responses import FileResponse

router = APIRouter(prefix="/api/journal", tags=["Travel Journal"])

UPLOAD_DIR = "uploads/journal"
os.makedirs(UPLOAD_DIR, exist_ok=True)

@router.post("/")
async def add_journal_entry(
    itinerary_id: int = Form(...),
    note: str = Form(None),
    location_name: str = Form(None),
    photo: UploadFile = File(None),
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    # check itinerary
    itinerary = db.query(Itinerary).filter(Itinerary.id == itinerary_id).first()
    if not itinerary:
        raise HTTPException(status_code=404, detail="Itinerary not found")
        
    photo_url = None
    if photo and photo.filename:
        ext = photo.filename.split('.')[-1]
        filename = f"{uuid.uuid4()}.{ext}"
        filepath = os.path.join(UPLOAD_DIR, filename)
        with open(filepath, "wb") as buffer:
            shutil.copyfileobj(photo.file, buffer)
        photo_url = f"/api/journal/photo/{filename}"
        
    entry = TravelJournal(
        user_id=user_id,
        itinerary_id=itinerary_id,
        note=note,
        photo_url=photo_url,
        location_name=location_name
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return entry

@router.get("/{itinerary_id}")
def get_journal(itinerary_id: int, db: Session = Depends(get_db)):
    entries = db.query(TravelJournal).filter(TravelJournal.itinerary_id == itinerary_id).order_by(TravelJournal.created_at.desc()).all()
    return entries

@router.get("/photo/{filename}")
def get_photo(filename: str):
    filepath = os.path.join(UPLOAD_DIR, filename)
    if os.path.exists(filepath):
        return FileResponse(filepath)
    raise HTTPException(status_code=404, detail="Photo not found")

@router.delete("/{entry_id}")
def delete_entry(entry_id: int, user_id: int = Depends(get_current_user_id), db: Session = Depends(get_db)):
    entry = db.query(TravelJournal).filter(TravelJournal.id == entry_id, TravelJournal.user_id == user_id).first()
    if not entry:
        raise HTTPException(status_code=404, detail="Entry not found or unauthorized")
    db.delete(entry)
    db.commit()
    return {"message": "Deleted successfully"}
