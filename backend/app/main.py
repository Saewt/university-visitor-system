from fastapi import FastAPI, Query, HTTPException, status, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, JSONResponse
from fastapi.exceptions import RequestValidationError
from contextlib import asynccontextmanager
from slowapi import Limiter
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware

from .config import get_settings
from .database import init_db
from .routers import students, stats, export, auth, management
from .services.sse import manager

settings = get_settings()

# Rate limiter setup
limiter = Limiter(key_func=get_remote_address)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    init_db()
    # Seed database with default data
    from .seeds import seed_database
    seed_database()
    yield
    # Shutdown
    # Close any connections if needed


app = FastAPI(
    title="University Visitor Registration API",
    description="API for university open day visitor registration system",
    version="1.0.0",
    lifespan=lifespan,
)

# Add slowapi middleware
app.state.limiter = limiter
app.add_middleware(SlowAPIMiddleware)

# Rate limit exception handler
@app.exception_handler(RateLimitExceeded)
async def rate_limit_exception_handler(request: Request, exc: RateLimitExceeded):
    return JSONResponse(
        status_code=status.HTTP_429_TOO_MANY_REQUESTS,
        content={
            "detail": "Çok fazla başarısız giriş denemesi. Lütfen 15 dakika sonra tekrar deneyin."
        }
    )

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        settings.frontend_url,
        "http://localhost:5173",
        "http://127.0.0.1:5173"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(auth.router, prefix="/api/auth", tags=["Authentication"])
app.include_router(students.router, prefix="/api/students", tags=["Students"])
app.include_router(stats.router, prefix="/api/stats", tags=["Statistics"])
app.include_router(export.router, prefix="/api/export", tags=["Export"])
app.include_router(management.router, prefix="/api/management", tags=["Management"])


@app.get("/")
async def root():
    return {
        "message": "University Visitor Registration API",
        "version": "1.0.0",
        "docs": "/docs",
        "environment": settings.environment
    }


@app.get("/health")
async def health_check():
    return {"status": "healthy", "timestamp": True}


@app.get("/api/health")
async def api_health_check():
    """Health check endpoint for frontend offline detection"""
    return {"status": "ok", "timestamp": True}


@app.get("/api/events")
async def events(
    request: Request,
    token: str = Query(..., description="JWT authentication token")
):
    """SSE endpoint for real-time updates (requires authentication)"""
    from .routers.auth import get_current_user_from_token
    from sqlalchemy.orm import Session
    from .database import get_db

    # Verify token
    db = next(get_db())
    try:
        current_user = await get_current_user_from_token(token, db)
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials"
        )
    finally:
        db.close()

    return StreamingResponse(
        manager.event_generator(current_user.id),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"
        }
    )


# Global exception handler for validation errors
@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request, exc):
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={"detail": exc.errors(), "body": exc.body}
    )
