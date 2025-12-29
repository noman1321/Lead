// Main Application JavaScript
const API_BASE = ''; // Same origin

// State
let currentTab = 'discover';
let leads = [];
let campaigns = [];
let currentLeadEmail = null;

// Initialize
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
});

async function initializeApp() {
    setupEventListeners();
    loadConfiguration();
    await loadCampaigns(); // Load campaigns first
    loadStats();
    toggleCampaignType(); // Set initial campaign type state
    updateDownloadButton(0); // Initialize download button state
    switchTab('discover');
}

// Event Listeners
function setupEventListeners() {
    // Tab navigation
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const tab = item.dataset.tab;
            switchTab(tab);
            
            // Close sidebar on mobile after selecting a tab
            if (window.innerWidth <= 768) {
                const sidebar = document.getElementById('sidebar');
                const overlay = document.getElementById('mobileMenuOverlay');
                if (sidebar && sidebar.classList.contains('active')) {
                    sidebar.classList.remove('active');
                    if (overlay) overlay.classList.remove('active');
                }
            }
        });
    });

    // Discover leads
    document.getElementById('discoverBtn')?.addEventListener('click', handleDiscoverLeads);

    // Campaign type toggle
    document.querySelectorAll('input[name="campaignType"]').forEach(radio => {
        radio.addEventListener('change', toggleCampaignType);
    });

    // Refresh button
    document.getElementById('refreshBtn')?.addEventListener('click', () => {
        if (currentTab === 'manage') {
            loadLeads();
        } else if (currentTab === 'analytics') {
            loadStats();
        }
    });

    // Test email
    document.getElementById('testEmailBtn')?.addEventListener('click', handleTestEmail);

    // Bulk email
    document.getElementById('bulkSendBtn')?.addEventListener('click', handleBulkSend);
    document.getElementById('confirmBulkSend')?.addEventListener('change', updateBulkButtonState);

    // Filters
    document.getElementById('filterCampaign')?.addEventListener('change', loadLeads);
    document.getElementById('filterStatus')?.addEventListener('change', loadLeads);
    document.getElementById('searchEmail')?.addEventListener('input', debounce(loadLeads, 300));

    // Download leads
    document.getElementById('downloadLeadsBtn')?.addEventListener('click', downloadLeadsCSV);

    // Modal
    document.getElementById('closeModal')?.addEventListener('click', closeLeadModal);

    // Sidebar toggle (desktop)
    document.getElementById('sidebarToggle')?.addEventListener('click', toggleSidebar);
    
    // Mobile menu button
    document.getElementById('mobileMenuBtn')?.addEventListener('click', toggleSidebar);
}

// Tab Management
function switchTab(tab) {
    currentTab = tab;
    
    // Update nav items
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
        if (item.dataset.tab === tab) {
            item.classList.add('active');
        }
    });

    // Update tab content
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });
    document.getElementById(`tab-${tab}`)?.classList.add('active');

    // Update page title with animation
    const titles = {
        discover: 'Discover Leads',
        manage: 'Manage Leads',
        bulk: 'Bulk Email',
        analytics: 'Analytics'
    };
    const pageTitle = document.getElementById('pageTitle');
    if (pageTitle) {
        pageTitle.style.opacity = '0';
        pageTitle.style.transform = 'translateY(-10px)';
        setTimeout(() => {
            pageTitle.textContent = titles[tab] || 'Dashboard';
            pageTitle.style.transition = 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)';
            pageTitle.style.opacity = '1';
            pageTitle.style.transform = 'translateY(0)';
        }, 150);
    }

    // Load data for current tab
    if (tab === 'discover') {
        loadCampaigns(); // Ensure campaigns are loaded for discover tab
    } else if (tab === 'manage') {
        loadLeads();
    } else if (tab === 'bulk') {
        updateBulkCount();
    } else if (tab === 'analytics') {
        loadStats();
        loadCampaigns(); // Load campaigns for analytics tab
        displayCampaignsList(); // Display campaigns with delete buttons
        loadAnalyticsCharts(); // Load all charts
    }
}

// Configuration
async function loadConfiguration() {
    try {
        const response = await fetch(`${API_BASE}/api/config`);
        const config = await response.json();
        
        updateStatusBadge('openaiBadge', config.openai_key);
        updateStatusBadge('serpapiBadge', config.serpapi_key);
        updateStatusBadge('smtpBadge', config.smtp_configured);
    } catch (error) {
        console.error('Error loading config:', error);
    }
}

function updateStatusBadge(badgeId, status) {
    const badge = document.getElementById(badgeId);
    if (badge) {
        badge.textContent = status ? '✅' : '❌';
    }
}

// Discover Leads
function toggleCampaignType() {
    const campaignType = document.querySelector('input[name="campaignType"]:checked')?.value;
    const existingGroup = document.getElementById('existingCampaignGroup');
    const newGroup = document.getElementById('newCampaignGroup');
    const existingRadio = document.getElementById('campaignTypeExisting');
    const newRadio = document.getElementById('campaignTypeNew');
    
    // If no campaigns exist, force "new campaign" mode
    if (campaigns.length === 0 && campaignType === 'existing') {
        if (newRadio) {
            newRadio.checked = true;
            return toggleCampaignType(); // Recursive call with new selection
        }
    }
    
    if (campaignType === 'existing') {
        existingGroup.style.display = 'block';
        newGroup.style.display = 'none';
        if (existingRadio) existingRadio.disabled = false;
    } else {
        existingGroup.style.display = 'none';
        newGroup.style.display = 'block';
        if (existingRadio) existingRadio.disabled = false;
    }
    
    // Disable "existing" option if no campaigns
    if (existingRadio) {
        existingRadio.disabled = campaigns.length === 0;
        if (campaigns.length === 0 && existingRadio.checked) {
            if (newRadio) newRadio.checked = true;
            toggleCampaignType();
        }
    }
}

