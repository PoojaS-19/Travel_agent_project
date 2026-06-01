from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

# Database imports
from app.database import engine, Base

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
        with engine.connect() as conn:
            # Check and add otp_code column to trip_invitations if missing
            try:
                conn.execute(text("ALTER TABLE trip_invitations ADD COLUMN otp_code VARCHAR(6)"))
                conn.commit()
                print("Dynamic migration: Added 'otp_code' column to 'trip_invitations'")
            except Exception:
                # Column already exists, safe to ignore
                pass
                
    except Exception as e:
        print(f"Warning: Could not run startup database validation/migrations: {e}")

# --- Root Endpoint ---
@app.get("/")
def home():
    return {"message": "AI Travel Agent API is working flawlessly!"}

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
