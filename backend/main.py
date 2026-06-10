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
from app.routers.buses import router as buses_router
from app.routers.journal import router as journal_router
from app.routers.location import router as location_router

app = FastAPI(
    title="Travel Trip",
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
    print(">>> Startup event started", flush=True)
    try:
        print(">>> Calling Base.metadata.create_all()", flush=True)
        Base.metadata.create_all(bind=engine)
        print("Database tables created/verified successfully", flush=True)
        # Removed dynamic migrations to prevent Postgres deadlocks on startup.
    except Exception as e:
        print(f"Warning: Could not run startup database validation: {e}", flush=True)

# --- Root Endpoint ---
@app.get("/")
def home():
    return {"message": "Travel Trip API is working flawlessly!"}

# --- Router Registration ---
app.include_router(auth_router)
app.include_router(train_router, prefix="/api")
app.include_router(flights_router)
app.include_router(places_router)
app.include_router(reviews_router, prefix="/api")
app.include_router(collaboration_router)
app.include_router(itinerary_router)
app.include_router(buses_router)
app.include_router(journal_router)
app.include_router(location_router)

# --- WebSocket Route Registration ---
app.websocket("/ws/trips/{trip_id}")(websocket_trip_endpoint)

# Reload trigger comment (PostgreSQL SSL mode and load_dotenv override configured) & GROQ_API_KEY added)
