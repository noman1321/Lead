"""
Test script to verify SMTP configuration
Run this to test your email settings
"""
import config
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

def test_smtp_connection():
    """Test SMTP connection and authentication"""
    print("=" * 60)
    print("Testing SMTP Configuration")
    print("=" * 60)
    
    # Check configuration
    print(f"\n1. Checking configuration...")
    print(f"   SMTP Server: {config.SMTP_SERVER}")
    print(f"   SMTP Port: {config.SMTP_PORT}")
    print(f"   SMTP Username: {config.SMTP_USERNAME if config.SMTP_USERNAME else 'NOT SET'}")
    print(f"   SMTP Password: {'SET' if config.SMTP_PASSWORD else 'NOT SET'}")
    print(f"   Email From: {config.EMAIL_FROM if config.EMAIL_FROM else 'NOT SET'}")
    
    if not config.SMTP_USERNAME or not config.SMTP_PASSWORD:
        print("\n❌ ERROR: SMTP_USERNAME or SMTP_PASSWORD not set!")
        print("   Please set these in your .env file")
        return False
    
    if not config.EMAIL_FROM:
        print("\n⚠️  WARNING: EMAIL_FROM not set, will use SMTP_USERNAME")
    
    # Test connection
    print(f"\n2. Testing connection to {config.SMTP_SERVER}:{config.SMTP_PORT}...")
    try:
        if config.SMTP_PORT == 465:
            server = smtplib.SMTP_SSL(config.SMTP_SERVER, config.SMTP_PORT, timeout=30)
        else:
            server = smtplib.SMTP(config.SMTP_SERVER, config.SMTP_PORT, timeout=30)
            server.starttls()
        
        print("   ✅ Connection successful!")
        
        # Test authentication
        print(f"\n3. Testing authentication...")
        server.login(config.SMTP_USERNAME, config.SMTP_PASSWORD)
        print("   ✅ Authentication successful!")
        
        # Test sending email to yourself
        print(f"\n4. Testing email send to {config.SMTP_USERNAME}...")
        msg = MIMEMultipart()
        msg['From'] = config.EMAIL_FROM or config.SMTP_USERNAME
        msg['To'] = config.SMTP_USERNAME
        msg['Subject'] = "Test Email from Lead Generation System"
        msg.attach(MIMEText("This is a test email from your Lead Generation System. If you received this, your SMTP configuration is working correctly!", 'plain', 'utf-8'))
        
        server.send_message(msg)
        print("   ✅ Test email sent successfully!")
        
        server.quit()
        
        print("\n" + "=" * 60)
        print("✅ All tests passed! Your SMTP configuration is working.")
        print("=" * 60)
        return True
        
    except smtplib.SMTPAuthenticationError as e:
        print(f"\n❌ Authentication failed: {e}")
        print("\nCommon fixes:")
        print("  • For Gmail: Use App Password (not your regular password)")
        print("  • Enable 2-Factor Authentication in your Google Account")
        print("  • Generate App Password: https://myaccount.google.com/apppasswords")
        print("  • Make sure SMTP_USERNAME is your full email address")
        return False
        
    except smtplib.SMTPConnectError as e:
        print(f"\n❌ Connection failed: {e}")
        print(f"\nCheck:")
        print(f"  • SMTP_SERVER is correct: {config.SMTP_SERVER}")
        print(f"  • SMTP_PORT is correct: {config.SMTP_PORT}")
        print(f"  • Firewall/network is not blocking the connection")
        return False
        
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        print(traceback.format_exc())
        return False

if __name__ == "__main__":
    test_smtp_connection()

