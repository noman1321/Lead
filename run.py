#!/usr/bin/env python
"""
Startup script for the Lead Generation System
"""
import uvicorn
import sys

if __name__ == "__main__":
    print("🚀 Starting Agentic Lead Generation System...")
    print("📍 Landing Page: http://localhost:8000/")
    print("📍 Application: http://localhost:8000/app")
    print("📍 API Docs: http://localhost:8000/docs")
    print("\nPress Ctrl+C to stop the server.\n")
    
    try:
        uvicorn.run(
            "backend:app",
            host="0.0.0.0",
            port=8000,
            reload=True,
            log_level="info"
        )
    except KeyboardInterrupt:
        print("\n\n👋 Shutting down... Goodbye!")
        sys.exit(0)

