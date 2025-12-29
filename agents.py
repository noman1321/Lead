"""
AI Agents for Lead Discovery and Enrichment
Uses LangChain patterns with SERP API for search
"""
import re
import requests
from typing import List, Dict, Optional
from langchain_openai import ChatOpenAI
from langchain_core.messages import HumanMessage, SystemMessage
import config

try:
    from serpapi import GoogleSearch
    SERPAPI_AVAILABLE = True
except ImportError:
    SERPAPI_AVAILABLE = False


class LeadDiscoveryAgent:
    """Agent that searches for companies matching the user's criteria"""
    
    def __init__(self):
        if not config.OPENAI_API_KEY:
            raise ValueError("OPENAI_API_KEY not set in config")
        self.llm = ChatOpenAI(
            model=config.LLM_MODEL,
            temperature=0.7,
            api_key=config.OPENAI_API_KEY
        )
        self.serpapi_key = config.SERPAPI_API_KEY
        self.tavily_api_key = config.TAVILY_API_KEY
    
    def search_companies(self, query: str, max_results: int = 10) -> List[Dict]:
        """
        Search for companies using SERP API (Google Search)
        Returns list of companies with their websites
        """
        results = []
        
        try:
            # Use SERP API for web search (primary method)
            if self.serpapi_key and SERPAPI_AVAILABLE:
                search = GoogleSearch({
                    "q": query,
                    "api_key": self.serpapi_key,
                    "num": max_results,
                    "engine": "google"
                })
                
                search_results = search.get_dict()
                
                # Extract organic results
                if "organic_results" in search_results:
                    for result in search_results["organic_results"][:max_results]:
                        results.append({
                            "title": result.get("title", ""),
                            "url": result.get("link", ""),
                            "content": result.get("snippet", ""),
                            "score": 1.0,  # SERP API doesn't provide scores, default to 1.0
                        })
                
                # Also check for knowledge graph results (company info)
                if "knowledge_graph" in search_results:
                    kg = search_results["knowledge_graph"]
                    if "website" in kg:
                        results.insert(0, {
                            "title": kg.get("title", ""),
                            "url": kg.get("website", ""),
                            "content": kg.get("description", ""),
                            "score": 1.0,
                        })
            
            # Fallback to Tavily if SERP API not available
            elif self.tavily_api_key:
                tavily_url = "https://api.tavily.com/search"
                response = requests.post(
                    tavily_url,
                    json={
                        "api_key": self.tavily_api_key,
                        "query": query,
                        "search_depth": "basic",
                        "max_results": max_results,
                        "include_domains": [],
                        "include_answer": True,
                    },
                    timeout=30
                )
                
                if response.status_code == 200:
                    data = response.json()
                    for result in data.get("results", []):
                        results.append({
                            "title": result.get("title", ""),
                            "url": result.get("url", ""),
                            "content": result.get("content", ""),
                            "score": result.get("score", 0),
                        })
            else:
                # Final fallback: Use LLM to generate search suggestions
                results = self._generate_mock_results(query, max_results)
        
        except Exception as e:
            print(f"Search error: {e}")
            results = self._generate_mock_results(query, max_results)
        
        return results
    
    def _generate_mock_results(self, query: str, max_results: int) -> List[Dict]:
        """Generate mock results when API is not available"""
        return [
            {
                "title": f"Company {i+1} matching: {query}",
                "url": f"https://example-company-{i+1}.com",
                "content": f"This is a company that matches the search criteria: {query}",
                "score": 0.8 - (i * 0.1)
            }
            for i in range(min(max_results, 5))
        ]


