// Dashboard JavaScript functionality

const API_BASE = '/api/v1';

// Tab management
function showTab(tabName) {
    // Hide all tabs
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.add('hidden');
    });
    
    // Remove active state from all buttons
    document.querySelectorAll('.tab-button').forEach(button => {
        button.classList.remove('border-blue-500', 'text-blue-600');
        button.classList.add('border-transparent', 'text-gray-500');
    });
    
    // Show selected tab
    document.getElementById(`${tabName}-tab`).classList.remove('hidden');
    
    // Activate selected button
    const activeButton = document.getElementById(`tab-${tabName}`);
    activeButton.classList.remove('border-transparent', 'text-gray-500');
    activeButton.classList.add('border-blue-500', 'text-blue-600');
    
    // Load data for the selected tab
    switch(tabName) {
        case 'dashboard':
            loadDashboardData();
            break;
        case 'campaigns':
            loadCampaigns();
            break;
        case 'prospects':
            loadProspects();
            break;
        case 'bulk':
            loadBulkImportJobs();
            loadCampaignsForSelect();
            break;
    }
}

// Dashboard functions
async function loadDashboardData() {
    try {
        // Make requests sequentially with small delays to avoid rate limiting
        const statusResponse = await axios.get(`${API_BASE}/status`);
        await new Promise(resolve => setTimeout(resolve, 100)); // 100ms delay
        
        const prospectsResponse = await axios.get(`${API_BASE}/prospects/stats/overview`);
        await new Promise(resolve => setTimeout(resolve, 100)); // 100ms delay
        
        const campaignsResponse = await axios.get(`${API_BASE}/campaigns`);

        const status = statusResponse.data.data;
        const prospectStats = prospectsResponse.data.data;
        const campaigns = campaignsResponse.data.data.campaigns;

        // Update dashboard cards
        document.getElementById('total-prospects').textContent = prospectStats.total || 0;
        document.getElementById('active-campaigns').textContent = campaigns.filter(c => c.status === 'active').length;
        document.getElementById('emails-generated').textContent = status.generation?.completed || 0;
        document.getElementById('drafts-created').textContent = status.drafts?.draftsCreated || 0;

        // Update system status
        const statusContainer = document.getElementById('system-status');
        statusContainer.innerHTML = `
            <div class="grid grid-cols-2 gap-4">
                <div class="bg-gray-50 p-3 rounded">
                    <h4 class="font-medium">Scraping</h4>
                    <p class="text-sm text-gray-600">Pending: ${status.scraping?.pending || 0}</p>
                    <p class="text-sm text-gray-600">Scraped: ${status.scraping?.scraped || 0}</p>
                </div>
                <div class="bg-gray-50 p-3 rounded">
                    <h4 class="font-medium">Email Generation</h4>
                    <p class="text-sm text-gray-600">Queued: ${status.generation?.queued || 0}</p>
                    <p class="text-sm text-gray-600">Completed: ${status.generation?.completed || 0}</p>
                </div>
            </div>
        `;
    } catch (error) {
        console.error('Failed to load dashboard data:', error);
        showNotification('Failed to load dashboard data', 'error');
    }
}

// Campaign functions
async function loadCampaigns() {
    try {
        const response = await axios.get(`${API_BASE}/campaigns`);
        const campaigns = response.data.data.campaigns;

        const tbody = document.getElementById('campaigns-list');
        tbody.innerHTML = campaigns.map(campaign => `
            <tr>
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    ${campaign.name}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(campaign.status)}">
                        ${campaign.status}
                    </span>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getEmailStyleColor(campaign.emailStyle)}">
                        ${getEmailStyleLabel(campaign.emailStyle || 'statement')}
                    </span>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    ${campaign.usps?.length || 0} USPs
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    ${new Date(campaign.createdAt).toLocaleDateString()}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <button onclick="startCampaign('${campaign._id}')" class="text-green-600 hover:text-green-900 mr-2">Start</button>
                    <button onclick="pauseCampaign('${campaign._id}')" class="text-yellow-600 hover:text-yellow-900 mr-2">Pause</button>
                    <button onclick="viewCampaignProgress('${campaign._id}')" class="text-blue-600 hover:text-blue-900 mr-2">Progress</button>
                    <button onclick="viewCampaignProspects('${campaign._id}', '${campaign.name}')" class="text-purple-600 hover:text-purple-900">Prospects</button>
                </td>
            </tr>
        `).join('');
    } catch (error) {
        console.error('Failed to load campaigns:', error);
        showNotification('Failed to load campaigns', 'error');
    }
}

