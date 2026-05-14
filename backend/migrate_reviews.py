"""
Database migration script for adding place_reviews table.
Run this script to add the new table to your database.
"""
from app.database import engine, Base
from app.models.models import PlaceReview

def run_migration():
    """Create the place_reviews table"""
    try:
        # Create the table
        PlaceReview.__table__.create(engine, checkfirst=True)
        print("✓ Migration successful: place_reviews table created")
    except Exception as e:
        print(f"✗ Migration failed: {e}")

if __name__ == "__main__":
    run_migration()