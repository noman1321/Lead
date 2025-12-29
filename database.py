"""
Database models and operations for the Lead Generation System
Uses SQLite for storage
"""
from sqlalchemy import create_engine, Column, String, Integer, DateTime, JSON, Boolean
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from datetime import datetime
import json
from typing import Optional, List, Dict
import config

Base = declarative_base()


class Campaign(Base):
    """Campaign model to store campaign information"""
    __tablename__ = "campaigns"

    id = Column(String, primary_key=True)  # Campaign ID
    name = Column(String)  # Campaign name/description (search query)
    search_query = Column(String)  # Original search query
    created_at = Column(DateTime, default=datetime.utcnow)
    lead_count = Column(Integer, default=0)
    notes = Column(String, nullable=True)

    def to_dict(self) -> Dict:
        """Convert campaign to dictionary"""
        return {
            "id": self.id,
            "name": self.name,
            "search_query": self.search_query,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "lead_count": self.lead_count,
            "notes": self.notes
        }


class Lead(Base):
    """Lead model to store discovered leads"""
    __tablename__ = "leads"

    id = Column(Integer, primary_key=True, autoincrement=True)
    email = Column(String, unique=True, nullable=False, index=True)
    name = Column(String)
    company_name = Column(String)
    company_data = Column(JSON)  # Stores scraped info as JSON
    campaign_id = Column(String, index=True)
    status = Column(String, default="found")  # found, emailed, followed_up, replied
    email_content = Column(String)  # Store the generated email
    follow_up_date = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    last_contacted_at = Column(DateTime, nullable=True)
    sent_email_at = Column(DateTime, nullable=True)
    has_replied = Column(Boolean, default=False)

    def to_dict(self) -> Dict:
        """Convert lead to dictionary for display"""
        # Safely parse company_data
        company_data = {}
        if self.company_data:
            if isinstance(self.company_data, dict):
                company_data = self.company_data
            elif isinstance(self.company_data, str):
                try:
                    company_data = json.loads(self.company_data)
                except (json.JSONDecodeError, TypeError):
                    # If parsing fails, return empty dict
                    company_data = {}
        
        return {
            "id": self.id,
            "email": self.email,
            "name": self.name,
            "company_name": self.company_name,
            "company_data": company_data,
            "campaign_id": self.campaign_id,
            "status": self.status,
            "email_content": self.email_content,
            "follow_up_date": self.follow_up_date.isoformat() if self.follow_up_date else None,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "last_contacted_at": self.last_contacted_at.isoformat() if self.last_contacted_at else None,
            "sent_email_at": self.sent_email_at.isoformat() if self.sent_email_at else None,
            "has_replied": self.has_replied,
        }


