from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy import text
import os

# Database imports
from app.database import engine, Base

# Create uploads folder if not exists
os.makedirs("uploads", exist_ok=True)


# Router imports
from app.routes.train_routes import router as train_router
from app.routers.auth import router as auth_router
from app.routers.flights import router as flights_router
from app.routers.places import router as places_router
from app.routers.reviews import router as reviews_router
from app.routers.collaboration import router as collaboration_router, websocket_trip_endpoint
from app.routers.itinerary import router as itinerary_router

app = FastAPI(
    title="AI Travel Agent & Collaborative Planner",
    description="A modern production-ready full-stack travel assistant.",
    version="1.0.0"
)

# CORS Middleware Configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
async def startup_event():
    """Create database tables and execute dynamic schema updates on startup."""
    try:
        Base.metadata.create_all(bind=engine)
        print("Database tables created/verified successfully")
        
        # Run dynamic migrations to ensure schema compatibility
        # Check and add otp_code column to trip_invitations if missing
        try:
            with engine.begin() as conn:
                conn.execute(text("ALTER TABLE trip_invitations ADD COLUMN otp_code VARCHAR(6)"))
                print("Dynamic migration: Added 'otp_code' column to 'trip_invitations'")
        except Exception:
            pass

        # Check and add columns to place_reviews if missing
        place_reviews_cols = [
            ("review_title", "VARCHAR(200)"),
            ("additional_notes", "TEXT"),
            ("would_visit_again", "BOOLEAN"),
            ("traveler_type", "VARCHAR(50)"),
            ("verified_status", "BOOLEAN DEFAULT FALSE"),
            ("rating_safety", "INTEGER"),
            ("rating_cleanliness", "INTEGER"),
            ("rating_crowd", "INTEGER"),
            ("rating_accessibility", "INTEGER"),
            ("rating_scenic", "INTEGER"),
            ("rating_family", "INTEGER"),
            ("rating_food", "INTEGER"),
            ("rating_transport", "INTEGER"),
            ("rating_value", "INTEGER"),
        ]
        for col_name, col_type in place_reviews_cols:
            try:
                with engine.begin() as conn:
                    conn.execute(text(f"ALTER TABLE place_reviews ADD COLUMN {col_name} {col_type}"))
                    print(f"Dynamic migration: Added '{col_name}' column to 'place_reviews'")
            except Exception:
                pass

        # Check and add is_admin column to users if missing
        try:
            with engine.begin() as conn:
                conn.execute(text("ALTER TABLE users ADD COLUMN is_admin BOOLEAN DEFAULT FALSE"))
                print("Dynamic migration: Added 'is_admin' column to 'users'")
        except Exception:
            pass


                
    except Exception as e:
        print(f"Warning: Could not run startup database validation/migrations: {e}")

# --- Root Endpoint ---
@app.get("/")
def home():
    return {"message": "AI Travel Agent API is working flawlessly!"}

@app.get("/smtp-test")
def smtp_test():
    import socket
    import os
    from dotenv import load_dotenv
    load_dotenv()
    
    smtp_host = os.getenv("SMTP_HOST", "smtp.gmail.com")
    smtp_port_str = os.getenv("SMTP_PORT", "587")
    smtp_port = int(smtp_port_str) if smtp_port_str.isdigit() else 587
    smtp_username = os.getenv("SMTP_USERNAME")
    smtp_password = os.getenv("SMTP_PASSWORD")
    
    results = {
        "configured_host": smtp_host,
        "configured_port": smtp_port,
        "has_username": bool(smtp_username),
        "has_password": bool(smtp_password),
        "dns_resolution": {},
        "tcp_connection": {}
    }
    
    # 1. Test DNS Resolution
    try:
        ip_addresses = socket.getaddrinfo(smtp_host, smtp_port)
        resolved_ips = list(set([ip[4][0] for ip in ip_addresses]))
        results["dns_resolution"] = {
            "status": "success",
            "resolved_ips": resolved_ips
        }
    except Exception as e:
        results["dns_resolution"] = {
            "status": "failed",
            "error": str(e)
        }
        
    # 2. Test TCP connection
    try:
        print(f"[SMTP-DIAGNOSTIC] Attempting socket connection to {smtp_host}:{smtp_port}")
        with socket.create_connection((smtp_host, smtp_port), timeout=10) as sock:
            # Try to read the initial banner from the SMTP server
            banner = sock.recv(1024).decode('utf-8', errors='ignore')
            results["tcp_connection"] = {
                "status": "success",
                "message": "TCP Connection established successfully!",
                "smtp_banner": banner.strip()
            }
    except Exception as e:
        results["tcp_connection"] = {
            "status": "failed",
            "error": str(e),
            "error_type": type(e).__name__
        }
        
    return results

# --- Mount Uploads ---
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

# --- Router Registration ---
app.include_router(auth_router)
app.include_router(train_router, prefix="/api")
app.include_router(flights_router)
app.include_router(places_router)
app.include_router(reviews_router, prefix="/api")
app.include_router(collaboration_router)
app.include_router(itinerary_router)

# --- WebSocket Route Registration ---
app.add_api_websocket_route("/ws/trips/{trip_id}", websocket_trip_endpoint)