// Prospect functions
async function loadProspects() {
    try {
        const response = await axios.get(`${API_BASE}/prospects`);
        const prospects = response.data.data.prospects;

        const tbody = document.getElementById('prospects-list');
        tbody.innerHTML = prospects.map(prospect => `
            <tr>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    <input type="checkbox" class="prospect-checkbox rounded border-gray-300" data-prospect-id="${prospect._id}" data-prospect-name="${prospect.website}">
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    <a href="${prospect.website}" target="_blank" class="text-blue-600 hover:text-blue-900">
                        ${prospect.website}
                    </a>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <div>
                        <div class="font-medium">${prospect.contactName || 'N/A'}</div>
                        <div>${prospect.contactEmail}</div>
                    </div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    ${prospect.companyName || 'N/A'}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(prospect.status)}">
                        ${prospect.status}
                    </span>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <div class="flex flex-wrap gap-1">
                        ${prospect.campaignIds && prospect.campaignIds.length > 0 ? 
                            prospect.campaignIds.map(campaignId => `<span class="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded-full">${campaignId.substring(0, 8)}...</span>`).join('') : 
                            '<span class="text-gray-400">No campaigns</span>'
                        }
                    </div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <button onclick="showAssignProspectModal('${prospect._id}', '${prospect.website}')" class="text-green-600 hover:text-green-900 mr-3">Assign</button>
                    <button onclick="scrapeProspect('${prospect._id}')" class="text-blue-600 hover:text-blue-900 mr-3">Scrape</button>
                    <button onclick="deleteProspect('${prospect._id}')" class="text-red-600 hover:text-red-900">Delete</button>
                </td>
            </tr>
        `).join('');
        
        // Setup select all checkbox
        setupSelectAllCheckbox();
    } catch (error) {
        console.error('Failed to load prospects:', error);
        showNotification('Failed to load prospects', 'error');
    }
}

// Bulk import functions
async function loadBulkImportJobs() {
    try {
        const response = await axios.get(`${API_BASE}/bulk/jobs`);
        const jobs = response.data.data.jobs;

        const container = document.getElementById('import-jobs-list');
        container.innerHTML = jobs.map(job => `
            <div class="border rounded-lg p-4">
                <div class="flex justify-between items-start">
                    <div>
                        <h4 class="font-medium">${job.filename}</h4>
                        <p class="text-sm text-gray-600">Status: <span class="font-medium ${getStatusColor(job.status)}">${job.status}</span></p>
                        <p class="text-sm text-gray-600">Progress: ${job.processedProspects}/${job.totalProspects}</p>
                    </div>
                    <div class="text-right">
                        <p class="text-sm text-green-600">Success: ${job.successfulProspects}</p>
                        <p class="text-sm text-red-600">Failed: ${job.failedProspects}</p>
                    </div>
                </div>
                <div class="mt-2">
                    <div class="bg-gray-200 rounded-full h-2">
                        <div class="bg-blue-600 h-2 rounded-full" style="width: ${job.totalProspects > 0 ? (job.processedProspects / job.totalProspects) * 100 : 0}%"></div>
                    </div>
                </div>
            </div>
        `).join('') || '<p class="text-gray-500">No import jobs found</p>';
    } catch (error) {
        console.error('Failed to load bulk import jobs:', error);
        showNotification('Failed to load bulk import jobs', 'error');
    }
}

