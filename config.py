"""
Configuration file for the Lead Generation System
Store your API keys here or use environment variables
"""
import os
from dotenv import load_dotenv

load_dotenv()

# API Keys - Set these in your .env file or environment variables
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
SERPAPI_API_KEY = os.getenv("SERPAPI_API_KEY", "")
TAVILY_API_KEY = os.getenv("TAVILY_API_KEY", "")
FIRECRAWL_API_KEY = os.getenv("FIRECRAWL_API_KEY", "")

# SMTP Configuration for sending emails
SMTP_SERVER = os.getenv("SMTP_SERVER", "smtp.gmail.com")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USERNAME = os.getenv("SMTP_USERNAME", "")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "")  # Use App Password for Gmail
EMAIL_FROM = os.getenv("EMAIL_FROM", "")

# Database
DATABASE_PATH = "leads.db"

# LLM Configuration
LLM_MODEL = os.getenv("LLM_MODEL", "gpt-4o-mini")  # or "gpt-4o" or "claude-3-5-sonnet-20241022"

# Follow-up settings
FOLLOW_UP_DAYS = 7

