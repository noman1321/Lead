# 🎯 Agentic Lead Generation System

An intelligent lead generation system that uses AI agents to discover, enrich, and personalize outreach to potential leads. Built with Streamlit, LangChain, and advanced AI capabilities.

## Features

- **🤖 AI-Powered Lead Discovery**: Automatically searches for companies matching your criteria
- **📊 Lead Enrichment**: Scrapes websites to extract contact information and pain points
- **🔍 Intelligent Deduplication**: Ensures you never contact the same lead twice
- **✉️ AI Email Generation**: Creates personalized cold emails based on lead data
- **📧 Automated Email Sending**: Sends emails via SMTP
- **⏰ Follow-up Automation**: Automatically sends follow-up emails after 7 days
- **📈 Analytics Dashboard**: Track your lead generation performance

## Tech Stack

- **Frontend**: Streamlit
- **Backend**: Python (FastAPI patterns)
- **AI Framework**: LangChain + OpenAI
- **Search API**: Tavily (optional)
- **Scraping**: Firecrawl (optional) or BeautifulSoup
- **Database**: SQLite
- **Email**: SMTP (Gmail, Outlook, etc.)

## Installation

### 1. Clone or Navigate to the Project

```bash
cd Lead
```

### 2. Create a Virtual Environment

```bash
python -m venv venv

# On Windows:
venv\Scripts\activate

# On Mac/Linux:
source venv/bin/activate
```

### 3. Install Dependencies

```bash
pip install -r requirements.txt
```

### 4. Set Up Environment Variables

Create a `.env` file in the project root (copy from `.env.example`):

```env
# Required
OPENAI_API_KEY=your_openai_api_key_here

# Recommended
SERPAPI_API_KEY=your_serpapi_api_key_here

# Optional
TAVILY_API_KEY=your_tavily_api_key_here
FIRECRAWL_API_KEY=your_firecrawl_api_key_here

# Required for sending emails
SMTP_SERVER=smtp.gmail.com
SMTP_PORT=587
SMTP_USERNAME=your_email@gmail.com
SMTP_PASSWORD=your_app_password_here
EMAIL_FROM=your_email@gmail.com
```

### Getting API Keys

1. **OpenAI API Key**: Get from [OpenAI Platform](https://platform.openai.com/api-keys)
2. **SERP API Key** (recommended): Get from [SERP API](https://serpapi.com) - Provides Google search results
3. **Tavily API Key** (optional): Get from [Tavily](https://tavily.com) - Fallback search option
4. **Firecrawl API Key** (optional): Get from [Firecrawl](https://firecrawl.dev) - Enhanced web scraping

### SMTP Setup (Gmail Example)

1. Enable 2-factor authentication on your Gmail account
2. Generate an App Password:
   - Go to Google Account → Security → App passwords
   - Generate a new app password
   - Use this password in `SMTP_PASSWORD`

## Usage

### 1. Run the Application

```bash
streamlit run app.py
```

The app will open in your browser at `http://localhost:8501`

### 2. Discover Leads

1. Go to the **"🔍 Discover Leads"** tab
2. Enter a search query (e.g., "Find me mid-sized AI startups in London")
3. Optionally add context about your service/product
4. Click **"🚀 Discover Leads"**
5. Wait for the system to discover and enrich leads

### 3. Generate & Send Emails

1. Review discovered leads
2. Click **"✉️ Generate Email"** for each lead
3. Review and edit the generated email if needed
4. Click **"📤 Send Email"** to send

### 4. Manage Leads

1. Go to the **"📧 Manage Leads"** tab
2. View all leads, filter by status, search by email
3. View lead details, regenerate emails, mark as replied

### 5. Analytics

View your lead generation statistics in the **"📈 Analytics"** tab

## How It Works

### Lead Discovery Flow

1. **Discovery Agent**: Uses Tavily/LLM to search for companies matching your query
2. **Enrichment Agent**: Scrapes each company website using Firecrawl or BeautifulSoup
3. **Validation Agent**: Validates if the lead matches your criteria
4. **Deduplication**: Checks database to ensure lead hasn't been contacted before
5. **Storage**: Stores enriched lead data in SQLite database

### Email Generation

- Uses OpenAI to generate personalized emails
- Incorporates company information, pain points, and recent news
- Keeps emails concise (under 100 words) and professional

### Follow-up Automation

- When an email is sent, system schedules a follow-up for 7 days later
- Background scheduler checks for leads needing follow-up
- Sends follow-up email if no reply is detected
- Can be cancelled if lead replies (marked manually)

## Project Structure

```
Lead/
├── app.py                 # Main Streamlit application
├── config.py             # Configuration and API keys
├── database.py           # Database models and operations
├── agents.py             # AI agents (discovery, enrichment, validation)
├── email_generator.py    # AI email copywriter
├── email_sender.py       # SMTP email sending
├── scheduler.py          # Follow-up email scheduler
├── requirements.txt      # Python dependencies
├── .env.example          # Environment variables template
├── README.md            # This file
└── leads.db             # SQLite database (created automatically)
```

## Database Schema

The `leads` table stores:
- `id`: Unique identifier
- `email`: Lead email (unique)
- `name`: Contact name
- `company_name`: Company name
- `company_data`: JSON with scraped information
- `campaign_id`: Campaign identifier
- `status`: found, emailed, followed_up, replied
- `email_content`: Generated email text
- `follow_up_date`: Scheduled follow-up date
- `created_at`: Creation timestamp
- `last_contacted_at`: Last contact timestamp
- `sent_email_at`: When email was sent
- `has_replied`: Boolean flag for replies

## Customization

### Change Follow-up Period

Edit `config.py`:
```python
FOLLOW_UP_DAYS = 7  # Change to desired days
```

### Change LLM Model

Edit `.env`:
```env
LLM_MODEL=gpt-4o  # or claude-3-5-sonnet-20241022
```

### Customize Email Templates

Edit `email_generator.py` to modify the email generation prompt.

## Troubleshooting

### "API Key not set" Error

- Ensure your `.env` file exists and contains the required API keys
- Check that you've activated your virtual environment

### SMTP Authentication Failed

- For Gmail: Use an App Password, not your regular password
- Check that 2FA is enabled on your email account
- Verify SMTP server and port settings

### No Leads Found

- Try a more specific search query
- Check that Tavily API key is set (optional but helpful)
- Ensure OpenAI API key is valid

### Emails Not Sending

- Verify SMTP credentials
- Check firewall/network settings
- Ensure SMTP port is not blocked

## Future Enhancements

- [ ] Reply detection via email API
- [ ] Multi-email account support
- [ ] A/B testing for email templates
- [ ] Integration with CRM systems
- [ ] Advanced analytics and reporting
- [ ] Email template library
- [ ] Campaign management

## License

This project is for educational and business use.

## Support

For issues or questions, please check the code comments or raise an issue in your repository.

---

**Built with ❤️ using Streamlit, LangChain, and OpenAI**