async function loadCampaignsForSelect() {
    try {
        const response = await axios.get(`${API_BASE}/campaigns`);
        const campaigns = response.data.data.campaigns;

        const select = document.getElementById('campaign-select');
        select.innerHTML = '<option value="">Select a campaign</option>' + 
            campaigns.map(campaign => `<option value="${campaign._id}">${campaign.name}</option>`).join('');
    } catch (error) {
        console.error('Failed to load campaigns for select:', error);
    }
}

// Action functions
async function startCampaign(campaignId) {
    try {
        await axios.post(`${API_BASE}/campaigns/${campaignId}/start`);
        showNotification('Campaign started successfully', 'success');
        loadCampaigns();
    } catch (error) {
        console.error('Failed to start campaign:', error);
        showNotification('Failed to start campaign', 'error');
    }
}

async function pauseCampaign(campaignId) {
    try {
        await axios.post(`${API_BASE}/campaigns/${campaignId}/pause`);
        showNotification('Campaign paused successfully', 'success');
        loadCampaigns();
    } catch (error) {
        console.error('Failed to pause campaign:', error);
        showNotification('Failed to pause campaign', 'error');
    }
}

async function viewCampaignProgress(campaignId) {
    try {
        const response = await axios.get(`${API_BASE}/campaigns/${campaignId}/progress`);
        const progress = response.data.data;
        
        alert(`Campaign Progress: ${progress.progress.percentage}%\nCompleted: ${progress.progress.completed}\nFailed: ${progress.progress.failed}\nQueued: ${progress.progress.queued}`);
    } catch (error) {
        console.error('Failed to get campaign progress:', error);
        showNotification('Failed to get campaign progress', 'error');
    }
}

async function viewCampaignProspects(campaignId, campaignName) {
    try {
        const response = await axios.get(`${API_BASE}/campaigns/${campaignId}/prospects`);
        const prospects = response.data.data.prospects;
        
        const prospectsList = prospects.map(prospect => 
            `• ${prospect.website} (${prospect.contactEmail}) - ${prospect.status}`
        ).join('\n');
        
        alert(`Campaign: ${campaignName}\nAssigned Prospects (${prospects.length}):\n\n${prospectsList || 'No prospects assigned to this campaign yet.'}`);
    } catch (error) {
        console.error('Failed to get campaign prospects:', error);
        showNotification('Failed to get campaign prospects', 'error');
    }
}

async function scrapeProspect(prospectId) {
    try {
        await axios.post(`${API_BASE}/prospects/${prospectId}/scrape`);
        showNotification('Scraping started for prospect', 'success');
        loadProspects();
    } catch (error) {
        console.error('Failed to start scraping:', error);
        showNotification('Failed to start scraping', 'error');
    }
}

async function deleteProspect(prospectId) {
    if (confirm('Are you sure you want to delete this prospect?')) {
        try {
            await axios.delete(`${API_BASE}/prospects/${prospectId}`);
            showNotification('Prospect deleted successfully', 'success');
            loadProspects();
        } catch (error) {
            console.error('Failed to delete prospect:', error);
            showNotification('Failed to delete prospect', 'error');
        }
    }
}

// Modal functions
function showCreateCampaignModal() {
    document.getElementById('create-campaign-modal').classList.remove('hidden');
}

function hideCreateCampaignModal() {
    document.getElementById('create-campaign-modal').classList.add('hidden');
    document.getElementById('create-campaign-form').reset();
}

function showCreateProspectModal() {
    document.getElementById('create-prospect-modal').classList.remove('hidden');
}

function hideCreateProspectModal() {
    document.getElementById('create-prospect-modal').classList.add('hidden');
    document.getElementById('create-prospect-form').reset();
}