async function handleDiscoverLeads() {
    const query = document.getElementById('searchQuery').value.trim();
    if (!query) {
        showToast('Please enter a search query', 'error');
        return;
    }

    const maxLeads = parseInt(document.getElementById('maxLeads').value) || 10;
    const userContext = document.getElementById('userContext').value.trim();
    const campaignType = document.querySelector('input[name="campaignType"]:checked')?.value;
    
    let campaignId = null;
    let campaignName = null;
    
    if (campaignType === 'existing') {
        campaignId = document.getElementById('existingCampaign').value;
        if (!campaignId) {
            showToast('Please select an existing campaign', 'error');
            return;
        }
    } else {
        campaignName = document.getElementById('campaignName').value.trim();
        // campaignName can be empty, it will use query as fallback
    }

    showLoadingWithProgress('Discovering leads... This may take a minute.');
    
    // Create and show progress steps
    const loadingContent = document.querySelector('.loading-content');
    if (loadingContent) {
        const progressSteps = createProgressSteps([
            { title: 'Searching for companies', description: 'Using AI to find matching companies', status: 'pending' },
            { title: 'Analyzing company data', description: 'Extracting company information', status: 'pending' },
            { title: 'Extracting contact information', description: 'Finding email addresses', status: 'pending' },
            { title: 'Validating leads', description: 'Verifying lead quality', status: 'pending' },
            { title: 'Finalizing results', description: 'Preparing your leads', status: 'pending' }
        ]);
        const existingSteps = loadingContent.querySelector('.progress-indicator');
        if (existingSteps) existingSteps.remove();
        loadingContent.insertBefore(progressSteps, loadingContent.querySelector('.progress-container'));
    }
    
    // Start progress simulation
    simulateProgress();

    try {
        const requestBody = {
            query,
            max_leads: maxLeads,
            user_context: userContext
        };
        
        if (campaignId) {
            requestBody.campaign_id = campaignId;
        } else {
            requestBody.campaign_name = campaignName || null;
        }
        
        const response = await fetch(`${API_BASE}/api/leads/discover`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody)
        });

        const data = await response.json();
        
        // Complete progress to 100%
        completeProgress();
        
        // Mark all steps as completed
        const progressStepsContainer = document.querySelector('.progress-indicator');
        if (progressStepsContainer) {
            updateProgressSteps(progressStepsContainer, 5); // All steps completed
        }
        
        setTimeout(() => {
            clearProgressInterval();
            hideLoading();
        }, 500);

        if (!response.ok) {
            throw new Error(data.detail || 'Failed to discover leads');
        }

        if (data.success && data.leads && data.leads.length > 0) {
            displayDiscoveredLeads(data.leads);
            showToast(`Successfully discovered ${data.leads.length} leads!`, 'success');
            loadCampaigns();
            loadStats();
        } else {
            showToast('No leads found. Try a different search query.', 'info');
        }
    } catch (error) {
        clearProgressInterval();
        setTimeout(() => {
            hideLoading();
        }, 200);
        showToast(`Error: ${error.message}`, 'error');
    }
}

// Progress simulation for lead discovery
let progressInterval = null;
let currentProgress = 0;

function simulateProgress() {
    currentProgress = 0;
    const progressFill = document.getElementById('progressFill');
    const progressText = document.getElementById('progressText');
    const loadingText = document.getElementById('loadingText');
    const progressStepsContainer = document.querySelector('.progress-indicator');
    
    const stages = [
        { progress: 20, message: 'Searching for companies...', stepIndex: 0 },
        { progress: 40, message: 'Analyzing company data...', stepIndex: 1 },
        { progress: 60, message: 'Extracting contact information...', stepIndex: 2 },
        { progress: 80, message: 'Validating leads...', stepIndex: 3 },
        { progress: 95, message: 'Finalizing results...', stepIndex: 4 }
    ];
    
    let stageIndex = 0;
    
    progressInterval = setInterval(() => {
        if (stageIndex < stages.length) {
            const stage = stages[stageIndex];
            currentProgress = stage.progress;
            
            if (loadingText) {
                loadingText.textContent = stage.message;
            }
            
            // Update progress steps
            if (progressStepsContainer) {
                updateProgressSteps(progressStepsContainer, stage.stepIndex);
            }
            
            stageIndex++;
        } else {
            // Slow progress from 95% to 99%
            if (currentProgress < 99) {
                currentProgress += 0.5;
            }
        }
        
        if (progressFill) {
            progressFill.style.width = currentProgress + '%';
        }
        if (progressText) {
            progressText.textContent = Math.round(currentProgress) + '%';
        }
    }, 800); // Update every 800ms
    
    return progressInterval;
}

function completeProgress() {
    const progressFill = document.getElementById('progressFill');
    const progressText = document.getElementById('progressText');
    const loadingText = document.getElementById('loadingText');
    
    if (progressFill) progressFill.style.width = '100%';
    if (progressText) progressText.textContent = '100%';
    if (loadingText) loadingText.textContent = 'Complete!';
}

function clearProgressInterval() {
    if (progressInterval) {
        clearInterval(progressInterval);
        progressInterval = null;
    }
    currentProgress = 0;
    
    // Reset progress bar
    const progressFill = document.getElementById('progressFill');
    const progressText = document.getElementById('progressText');
    if (progressFill) progressFill.style.width = '0%';
    if (progressText) progressText.textContent = '0%';
}

function displayDiscoveredLeads(leads) {
    const container = document.getElementById('discoveredLeads');
    const list = document.getElementById('leadsList');
    
    container.style.display = 'block';
    list.innerHTML = '';

    leads.forEach((lead, index) => {
        const leadCard = createLeadCard(lead, index);
        list.appendChild(leadCard);
    });
}

function createLeadCard(lead, index) {
    const card = document.createElement('div');
    card.className = 'lead-card';
    card.dataset.email = lead.email;

    const painPoints = lead.company_data?.pain_points || [];
    const painPointsHtml = painPoints.slice(0, 3).map(p => 
        `<span class="pain-point">${escapeHtml(p)}</span>`
    ).join('');

    const websiteUrl = lead.website_url || lead.company_data?.website_url || lead.company_data?.source_url || '';
    const websiteLink = websiteUrl ? `<p><i class="fas fa-globe"></i> <a href="${escapeHtml(websiteUrl)}" target="_blank" rel="noopener noreferrer" style="color: var(--primary); text-decoration: none;">${escapeHtml(websiteUrl)}</a></p>` : '';

    card.innerHTML = `
        <div class="lead-header">
            <div class="lead-info">
                <h3>${escapeHtml(lead.company_name || 'Unknown Company')}</h3>
                <p><i class="fas fa-envelope"></i> ${escapeHtml(lead.email)}</p>
                ${websiteLink}
                ${lead.name ? `<p><i class="fas fa-user"></i> ${escapeHtml(lead.name)}</p>` : ''}
            </div>
            <div class="lead-actions">
                <button class="btn-small btn-primary" onclick="generateEmail('${lead.email}', ${index})">
                    <i class="fas fa-magic"></i> Generate Email
                </button>
            </div>
        </div>
        ${lead.description ? `<div class="lead-description">${escapeHtml(lead.description)}</div>` : ''}
        ${painPointsHtml ? `<div class="lead-pain-points">${painPointsHtml}</div>` : ''}
        <div id="emailEditor_${index}" class="email-editor" style="display: none;">
            <div class="form-group">
                <label>Subject</label>
                <input type="text" id="subject_${index}" class="input" placeholder="Email subject">
            </div>
            <div class="form-group">
                <label>Email Body</label>
                <textarea id="emailBody_${index}" class="textarea" rows="8" placeholder="Email content"></textarea>
            </div>
            <div class="form-group">
                <button class="btn-primary" onclick="sendEmail('${lead.email}', ${index})">
                    <i class="fas fa-paper-plane"></i> Send Email
                </button>
                <button class="btn-secondary" onclick="closeEmailEditor(${index})">
                    <i class="fas fa-times"></i> Cancel
                </button>
            </div>
        </div>
    `;

    return card;
}

