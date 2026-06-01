from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
import os
from urllib.parse import quote_plus
from dotenv import load_dotenv

load_dotenv()

# MySQL Database Configuration
mysql_url = (
    f"mysql+mysqlconnector://{quote_plus(os.getenv('DB_USER', 'root'))}:"
    f"{quote_plus(os.getenv('DB_PASSWORD', 'root'))}@"
    f"{os.getenv('DB_HOST', 'localhost')}:{os.getenv('DB_PORT', '3306')}/"
    f"{os.getenv('DB_NAME', 'travel_planner')}"
)

sqlite_url = "sqlite:///./travel_planner.db"

DATABASE_TYPE = "MySQL"
engine = None

try:
    print("Attempting to connect to MySQL database...")
    # Using a 2-second timeout to avoid long startup delays if the server is offline
    mysql_timeout = int(os.getenv("DB_CONNECTION_TIMEOUT", "2"))
    engine = create_engine(
        mysql_url,
        echo=os.getenv("SQL_ECHO", "false").lower() == "true",
        pool_pre_ping=True,  # Verifies connection before use
        connect_args={"connection_timeout": mysql_timeout},
    )
    # Test connection immediately to trigger connection error if server is offline
    with engine.connect() as conn:
        pass
    print("Database Connection: MySQL connected successfully!")
except Exception as mysql_err:
    print(f"Warning: Could not connect to MySQL server ({mysql_err}).")
    print("Falling back to local SQLite database...")
    DATABASE_TYPE = "SQLite"
    
    # Create SQLite engine
    engine = create_engine(
        sqlite_url,
        echo=os.getenv("SQL_ECHO", "false").lower() == "true",
        connect_args={"check_same_thread": False},
    )
    print("Database Connection: SQLite engine initialized!")

# Session factory
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Base class for all models
Base = declarative_base()

def get_db():
    """Dependency for FastAPI to inject DB session"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

