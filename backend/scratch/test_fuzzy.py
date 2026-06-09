import sys
import os
import difflib

# Add parent directory to path so we can import app
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database import SessionLocal
from app.models import TrainStop

def search_stations_test(query: str):
    db = SessionLocal()
    try:
        # 1. Try exact ilike query
        results = db.query(TrainStop.station_name, TrainStop.station_code).\
            filter(
                (TrainStop.station_name.ilike(f"%{query}%")) | 
                (TrainStop.station_code.ilike(f"%{query}%"))
            ).\
            distinct().\
            limit(15).\
            all()
        
        if results:
            print("Exact search results found:")
            for r in results:
                print(f"  {r.station_name} ({r.station_code})")
            return

        # 2. Try fuzzy search query with ranking
        # Create a pattern by replacing vowels with %
        vowels = "aeiouy"
        chars = []
        for char in query.lower():
            if char in vowels:
                if not chars or chars[-1] != '%':
                    chars.append('%')
            else:
                chars.append(char)
        pattern = "%" + "%".join(chars) + "%"
        while "%%" in pattern:
            pattern = pattern.replace("%%", "%")
            
        print(f"No exact results. Trying fuzzy pattern: {pattern}")
        
        # Get up to 300 candidates to rank in memory (which is very fast)
        results = db.query(TrainStop.station_name, TrainStop.station_code).\
            filter(
                (TrainStop.station_name.ilike(pattern)) | 
                (TrainStop.station_code.ilike(pattern))
            ).\
            distinct().\
            limit(300).\
            all()
            
        # Rank by similarity to the query
        ranked_results = []
        for r in results:
            # We compare the query to both the station name and code
            name_score = difflib.SequenceMatcher(None, query.upper(), r.station_name).ratio()
            code_score = difflib.SequenceMatcher(None, query.upper(), r.station_code).ratio()
            best_score = max(name_score, code_score)
            
            # Boost if name starts with the same letter
            if r.station_name and r.station_name.upper().startswith(query[0].upper()):
                best_score += 0.2
            
            ranked_results.append((r, best_score))
            
        # Sort by score descending
        ranked_results.sort(key=lambda x: x[1], reverse=True)
        
        print("\nRanked Fuzzy search results (Top 15):")
        for r, score in ranked_results[:15]:
            print(f"  {r.station_name} ({r.station_code}) [score: {score:.3f}]")
            
    finally:
        db.close()

if __name__ == "__main__":
    search_stations_test("mangoan")