class LeadEnrichmentAgent:
    """Agent that scrapes websites and extracts contact information"""
    
    def __init__(self):
        if not config.OPENAI_API_KEY:
            raise ValueError("OPENAI_API_KEY not set in config")
        self.llm = ChatOpenAI(
            model=config.LLM_MODEL,
            temperature=0.3,
            api_key=config.OPENAI_API_KEY
        )
        self.firecrawl_api_key = config.FIRECRAWL_API_KEY
    
    def scrape_website(self, url: str) -> Optional[Dict]:
        """
        Deep scrape a website and extract comprehensive company information
        Scrapes multiple pages (homepage, about, contact) for better data
        Uses Firecrawl if available, otherwise falls back to requests + LLM
        """
        try:
            # Normalize URL
            base_url = self._normalize_url(url)
            website_url = base_url  # Store the main website URL
            
            # Collect content from multiple pages
            all_content = []
            pages_to_scrape = [
                base_url,  # Homepage
                f"{base_url}/about",
                f"{base_url}/contact",
                f"{base_url}/company",
                f"{base_url}/team"
            ]
            
            # Try Firecrawl first (better for deep scraping)
            if self.firecrawl_api_key:
                scraped_data = self._deep_scrape_with_firecrawl(pages_to_scrape, base_url)
                if scraped_data:
                    scraped_data["website_url"] = website_url  # Always include website URL
                    return scraped_data
                # If Firecrawl fails, fall through to requests fallback
            
            # Fallback: scrape with requests (more reliable for timeout-prone sites)
            scraped_data = self._deep_scrape_with_requests(pages_to_scrape, base_url)
            if scraped_data:
                scraped_data["website_url"] = website_url  # Always include website URL
                return scraped_data
            
            return None
        except Exception as e:
            print(f"Scraping error for {url}: {e}")
            return None
    
    def _normalize_url(self, url: str) -> str:
        """Normalize URL to base domain"""
        url = url.strip()
        if not url.startswith(('http://', 'https://')):
            url = 'https://' + url
        # Remove path to get base URL
        from urllib.parse import urlparse
        parsed = urlparse(url)
        return f"{parsed.scheme}://{parsed.netloc}"
    
    def _deep_scrape_with_firecrawl(self, urls: List[str], base_url: str) -> Optional[Dict]:
        """Deep scrape multiple pages using Firecrawl with retry logic and timeout handling"""
        import time
        all_content = []
        successful_pages = []
        
        # Limit pages and prioritize homepage
        priority_urls = [urls[0]] if urls else []  # Always try homepage first
        other_urls = urls[1:3] if len(urls) > 1 else []  # Try up to 2 additional pages
        
        for url in priority_urls + other_urls:
            max_retries = 2
            retry_delay = 1
            
            for attempt in range(max_retries):
                try:
                    firecrawl_url = "https://api.firecrawl.dev/v0/scrape"
                    headers = {
                        "Authorization": f"Bearer {self.firecrawl_api_key}",
                        "Content-Type": "application/json"
                    }
                    
                    # Shorter timeout for faster failure and retry
                    timeout = 15 if attempt == 0 else 10
                    
                    response = requests.post(
                        firecrawl_url,
                        json={"url": url},
                        headers=headers,
                        timeout=timeout
                    )
                    
                    if response.status_code == 200:
                        data = response.json()
                        markdown_content = data.get("data", {}).get("markdown", "")
                        if markdown_content:
                            all_content.append({
                                "url": url,
                                "content": markdown_content[:3000]  # Limit per page
                            })
                            successful_pages.append(url)
                            break  # Success, move to next URL
                    elif response.status_code == 429:
                        # Rate limited, wait longer
                        if attempt < max_retries - 1:
                            time.sleep(retry_delay * 2)
                            continue
                
                except requests.exceptions.Timeout:
                    if attempt < max_retries - 1:
                        # Log but don't print error - timeouts are expected for some sites
                        print(f"⚠️  Timeout scraping {url} (attempt {attempt + 1}/{max_retries}), retrying...")
                        time.sleep(retry_delay)
                        retry_delay *= 2  # Exponential backoff
                    else:
                        # Final attempt failed, skip this URL
                        print(f"⚠️  Skipping {url} after {max_retries} timeout attempts")
                        continue
                
                except requests.exceptions.RequestException as e:
                    # Network errors - log but continue
                    if attempt < max_retries - 1:
                        print(f"⚠️  Network error for {url} (attempt {attempt + 1}/{max_retries}): {str(e)[:50]}")
                        time.sleep(retry_delay)
                        retry_delay *= 2
                    else:
                        print(f"⚠️  Skipping {url} due to network error")
                        continue
                
                except Exception as e:
                    # Other errors - log and skip
                    print(f"⚠️  Error scraping {url}: {str(e)[:100]}")
                    break  # Don't retry for other errors
        
        # If we have at least the homepage, proceed
        if all_content:
            # Combine all content
            combined_content = "\n\n---PAGE BREAK---\n\n".join([
                f"Page: {item['url']}\n{item['content']}" 
                for item in all_content
            ])
            return self._extract_info_from_content(combined_content, base_url, successful_pages)
        
        # If Firecrawl failed completely, return None to trigger fallback
        return None
    
    def _deep_scrape_with_requests(self, urls: List[str], base_url: str) -> Optional[Dict]:
        """Deep scrape multiple pages using requests + BeautifulSoup"""
        all_content = []
        successful_pages = []
        
        try:
            from bs4 import BeautifulSoup
            headers = {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
            
            for url in urls[:3]:  # Limit to 3 pages
                try:
                    # Shorter timeout for faster fallback
                    response = requests.get(url, headers=headers, timeout=8, allow_redirects=True)
                    if response.status_code == 200:
                        soup = BeautifulSoup(response.content, 'html.parser')
                        
                        # Remove script and style elements
                        for script in soup(["script", "style", "nav", "footer", "header"]):
                            script.decompose()
                        
                        # Extract main content
                        main_content = soup.find('main') or soup.find('article') or soup.find('body')
                        if main_content:
                            text = main_content.get_text()
                        else:
                            text = soup.get_text()
                        
                        # Clean up text
                        lines = (line.strip() for line in text.splitlines())
                        chunks = (phrase.strip() for line in lines for phrase in line.split("  "))
                        text = ' '.join(chunk for chunk in chunks if chunk)
                        
                        if text and len(text) > 100:  # Only add if meaningful content
                            all_content.append({
                                "url": url,
                                "content": text[:3000]  # Limit per page
                            })
                            successful_pages.append(url)
                except Exception as e:
                    print(f"Error scraping {url}: {e}")
                    continue
        except Exception as e:
            print(f"Requests scraping error: {e}")
        
        if all_content:
            # Combine all content
            combined_content = "\n\n---PAGE BREAK---\n\n".join([
                f"Page: {item['url']}\n{item['content']}" 
                for item in all_content
            ])
            return self._extract_info_from_content(combined_content, base_url, successful_pages)
        
        return None
    
    
    def _extract_info_from_content(self, content: str, base_url: str, scraped_pages: List[str] = None) -> Dict:
        """Use LLM to extract comprehensive structured information from scraped content"""
        # Increase content limit for deeper analysis
        content_to_analyze = content[:6000] if len(content) > 6000 else content
        
        prompt = f"""
        Extract comprehensive information from this company website content (scraped from multiple pages):
        
        {content_to_analyze}
        
        Extract and return as JSON with the following structure:
        {{
            "company_name": "official name of the company",
            "description": "detailed description of what the company does, their products/services, and value proposition",
            "website_url": "{base_url}",
            "email": "contact email if found (check contact pages, footer, etc.), otherwise null",
            "phone": "phone number if found, otherwise null",
            "location": "city, country or address if mentioned",
            "industry": "industry or sector the company operates in",
            "company_size": "number of employees or size category if mentioned (e.g., '50-100 employees', 'startup', 'enterprise')",
            "founded_year": "year company was founded if mentioned",
            "pain_points": ["list", "of", "specific", "pain", "points", "or", "challenges", "they", "might", "face", "based", "on", "their", "industry", "and", "content"],
            "recent_news": "any recent news, achievements, funding, partnerships, or milestones mentioned",
            "social_media": {{
                "linkedin": "LinkedIn URL if found",
                "twitter": "Twitter/X URL if found",
                "facebook": "Facebook URL if found"
            }},
            "key_features": ["list", "of", "key", "features", "or", "services", "they", "offer"],
            "target_audience": "who their target customers are"
        }}
        
        Important:
        - Always include the website_url field with the base URL: {base_url}
        - Extract email from content, footer, contact pages
        - If email not found, suggest common patterns like contact@domain, info@domain, hello@domain based on the URL
        - Be thorough in extracting pain_points based on industry and company description
        - Extract as much detail as possible from the content
        """
        
        messages = [
            SystemMessage(content="You are an expert at extracting comprehensive structured information from company websites. Analyze the content deeply and extract all available details. Return only valid JSON without any additional text."),
            HumanMessage(content=prompt)
        ]
        
        try:
            import json
            response = self.llm.invoke(messages)
            # Try to extract JSON from response
            response_content = response.content
            # Remove markdown code blocks if present
            if "```json" in response_content:
                response_content = response_content.split("```json")[1].split("```")[0]
            elif "```" in response_content:
                response_content = response_content.split("```")[1].split("```")[0]
            
            extracted_info = json.loads(response_content.strip())
            
            # Ensure website_url is always set
            if not extracted_info.get("website_url"):
                extracted_info["website_url"] = base_url
            
            # Try to find email in original content if not found
            if not extracted_info.get("email"):
                email = self._find_email_in_content(content, base_url)
                if email:
                    extracted_info["email"] = email
                else:
                    # Try guessing from URL
                    guessed_email = self._guess_email_from_url(base_url)
                    if guessed_email:
                        extracted_info["email"] = guessed_email
            
            # Ensure all required fields exist
            extracted_info.setdefault("source_url", base_url)
            extracted_info.setdefault("scraped_pages", scraped_pages or [base_url])
            
            return extracted_info
        except Exception as e:
            print(f"LLM extraction error: {e}")
            # Return comprehensive basic info
            domain = base_url.split("//")[-1].split("/")[0]
            return {
                "company_name": domain.replace("www.", "").split(".")[0].title(),
                "description": content[:300] if content else "No description available",
                "website_url": base_url,
                "email": self._guess_email_from_url(base_url),
                "phone": None,
                "location": None,
                "industry": None,
                "company_size": None,
                "founded_year": None,
                "pain_points": [],
                "recent_news": None,
                "social_media": {},
                "key_features": [],
                "target_audience": None,
                "source_url": base_url,
                "scraped_pages": scraped_pages or [base_url]
            }
    
    def _find_email_in_content(self, content: str, url: str) -> Optional[str]:
        """Try to find email addresses in content"""
        email_pattern = r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b'
        emails = re.findall(email_pattern, content)
        if emails:
            return emails[0]
        return None
    
    def _guess_email_from_url(self, url: str) -> Optional[str]:
        """Guess common email patterns from URL"""
        try:
            domain = url.split("//")[-1].split("/")[0]
            if domain.startswith("www."):
                domain = domain[4:]
            # Try common patterns
            common_emails = [
                f"contact@{domain}",
                f"info@{domain}",
                f"hello@{domain}",
                f"sales@{domain}"
            ]
            return common_emails[0]  # Return first as guess
        except:
            return None


class LeadValidatorAgent:
    """Agent that validates if a lead matches the criteria"""
    
    def __init__(self):
        if not config.OPENAI_API_KEY:
            raise ValueError("OPENAI_API_KEY not set in config")
        self.llm = ChatOpenAI(
            model=config.LLM_MODEL,
            temperature=0.3,
            api_key=config.OPENAI_API_KEY
        )
    
    def validate_lead(self, lead_info: Dict, original_query: str) -> bool:
        """Determine if a lead matches the original search criteria"""
        # Extract key information for validation
        company_name = lead_info.get("company_name", "").lower()
        description = str(lead_info.get("description", "")).lower()
        website_url = lead_info.get("website_url", "").lower()
        
        # If we don't have enough info, default to valid
        if not company_name and not description:
            return True
        
        prompt = f"""
        Original search query: "{original_query}"
        
        Lead information:
        - Company: {company_name}
        - Description: {description[:200]}
        - Website: {website_url}
        
        Task: Determine if this lead is RELEVANT to the search query. 
        
        Guidelines:
        - If searching for restaurants, accept restaurant review sites, food blogs, and dining guides as they are relevant
        - If searching for businesses, accept business directories, review sites, and related services
        - Be lenient - if there's any connection to the query, accept it
        - Only reject if completely unrelated (e.g., a restaurant site when searching for software companies)
        
        Answer only 'yes' or 'no'.
        """
        
        messages = [
            SystemMessage(content="You are a lead validation expert. Be lenient and accept leads that are even loosely related to the search query. Answer only 'yes' or 'no'."),
            HumanMessage(content=prompt)
        ]
        
        try:
            response = self.llm.invoke(messages)
            answer = response.content.lower().strip()
            is_valid = "yes" in answer or answer.startswith("y")
            
            if not is_valid:
                print(f"Validation rejected: {company_name} - LLM response: {answer}")
            
            return is_valid
        except Exception as e:
            print(f"Validation error for {company_name}: {e}")
            # Default to valid if validation fails - better to include than exclude
            return True