// Form handlers
document.getElementById('create-campaign-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const data = Object.fromEntries(formData);

    try {
        await axios.post(`${API_BASE}/campaigns`, data);
        showNotification('Campaign created successfully', 'success');
        hideCreateCampaignModal();
        loadCampaigns();
    } catch (error) {
        console.error('Failed to create campaign:', error);
        showNotification('Failed to create campaign', 'error');
    }
});

document.getElementById('create-prospect-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const data = Object.fromEntries(formData);

    try {
        await axios.post(`${API_BASE}/prospects`, data);
        showNotification('Prospect created successfully', 'success');
        hideCreateProspectModal();
        loadProspects();
    } catch (error) {
        console.error('Failed to create prospect:', error);
        
        // Show specific validation error if available
        if (error.response && error.response.data && error.response.data.message) {
            showNotification(`Validation error: ${error.response.data.message}`, 'error');
        } else {
            showNotification('Failed to create prospect', 'error');
        }
    }
});

document.getElementById('bulk-upload-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);

    try {
        const response = await axios.post(`${API_BASE}/bulk/import`, formData, {
            headers: {
                'Content-Type': 'multipart/form-data'
            }
        });
        showNotification('Bulk import started successfully', 'success');
        document.getElementById('bulk-upload-form').reset();
        loadBulkImportJobs();
    } catch (error) {
        console.error('Failed to start bulk import:', error);
        showNotification('Failed to start bulk import', 'error');
    }
});

// Utility functions
function getStatusColor(status) {
    const colors = {
        'pending': 'bg-yellow-100 text-yellow-800',
        'active': 'bg-green-100 text-green-800',
        'paused': 'bg-gray-100 text-gray-800',
        'completed': 'bg-blue-100 text-blue-800',
        'failed': 'bg-red-100 text-red-800',
        'scraped': 'bg-green-100 text-green-800',
        'analyzed': 'bg-blue-100 text-blue-800',
        'email_generated': 'bg-purple-100 text-purple-800',
        'draft_created': 'bg-indigo-100 text-indigo-800',
        'processing': 'bg-yellow-100 text-yellow-800',
        'queued': 'bg-gray-100 text-gray-800'
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
}

function getEmailStyleColor(emailStyle) {
    const colors = {
        'statement': 'bg-blue-100 text-blue-800',
        'question': 'bg-orange-100 text-orange-800'
    };
    return colors[emailStyle] || 'bg-blue-100 text-blue-800';
}

function getEmailStyleLabel(emailStyle) {
    const labels = {
        'statement': 'Statement',
        'question': 'Question'
    };
    return labels[emailStyle] || 'Statement';
}

function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `fixed top-4 right-4 p-4 rounded-md text-white z-50 ${
        type === 'success' ? 'bg-green-500' : 
        type === 'error' ? 'bg-red-500' : 
        'bg-blue-500'
    }`;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.remove();
    }, 5000);
}

// Campaign assignment functions
let selectedProspectId = null;

function setupSelectAllCheckbox() {
    const selectAllCheckbox = document.getElementById('select-all-prospects');
    const prospectCheckboxes = document.querySelectorAll('.prospect-checkbox');
    
    selectAllCheckbox.addEventListener('change', function() {
        prospectCheckboxes.forEach(checkbox => {
            checkbox.checked = this.checked;
        });
        updateSelectedCount();
    });
    
    prospectCheckboxes.forEach(checkbox => {
        checkbox.addEventListener('change', updateSelectedCount);
    });
}

function updateSelectedCount() {
    const selectedCheckboxes = document.querySelectorAll('.prospect-checkbox:checked');
    const count = selectedCheckboxes.length;
    
    const selectedCountElement = document.getElementById('selected-count');
    if (selectedCountElement) {
        selectedCountElement.textContent = count;
    }
}

function getSelectedProspects() {
    const selectedCheckboxes = document.querySelectorAll('.prospect-checkbox:checked');
    return Array.from(selectedCheckboxes).map(checkbox => ({
        id: checkbox.dataset.prospectId,
        name: checkbox.dataset.prospectName
    }));
}

