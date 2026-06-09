import sys
import os

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database import SessionLocal
from app.models import TrainStop

def check():
    db = SessionLocal()
    try:
        mangaon_stops = db.query(TrainStop).filter(TrainStop.station_name.ilike("%mangaon%")).distinct(TrainStop.station_code).all()
        print("Stations matching 'mangaon':")
        for s in mangaon_stops:
            print(f"  Name={s.station_name}, Code={s.station_code}")
    finally:
        db.close()

if __name__ == "__main__":
    check()
