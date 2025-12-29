"""
Email sending functionality using SMTP
"""
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from datetime import datetime
from typing import Optional, Dict
import config
from database import Database


class EmailSender:
    """Handles sending emails via SMTP"""
    
    def __init__(self):
        self.smtp_server = config.SMTP_SERVER
        self.smtp_port = config.SMTP_PORT
        self.username = config.SMTP_USERNAME
        self.password = config.SMTP_PASSWORD
        self.email_from = config.EMAIL_FROM or config.SMTP_USERNAME
        self.db = Database()
    
    def send_email(self, to_email: str, subject: str, body: str, 
                   lead_email: str, is_followup: bool = False) -> Dict:
        """
        Send an email via SMTP
        
        Returns:
            Dict with 'success' (bool) and 'message' (str)
        """
        # Validation checks
        if not self.username or not self.password:
            return {
                "success": False,
                "message": "❌ SMTP credentials not configured. Please set SMTP_USERNAME and SMTP_PASSWORD in your .env file."
            }
        
        if not self.email_from:
            return {
                "success": False,
                "message": "❌ EMAIL_FROM not configured. Please set EMAIL_FROM in your .env file."
            }
        
        if not to_email or '@' not in to_email:
            return {
                "success": False,
                "message": f"❌ Invalid recipient email address: {to_email}"
            }
        
        try:
            # Create message
            msg = MIMEMultipart()
            msg['From'] = self.email_from
            msg['To'] = to_email
            msg['Subject'] = subject
            
            # Add body
            msg.attach(MIMEText(body, 'plain', 'utf-8'))
            
            # Connect to SMTP server and send
            if self.smtp_port == 465:
                # SSL connection
                server = smtplib.SMTP_SSL(self.smtp_server, self.smtp_port, timeout=30)
            else:
                # TLS connection (default)
                server = smtplib.SMTP(self.smtp_server, self.smtp_port, timeout=30)
                server.starttls()
            
            # Login
            server.login(self.username, self.password)
            
            # Send email
            server.send_message(msg)
            
            # Close connection
            server.quit()
            
            # Update database
            status = "followed_up" if is_followup else "emailed"
            self.db.update_lead_status(lead_email, status, body)
            
            return {
                "success": True,
                "message": f"✅ Email sent successfully to {to_email}"
            }
        
        except smtplib.SMTPAuthenticationError as e:
            return {
                "success": False,
                "message": f"❌ SMTP authentication failed: {str(e)}\n\n"
                          f"Common causes:\n"
                          f"• For Gmail: Use App Password, not your regular password\n"
                          f"• Check that SMTP_USERNAME and SMTP_PASSWORD are correct\n"
                          f"• Ensure 2-Factor Authentication is enabled (for Gmail)"
            }
        except smtplib.SMTPRecipientsRefused as e:
            return {
                "success": False,
                "message": f"❌ Recipient email rejected: {str(e)}\n\nCheck that the email address is valid."
            }
        except smtplib.SMTPServerDisconnected:
            return {
                "success": False,
                "message": f"❌ SMTP server disconnected. Check:\n"
                          f"• SMTP_SERVER: {self.smtp_server}\n"
                          f"• SMTP_PORT: {self.smtp_port}\n"
                          f"• Firewall/network settings"
            }
        except smtplib.SMTPConnectError as e:
            return {
                "success": False,
                "message": f"❌ Could not connect to SMTP server: {str(e)}\n\n"
                          f"Check:\n"
                          f"• SMTP_SERVER: {self.smtp_server}\n"
                          f"• SMTP_PORT: {self.smtp_port}\n"
                          f"• Internet connection\n"
                          f"• Firewall settings"
            }
        except smtplib.SMTPException as e:
            return {
                "success": False,
                "message": f"❌ SMTP error: {str(e)}\n\n"
                          f"SMTP Server: {self.smtp_server}:{self.smtp_port}\n"
                          f"From: {self.email_from}\n"
                          f"To: {to_email}"
            }
        except Exception as e:
            import traceback
            error_details = traceback.format_exc()
            return {
                "success": False,
                "message": f"❌ Unexpected error sending email: {str(e)}\n\n"
                          f"Error details: {error_details[:500]}"
            }
    
    def send_lead_email(self, lead_email: str, email_content: str, 
                       subject: Optional[str] = None) -> Dict:
        """Send email to a lead"""
        if not subject:
            # Try to extract subject from first line or use default
            first_line = email_content.split('\n')[0].strip()
            if len(first_line) < 100 and not first_line.startswith('Hi'):
                subject = first_line
            else:
                subject = "Quick question about your business"
        
        return self.send_email(
            to_email=lead_email,
            subject=subject,
            body=email_content,
            lead_email=lead_email,
            is_followup=False
        )
    
    def send_followup_email(self, lead_email: str, original_email: str) -> Dict:
        """Send a follow-up email to a lead"""
        # Try to extract a better subject from original email
        if isinstance(original_email, str) and len(original_email) > 50:
            # If original_email is the full email content, try to get subject from first line
            first_line = original_email.split('\n')[0].strip()
            if len(first_line) < 100:
                subject_base = first_line
            else:
                subject_base = original_email[:50]
        else:
            subject_base = str(original_email)[:50]
        
        followup_subject = f"Re: {subject_base}"
        
        # More professional follow-up email
        followup_body = f"""Hi there,

I wanted to follow up on my previous email. I'd love to hear your thoughts or answer any questions you might have.

Looking forward to hearing from you!

Best regards"""
        
        return self.send_email(
            to_email=lead_email,
            subject=followup_subject,
            body=followup_body,
            lead_email=lead_email,
            is_followup=True
        )