async function generateEmail(email, index) {
    const userContext = document.getElementById('userContext').value.trim();
    
    showLoading('Generating personalized email...');
    const emailProgressInterval = simulateEmailProgress();

    try {
        const response = await fetch(`${API_BASE}/api/email/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                lead_email: email,
                user_context: userContext
            })
        });

        const data = await response.json();
        clearInterval(emailProgressInterval);
        hideLoading();

        if (!response.ok) {
            throw new Error(data.detail || 'Failed to generate email');
        }

        if (data.success) {
            const editor = document.getElementById(`emailEditor_${index}`);
            document.getElementById(`subject_${index}`).value = data.subject || '';
            document.getElementById(`emailBody_${index}`).value = data.body || '';
            editor.style.display = 'block';
            editor.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
    } catch (error) {
        clearInterval(emailProgressInterval);
        hideLoading();
        showToast(`Error generating email: ${error.message}`, 'error');
    }
}

function simulateEmailProgress() {
    let progress = 0;
    const progressFill = document.getElementById('progressFill');
    const progressText = document.getElementById('progressText');
    
    const interval = setInterval(() => {
        progress += 15;
        if (progress > 95) progress = 95;
        
        if (progressFill) progressFill.style.width = progress + '%';
        if (progressText) progressText.textContent = Math.round(progress) + '%';
    }, 200);
    
    return interval;
}

function closeEmailEditor(index) {
    document.getElementById(`emailEditor_${index}`).style.display = 'none';
}

async function sendEmail(email, index) {
    const subject = document.getElementById(`subject_${index}`).value.trim();
    const body = document.getElementById(`emailBody_${index}`).value.trim();

    if (!subject || !body) {
        showToast('Subject and body are required', 'error');
        return;
    }

    // Optimistic UI update
    const leadCard = document.querySelector(`.lead-card:has(input[value="${email}"])`);
    let rollback = null;
    
    if (leadCard) {
        const statusElement = leadCard.querySelector('.status-badge, .lead-status');
        if (statusElement) {
            rollback = optimisticUpdate(statusElement, (element) => {
                element.textContent = 'emailed';
                element.className = 'status-badge status-emailed';
            });
        }
    }

    showLoading('Sending email...');

    try {
        const response = await fetch(`${API_BASE}/api/email/send`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                lead_email: email,
                subject,
                email_content: body
            })
        });

        const data = await response.json();
        hideLoading();

        if (!response.ok) {
            if (rollback) rollback();
            const errorMsg = data.detail || data.message || 'Failed to send email';
            console.error('Email send error:', errorMsg);
            showToast(errorMsg, 'error');
            return;
        }

        if (data.success) {
            // Update lead in local state
            const leadIndex = leads.findIndex(l => l.email === email);
            if (leadIndex !== -1) {
                leads[leadIndex].status = 'emailed';
                leads[leadIndex].sent_email_at = new Date().toISOString();
            }
            
            showSuccessCheckmark(document.querySelector('.topbar-right'));
            showToast(data.message || 'Email sent successfully!', 'success');
            closeEmailEditor(index);
            
            // Refresh in background
            setTimeout(() => {
                loadLeads();
                loadStats();
            }, 500);
        }
    } catch (error) {
        hideLoading();
        if (rollback) rollback();
        showToast(`Error sending email: ${error.message}`, 'error');
    }
}

// Load Leads
async function loadLeads() {
    const campaignFilter = document.getElementById('filterCampaign')?.value || '';
    const statusFilter = document.getElementById('filterStatus')?.value || '';
    const searchEmail = document.getElementById('searchEmail')?.value || '';

    // Show skeleton loader instead of full overlay
    showTableSkeleton(8);

    try {
        const params = new URLSearchParams();
        if (campaignFilter) params.append('campaign_id', campaignFilter);
        if (statusFilter) params.append('status', statusFilter);
        params.append('limit', '1000');
        
        const response = await fetch(`${API_BASE}/api/leads?${params.toString()}`);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();

        console.log('Leads API response:', data); // Debug log

        if (data.success) {
            leads = Array.isArray(data.leads) ? data.leads : [];
            
            console.log(`Loaded ${leads.length} leads`); // Debug log
            
            // Apply email search filter
            if (searchEmail) {
                leads = leads.filter(lead => 
                    lead && lead.email && lead.email.toLowerCase().includes(searchEmail.toLowerCase())
                );
            }

            // Small delay for smooth transition from skeleton
            setTimeout(() => {
                displayLeadsTable(leads);
                updateDownloadButton(leads.length);
            }, 300);
        } else {
            console.error('API returned success=false:', data);
            const tbody = document.getElementById('leadsTableBody');
            if (tbody) {
                tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 2rem; color: var(--danger);">Failed to load leads</td></tr>';
            }
            showToast('Failed to load leads', 'error');
            updateDownloadButton(0);
        }
    } catch (error) {
        console.error('Error loading leads:', error);
        const tbody = document.getElementById('leadsTableBody');
        if (tbody) {
            tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; padding: 2rem; color: var(--danger);">Error: ${error.message}</td></tr>`;
        }
        showToast(`Error loading leads: ${error.message}`, 'error');
        updateDownloadButton(0);
    }
}

function updateDownloadButton(leadCount) {
    const downloadBtn = document.getElementById('downloadLeadsBtn');
    if (downloadBtn) {
        if (leadCount > 0) {
            downloadBtn.disabled = false;
            downloadBtn.title = `Download ${leadCount} leads as CSV`;
        } else {
            downloadBtn.disabled = true;
            downloadBtn.title = 'No leads to download';
        }
    }
}

function displayLeadsTable(leads) {
    const tbody = document.getElementById('leadsTableBody');
    if (!tbody) {
        console.error('leadsTableBody element not found');
        return;
    }
    
    tbody.innerHTML = '';

    if (!Array.isArray(leads) || leads.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 2rem;">No leads found</td></tr>';
        return;
    }

    leads.forEach(lead => {
        if (!lead) {
            console.warn('Skipping invalid lead:', lead);
            return;
        }
        
        const row = document.createElement('tr');
        const statusClass = `status-${lead.status || 'found'}`;
        
        row.innerHTML = `
            <td>${lead.id || '-'}</td>
            <td>${escapeHtml(lead.email || '-')}</td>
            <td>${escapeHtml(lead.name || '-')}</td>
            <td>${escapeHtml(lead.company_name || '-')}</td>
            <td><span class="status-badge ${statusClass}">${lead.status || 'found'}</span></td>
            <td>${formatDate(lead.created_at)}</td>
            <td class="actions-cell">
                <div class="action-buttons">
                    <button class="btn-small btn-secondary" onclick="viewLeadDetails(${lead.id})" title="View Details">
                        <i class="fas fa-eye"></i>
                    </button>
                    <button class="btn-small btn-danger" onclick="deleteLead(${lead.id})" title="Delete Lead">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </td>
        `;
        tbody.appendChild(row);
    });
    
    console.log(`Displayed ${leads.length} leads in table`); // Debug log
}

