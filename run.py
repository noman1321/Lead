#!/usr/bin/env python
"""
Startup script for the Lead Generation System
"""
import uvicorn
import sys
import os

if __name__ == "__main__":
    # Get port from environment variable (for Render/Heroku) or use default
    port = int(os.getenv("PORT", 8000))
    
    print("🚀 Starting Agentic Lead Generation System...")
    print(f"📍 Landing Page: http://localhost:{port}/")
    print(f"📍 Application: http://localhost:{port}/app")
    print(f"📍 API Docs: http://localhost:{port}/docs")
    print(f"📍 Health Check: http://localhost:{port}/health")
    print("\nPress Ctrl+C to stop the server.\n")
    
    try:
        uvicorn.run(
            "backend:app",
            host="0.0.0.0",
            port=port,
            reload=os.getenv("ENVIRONMENT") != "production",  # Disable reload in production
            log_level="info"
        )
    except KeyboardInterrupt:
        print("\n\n👋 Shutting down... Goodbye!")
        sys.exit(0)

