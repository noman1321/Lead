"""
FastAPI Backend for Lead Generation System
All business logic remains the same, only UI changed
"""
from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse, FileResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, EmailStr
from typing import List, Dict, Optional
import uvicorn
from datetime import datetime
import uuid

# Import all existing modules (logic remains the same)
from database import Database
from agents import LeadDiscoveryAgent, LeadEnrichmentAgent, LeadValidatorAgent
from email_generator import AICopywriter
from email_sender import EmailSender
from scheduler import get_scheduler
import config

# Initialize FastAPI app
app = FastAPI(title="Agentic Lead Generation System")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Static files
app.mount("/static", StaticFiles(directory="static"), name="static")

# Initialize components
db = Database()
discovery_agent = None
enrichment_agent = None
validator_agent = None
copywriter = None
email_sender = EmailSender()
scheduler = get_scheduler()

# Start scheduler
try:
    scheduler.start(check_interval_minutes=15)  # Check every 15 minutes for better responsiveness
    print("✅ Follow-up scheduler started successfully - checking every 15 minutes")
except Exception as e:
    print(f"⚠️ Warning: Could not start follow-up scheduler: {e}")
    print("Follow-up emails will not be sent automatically. You can still send them manually.")


# Pydantic models for API requests/responses
class LeadSearchRequest(BaseModel):
    query: str
    max_leads: int = 10
    user_context: Optional[str] = ""
    campaign_name: Optional[str] = None
    campaign_id: Optional[str] = None  # Use existing campaign if provided


class EmailGenerateRequest(BaseModel):
    lead_email: str
    user_context: Optional[str] = ""


class EmailSendRequest(BaseModel):
    lead_email: str
    email_content: str
    subject: str


class BulkEmailRequest(BaseModel):
    lead_ids: Optional[List[int]] = None
    status_filter: Optional[List[str]] = None
    exclude_replied: bool = True
    campaign_id: Optional[str] = None
    user_context: str
    subject_template: str = "Quick question about {company_name}"


class CampaignCreateRequest(BaseModel):
    name: str
    search_query: str
    notes: Optional[str] = None


@app.on_event("startup")
async def startup_event():
    """Initialize agents on startup"""
    global discovery_agent, enrichment_agent, validator_agent, copywriter
    try:
        if config.OPENAI_API_KEY:
            discovery_agent = LeadDiscoveryAgent()
            enrichment_agent = LeadEnrichmentAgent()
            validator_agent = LeadValidatorAgent()
            copywriter = AICopywriter()
    except Exception as e:
        print(f"Warning: Agents not initialized: {e}")


# API Routes

@app.get("/")
async def landing_page():
    """Serve landing page"""
    try:
        return FileResponse("static/index.html")
    except Exception as e:
        return HTMLResponse(content=f"<h1>Landing page not found: {str(e)}</h1>")


@app.get("/app")
async def app_page():
    """Serve main application page"""
    try:
        return FileResponse("static/app.html")
    except Exception as e:
        return HTMLResponse(content=f"<h1>App page not found: {str(e)}</h1>")


@app.get("/api/config")
async def get_config():
    """Get configuration status"""
    return {
        "openai_key": bool(config.OPENAI_API_KEY),
        "serpapi_key": bool(config.SERPAPI_API_KEY),
        "tavily_key": bool(config.TAVILY_API_KEY),
        "smtp_configured": bool(config.SMTP_USERNAME and config.SMTP_PASSWORD)
    }


