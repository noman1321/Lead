# Email Sending Troubleshooting Guide

## Common Issues and Solutions

### 1. ❌ "SMTP credentials not configured"
**Problem:** SMTP_USERNAME or SMTP_PASSWORD not set in .env file

**Solution:**
- Open your `.env` file
- Add these lines:
  ```
  SMTP_USERNAME=your_email@gmail.com
  SMTP_PASSWORD=your_app_password
  EMAIL_FROM=your_email@gmail.com
  ```

### 2. ❌ "SMTP authentication failed" (Most Common for Gmail)
**Problem:** Using regular password instead of App Password

**Solution for Gmail:**
1. Go to [Google Account Security](https://myaccount.google.com/security)
2. Enable **2-Step Verification** (if not already enabled)
3. Go to [App Passwords](https://myaccount.google.com/apppasswords)
4. Select "Mail" and "Other (Custom name)"
5. Enter "Lead Generation System" as the name
6. Click "Generate"
7. Copy the 16-character password (e.g., `abcd efgh ijkl mnop`)
8. Use this password in your `.env` file (remove spaces):
   ```
   SMTP_PASSWORD=abcdefghijklmnop
   ```

**Important:** Use the App Password, NOT your regular Gmail password!

### 3. ❌ "Could not connect to SMTP server"
**Problem:** Wrong SMTP server or port, or firewall blocking

**Solutions:**
- **For Gmail:**
  - SMTP_SERVER: `smtp.gmail.com`
  - SMTP_PORT: `587` (TLS) or `465` (SSL)
  
- **For Outlook/Hotmail:**
  - SMTP_SERVER: `smtp-mail.outlook.com`
  - SMTP_PORT: `587`

- **For Yahoo:**
  - SMTP_SERVER: `smtp.mail.yahoo.com`
  - SMTP_PORT: `587` or `465`

- Check firewall/antivirus isn't blocking the connection
- Check your internet connection

### 4. ❌ "Recipient email rejected"
**Problem:** Invalid email address format

**Solution:**
- Check that the email address is valid (contains @ and valid domain)
- Ensure no extra spaces in the email address

### 5. ❌ General SMTP Errors
**Problem:** Various SMTP server errors

**Solution:**
1. Run the test script:
   ```bash
   python test_email.py
   ```
2. Check the detailed error message
3. Verify your .env file has correct settings
4. Try sending from a different network (some corporate networks block SMTP)

## Testing Your Email Configuration

### Method 1: Use the Test Button in the App
1. Open the app sidebar
2. Scroll to "Email Configuration Test"
3. Click "📧 Test Email Configuration"
4. Check if you receive a test email

### Method 2: Run the Test Script
```bash
python test_email.py
```

## Example .env Configuration (Gmail)

```env
SMTP_SERVER=smtp.gmail.com
SMTP_PORT=587
SMTP_USERNAME=your.email@gmail.com
SMTP_PASSWORD=abcdefghijklmnop
EMAIL_FROM=your.email@gmail.com
```

## Example .env Configuration (Outlook)

```env
SMTP_SERVER=smtp-mail.outlook.com
SMTP_PORT=587
SMTP_USERNAME=your.email@outlook.com
SMTP_PASSWORD=YourPassword
EMAIL_FROM=your.email@outlook.com
```

## Still Having Issues?

1. Check the error message in the app - it now shows detailed information
2. Verify your .env file is in the project root directory
3. Restart the Streamlit app after changing .env file
4. Check that no spaces are around the = sign in .env file
5. For Gmail: Make sure you're using App Password, not regular password

