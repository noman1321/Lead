"""
Follow-up email scheduler
Checks for leads that need follow-up emails and sends them
"""
import threading
import time
from datetime import datetime, timedelta
from database import Database, Lead
from email_sender import EmailSender
import config


class FollowUpScheduler:
    """Manages scheduled follow-up emails"""
    
    def __init__(self):
        self.db = Database()
        self.email_sender = EmailSender()
        self.running = False
        self.thread = None
    
    def start(self, check_interval_minutes: int = 15):
        """Start the scheduler in a background thread"""
        if self.running:
            print("⚠️ Scheduler is already running")
            return
        
        self.running = True
        self.check_interval = check_interval_minutes
        self.thread = threading.Thread(
            target=self._run_scheduler,
            args=(check_interval_minutes,),
            daemon=True
        )
        self.thread.start()
        print(f"✅ Follow-up scheduler started - checking every {check_interval_minutes} minutes")
    
    def stop(self):
        """Stop the scheduler"""
        self.running = False
        if self.thread:
            self.thread.join(timeout=5)
        print("Follow-up scheduler stopped")
    
    def _run_scheduler(self, check_interval_minutes: int):
        """Main scheduler loop"""
        import traceback
        while self.running:
            try:
                self.process_followups()
            except Exception as e:
                print(f"❌ Scheduler error: {e}")
                traceback.print_exc()
            
            # Sleep for check interval
            time.sleep(check_interval_minutes * 60)
    
    def process_followups(self):
        """Process leads that need follow-up emails"""
        try:
            leads_needing_followup = self.db.get_leads_needing_followup()
            
            if not leads_needing_followup:
                # Silent check - no leads need follow-up
                return
            
            print(f"📧 Checking {len(leads_needing_followup)} lead(s) for follow-up emails...")
            
            for lead in leads_needing_followup:
                try:
                    # Double-check if enough time has passed
                    if lead.follow_up_date and lead.follow_up_date <= datetime.utcnow():
                        if not lead.has_replied:
                            # Send follow-up email
                            original_email = lead.email_content or "Previous message"
                            
                            print(f"📨 Sending follow-up email to {lead.email} (follow-up date: {lead.follow_up_date})")
                            
                            result = self.email_sender.send_followup_email(
                                lead.email,
                                original_email
                            )
                            
                            if result["success"]:
                                print(f"✅ Follow-up email sent successfully to {lead.email}")
                                # Clear follow-up date to prevent sending multiple follow-ups
                                session = self.db.get_session()
                                try:
                                    updated_lead = session.query(Lead).filter_by(email=lead.email).first()
                                    if updated_lead:
                                        updated_lead.follow_up_date = None  # Clear to prevent re-sending
                                        session.commit()
                                        print(f"   ✓ Follow-up date cleared for {lead.email}")
                                except Exception as e:
                                    print(f"⚠️ Warning: Could not clear follow-up date for {lead.email}: {e}")
                                    session.rollback()
                                finally:
                                    session.close()
                            else:
                                print(f"❌ Failed to send follow-up to {lead.email}: {result.get('message', 'Unknown error')}")
                        else:
                            print(f"⏭️ Skipping {lead.email} - lead has already replied")
                    else:
                        # Follow-up date hasn't been reached yet
                        if lead.follow_up_date:
                            days_remaining = (lead.follow_up_date - datetime.utcnow()).days
                            if days_remaining > 0:
                                print(f"⏳ {lead.email} - follow-up scheduled in {days_remaining} day(s)")
                except Exception as e:
                    import traceback
                    print(f"❌ Error processing follow-up for {lead.email}: {e}")
                    traceback.print_exc()
        except Exception as e:
            import traceback
            print(f"❌ Error in process_followups: {e}")
            traceback.print_exc()
    
    def check_followups_now(self):
        """Manually trigger follow-up check (useful for Streamlit)"""
        self.process_followups()


# Global scheduler instance
_scheduler_instance = None

def get_scheduler() -> FollowUpScheduler:
    """Get or create the global scheduler instance"""
    global _scheduler_instance
    if _scheduler_instance is None:
        _scheduler_instance = FollowUpScheduler()
    return _scheduler_instance