@app.post("/api/leads/discover")
async def discover_leads(request: LeadSearchRequest, background_tasks: BackgroundTasks):
    """Discover and enrich leads"""
    if not discovery_agent or not enrichment_agent:
        raise HTTPException(status_code=500, detail="Agents not initialized. Check API keys.")
    
    # Use existing campaign if provided, otherwise create new one
    if request.campaign_id:
        # Validate that campaign exists
        existing_campaign = db.get_campaign(request.campaign_id)
        if not existing_campaign:
            raise HTTPException(status_code=404, detail="Campaign not found")
        campaign_id = request.campaign_id
        campaign_name = existing_campaign.name
    else:
        # Create new campaign
        campaign_id = str(uuid.uuid4())[:8]
        campaign_name = request.campaign_name or request.query[:50]
        try:
            db.create_campaign(campaign_id, campaign_name, request.query, f"Max leads: {request.max_leads}")
        except:
            pass
    
    # Discover leads
    try:
        search_results = discovery_agent.search_companies(request.query, request.max_leads * 2)
        leads = []
        
        for result in search_results[:request.max_leads]:
            try:
                website_url = result.get("url", "")
                if not website_url:
                    continue
                
                company_data = enrichment_agent.scrape_website(website_url)
                if not company_data:
                    continue
                
                email = company_data.get("email")
                if not email:
                    email = enrichment_agent._guess_email_from_url(website_url)
                
                if not email:
                    continue
                
                # Check for duplicates
                existing = db.get_lead_by_email(email)
                if existing:
                    continue
                
                # Validate lead
                if validator_agent:
                    is_valid = validator_agent.validate_lead(company_data, request.query)
                    if not is_valid:
                        continue
                
                # Add to database
                lead = db.add_lead(
                    email=email,
                    name=company_data.get("name", email.split("@")[0].replace(".", " ").title()),
                    company_name=company_data.get("company_name", result.get("title", "Unknown Company")),
                    company_data=company_data,
                    campaign_id=campaign_id
                )
                
                leads.append({
                    "id": lead.id,
                    "email": email,
                    "name": lead.name,
                    "company_name": lead.company_name,
                    "description": company_data.get("description", "")[:100] + "...",
                    "pain_points": ", ".join(company_data.get("pain_points", [])[:3]),
                    "status": "found",
                    "company_data": company_data,
                    "campaign_id": campaign_id,
                    "website_url": company_data.get("website_url") or company_data.get("source_url") or website_url
                })
            except Exception as e:
                print(f"Error processing lead: {e}")
                continue
        
        # Update campaign lead count
        background_tasks.add_task(db.update_campaign_lead_count, campaign_id)
        
        return {
            "success": True,
            "leads": leads,
            "campaign_id": campaign_id,
            "campaign_name": campaign_name
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error discovering leads: {str(e)}")


@app.post("/api/email/generate")
async def generate_email(request: EmailGenerateRequest):
    """Generate email for a lead"""
    if not copywriter:
        raise HTTPException(status_code=500, detail="Email generator not initialized")
    
    # Get lead from database
    lead = db.get_lead_by_email(request.lead_email)
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    
    lead_dict = lead.to_dict()
    email_result = copywriter.generate_email(lead_dict, request.user_context or "")
    
    return {
        "success": True,
        "subject": email_result.get("subject", ""),
        "body": email_result.get("body", "")
    }


@app.post("/api/email/send")
async def send_email(request: EmailSendRequest):
    """Send email to a lead"""
    try:
        result = email_sender.send_lead_email(
            request.lead_email,
            request.email_content,
            subject=request.subject
        )
        
        if result["success"]:
            return {"success": True, "message": result["message"]}
        else:
            raise HTTPException(status_code=400, detail=result["message"])
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error sending email: {str(e)}")


@app.post("/api/email/bulk")
async def send_bulk_emails(request: BulkEmailRequest, background_tasks: BackgroundTasks):
    """Send bulk emails"""
    if not copywriter:
        raise HTTPException(status_code=500, detail="Email generator not initialized")
    
    # Get leads
    all_leads = db.get_all_leads(limit=1000)
    
    # Apply filters
    filtered_leads = all_leads
    if request.status_filter:
        filtered_leads = [l for l in filtered_leads if l.status in request.status_filter]
    if request.exclude_replied:
        filtered_leads = [l for l in filtered_leads if not l.has_replied]
    if request.campaign_id:
        filtered_leads = [l for l in filtered_leads if l.campaign_id == request.campaign_id]
    if request.lead_ids:
        filtered_leads = [l for l in filtered_leads if l.id in request.lead_ids]
    
    results = {
        "total": len(filtered_leads),
        "success": 0,
        "failed": 0,
        "details": []
    }
    
    # Send emails in background
    def send_bulk():
        for lead in filtered_leads:
            try:
                email_result = copywriter.generate_email(lead.to_dict(), request.user_context)
                email_content = email_result.get("body", "")
                email_subject = email_result.get("subject", "")
                
                if not email_subject or email_subject == "Error":
                    email_subject = request.subject_template.format(
                        company_name=lead.company_name,
                        name=lead.name or ""
                    )
                
                result = email_sender.send_lead_email(lead.email, email_content, email_subject)
                results["success"] += 1 if result["success"] else 0
                results["failed"] += 0 if result["success"] else 1
                results["details"].append({
                    "email": lead.email,
                    "status": "success" if result["success"] else "failed",
                    "message": result.get("message", "")
                })
            except Exception as e:
                results["failed"] += 1
                results["details"].append({
                    "email": lead.email,
                    "status": "failed",
                    "message": str(e)
                })
    
    background_tasks.add_task(send_bulk)
    
    return {
        "success": True,
        "message": f"Bulk email started for {len(filtered_leads)} leads",
        "total": len(filtered_leads)
    }


@app.get("/api/leads")
async def get_leads(campaign_id: Optional[str] = None, status: Optional[str] = None, limit: int = 1000):
    """Get all leads with optional filters"""
    leads = db.get_all_leads(limit=limit)
    
    if campaign_id:
        leads = [l for l in leads if l.campaign_id == campaign_id]
    if status and status != "All":
        leads = [l for l in leads if l.status == status]
    
    # Convert leads to dicts with error handling
    leads_dict = []
    for lead in leads:
        try:
            leads_dict.append(lead.to_dict())
        except Exception as e:
            print(f"Error converting lead {lead.id} to dict: {e}")
            # Return basic info even if to_dict fails
            leads_dict.append({
                "id": lead.id,
                "email": lead.email or "",
                "name": lead.name or "",
                "company_name": lead.company_name or "",
                "company_data": {},
                "campaign_id": lead.campaign_id or "",
                "status": lead.status or "found",
                "email_content": lead.email_content or "",
                "follow_up_date": None,
                "created_at": lead.created_at.isoformat() if lead.created_at else None,
                "last_contacted_at": lead.last_contacted_at.isoformat() if lead.last_contacted_at else None,
                "sent_email_at": lead.sent_email_at.isoformat() if lead.sent_email_at else None,
                "has_replied": lead.has_replied or False,
            })
    
    return {
        "success": True,
        "leads": leads_dict,
        "total": len(leads_dict)
    }


@app.get("/api/leads/{lead_id}")
async def get_lead(lead_id: int):
    """Get a single lead by ID"""
    session = db.get_session()
    try:
        from database import Lead
        lead = session.query(Lead).filter_by(id=lead_id).first()
        if not lead:
            raise HTTPException(status_code=404, detail="Lead not found")
        return {"success": True, "lead": lead.to_dict()}
    finally:
        session.close()


@app.put("/api/leads/{lead_id}/replied")
async def mark_lead_replied(lead_id: int):
    """Mark a lead as replied"""
    session = db.get_session()
    try:
        from database import Lead
        lead = session.query(Lead).filter_by(id=lead_id).first()
        if not lead:
            raise HTTPException(status_code=404, detail="Lead not found")
        db.mark_as_replied(lead.email)
        return {"success": True, "message": "Lead marked as replied"}
    finally:
        session.close()


@app.delete("/api/leads/{lead_id}")
async def delete_lead(lead_id: int):
    """Delete a single lead and update campaign count"""
    try:
        success = db.delete_lead(lead_id)
        if success:
            # Campaign count is automatically updated in delete_lead method
            return {"success": True, "message": "Lead deleted"}
        else:
            raise HTTPException(status_code=404, detail="Lead not found")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error deleting lead: {str(e)}")


@app.delete("/api/leads")
async def delete_all_leads():
    """Delete all leads and update campaign counts"""
    count = db.delete_all_leads()
    # Campaign counts are automatically updated in delete_all_leads method
    return {"success": True, "message": f"Deleted {count} leads", "count": count}


@app.get("/api/campaigns")
async def get_campaigns():
    """Get all campaigns with updated lead counts"""
    campaigns = db.get_all_campaigns_with_lead_count()
    return {
        "success": True,
        "campaigns": [c.to_dict() for c in campaigns]
    }


@app.get("/api/campaigns/{campaign_id}")
async def get_campaign(campaign_id: str):
    """Get a single campaign"""
    campaign = db.get_campaign(campaign_id)
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    # Update lead count before returning
    db.update_campaign_lead_count(campaign_id)
    campaign = db.get_campaign(campaign_id)  # Refresh to get updated count
    return {"success": True, "campaign": campaign.to_dict()}

@app.delete("/api/campaigns/{campaign_id}")
async def delete_campaign(campaign_id: str):
    """Delete a campaign and all its leads"""
    try:
        success = db.delete_campaign(campaign_id)
        if success:
            return {"success": True, "message": "Campaign and all its leads deleted"}
        else:
            raise HTTPException(status_code=404, detail="Campaign not found")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error deleting campaign: {str(e)}")


@app.get("/api/stats")
async def get_statistics():
    """Get statistics"""
    all_leads = db.get_all_leads(limit=1000)
    return {
        "success": True,
        "total_leads": len(all_leads),
        "emailed": len([l for l in all_leads if l.status == "emailed"]),
        "replied": len([l for l in all_leads if l.has_replied]),
        "found": len([l for l in all_leads if l.status == "found"])
    }


@app.get("/api/analytics/timeseries")
async def get_timeseries_analytics(days: int = 30):
    """Get time-series analytics for lead growth"""
    from datetime import timedelta
    all_leads = db.get_all_leads(limit=10000)
    
    # Calculate date range
    end_date = datetime.now()
    start_date = end_date - timedelta(days=days)
    
    # Group leads by date
    daily_counts = {}
    for lead in all_leads:
        if lead.created_at:
            lead_date = lead.created_at.date()
            if start_date.date() <= lead_date <= end_date.date():
                date_str = lead_date.isoformat()
                daily_counts[date_str] = daily_counts.get(date_str, 0) + 1
    
    # Create sorted list of dates
    dates = sorted(daily_counts.keys())
    counts = [daily_counts[date] for date in dates]
    
    # Calculate cumulative
    cumulative = []
    total = 0
    for count in counts:
        total += count
        cumulative.append(total)
    
    return {
        "success": True,
        "dates": dates,
        "daily": counts,
        "cumulative": cumulative
    }


@app.get("/api/analytics/funnel")
async def get_funnel_analytics():
    """Get conversion funnel data"""
    all_leads = db.get_all_leads(limit=10000)
    
    total = len(all_leads)
    found = len([l for l in all_leads if l.status == "found"])
    emailed = len([l for l in all_leads if l.status == "emailed"])
    followed_up = len([l for l in all_leads if l.status == "followed_up"])
    replied = len([l for l in all_leads if l.has_replied])
    
    return {
        "success": True,
        "funnel": [
            {"stage": "Discovered", "count": total, "percentage": 100},
            {"stage": "Emailed", "count": emailed, "percentage": (emailed / total * 100) if total > 0 else 0},
            {"stage": "Followed Up", "count": followed_up, "percentage": (followed_up / total * 100) if total > 0 else 0},
            {"stage": "Replied", "count": replied, "percentage": (replied / total * 100) if total > 0 else 0}
        ]
    }


@app.get("/api/analytics/sources")
async def get_source_analytics():
    """Get lead source analytics"""
    all_leads = db.get_all_leads(limit=10000)
    
    # Group by campaign
    campaign_sources = {}
    for lead in all_leads:
        if lead.campaign_id:
            campaign = db.get_campaign(lead.campaign_id)
            if campaign:
                campaign_name = campaign.name
                campaign_sources[campaign_name] = campaign_sources.get(campaign_name, 0) + 1
    
    # Sort by count
    sorted_sources = sorted(campaign_sources.items(), key=lambda x: x[1], reverse=True)
    
    return {
        "success": True,
        "sources": [{"name": name, "count": count} for name, count in sorted_sources]
    }


@app.get("/api/analytics/campaigns")
async def get_campaign_analytics():
    """Get campaign performance analytics"""
    campaigns = db.get_all_campaigns()
    
    campaign_data = []
    for campaign in campaigns:
        leads = db.get_all_leads(limit=10000)
        campaign_leads = [l for l in leads if l.campaign_id == campaign.id]
        
        emailed = len([l for l in campaign_leads if l.status == "emailed"])
        replied = len([l for l in campaign_leads if l.has_replied])
        
        campaign_data.append({
            "name": campaign.name,
            "total": len(campaign_leads),
            "emailed": emailed,
            "replied": replied,
            "reply_rate": (replied / len(campaign_leads) * 100) if len(campaign_leads) > 0 else 0
        })
    
    return {
        "success": True,
        "campaigns": campaign_data
    }


@app.post("/api/followup/check")
async def check_followups():
    """Manually trigger follow-up check"""
    try:
        scheduler.check_followups_now()
        return {"success": True, "message": "Follow-up check completed"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error checking follow-ups: {str(e)}")

@app.get("/api/followup/status")
async def get_followup_status():
    """Get scheduler status"""
    return {
        "success": True,
        "running": scheduler.running if hasattr(scheduler, 'running') else False,
        "check_interval_minutes": scheduler.check_interval if hasattr(scheduler, 'check_interval') else 15,
        "message": "Scheduler is running" if (hasattr(scheduler, 'running') and scheduler.running) else "Scheduler is not running"
    }


@app.post("/api/email/test")
async def test_email():
    """Test email configuration"""
    if not config.SMTP_USERNAME or not config.SMTP_PASSWORD:
        raise HTTPException(status_code=400, detail="SMTP credentials not configured")
    
    result = email_sender.send_email(
        to_email=config.SMTP_USERNAME,
        subject="Test Email from Lead Generation System",
        body="This is a test email. If you received this, your SMTP configuration is working!",
        lead_email=config.SMTP_USERNAME,
        is_followup=False
    )
    
    return result


if __name__ == "__main__":
    uvicorn.run("backend:app", host="0.0.0.0", port=8000, reload=True)