// Download Leads as CSV
function downloadLeadsCSV() {
    if (!leads || leads.length === 0) {
        showToast('No leads to download', 'info');
        return;
    }

    // Prepare CSV headers
    const headers = [
        'ID',
        'Email',
        'Name',
        'Company Name',
        'Website URL',
        'Status',
        'Campaign ID',
        'Created At',
        'Last Contacted At',
        'Sent Email At',
        'Has Replied',
        'Description',
        'Pain Points'
    ];

    // Convert leads to CSV rows
    const csvRows = [headers.join(',')];

    leads.forEach(lead => {
        const companyData = lead.company_data || {};
        const painPoints = Array.isArray(companyData.pain_points) 
            ? companyData.pain_points.join('; ') 
            : '';
        const description = companyData.description || '';
        const websiteUrl = lead.website_url || companyData.website_url || companyData.source_url || '';

        const row = [
            lead.id || '',
            `"${(lead.email || '').replace(/"/g, '""')}"`,
            `"${(lead.name || '').replace(/"/g, '""')}"`,
            `"${(lead.company_name || '').replace(/"/g, '""')}"`,
            `"${websiteUrl.replace(/"/g, '""')}"`,
            lead.status || 'found',
            lead.campaign_id || '',
            lead.created_at || '',
            lead.last_contacted_at || '',
            lead.sent_email_at || '',
            lead.has_replied ? 'Yes' : 'No',
            `"${description.replace(/"/g, '""').replace(/\n/g, ' ').replace(/\r/g, '')}"`,
            `"${painPoints.replace(/"/g, '""')}"`
        ];
        csvRows.push(row.join(','));
    });

    // Create CSV content
    const csvContent = csvRows.join('\n');

    // Create blob and download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    // Generate filename with timestamp
    const now = new Date();
    const timestamp = now.toISOString().slice(0, 19).replace(/:/g, '-');
    const campaignFilter = document.getElementById('filterCampaign')?.value;
    const statusFilter = document.getElementById('filterStatus')?.value;
    let filename = `leads_${timestamp}`;
    
    if (campaignFilter) {
        const campaign = campaigns.find(c => c.id === campaignFilter);
        if (campaign) {
            filename += `_${campaign.name.replace(/[^a-z0-9]/gi, '_')}`;
        }
    }
    if (statusFilter) {
        filename += `_${statusFilter}`;
    }
    filename += '.csv';

    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    showToast(`Downloaded ${leads.length} leads as CSV`, 'success');
}

async function viewLeadDetails(leadId) {
    try {
        const response = await fetch(`${API_BASE}/api/leads/${leadId}`);
        const data = await response.json();
        
        if (data.success) {
            displayLeadModal(data.lead);
        }
    } catch (error) {
        showToast(`Error loading lead: ${error.message}`, 'error');
    }
}

function displayLeadModal(lead) {
    const modal = document.getElementById('leadModal');
    const content = document.getElementById('leadDetailsContent');
    
    const companyData = lead.company_data || {};
    const painPoints = companyData.pain_points || [];
    
    const websiteUrl = companyData.website_url || companyData.source_url || '';
    const websiteDisplay = websiteUrl ? `
        <div class="form-group">
            <label>Website</label>
            <div style="display: flex; align-items: center; gap: 0.5rem;">
                <input type="text" class="input" value="${escapeHtml(websiteUrl)}" readonly style="flex: 1;">
                <a href="${escapeHtml(websiteUrl)}" target="_blank" rel="noopener noreferrer" class="btn-small btn-secondary" title="Open Website">
                    <i class="fas fa-external-link-alt"></i>
                </a>
            </div>
        </div>
    ` : '';

    content.innerHTML = `
        <div class="form-group">
            <label>Email</label>
            <input type="text" class="input" value="${escapeHtml(lead.email)}" readonly>
        </div>
        <div class="form-row">
            <div class="form-group">
                <label>Name</label>
                <input type="text" class="input" value="${escapeHtml(lead.name || '')}" readonly>
            </div>
            <div class="form-group">
                <label>Company</label>
                <input type="text" class="input" value="${escapeHtml(lead.company_name || '')}" readonly>
            </div>
        </div>
        ${websiteDisplay}
        <div class="form-group">
            <label>Status</label>
            <input type="text" class="input" value="${lead.status || 'found'}" readonly>
        </div>
        ${companyData.description ? `
            <div class="form-group">
                <label>Description</label>
                <textarea class="textarea" readonly>${escapeHtml(companyData.description)}</textarea>
            </div>
        ` : ''}
        ${painPoints.length > 0 ? `
            <div class="form-group">
                <label>Pain Points</label>
                <div class="lead-pain-points">
                    ${painPoints.map(p => `<span class="pain-point">${escapeHtml(p)}</span>`).join('')}
                </div>
            </div>
        ` : ''}
        ${companyData.industry ? `
            <div class="form-group">
                <label>Industry</label>
                <input type="text" class="input" value="${escapeHtml(companyData.industry)}" readonly>
            </div>
        ` : ''}
        ${companyData.location ? `
            <div class="form-group">
                <label>Location</label>
                <input type="text" class="input" value="${escapeHtml(companyData.location)}" readonly>
            </div>
        ` : ''}
        ${companyData.company_size ? `
            <div class="form-group">
                <label>Company Size</label>
                <input type="text" class="input" value="${escapeHtml(companyData.company_size)}" readonly>
            </div>
        ` : ''}
        ${companyData.founded_year ? `
            <div class="form-group">
                <label>Founded Year</label>
                <input type="text" class="input" value="${escapeHtml(companyData.founded_year)}" readonly>
            </div>
        ` : ''}
        ${companyData.target_audience ? `
            <div class="form-group">
                <label>Target Audience</label>
                <input type="text" class="input" value="${escapeHtml(companyData.target_audience)}" readonly>
            </div>
        ` : ''}
        ${companyData.key_features && companyData.key_features.length > 0 ? `
            <div class="form-group">
                <label>Key Features/Services</label>
                <div class="lead-pain-points">
                    ${companyData.key_features.map(f => `<span class="pain-point" style="background: rgba(99, 102, 241, 0.1); color: var(--primary);">${escapeHtml(f)}</span>`).join('')}
                </div>
            </div>
        ` : ''}
        ${companyData.recent_news ? `
            <div class="form-group">
                <label>Recent News</label>
                <textarea class="textarea" readonly>${escapeHtml(companyData.recent_news)}</textarea>
            </div>
        ` : ''}
        ${companyData.social_media && Object.keys(companyData.social_media).length > 0 ? `
            <div class="form-group">
                <label>Social Media</label>
                <div style="display: flex; gap: 1rem; flex-wrap: wrap;">
                    ${companyData.social_media.linkedin ? `<a href="${escapeHtml(companyData.social_media.linkedin)}" target="_blank" class="btn-small btn-secondary"><i class="fab fa-linkedin"></i> LinkedIn</a>` : ''}
                    ${companyData.social_media.twitter ? `<a href="${escapeHtml(companyData.social_media.twitter)}" target="_blank" class="btn-small btn-secondary"><i class="fab fa-twitter"></i> Twitter</a>` : ''}
                    ${companyData.social_media.facebook ? `<a href="${escapeHtml(companyData.social_media.facebook)}" target="_blank" class="btn-small btn-secondary"><i class="fab fa-facebook"></i> Facebook</a>` : ''}
                </div>
            </div>
        ` : ''}
        <div class="form-group">
            <button class="btn-primary" onclick="generateEmailForLead('${lead.email}')">
                <i class="fas fa-magic"></i> Generate Email
            </button>
            ${!lead.has_replied ? `
                <button class="btn-secondary" onclick="markAsReplied(${lead.id})">
                    <i class="fas fa-check"></i> Mark as Replied
                </button>
            ` : ''}
        </div>
    `;
    
    modal.classList.add('active');
}

function closeLeadModal() {
    document.getElementById('leadModal').classList.remove('active');
}

