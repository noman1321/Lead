# Agentic Lead Generation System - FastAPI + Modern UI

A modern, AI-powered lead generation system with a beautiful web interface built with FastAPI and vanilla HTML/CSS/JavaScript.

## Features

- 🎯 **AI-Powered Lead Discovery** - Intelligent search and discovery using SERP API
- 📊 **Lead Enrichment** - Automatic scraping and contact extraction
- ✉️ **AI Email Generation** - Personalized emails with AI-generated subjects
- 📧 **Bulk Email Campaigns** - Send to multiple leads at once
- ⏰ **Auto Follow-ups** - Automated 7-day follow-up system
- 📈 **Campaign Management** - Organize leads by campaigns
- 🎨 **Modern UI** - Beautiful, responsive interface with animations
- 📱 **Mobile Friendly** - Works on all devices

## Tech Stack

- **Backend**: FastAPI (Python)
- **Frontend**: HTML5, CSS3, JavaScript (Vanilla)
- **Database**: SQLite
- **AI**: OpenAI GPT-4o-mini
- **Search**: SERP API (with Tavily fallback)
- **Scraping**: Firecrawl (with BeautifulSoup fallback)
- **Email**: SMTP

## Setup

### 1. Install Dependencies

```bash
pip install -r requirements.txt
```

### 2. Configure Environment Variables

Create a `.env` file in the root directory:

```env
# API Keys
OPENAI_API_KEY=your_openai_api_key
SERPAPI_API_KEY=your_serpapi_key
TAVILY_API_KEY=your_tavily_key  # Optional, fallback
FIRECRAWL_API_KEY=your_firecrawl_key  # Optional, fallback

# SMTP Configuration
SMTP_SERVER=smtp.gmail.com
SMTP_PORT=587
SMTP_USERNAME=your_email@gmail.com
SMTP_PASSWORD=your_app_password  # Use App Password for Gmail
EMAIL_FROM=your_email@gmail.com

# LLM Model (optional)
LLM_MODEL=gpt-4o-mini
```

**For Gmail users**: You need to create an [App Password](https://myaccount.google.com/apppasswords) instead of using your regular password.

### 3. Run the Application

```bash
python backend.py
```

Or using uvicorn directly:

```bash
uvicorn backend:app --reload --host 0.0.0.0 --port 8000
```

### 4. Access the Application

- **Landing Page**: http://localhost:8000/
- **Application**: http://localhost:8000/app

## Project Structure

```
Lead/
├── backend.py              # FastAPI backend
├── database.py             # Database models and operations
├── agents.py               # AI agents (discovery, enrichment, validation)
├── email_generator.py      # AI email generation
├── email_sender.py         # SMTP email sending
├── scheduler.py            # Follow-up scheduler
├── config.py               # Configuration
├── static/
│   ├── index.html         # Landing page
│   ├── app.html           # Main application
│   ├── css/
│   │   ├── landing.css    # Landing page styles
│   │   └── app.css        # Application styles
│   └── js/
│       ├── landing.js     # Landing page scripts
│       └── app.js         # Application scripts
├── leads.db               # SQLite database (created automatically)
└── .env                   # Environment variables (create this)
```

## Usage

### Discovering Leads

1. Go to the "Discover Leads" tab
2. Enter your search query (e.g., "Find me mid-sized AI startups in London")
3. Optionally set a campaign name
4. Set the maximum number of leads
5. Add context about your service/product
6. Click "Discover Leads"

### Generating Emails

1. After leads are discovered, click "Generate Email" for any lead
2. Review and edit the AI-generated subject and body
3. Click "Send Email" when ready

### Bulk Emails

1. Go to the "Bulk Email" tab
2. Select filters (status, campaign, exclude replied)
3. Add your service/product context
4. Customize the subject template
5. Confirm and send

### Managing Leads

1. Go to the "Manage Leads" tab
2. Filter by campaign or status
3. Search by email
4. View details, generate emails, or delete leads

## API Endpoints

All API endpoints are prefixed with `/api`:

- `GET /api/config` - Get configuration status
- `POST /api/leads/discover` - Discover new leads
- `GET /api/leads` - Get all leads (with filters)
- `GET /api/leads/{id}` - Get a single lead
- `DELETE /api/leads/{id}` - Delete a lead
- `DELETE /api/leads` - Delete all leads
- `POST /api/email/generate` - Generate email for a lead
- `POST /api/email/send` - Send email to a lead
- `POST /api/email/bulk` - Send bulk emails
- `POST /api/email/test` - Test email configuration
- `GET /api/campaigns` - Get all campaigns
- `GET /api/stats` - Get statistics

## Troubleshooting

### Email Sending Fails

1. Check your SMTP credentials in `.env`
2. For Gmail, ensure you're using an App Password
3. Test email configuration using the "Test Email" button in the sidebar
4. Check firewall/network settings for port 587/465

### No Leads Found

1. Check API keys (OpenAI, SERP API)
2. Try a different search query
3. Check the browser console for errors
4. Verify API quotas/limits

### Database Issues

- The database is created automatically on first run
- To reset, delete `leads.db` and restart the application

## License

MIT License

