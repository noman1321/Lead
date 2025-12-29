# Quick Start Guide

## 🚀 Getting Started in 3 Steps

### Step 1: Install Dependencies

```bash
pip install -r requirements.txt
```

### Step 2: Configure Environment

Create a `.env` file in the project root:

```env
OPENAI_API_KEY=your_openai_key
SERPAPI_API_KEY=your_serpapi_key
SMTP_SERVER=smtp.gmail.com
SMTP_PORT=587
SMTP_USERNAME=your_email@gmail.com
SMTP_PASSWORD=your_app_password
EMAIL_FROM=your_email@gmail.com
```

**Important for Gmail**: Use an [App Password](https://myaccount.google.com/apppasswords), not your regular password.

### Step 3: Run the Application

```bash
python run.py
```

Or directly:

```bash
python backend.py
```

Then open your browser:
- **Landing Page**: http://localhost:8000/
- **Application**: http://localhost:8000/app

## 🎯 What's New?

### Modern UI
- ✅ Beautiful landing page with smooth animations
- ✅ Responsive design that works on all devices
- ✅ Clean, modern dashboard interface
- ✅ Real-time updates and notifications

### All Original Features Preserved
- ✅ AI-powered lead discovery
- ✅ Lead enrichment and validation
- ✅ AI email generation (subject + body)
- ✅ Individual email sending
- ✅ Bulk email campaigns
- ✅ Campaign management
- ✅ Auto follow-ups (7-day)
- ✅ Analytics and statistics
- ✅ Delete leads (individual and bulk)

## 📋 Features Comparison

| Feature | Streamlit (Old) | FastAPI + Modern UI (New) |
|---------|----------------|---------------------------|
| Landing Page | ❌ | ✅ Beautiful, animated |
| UI Design | Basic | Modern, professional |
| Animations | ❌ | ✅ Smooth scroll, fade-ins |
| Mobile Friendly | Limited | ✅ Fully responsive |
| All Features | ✅ | ✅ Same functionality |
| Performance | Good | ✅ Faster, more efficient |

## 🎨 UI Highlights

- **Smooth Scrolling**: Elegant page transitions
- **Animations**: Fade-ins, slide-ins, hover effects
- **Modern Colors**: Professional gradient themes
- **Toast Notifications**: Beautiful success/error messages
- **Loading States**: Clear feedback during operations
- **Modal Dialogs**: Smooth popups for lead details

## 🔧 Troubleshooting

### Port Already in Use?
```bash
# Change port in run.py or backend.py
uvicorn backend:app --port 8080
```

### Static Files Not Loading?
- Ensure the `static/` folder exists
- Check file paths in browser console (F12)

### API Errors?
- Check all API keys in `.env`
- Verify SMTP credentials
- Check browser console for detailed errors

## 📚 Next Steps

1. **Test Email Configuration**: Click the email icon in the top bar
2. **Discover Leads**: Start with a simple query like "AI startups in San Francisco"
3. **Generate Emails**: Let AI create personalized emails
4. **Send & Track**: Monitor your campaigns in Analytics

Enjoy your new modern lead generation system! 🎉