async function deleteLead(leadId) {
    if (!confirm('Are you sure you want to delete this lead?')) {
        return;
    }

    // Find the row element for optimistic update
    const tbody = document.getElementById('leadsTableBody');
    const row = tbody?.querySelector(`tr:has(button[onclick*="${leadId}"])`);
    let rollback = null;

    // Optimistic UI update - hide row immediately
    if (row) {
        rollback = optimisticUpdate(row, (element) => {
            element.style.opacity = '0.5';
            element.style.transform = 'translateX(-20px)';
            setTimeout(() => {
                element.style.display = 'none';
            }, 300);
        });
    }

    try {
        const response = await fetch(`${API_BASE}/api/leads/${leadId}`, {
            method: 'DELETE'
        });
        const data = await response.json();
        
        if (data.success) {
            // Remove from local state
            leads = leads.filter(l => l.id !== leadId);
            
            // Update UI optimistically
            if (row) {
                row.remove();
                updateDownloadButton(leads.length);
            }
            
            showToast('Lead deleted successfully', 'success');
            showSuccessCheckmark(document.querySelector('.topbar-right'));
            
            // Refresh stats and campaigns in background
            loadStats();
            loadCampaigns();
        } else {
            // Rollback on error
            if (rollback) rollback();
            throw new Error(data.detail || 'Failed to delete lead');
        }
    } catch (error) {
        // Rollback on error
        if (rollback) rollback();
        showToast(`Error deleting lead: ${error.message}`, 'error');
    }
}

async function markAsReplied(leadId) {
    try {
        const response = await fetch(`${API_BASE}/api/leads/${leadId}/replied`, {
            method: 'PUT'
        });
        const data = await response.json();
        
        if (data.success) {
            showToast('Lead marked as replied', 'success');
            closeLeadModal();
            loadLeads();
            loadStats();
        }
    } catch (error) {
        showToast(`Error: ${error.message}`, 'error');
    }
}