class Database:
    """Database operations wrapper"""
    
    def __init__(self, db_path: str = config.DATABASE_PATH):
        self.engine = create_engine(f"sqlite:///{db_path}", echo=False)
        Base.metadata.create_all(self.engine)
        self.Session = sessionmaker(bind=self.engine)
    
    def get_session(self):
        """Get a new database session"""
        return self.Session()
    
    def add_lead(self, email: str, name: Optional[str] = None, 
                 company_name: Optional[str] = None, 
                 company_data: Optional[Dict] = None,
                 campaign_id: Optional[str] = None) -> Lead:
        """Add a new lead to the database"""
        session = self.get_session()
        try:
            # Check if lead already exists
            existing = session.query(Lead).filter_by(email=email).first()
            if existing:
                return existing
            
            lead = Lead(
                email=email,
                name=name,
                company_name=company_name,
                company_data=company_data or {},
                campaign_id=campaign_id
            )
            session.add(lead)
            session.commit()
            session.refresh(lead)
            return lead
        except Exception as e:
            session.rollback()
            raise e
        finally:
            session.close()
    
    def get_lead_by_email(self, email: str) -> Optional[Lead]:
        """Get a lead by email address"""
        session = self.get_session()
        try:
            return session.query(Lead).filter_by(email=email).first()
        finally:
            session.close()
    
    def update_lead_status(self, email: str, status: str, 
                          email_content: Optional[str] = None):
        """Update lead status and email content"""
        session = self.get_session()
        try:
            lead = session.query(Lead).filter_by(email=email).first()
            if lead:
                lead.status = status
                lead.last_contacted_at = datetime.utcnow()
                if email_content:
                    lead.email_content = email_content
                if status == "emailed":
                    lead.sent_email_at = datetime.utcnow()
                    # Set follow-up date
                    from datetime import timedelta
                    lead.follow_up_date = datetime.utcnow() + timedelta(days=config.FOLLOW_UP_DAYS)
                session.commit()
        except Exception as e:
            session.rollback()
            raise e
        finally:
            session.close()
    
    def get_leads_by_campaign(self, campaign_id: str) -> List[Lead]:
        """Get all leads for a campaign"""
        session = self.get_session()
        try:
            return session.query(Lead).filter_by(campaign_id=campaign_id).all()
        finally:
            session.close()
    
    def get_leads_needing_followup(self) -> List[Lead]:
        """Get leads that need follow-up emails"""
        session = self.get_session()
        try:
            now = datetime.utcnow()
            # Only get leads that:
            # 1. Have a follow-up date that has passed
            # 2. Have been emailed (not already followed up - to prevent multiple follow-ups)
            # 3. Haven't replied
            # 4. Follow-up date is not None (hasn't been cleared)
            return session.query(Lead).filter(
                Lead.follow_up_date.isnot(None),
                Lead.follow_up_date <= now,
                Lead.status == "emailed",  # Only "emailed" status, not "followed_up" to prevent multiple follow-ups
                Lead.has_replied == False
            ).all()
        finally:
            session.close()
    
    def mark_as_replied(self, email: str):
        """Mark a lead as having replied"""
        session = self.get_session()
        try:
            lead = session.query(Lead).filter_by(email=email).first()
            if lead:
                lead.has_replied = True
                lead.status = "replied"
                lead.follow_up_date = None  # Cancel follow-up
                session.commit()
        except Exception as e:
            session.rollback()
            raise e
        finally:
            session.close()
    
    def get_all_leads(self, limit: int = 100) -> List[Lead]:
        """Get all leads with limit"""
        session = self.get_session()
        try:
            return session.query(Lead).order_by(Lead.created_at.desc()).limit(limit).all()
        finally:
            session.close()
    
    def delete_lead(self, lead_id: int) -> bool:
        """Delete a single lead by ID and update campaign count"""
        session = self.get_session()
        try:
            lead = session.query(Lead).filter_by(id=lead_id).first()
            if lead:
                campaign_id = lead.campaign_id
                session.delete(lead)
                session.commit()
                
                # Update campaign lead count
                if campaign_id:
                    self.update_campaign_lead_count(campaign_id)
                
                return True
            return False
        except Exception as e:
            session.rollback()
            raise e
        finally:
            session.close()
    
    def delete_all_leads(self) -> int:
        """Delete all leads from the database and update all campaign counts. Returns number of leads deleted."""
        session = self.get_session()
        try:
            # Get all campaign IDs before deletion
            campaign_ids = session.query(Lead.campaign_id).distinct().all()
            campaign_ids = [c[0] for c in campaign_ids if c[0]]
            
            count = session.query(Lead).count()
            session.query(Lead).delete()
            session.commit()
            
            # Update all campaign lead counts
            for campaign_id in campaign_ids:
                self.update_campaign_lead_count(campaign_id)
            
            return count
        except Exception as e:
            session.rollback()
            raise e
        finally:
            session.close()
    
    def create_campaign(self, campaign_id: str, name: str, search_query: str, notes: Optional[str] = None) -> Campaign:
        """Create a new campaign"""
        session = self.get_session()
        try:
            campaign = Campaign(
                id=campaign_id,
                name=name,
                search_query=search_query,
                notes=notes
            )
            session.add(campaign)
            session.commit()
            session.refresh(campaign)
            return campaign
        except Exception as e:
            session.rollback()
            # Campaign might already exist, return existing one
            existing = session.query(Campaign).filter_by(id=campaign_id).first()
            if existing:
                return existing
            raise e
        finally:
            session.close()
    
    def get_campaign(self, campaign_id: str) -> Optional[Campaign]:
        """Get a campaign by ID"""
        session = self.get_session()
        try:
            return session.query(Campaign).filter_by(id=campaign_id).first()
        finally:
            session.close()
    
    def get_all_campaigns(self) -> List[Campaign]:
        """Get all campaigns"""
        session = self.get_session()
        try:
            return session.query(Campaign).order_by(Campaign.created_at.desc()).all()
        finally:
            session.close()
    
    def update_campaign_lead_count(self, campaign_id: str):
        """Update the lead count for a campaign"""
        session = self.get_session()
        try:
            campaign = session.query(Campaign).filter_by(id=campaign_id).first()
            if campaign:
                lead_count = session.query(Lead).filter_by(campaign_id=campaign_id).count()
                campaign.lead_count = lead_count
                session.commit()
        except Exception as e:
            session.rollback()
            raise e
        finally:
            session.close()
    
    def delete_campaign(self, campaign_id: str) -> bool:
        """Delete a campaign and all its leads"""
        session = self.get_session()
        try:
            campaign = session.query(Campaign).filter_by(id=campaign_id).first()
            if campaign:
                # Delete all leads in this campaign
                session.query(Lead).filter_by(campaign_id=campaign_id).delete()
                # Delete the campaign
                session.delete(campaign)
                session.commit()
                return True
            return False
        except Exception as e:
            session.rollback()
            raise e
        finally:
            session.close()
    
    def get_all_campaigns_with_lead_count(self) -> List[Campaign]:
        """Get all campaigns with updated lead counts"""
        campaigns = self.get_all_campaigns()
        # Update lead counts for all campaigns
        for campaign in campaigns:
            self.update_campaign_lead_count(campaign.id)
        return campaigns

