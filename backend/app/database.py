import sqlite3
import os

# Root project directory for the database
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DB_PATH = os.path.join(BASE_DIR, "demo_bookings.db")

def init_db():
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute(
        """
        CREATE TABLE IF NOT EXISTS demo_bookings (
          id TEXT PRIMARY KEY,
          pnr TEXT,
          train_no TEXT,
          train_name TEXT,
          from_code TEXT,
          to_code TEXT,
          date TEXT,
          class_type TEXT,
          passengers TEXT,
          contact TEXT,
          status TEXT,
          created_at TEXT
        )
        """
    )
    conn.commit()
    conn.close()

def get_db_connection():
    return sqlite3.connect(DB_PATH)