async function generateEmailForLead(email) {
    currentLeadEmail = email;
    const userContext = document.getElementById('userContext')?.value.trim() || '';
    
    showLoading('Generating email...');

    try {
        const response = await fetch(`${API_BASE}/api/email/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ lead_email: email, user_context: userContext })
        });

        const data = await response.json();
        hideLoading();

        if (data.success) {
            const subject = prompt('Email Subject:', data.subject || '');
            if (subject) {
                const body = prompt('Email Body:', data.body || '');
                if (body) {
                    await sendEmailToLead(email, subject, body);
                }
            }
        }
    } catch (error) {
        hideLoading();
        showToast(`Error: ${error.message}`, 'error');
    }
}

async function sendEmailToLead(email, subject, body) {
    showLoading('Sending email...');

    try {
        const response = await fetch(`${API_BASE}/api/email/send`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ lead_email: email, subject, email_content: body })
        });

        const data = await response.json();
        hideLoading();

        if (!response.ok) {
            const errorMsg = data.detail || data.message || 'Failed to send email';
            console.error('Email send error:', errorMsg);
            showToast(errorMsg, 'error');
            return;
        }

        if (data.success) {
            showToast(data.message || 'Email sent successfully!', 'success');
            loadLeads();
        } else {
            const errorMsg = data.detail || data.message || 'Failed to send email';
            showToast(errorMsg, 'error');
        }
    } catch (error) {
        hideLoading();
        console.error('Email send exception:', error);
        const errorMsg = error.message || 'Failed to send email. Please check your SMTP configuration.';
        showToast(errorMsg, 'error');
    }
}

// Bulk Email
async function updateBulkCount() {
    const statusCheckboxes = document.querySelectorAll('input[name="bulkStatus"]:checked');
    const statusFilter = Array.from(statusCheckboxes).map(cb => cb.value);
    const excludeReplied = document.getElementById('excludeReplied').checked;
    const campaignFilter = document.getElementById('bulkCampaign')?.value || '';

    try {
        const response = await fetch(`${API_BASE}/api/leads?limit=1000`);
        const data = await response.json();

        if (data.success) {
            let filteredLeads = data.leads || [];

            if (statusFilter.length > 0) {
                filteredLeads = filteredLeads.filter(l => statusFilter.includes(l.status));
            }
            if (excludeReplied) {
                filteredLeads = filteredLeads.filter(l => !l.has_replied);
            }
            if (campaignFilter) {
                filteredLeads = filteredLeads.filter(l => l.campaign_id === campaignFilter);
            }

            document.getElementById('bulkLeadsCount').innerHTML = 
                `<strong>${filteredLeads.length} leads</strong> selected for bulk email`;
            document.getElementById('bulkWarning').innerHTML = 
                `You are about to send emails to <strong>${filteredLeads.length} leads</strong>`;
        }
    } catch (error) {
        console.error('Error updating bulk count:', error);
    }
}

function updateBulkButtonState() {
    const confirmed = document.getElementById('confirmBulkSend').checked;
    document.getElementById('bulkSendBtn').disabled = !confirmed;
}

async function handleBulkSend() {
    const statusCheckboxes = document.querySelectorAll('input[name="bulkStatus"]:checked');
    const statusFilter = Array.from(statusCheckboxes).map(cb => cb.value);
    const excludeReplied = document.getElementById('excludeReplied').checked;
    const campaignFilter = document.getElementById('bulkCampaign')?.value || '';
    const userContext = document.getElementById('bulkContext').value.trim();
    const subjectTemplate = document.getElementById('bulkSubject').value.trim();

    if (!userContext) {
        showToast('Please provide your service/product context', 'error');
        return;
    }

    showLoading('Sending bulk emails... This may take a while.');
    const bulkProgressInterval = simulateBulkProgress();

    try {
        const response = await fetch(`${API_BASE}/api/email/bulk`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                status_filter: statusFilter,
                exclude_replied: excludeReplied,
                campaign_id: campaignFilter || null,
                user_context: userContext,
                subject_template: subjectTemplate
            })
        });

        const data = await response.json();
        clearInterval(bulkProgressInterval);
        hideLoading();

        if (data.success) {
            showToast(`Bulk email started for ${data.total} leads`, 'success');
            setTimeout(() => {
                loadLeads();
                loadStats();
            }, 2000);
        } else {
            throw new Error(data.detail || 'Failed to start bulk email');
        }
    } catch (error) {
        clearInterval(bulkProgressInterval);
        hideLoading();
        showToast(`Error: ${error.message}`, 'error');
    }
}

function simulateBulkProgress() {
    let progress = 0;
    const progressFill = document.getElementById('progressFill');
    const progressText = document.getElementById('progressText');
    const loadingText = document.getElementById('loadingText');
    
    const stages = [
        { progress: 25, message: 'Preparing emails...' },
        { progress: 50, message: 'Generating personalized content...' },
        { progress: 75, message: 'Sending emails...' },
        { progress: 90, message: 'Finalizing...' }
    ];
    
    let stageIndex = 0;
    
    const interval = setInterval(() => {
        if (stageIndex < stages.length) {
            const stage = stages[stageIndex];
            progress = stage.progress;
            
            if (loadingText) {
                loadingText.textContent = stage.message;
            }
            
            stageIndex++;
        } else {
            if (progress < 95) progress += 2;
        }
        
        if (progressFill) progressFill.style.width = progress + '%';
        if (progressText) progressText.textContent = Math.round(progress) + '%';
    }, 600);
    
    return interval;
}

// Campaigns
async function loadCampaigns() {
    try {
        const response = await fetch(`${API_BASE}/api/campaigns`);
        const data = await response.json();

        if (data.success) {
            campaigns = data.campaigns || [];
            populateCampaignFilters();
            
            // Display campaigns list if on analytics tab
            if (currentTab === 'analytics') {
                displayCampaignsList();
            }
        }
    } catch (error) {
        console.error('Error loading campaigns:', error);
    }
}

function displayCampaignsList() {
    const container = document.getElementById('campaignsList');
    if (!container) return;
    
    if (!campaigns || campaigns.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: var(--text-secondary); padding: 2rem;">No campaigns found</p>';
        return;
    }
    
    container.innerHTML = '';
    
    campaigns.forEach(campaign => {
        const campaignCard = document.createElement('div');
        campaignCard.className = 'campaign-card';
        campaignCard.innerHTML = `
            <div class="campaign-info">
                <h3>${escapeHtml(campaign.name || 'Unnamed Campaign')}</h3>
                <p class="campaign-meta">
                    <span><i class="fas fa-calendar"></i> ${formatDate(campaign.created_at)}</span>
                    <span><i class="fas fa-users"></i> ${campaign.lead_count || 0} leads</span>
                </p>
                ${campaign.search_query ? `<p class="campaign-query"><i class="fas fa-search"></i> ${escapeHtml(campaign.search_query)}</p>` : ''}
            </div>
            <div class="campaign-actions">
                <button class="btn-small btn-danger" onclick="deleteCampaign('${campaign.id}', '${escapeHtml(campaign.name || 'this campaign')}')" title="Delete Campaign">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        `;
        container.appendChild(campaignCard);
    });
}

async function deleteCampaign(campaignId, campaignName) {
    if (!confirm(`Are you sure you want to delete "${campaignName}"?\n\nThis will delete the campaign and ALL leads associated with it. This action cannot be undone.`)) {
        return;
    }
    
    showLoading('Deleting campaign...');
    
    try {
        const response = await fetch(`${API_BASE}/api/campaigns/${campaignId}`, {
            method: 'DELETE'
        });
        const data = await response.json();
        hideLoading();
        
        if (data.success) {
            showToast(`Campaign "${campaignName}" and all its leads deleted successfully`, 'success');
            loadCampaigns(); // Reload campaigns
            loadStats(); // Update stats
            if (currentTab === 'manage') {
                loadLeads(); // Reload leads if on manage tab
            }
        } else {
            throw new Error(data.detail || 'Failed to delete campaign');
        }
    } catch (error) {
        hideLoading();
        showToast(`Error deleting campaign: ${error.message}`, 'error');
    }
}

function populateCampaignFilters() {
    const filterSelect = document.getElementById('filterCampaign');
    const bulkSelect = document.getElementById('bulkCampaign');
    const discoverSelect = document.getElementById('existingCampaign');

    [filterSelect, bulkSelect, discoverSelect].forEach(select => {
        if (!select) return;
        
        const currentValue = select.value;
        const isDiscover = select.id === 'existingCampaign';
        
        if (isDiscover) {
            select.innerHTML = campaigns.length > 0 
                ? '<option value="">Select a campaign...</option>'
                : '<option value="">No campaigns available. Create a new one.</option>';
        } else {
            select.innerHTML = '<option value="">All Campaigns</option>';
        }
        
        campaigns.forEach(campaign => {
            const option = document.createElement('option');
            option.value = campaign.id;
            option.textContent = `${campaign.name} (${campaign.lead_count || 0} leads)`;
            select.appendChild(option);
        });

        select.value = currentValue;
    });

    // Add event listener for bulk campaign change
    if (bulkSelect) {
        bulkSelect.addEventListener('change', updateBulkCount);
    }
    
    // Add event listeners for status checkboxes
    document.querySelectorAll('input[name="bulkStatus"]').forEach(cb => {
        cb.addEventListener('change', updateBulkCount);
    });
    document.getElementById('excludeReplied')?.addEventListener('change', updateBulkCount);
}

// Statistics
async function loadStats() {
    try {
        const response = await fetch(`${API_BASE}/api/stats`);
        const data = await response.json();

        if (data.success) {
            document.getElementById('statTotal').textContent = data.total_leads || 0;
            document.getElementById('statEmailed').textContent = data.emailed || 0;
            document.getElementById('statReplies').textContent = data.replied || 0;

            if (currentTab === 'analytics') {
                document.getElementById('analyticsTotal').textContent = data.total_leads || 0;
                document.getElementById('analyticsFound').textContent = data.found || 0;
                document.getElementById('analyticsEmailed').textContent = data.emailed || 0;
                document.getElementById('analyticsReplies').textContent = data.replied || 0;
                
                const replyRate = data.total_leads > 0 
                    ? ((data.replied / data.total_leads) * 100).toFixed(1) 
                    : 0;
                document.getElementById('analyticsReplyRate').textContent = `${replyRate}%`;
                
                // Load all analytics charts
                loadAnalyticsCharts();
            }
        }
    } catch (error) {
        console.error('Error loading stats:', error);
    }
}

// Chart instances
let statusChart = null;
let funnelChart = null;
let timeSeriesChart = null;
let sourceChart = null;
let campaignChart = null;

// Chart color palette (Apple-inspired)
const chartColors = {
    primary: '#007AFF',
    secondary: '#5856D6',
    success: '#34C759',
    warning: '#FF9500',
    danger: '#FF3B30',
    info: '#5AC8FA',
    purple: '#AF52DE',
    pink: '#FF2D55',
    teal: '#5AC8FA',
    gray: '#8E8E93'
};

// Load all analytics charts
async function loadAnalyticsCharts() {
    await Promise.all([
        loadStatusChart(),
        loadFunnelChart(),
        loadTimeSeriesChart(),
        loadSourceChart(),
        loadCampaignChart()
    ]);
}

// Status Distribution Chart
async function loadStatusChart() {
    try {
        const response = await fetch(`${API_BASE}/api/stats`);
        const data = await response.json();
        
        if (!data.success) return;
        
        const ctx = document.getElementById('statusChart');
        if (!ctx) return;
        
        if (statusChart) statusChart.destroy();
        
        statusChart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['Found', 'Emailed', 'Followed Up', 'Replied'],
                datasets: [{
                    data: [
                        data.found || 0,
                        data.emailed || 0,
                        data.followed_up || 0,
                        data.replied || 0
                    ],
                    backgroundColor: [
                        chartColors.info,
                        chartColors.warning,
                        chartColors.secondary,
                        chartColors.success
                    ],
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            padding: 15,
                            font: {
                                family: '-apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif',
                                size: 13
                            }
                        }
                    },
                    tooltip: {
                        backgroundColor: 'rgba(0, 0, 0, 0.8)',
                        padding: 12,
                        titleFont: {
                            family: '-apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif',
                            size: 14,
                            weight: '600'
                        },
                        bodyFont: {
                            family: '-apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif',
                            size: 13
                        }
                    }
                }
            }
        });
    } catch (error) {
        console.error('Error loading status chart:', error);
    }
}

// Conversion Funnel Chart
async function loadFunnelChart() {
    try {
        const response = await fetch(`${API_BASE}/api/analytics/funnel`);
        const data = await response.json();
        
        if (!data.success || !data.funnel) return;
        
        const ctx = document.getElementById('funnelChart');
        if (!ctx) return;
        
        if (funnelChart) funnelChart.destroy();
        
        const funnelData = data.funnel;
        
        funnelChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: funnelData.map(f => f.stage),
                datasets: [{
                    label: 'Leads',
                    data: funnelData.map(f => f.count),
                    backgroundColor: [
                        chartColors.primary,
                        chartColors.warning,
                        chartColors.secondary,
                        chartColors.success
                    ],
                    borderRadius: 8,
                    borderSkipped: false
                }]
            },
            options: {
                indexAxis: 'y',
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        backgroundColor: 'rgba(0, 0, 0, 0.8)',
                        padding: 12,
                        callbacks: {
                            afterLabel: (context) => {
                                const index = context.dataIndex;
                                return `${funnelData[index].percentage.toFixed(1)}% conversion`;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        beginAtZero: true,
                        grid: {
                            color: 'rgba(0, 0, 0, 0.05)'
                        },
                        ticks: {
                            font: {
                                family: '-apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif',
                                size: 12
                            }
                        }
                    },
                    y: {
                        grid: {
                            display: false
                        },
                        ticks: {
                            font: {
                                family: '-apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif',
                                size: 12
                            }
                        }
                    }
                }
            }
        });
    } catch (error) {
        console.error('Error loading funnel chart:', error);
    }
}

// Time Series Chart
async function loadTimeSeriesChart() {
    try {
        const response = await fetch(`${API_BASE}/api/analytics/timeseries?days=30`);
        const data = await response.json();
        
        if (!data.success || !data.dates) return;
        
        const ctx = document.getElementById('timeSeriesChart');
        if (!ctx) return;
        
        if (timeSeriesChart) timeSeriesChart.destroy();
        
        // Format dates for display
        const formattedDates = data.dates.map(date => {
            const d = new Date(date);
            return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        });
        
        timeSeriesChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: formattedDates,
                datasets: [
                    {
                        label: 'Daily Leads',
                        data: data.daily,
                        borderColor: chartColors.primary,
                        backgroundColor: 'rgba(0, 122, 255, 0.1)',
                        borderWidth: 2,
                        fill: true,
                        tension: 0.4,
                        pointRadius: 3,
                        pointHoverRadius: 5
                    },
                    {
                        label: 'Cumulative',
                        data: data.cumulative,
                        borderColor: chartColors.success,
                        backgroundColor: 'rgba(52, 199, 89, 0.1)',
                        borderWidth: 2,
                        fill: false,
                        tension: 0.4,
                        pointRadius: 3,
                        pointHoverRadius: 5
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: {
                        position: 'top',
                        labels: {
                            padding: 15,
                            font: {
                                family: '-apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif',
                                size: 13
                            }
                        }
                    },
                    tooltip: {
                        backgroundColor: 'rgba(0, 0, 0, 0.8)',
                        padding: 12,
                        mode: 'index',
                        intersect: false
                    }
                },
                scales: {
                    x: {
                        grid: {
                            color: 'rgba(0, 0, 0, 0.05)'
                        },
                        ticks: {
                            font: {
                                family: '-apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif',
                                size: 11
                            },
                            maxRotation: 45,
                            minRotation: 0
                        }
                    },
                    y: {
                        beginAtZero: true,
                        grid: {
                            color: 'rgba(0, 0, 0, 0.05)'
                        },
                        ticks: {
                            font: {
                                family: '-apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif',
                                size: 12
                            }
                        }
                    }
                },
                interaction: {
                    mode: 'nearest',
                    axis: 'x',
                    intersect: false
                }
            }
        });
    } catch (error) {
        console.error('Error loading time series chart:', error);
    }
}

// Lead Sources Chart
async function loadSourceChart() {
    try {
        const response = await fetch(`${API_BASE}/api/analytics/sources`);
        const data = await response.json();
        
        if (!data.success || !data.sources) return;
        
        const ctx = document.getElementById('sourceChart');
        if (!ctx) return;
        
        if (sourceChart) sourceChart.destroy();
        
        const sources = data.sources.slice(0, 10); // Top 10 sources
        const colors = [
            chartColors.primary,
            chartColors.secondary,
            chartColors.success,
            chartColors.warning,
            chartColors.danger,
            chartColors.info,
            chartColors.purple,
            chartColors.pink,
            chartColors.teal,
            chartColors.gray
        ];
        
        sourceChart = new Chart(ctx, {
            type: 'pie',
            data: {
                labels: sources.map(s => s.name),
                datasets: [{
                    data: sources.map(s => s.count),
                    backgroundColor: colors.slice(0, sources.length),
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: {
                        position: 'right',
                        labels: {
                            padding: 15,
                            font: {
                                family: '-apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif',
                                size: 12
                            }
                        }
                    },
                    tooltip: {
                        backgroundColor: 'rgba(0, 0, 0, 0.8)',
                        padding: 12
                    }
                }
            }
        });
    } catch (error) {
        console.error('Error loading source chart:', error);
    }
}

// Campaign Performance Chart
async function loadCampaignChart() {
    try {
        const response = await fetch(`${API_BASE}/api/analytics/campaigns`);
        const data = await response.json();
        
        if (!data.success || !data.campaigns) return;
        
        const ctx = document.getElementById('campaignChart');
        if (!ctx) return;
        
        if (campaignChart) campaignChart.destroy();
        
        const campaigns = data.campaigns.slice(0, 8); // Top 8 campaigns
        
        campaignChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: campaigns.map(c => c.name.length > 20 ? c.name.substring(0, 20) + '...' : c.name),
                datasets: [
                    {
                        label: 'Total Leads',
                        data: campaigns.map(c => c.total),
                        backgroundColor: chartColors.primary,
                        borderRadius: 8,
                        borderSkipped: false
                    },
                    {
                        label: 'Emailed',
                        data: campaigns.map(c => c.emailed),
                        backgroundColor: chartColors.warning,
                        borderRadius: 8,
                        borderSkipped: false
                    },
                    {
                        label: 'Replied',
                        data: campaigns.map(c => c.replied),
                        backgroundColor: chartColors.success,
                        borderRadius: 8,
                        borderSkipped: false
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: {
                        position: 'top',
                        labels: {
                            padding: 15,
                            font: {
                                family: '-apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif',
                                size: 13
                            }
                        }
                    },
                    tooltip: {
                        backgroundColor: 'rgba(0, 0, 0, 0.8)',
                        padding: 12,
                        callbacks: {
                            afterLabel: (context) => {
                                const index = context.dataIndex;
                                if (context.datasetIndex === 2) {
                                    return `Reply Rate: ${campaigns[index].reply_rate.toFixed(1)}%`;
                                }
                                return '';
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        stacked: true,
                        grid: {
                            display: false
                        },
                        ticks: {
                            font: {
                                family: '-apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif',
                                size: 11
                            },
                            maxRotation: 45,
                            minRotation: 0
                        }
                    },
                    y: {
                        stacked: true,
                        beginAtZero: true,
                        grid: {
                            color: 'rgba(0, 0, 0, 0.05)'
                        },
                        ticks: {
                            font: {
                                family: '-apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif',
                                size: 12
                            }
                        }
                    }
                }
            }
        });
    } catch (error) {
        console.error('Error loading campaign chart:', error);
    }
}

// Test Email
async function handleTestEmail() {
    if (!confirm('This will send a test email to your configured SMTP address. Continue?')) {
        return;
    }

    showLoading('Sending test email...');

    try {
        const response = await fetch(`${API_BASE}/api/email/test`, {
            method: 'POST'
        });
        const data = await response.json();
        hideLoading();

        if (data.success) {
            showToast('Test email sent successfully! Check your inbox.', 'success');
        } else {
            throw new Error(data.message || 'Failed to send test email');
        }
    } catch (error) {
        hideLoading();
        showToast(`Error: ${error.message}`, 'error');
    }
}

// Sidebar Toggle
function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('mobileMenuOverlay');
    const mobileBtn = document.getElementById('mobileMenuBtn');
    
    sidebar.classList.toggle('active');
    if (overlay) {
        overlay.classList.toggle('active');
    }
    if (mobileBtn) {
        mobileBtn.classList.toggle('active');
    }
}

// Close sidebar when clicking overlay
document.getElementById('mobileMenuOverlay')?.addEventListener('click', () => {
    const sidebar = document.getElementById('sidebar');
    if (sidebar.classList.contains('active')) {
        toggleSidebar();
    }
});

// Show/hide mobile menu button based on screen size
function updateMobileMenuButton() {
    const mobileBtn = document.getElementById('mobileMenuBtn');
    if (window.innerWidth <= 768) {
        if (mobileBtn) mobileBtn.style.display = 'flex';
    } else {
        if (mobileBtn) mobileBtn.style.display = 'none';
        // Close sidebar on desktop
        const sidebar = document.getElementById('sidebar');
        const overlay = document.getElementById('mobileMenuOverlay');
        if (sidebar) sidebar.classList.remove('active');
        if (overlay) overlay.classList.remove('active');
    }
}

// Update on load and resize
window.addEventListener('resize', updateMobileMenuButton);
updateMobileMenuButton();

// Utility Functions
function showLoading(text = 'Loading...') {
    const overlay = document.getElementById('loadingOverlay');
    const loadingText = document.getElementById('loadingText');
    const progressFill = document.getElementById('progressFill');
    const progressText = document.getElementById('progressText');
    
    if (loadingText) loadingText.textContent = text;
    if (progressFill) progressFill.style.width = '0%';
    if (progressText) progressText.textContent = '0%';
    
    overlay.classList.add('active');
}

function showLoadingWithProgress(text = 'Loading...') {
    showLoading(text);
    // Progress will be handled by the calling function
}

function hideLoading() {
    const overlay = document.getElementById('loadingOverlay');
    overlay.classList.remove('active');
    clearProgressInterval();
    
    // Reset progress
    const progressFill = document.getElementById('progressFill');
    const progressText = document.getElementById('progressText');
    if (progressFill) progressFill.style.width = '0%';
    if (progressText) progressText.textContent = '0%';
}

// Skeleton Loader Functions
function showTableSkeleton(rowCount = 5) {
    const tbody = document.getElementById('leadsTableBody');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    for (let i = 0; i < rowCount; i++) {
        const row = document.createElement('tr');
        row.className = 'skeleton-table-row';
        row.innerHTML = `
            <td><div class="skeleton skeleton-text"></div></td>
            <td><div class="skeleton skeleton-text"></div></td>
            <td><div class="skeleton skeleton-text"></div></td>
            <td><div class="skeleton skeleton-text"></div></td>
            <td><div class="skeleton skeleton-badge"></div></td>
            <td><div class="skeleton skeleton-text"></div></td>
            <td class="actions-cell">
                <div class="action-buttons">
                    <div class="skeleton skeleton-button"></div>
                    <div class="skeleton skeleton-button"></div>
                </div>
            </td>
        `;
        tbody.appendChild(row);
    }
}

function showStatsSkeleton() {
    const statsGrid = document.querySelector('.stats-grid');
    if (!statsGrid) return;
    
    statsGrid.innerHTML = '';
    for (let i = 0; i < 4; i++) {
        const statCard = document.createElement('div');
        statCard.className = 'skeleton-stat-card';
        statCard.innerHTML = `
            <div class="skeleton skeleton-stat-icon"></div>
            <div class="skeleton-stat-info">
                <div class="skeleton skeleton-text" style="width: 60px; height: 1.75rem; margin-bottom: 0.5rem;"></div>
                <div class="skeleton skeleton-text" style="width: 80px;"></div>
            </div>
        `;
        statsGrid.appendChild(statCard);
    }
}

function showCardSkeleton(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    const skeleton = document.createElement('div');
    skeleton.className = 'skeleton-card';
    skeleton.innerHTML = `
        <div class="skeleton-card-header">
            <div class="skeleton skeleton-title"></div>
            <div class="skeleton skeleton-subtitle"></div>
        </div>
        <div class="skeleton-card-body">
            <div class="skeleton skeleton-text"></div>
            <div class="skeleton skeleton-text"></div>
            <div class="skeleton skeleton-text" style="width: 80%;"></div>
        </div>
    `;
    container.innerHTML = '';
    container.appendChild(skeleton);
}

function hideSkeleton() {
    // Skeleton loaders are replaced by actual content, so no cleanup needed
}

// Progress Step Indicator
function createProgressSteps(steps) {
    const container = document.createElement('div');
    container.className = 'progress-indicator';
    
    steps.forEach((step, index) => {
        const stepEl = document.createElement('div');
        stepEl.className = `progress-step ${step.status || 'pending'}`;
        
        const icon = document.createElement('div');
        icon.className = 'progress-step-icon';
        if (step.status === 'completed') {
            icon.innerHTML = '<i class="fas fa-check"></i>';
        } else if (step.status === 'active') {
            icon.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
        } else {
            icon.textContent = index + 1;
        }
        
        const content = document.createElement('div');
        content.className = 'progress-step-content';
        content.innerHTML = `
            <div class="progress-step-title">${step.title}</div>
            ${step.description ? `<div class="progress-step-description">${step.description}</div>` : ''}
        `;
        
        stepEl.appendChild(icon);
        stepEl.appendChild(content);
        container.appendChild(stepEl);
    });
    
    return container;
}

function updateProgressSteps(container, currentStep) {
    const steps = container.querySelectorAll('.progress-step');
    steps.forEach((step, index) => {
        step.classList.remove('active', 'completed', 'pending');
        const icon = step.querySelector('.progress-step-icon');
        
        if (index < currentStep) {
            step.classList.add('completed');
            icon.innerHTML = '<i class="fas fa-check"></i>';
        } else if (index === currentStep) {
            step.classList.add('active');
            icon.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
        } else {
            step.classList.add('pending');
            icon.textContent = index + 1;
        }
    });
}

// Optimistic UI Updates
function optimisticUpdate(element, updateFn, rollbackFn = null) {
    // Store original state
    const originalHTML = element.innerHTML;
    const originalClass = element.className;
    
    // Apply optimistic update
    element.classList.add('optimistic-update');
    updateFn(element);
    
    // Remove animation class after animation completes
    setTimeout(() => {
        element.classList.remove('optimistic-update');
    }, 500);
    
    // Return rollback function
    return () => {
        element.innerHTML = originalHTML;
        element.className = originalClass;
        if (rollbackFn) rollbackFn(element);
    };
}

function showSuccessCheckmark(element) {
    const checkmark = document.createElement('span');
    checkmark.className = 'success-checkmark';
    checkmark.innerHTML = '<i class="fas fa-check"></i>';
    element.appendChild(checkmark);
    
    setTimeout(() => {
        checkmark.remove();
    }, 2000);
}

function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    container.appendChild(toast);

    setTimeout(() => {
        toast.style.animation = 'toastSlideIn 0.3s ease reverse';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function formatDate(dateString) {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
}

function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Close modal on outside click
document.getElementById('leadModal')?.addEventListener('click', (e) => {
    if (e.target.id === 'leadModal') {
        closeLeadModal();
    }
});

