#!/usr/bin/env python3
"""
Development server runner for the University Visitor Registration System
"""

import uvicorn
from app.config import get_settings

settings = get_settings()

if __name__ == "__main__":
    print("🚀 Starting University Visitor Registration API...")
    print(f"📝 Environment: {settings.environment}")
    print(f"🌐 URL: http://localhost:8000")
    print(f"📚 Docs: http://localhost:8000/docs")
    print("-" * 50)

    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info"
    )
