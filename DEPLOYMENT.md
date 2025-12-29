# Deployment Guide for Render

## Prerequisites

1. **GitHub Repository**: Your code should be pushed to GitHub
2. **Render Account**: Sign up at [render.com](https://render.com)

## Step 1: Create a New Web Service on Render

1. Go to your Render dashboard
2. Click "New +" → "Web Service"
3. Connect your GitHub repository
4. Select the repository: `noman1321/Lead`

## Step 2: Configure Build Settings

- **Name**: `lead-generation-system` (or any name you prefer)
- **Environment**: `Python 3`
- **Build Command**: `pip install -r requirements.txt`
- **Start Command**: `python run.py`

## Step 3: Set Environment Variables

In the Render dashboard, go to "Environment" tab and add these variables:

### Required:
```
OPENAI_API_KEY=your_openai_api_key_here
```

### Recommended (at least one):
```
SERPAPI_API_KEY=your_serpapi_key_here
```
OR
```
TAVILY_API_KEY=your_tavily_api_key_here
```

### Optional:
```
FIRECRAWL_API_KEY=your_firecrawl_api_key_here
```

### For Email Sending:
```
SMTP_SERVER=smtp.gmail.com
SMTP_PORT=587
SMTP_USERNAME=your_email@gmail.com
SMTP_PASSWORD=your_app_password
EMAIL_FROM=your_email@gmail.com
```

### Optional Configuration:
```
LLM_MODEL=gpt-4o-mini
DATABASE_PATH=/tmp/leads.db
PORT=8000
```

## Step 4: Deploy

1. Click "Create Web Service"
2. Render will automatically build and deploy your application
3. Wait for the build to complete (usually 2-5 minutes)

## Step 5: Verify Deployment

1. Once deployed, you'll get a URL like: `https://your-app-name.onrender.com`
2. Visit the health check endpoint: `https://your-app-name.onrender.com/health`
3. Check the logs in Render dashboard for any errors

## Troubleshooting

### 500 Internal Server Error

1. **Check Logs**: Go to Render dashboard → Logs tab
2. **Check Environment Variables**: Ensure all required API keys are set
3. **Check Health Endpoint**: Visit `/health` to see system status

### Common Issues:

#### "Agents not initialized"
- **Solution**: Make sure `OPENAI_API_KEY` is set in environment variables

#### "No search API configured"
- **Solution**: Set either `SERPAPI_API_KEY` or `TAVILY_API_KEY`

#### Database Errors
- **Solution**: The database file is created automatically. If you see database errors, check file permissions.

#### Port Issues
- **Solution**: Render automatically sets the PORT environment variable. Make sure your app uses `os.getenv("PORT", 8000)`

## Monitoring

- **Health Check**: `/health` endpoint shows system status
- **Logs**: View real-time logs in Render dashboard
- **Metrics**: Monitor CPU, memory, and network usage in Render dashboard

## Notes

- Render free tier has limitations (spins down after inactivity)
- Database is stored in `/tmp` which is ephemeral (data may be lost on restart)
- For production, consider using a persistent database service

