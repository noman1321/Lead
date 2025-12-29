"""
AI Copywriter for generating personalized cold emails
"""
from langchain_openai import ChatOpenAI
from langchain_core.messages import HumanMessage, SystemMessage
from typing import Dict, Optional
import config


class AICopywriter:
    """Generates personalized cold emails based on lead information"""
    
    def __init__(self):
        if not config.OPENAI_API_KEY:
            raise ValueError("OPENAI_API_KEY not set in config")
        self.llm = ChatOpenAI(
            model=config.LLM_MODEL,
            temperature=0.8,  # Higher temperature for more creative emails
            api_key=config.OPENAI_API_KEY
        )
    
    def generate_email(self, lead_info: Dict, user_context: Optional[str] = None) -> Dict[str, str]:
        """
        Generate a personalized cold email (subject and body) for a lead
        
        Args:
            lead_info: Dictionary with lead information (name, company, pain_points, etc.)
            user_context: Optional context about the user's service/product
            
        Returns:
            Dictionary with 'subject' and 'body' keys
        """
        name = lead_info.get("name", "there")
        company_name = lead_info.get("company_name", "your company")
        pain_points = lead_info.get("company_data", {}).get("pain_points", [])
        description = lead_info.get("company_data", {}).get("description", "")
        recent_news = lead_info.get("company_data", {}).get("recent_news", "")
        
        pain_points_text = ", ".join(pain_points[:3]) if pain_points else "industry challenges"
        
        # Generate email subject (with error handling)
        try:
            subject = self.generate_subject(lead_info, user_context)
            if not subject or not subject.strip():
                # Fallback if subject generation returns empty
                company_name = lead_info.get("company_name", "your company")
                subject = f"Quick question about {company_name}"
        except Exception as e:
            print(f"Subject generation error, using fallback: {e}")
            company_name = lead_info.get("company_name", "your company")
            subject = f"Quick question about {company_name}"
        
        # Generate email body
        system_prompt = """You are an expert B2B email copywriter specializing in personalized cold emails.
        Write professional, concise, and engaging emails that:
        - Are personalized to the recipient's company and role
        - Mention specific details about their company when available
        - Keep it under 100 words
        - Have a clear, friendly tone
        - Include a specific call-to-action
        - Avoid being too salesy or pushy"""
        
        user_prompt = f"""Write a personalized cold email to {name} at {company_name}.

Company Description: {description[:300]}

Pain Points Identified: {pain_points_text}

Recent News/Updates: {recent_news[:200] if recent_news else "None mentioned"}

{f"Context about our service: {user_context}" if user_context else "Assume we offer relevant business solutions."}

Start the email with "Hi {name}," and sign it with "- [Your Name]"

Make it personalized, relevant, and compelling."""
        
        messages = [
            SystemMessage(content=system_prompt),
            HumanMessage(content=user_prompt)
        ]
        
        try:
            response = self.llm.invoke(messages)
            email_content = response.content.strip()
            return {
                "subject": subject,
                "body": email_content
            }
        except Exception as e:
            print(f"Email generation error: {e}")
            # Return a fallback email
            fallback = self._generate_fallback_email(name, company_name, description)
            return {
                "subject": f"Quick question about {company_name}",
                "body": fallback
            }
    
    def generate_subject(self, lead_info: Dict, user_context: Optional[str] = None) -> str:
        """
        Generate an AI-powered email subject line
        
        Args:
            lead_info: Dictionary with lead information
            user_context: Optional context about the user's service/product
            
        Returns:
            Generated subject line
        """
        name = lead_info.get("name", "")
        company_name = lead_info.get("company_name", "your company")
        description = lead_info.get("company_data", {}).get("description", "")
        pain_points = lead_info.get("company_data", {}).get("pain_points", [])
        recent_news = lead_info.get("company_data", {}).get("recent_news", "")
        
        system_prompt = """You are an expert at writing compelling email subject lines for B2B cold emails.
        Create subject lines that:
        - Are personalized and relevant to the recipient
        - Are concise (under 60 characters ideally)
        - Create curiosity or highlight value
        - Avoid spammy words
        - Are professional but engaging
        Return ONLY the subject line, nothing else."""
        
        user_prompt = f"""Generate a compelling email subject line for a cold email to {name} at {company_name}.

Company: {company_name}
What they do: {description[:200] if description else "Business company"}

{f"Pain points: {', '.join(pain_points[:2])}" if pain_points else ""}

{f"Recent news: {recent_news[:150]}" if recent_news else ""}

{f"Our service context: {user_context}" if user_context else ""}

Create a personalized, engaging subject line that would make them want to open the email."""
        
        messages = [
            SystemMessage(content=system_prompt),
            HumanMessage(content=user_prompt)
        ]
        
        try:
            response = self.llm.invoke(messages)
            subject = response.content.strip()
            # Clean up subject (remove quotes if present)
            subject = subject.strip('"').strip("'").strip()
            # Limit length
            if len(subject) > 100:
                subject = subject[:97] + "..."
            return subject
        except Exception as e:
            print(f"Subject generation error: {e}")
            # Fallback subject
            return f"Quick question about {company_name}"
    
    def _generate_fallback_email(self, name: str, company_name: str, description: str) -> str:
        """Generate a simple fallback email if LLM fails"""
        return f"""Hi {name},

I noticed {company_name} is working on {description[:100] if description else "exciting projects"}.

I'd love to share how we might be able to help. Would you be open to a brief conversation this week?

Best regards,
[Your Name]"""
    
    def generate_email_body_only(self, lead_info: Dict, user_context: Optional[str] = None) -> str:
        """
        Generate only the email body (for backward compatibility)
        Returns just the body string
        """
        result = self.generate_email(lead_info, user_context)
        return result.get("body", "")