async function loadCampaignsForAssignment() {
    try {
        const response = await axios.get(`${API_BASE}/campaigns`);
        const campaigns = response.data.data.campaigns;
        
        const bulkSelect = document.getElementById('bulk-assign-campaign');
        const individualSelect = document.getElementById('assign-prospect-campaign');
        
        const options = '<option value="">Select a campaign</option>' + 
            campaigns.map(campaign => `<option value="${campaign._id}">${campaign.name}</option>`).join('');
        
        if (bulkSelect) bulkSelect.innerHTML = options;
        if (individualSelect) individualSelect.innerHTML = options;
    } catch (error) {
        console.error('Failed to load campaigns for assignment:', error);
        showNotification('Failed to load campaigns', 'error');
    }
}

// Bulk assignment modal functions
function showBulkAssignModal() {
    const selectedProspects = getSelectedProspects();
    if (selectedProspects.length === 0) {
        showNotification('Please select at least one prospect to assign', 'error');
        return;
    }
    
    loadCampaignsForAssignment();
    updateSelectedCount();
    document.getElementById('bulk-assign-modal').classList.remove('hidden');
}

function hideBulkAssignModal() {
    document.getElementById('bulk-assign-modal').classList.add('hidden');
    document.getElementById('bulk-assign-campaign').value = '';
}

async function performBulkAssignment() {
    const selectedProspects = getSelectedProspects();
    const campaignId = document.getElementById('bulk-assign-campaign').value;
    
    if (!campaignId) {
        showNotification('Please select a campaign', 'error');
        return;
    }
    
    if (selectedProspects.length === 0) {
        showNotification('No prospects selected', 'error');
        return;
    }
    
    try {
        const prospectIds = selectedProspects.map(p => p.id);
        await axios.post(`${API_BASE}/prospects/bulk/assign-campaign`, {
            prospectIds,
            campaignId
        });
        
        showNotification(`Successfully assigned ${selectedProspects.length} prospects to campaign`, 'success');
        hideBulkAssignModal();
        loadProspects();
    } catch (error) {
        console.error('Failed to perform bulk assignment:', error);
        showNotification('Failed to assign prospects to campaign', 'error');
    }
}

// Individual assignment modal functions
function showAssignProspectModal(prospectId, prospectName) {
    selectedProspectId = prospectId;
    document.getElementById('assign-prospect-name').textContent = prospectName;
    loadCampaignsForAssignment();
    document.getElementById('assign-prospect-modal').classList.remove('hidden');
}

function hideAssignProspectModal() {
    document.getElementById('assign-prospect-modal').classList.add('hidden');
    document.getElementById('assign-prospect-campaign').value = '';
    selectedProspectId = null;
}

async function performIndividualAssignment() {
    const campaignId = document.getElementById('assign-prospect-campaign').value;
    
    if (!campaignId) {
        showNotification('Please select a campaign', 'error');
        return;
    }
    
    if (!selectedProspectId) {
        showNotification('No prospect selected', 'error');
        return;
    }
    
    try {
        await axios.post(`${API_BASE}/prospects/${selectedProspectId}/assign-campaign`, {
            campaignId
        });
        
        showNotification('Successfully assigned prospect to campaign', 'success');
        hideAssignProspectModal();
        loadProspects();
    } catch (error) {
        console.error('Failed to assign prospect to campaign:', error);
        showNotification('Failed to assign prospect to campaign', 'error');
    }
}

// Initialize dashboard
document.addEventListener('DOMContentLoaded', () => {
    showTab('dashboard');
    
    // Auto-refresh dashboard every 30 seconds
    setInterval(() => {
        if (!document.querySelector('#dashboard-tab').classList.contains('hidden')) {
            loadDashboardData();
        }
    }, 30000);
});