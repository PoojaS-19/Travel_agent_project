from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
import os
from urllib.parse import quote_plus
from dotenv import load_dotenv

load_dotenv()

# MySQL Database Configuration
SQLALCHEMY_DATABASE_URL = (
    f"mysql+mysqlconnector://{quote_plus(os.getenv('DB_USER', 'root'))}:"
    f"{quote_plus(os.getenv('DB_PASSWORD', 'root'))}@"
    f"{os.getenv('DB_HOST', 'localhost')}:{os.getenv('DB_PORT', '3306')}/"
    f"{os.getenv('DB_NAME', 'travel_planner')}"
)

# Create engine
engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    echo=os.getenv("SQL_ECHO", "false").lower() == "true",
    pool_pre_ping=True,  # Verifies connection before use
    connect_args={"connection_timeout": int(os.getenv("DB_CONNECTION_TIMEOUT", "5"))},
)

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
