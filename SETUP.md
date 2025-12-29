# Quick Setup Guide

## Step 1: Install Dependencies

```bash
# Activate your virtual environment first
pip install -r requirements.txt
```

## Step 2: Create .env File

Create a `.env` file in the project root with:

```env
OPENAI_API_KEY=sk-...
SERPAPI_API_KEY=your_serpapi_api_key_here
SMTP_USERNAME=your_email@gmail.com
SMTP_PASSWORD=your_app_password
EMAIL_FROM=your_email@gmail.com
```

### Getting Your Gmail App Password

1. Go to [Google Account Security](https://myaccount.google.com/security)
2. Enable 2-Step Verification (if not already enabled)
3. Go to "App passwords"
4. Create a new app password for "Mail"
5. Use this 16-character password in your `.env` file

## Step 3: Run the Application

```bash
streamlit run app.py
```

Or use the convenience script:
- Windows: `run.bat`
- Mac/Linux: `chmod +x run.sh && ./run.sh`

## Step 4: Start Generating Leads

1. Enter a search query like: "AI startups in San Francisco"
2. Add context about your service
3. Click "Discover Leads"
4. Generate and send emails!

## Troubleshooting

### "Module not found" error
- Make sure you've activated your virtual environment
- Run `pip install -r requirements.txt` again

### "API Key not set" error
- Check that your `.env` file is in the project root
- Verify the API key is correct (no extra spaces)

### SMTP errors
- Use App Password for Gmail (not your regular password)
- Check that SMTP port 587 is not blocked by your firewall

### No leads found
- Try a more specific search query
- Check your OpenAI API key is valid and has credits
- Verify SERP API key is set correctly (get free key from serpapi.com)

