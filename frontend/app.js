let currentUser = null;
let currentTicketId = null;
let managedUsersCache = [];
let currentTicketCanReply = false;

let statusBannerTimeout = null;
const REMEMBERED_LOGIN_EMAILS_KEY = 'remembered_login_emails';
const LAST_LOGIN_EMAIL_KEY = 'last_login_email';

function getRememberedLoginEmails() {
  try {
    const parsed = JSON.parse(localStorage.getItem(REMEMBERED_LOGIN_EMAILS_KEY) || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch (_) {
    return [];
  }
}

function renderRememberedEmailSuggestions() {
  const suggestions = document.getElementById('login-email-suggestions');
  if (!suggestions) return;

  const remembered = getRememberedLoginEmails();
  suggestions.innerHTML = remembered
    .map((email) => `<option value="${String(email).replace(/"/g, '&quot;')}"></option>`)
    .join('');
}

function hydrateLoginEmailInput() {
  const emailInput = document.getElementById('email');
  if (!emailInput) return;

  const lastEmail = localStorage.getItem(LAST_LOGIN_EMAIL_KEY) || '';
  if (lastEmail && !emailInput.value) {
    emailInput.value = lastEmail;
  }
}

function rememberLoginEmail(email) {
  const normalized = String(email || '').trim().toLowerCase();
  if (!normalized) return;

  const deduped = getRememberedLoginEmails().filter((item) => item !== normalized);
  const next = [normalized, ...deduped].slice(0, 6);
  localStorage.setItem(REMEMBERED_LOGIN_EMAILS_KEY, JSON.stringify(next));
  localStorage.setItem(LAST_LOGIN_EMAIL_KEY, normalized);
  renderRememberedEmailSuggestions();
}

function setAuthLoading(pageId, isLoading, message) {
  const page = document.getElementById(pageId);
  if (!page) return;

  const overlay = page.querySelector('.auth-loading-overlay');
  const controls = page.querySelectorAll('input, button, select, textarea');

  page.setAttribute('aria-busy', isLoading ? 'true' : 'false');

  if (overlay) {
    const textNode = overlay.querySelector('.auth-loading-card p');
    if (textNode && message) {
      textNode.textContent = message;
    }
    overlay.classList.toggle('hidden', !isLoading);
    overlay.setAttribute('aria-hidden', isLoading ? 'false' : 'true');
  }

  controls.forEach((control) => {
    control.disabled = isLoading;
  });
}

function isTechnician() {
  return currentUser?.role === 'technician';
}

function isOperator() {
  return currentUser?.role === 'operator';
}

function isAdmin() {
  return currentUser?.role === 'admin';
}

function configureRoleUi() {
  const navTitle = document.getElementById('nav-title');
  const dashboardBtn = document.getElementById('nav-dashboard-btn');
  const ticketsBtn = document.getElementById('nav-tickets-btn');
  const createBtn = document.getElementById('nav-create-btn');
  const createTitle = document.getElementById('create-ticket-title');

  if (!currentUser) return;

  if (isAdmin()) {
    if (navTitle) navTitle.textContent = 'T.A.R.M Admin Console';
    if (dashboardBtn) {
      dashboardBtn.classList.remove('hidden');
      dashboardBtn.textContent = 'User Admin';
    }
    if (ticketsBtn) ticketsBtn.classList.add('hidden');
    if (createBtn) createBtn.classList.add('hidden');
    if (createTitle) createTitle.textContent = 'Submit Complaint';
    return;
  }

  if (isTechnician()) {
    if (navTitle) navTitle.textContent = 'T.A.R.M Technician Panel';
    if (dashboardBtn) {
      dashboardBtn.classList.remove('hidden');
      dashboardBtn.textContent = 'Dashboard';
    }
    if (ticketsBtn) ticketsBtn.classList.remove('hidden');
    if (createBtn) createBtn.classList.add('hidden');
    if (createTitle) createTitle.textContent = 'Submit Complaint';
    return;
  }

  if (navTitle) navTitle.textContent = 'T.A.R.M Operator Desk';
  if (dashboardBtn) {
    dashboardBtn.classList.remove('hidden');
    dashboardBtn.textContent = 'My Tickets';
  }
  if (ticketsBtn) ticketsBtn.classList.add('hidden');
  if (createBtn) createBtn.classList.remove('hidden');
  if (createTitle) createTitle.textContent = 'Submit Complaint';
}

function showStatusBanner(message, type = 'info', autoHideMs = 5000) {
  const banner = document.getElementById('status-banner');
  if (!banner) return;

  banner.classList.remove('hidden', 'info', 'success', 'error');
  banner.classList.add(type);
  banner.textContent = message;

  if (statusBannerTimeout) {
    clearTimeout(statusBannerTimeout);
  }

  if (autoHideMs > 0) {
    statusBannerTimeout = setTimeout(() => {
      banner.classList.add('hidden');
    }, autoHideMs);
  }
}

function handleNetworkError(prefix, err) {
  if (err?.message?.includes('Failed to fetch')) {
    const isLocalApi = (window.APP_CONFIG?.API_BASE_URL || '').includes('localhost');
    const hint = isLocalApi
      ? 'Current API uses localhost. Ask an admin to set a hosted API URL in User Admin > Server Settings.'
      : 'Check internet connection and confirm backend is running.';
    showStatusBanner(
      `${prefix}: Cannot reach backend API. ${hint}`,
      'error',
      9000
    );
    return;
  }
  showStatusBanner(`${prefix}: ${err.message}`, 'error', 7000);
}

function initializeApiConfigUi() {
  const input = document.getElementById('api-url-input');
  const saveBtn = document.getElementById('save-api-url-btn');
  const current = document.getElementById('api-url-current');

  if (!input || !saveBtn || !current) return;

  const activeUrl = window.APP_CONFIG?.API_BASE_URL || '';
  input.value = activeUrl;
  current.textContent = activeUrl ? `Current: ${activeUrl}` : 'Current: not set';

  if (!isAdmin()) {
    input.disabled = true;
    saveBtn.disabled = true;
    current.textContent = 'Only admin can change this setting.';
    return;
  }

  input.disabled = false;
  saveBtn.disabled = false;

  saveBtn.onclick = () => {
    try {
      const saved = window.setApiBaseUrl(input.value);
      current.textContent = `Current: ${saved}`;
      showStatusBanner('Server URL saved. Please login again to continue.', 'success', 4500);
    } catch (error) {
      showStatusBanner(`Invalid server URL: ${error.message}`, 'error', 5000);
    }
  };
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  renderRememberedEmailSuggestions();
  hydrateLoginEmailInput();

  if ((window.APP_CONFIG?.API_BASE_URL || '').includes('localhost') && window.Capacitor) {
    showStatusBanner(
      'This build points to localhost. Ask an admin to set a hosted API URL in Server Settings.',
      'info',
      12000
    );
  }

  const savedUser = localStorage.getItem('user');
  if (savedUser) {
    currentUser = JSON.parse(savedUser);
    TicketAPI.setToken(localStorage.getItem('token'));
    configureRoleUi();
    showDashboard();
  } else {
    showLogin();
  }
});

// Auth Functions
function showLogin() {
  document.getElementById('login-page').classList.remove('hidden');
  document.getElementById('register-page').classList.add('hidden');
  document.getElementById('setup-password-page').classList.add('hidden');
  document.getElementById('navbar').classList.add('hidden');
  document.getElementById('dashboard-page').classList.add('hidden');
  document.getElementById('operator-dashboard-page').classList.add('hidden');
  document.getElementById('admin-page').classList.add('hidden');
  document.getElementById('tickets-page').classList.add('hidden');
  document.getElementById('create-ticket-page').classList.add('hidden');
  document.getElementById('ticket-detail-page').classList.add('hidden');

  document.getElementById('login-form').onsubmit = handleLogin;
  renderRememberedEmailSuggestions();
  hydrateLoginEmailInput();
}

function showRegister() {
  document.getElementById('login-page').classList.add('hidden');
  document.getElementById('register-page').classList.remove('hidden');
  document.getElementById('setup-password-page').classList.add('hidden');
  document.getElementById('navbar').classList.add('hidden');
  document.getElementById('dashboard-page').classList.add('hidden');
  document.getElementById('operator-dashboard-page').classList.add('hidden');
  document.getElementById('admin-page').classList.add('hidden');
  document.getElementById('tickets-page').classList.add('hidden');
  document.getElementById('create-ticket-page').classList.add('hidden');
  document.getElementById('ticket-detail-page').classList.add('hidden');

  document.getElementById('register-form').onsubmit = handleRegister;
}

function showSetupPassword() {
  document.getElementById('login-page').classList.add('hidden');
  document.getElementById('register-page').classList.add('hidden');
  document.getElementById('setup-password-page').classList.remove('hidden');
  document.getElementById('navbar').classList.add('hidden');
  document.getElementById('dashboard-page').classList.add('hidden');
  document.getElementById('operator-dashboard-page').classList.add('hidden');
  document.getElementById('admin-page').classList.add('hidden');
  document.getElementById('tickets-page').classList.add('hidden');
  document.getElementById('create-ticket-page').classList.add('hidden');
  document.getElementById('ticket-detail-page').classList.add('hidden');

  document.getElementById('setup-password-form').onsubmit = handleSetupPassword;
}

async function handleLogin(e) {
  e.preventDefault();
  const email = document.getElementById('email').value;
  const password = document.getElementById('password').value;

  setAuthLoading('login-page', true, 'Signing in...');

  try {
    const result = await TicketAPI.login(email, password);
    if (result.error) {
      showStatusBanner(result.error, 'error');
      return;
    }

    currentUser = result.user;
    TicketAPI.setToken(result.token);
    localStorage.setItem('user', JSON.stringify(result.user));
    rememberLoginEmail(email);

    configureRoleUi();
    showDashboard();
    showStatusBanner('Login successful.', 'success', 3500);
  } catch (err) {
    handleNetworkError('Login failed', err);
  } finally {
    setAuthLoading('login-page', false, 'Signing in...');
  }
}

async function handleRegister(e) {
  e.preventDefault();
  const email = document.getElementById('reg-email').value;
  const password = document.getElementById('reg-password').value;
  const fullName = document.getElementById('full-name').value;
  const role = 'operator';

  setAuthLoading('register-page', true, 'Creating account...');

  try {
    const result = await TicketAPI.register(email, password, fullName, role);
    if (result.error) {
      showStatusBanner(result.error, 'error');
      return;
    }

    currentUser = result.user;
    TicketAPI.setToken(result.token);
    localStorage.setItem('user', JSON.stringify(result.user));

    configureRoleUi();
    showDashboard();
    showStatusBanner('Registration successful.', 'success', 3500);
  } catch (err) {
    handleNetworkError('Registration failed', err);
  } finally {
    setAuthLoading('register-page', false, 'Creating account...');
  }
}

async function handleSetupPassword(e) {
  e.preventDefault();

  const email = document.getElementById('setup-email').value;
  const setupToken = document.getElementById('setup-token').value;
  const newPassword = document.getElementById('setup-new-password').value;
  const confirmPassword = document.getElementById('setup-confirm-password').value;

  if (newPassword !== confirmPassword) {
    showStatusBanner('Passwords do not match.', 'error', 5000);
    return;
  }

  setAuthLoading('setup-password-page', true, 'Saving password...');

  try {
    const result = await TicketAPI.setupPassword(email, setupToken, newPassword);
    if (result.error) {
      showStatusBanner(result.error, 'error', 7000);
      return;
    }

    showStatusBanner('Password setup successful. Please login.', 'success', 4500);
    showLogin();
  } catch (err) {
    handleNetworkError('Password setup failed', err);
  } finally {
    setAuthLoading('setup-password-page', false, 'Saving password...');
  }
}

function logout() {
  currentUser = null;
  localStorage.removeItem('user');
  localStorage.removeItem('token');
  location.reload();
}

// Page Navigation
function showPage(pageId) {
  document.getElementById('login-page').classList.add('hidden');
  document.getElementById('register-page').classList.add('hidden');
  document.getElementById('setup-password-page').classList.add('hidden');
  document.getElementById('navbar').classList.remove('hidden');
  document.getElementById('dashboard-page').classList.add('hidden');
  document.getElementById('operator-dashboard-page').classList.add('hidden');
  document.getElementById('admin-page').classList.add('hidden');
  document.getElementById('tickets-page').classList.add('hidden');
  document.getElementById('create-ticket-page').classList.add('hidden');
  document.getElementById('ticket-detail-page').classList.add('hidden');

  document.getElementById(pageId).classList.remove('hidden');
}

function showDashboard() {
  if (isAdmin()) {
    showAdminPanel();
    return;
  }

  if (isOperator()) {
    showPage('operator-dashboard-page');
    loadOperatorTickets();
    return;
  }

  showPage('dashboard-page');
  loadDashboardStats();
  loadTickets('tickets-list');
}

function showTickets() {
  if (isAdmin()) {
    showAdminPanel();
    return;
  }

  if (isOperator()) {
    showDashboard();
    return;
  }

  showPage('tickets-page');
  loadTickets('tickets-list-secondary');
}

function showCreateTicket() {
  if (isAdmin()) {
    showAdminPanel();
    return;
  }

  showPage('create-ticket-page');
  document.getElementById('create-ticket-form').onsubmit = handleCreateTicket;
}

function showAdminPanel() {
  showPage('admin-page');
  document.getElementById('admin-create-user-form').onsubmit = handleAdminCreateUser;
  initializeApiConfigUi();
  loadManagedUsers();
}

function showTicketsForCurrentRole() {
  if (isOperator()) {
    showDashboard();
    return;
  }

  showTickets();
}

async function handleAdminCreateUser(e) {
  e.preventDefault();

  const fullName = document.getElementById('admin-user-full-name').value;
  const email = document.getElementById('admin-user-email').value;
  const role = document.getElementById('admin-user-role').value;

  try {
    const result = await TicketAPI.createManagedUser(email, fullName, role);
    if (result.error) {
      showStatusBanner(result.error, 'error', 7000);
      return;
    }

    document.getElementById('admin-create-user-form').reset();
    document.getElementById('admin-setup-token').value = result.setupToken || '';
    showStatusBanner(`${role} account created. Share setup token securely.`, 'success', 5000);
    loadManagedUsers();
  } catch (err) {
    handleNetworkError('User creation failed', err);
  }
}

async function loadManagedUsers() {
  try {
    const users = await TicketAPI.getManagedUsers();
    if (users?.error) {
      showStatusBanner(users.error, 'error', 7000);
      return;
    }

    managedUsersCache = Array.isArray(users) ? users : [];
    renderManagedUsers(managedUsersCache);
  } catch (err) {
    handleNetworkError('Failed to load users', err);
  }
}

function renderManagedUsers(users) {
  const container = document.getElementById('admin-users-list');
  if (!container) return;

  if (!users.length) {
    container.innerHTML = '<p>No managed users yet.</p>';
    return;
  }

  container.innerHTML = users.map((user) => `
    <div class="ticket-card" style="margin-bottom: 0.85rem;">
      <div style="display:flex; justify-content:space-between; gap:1rem; flex-wrap:wrap; align-items:center;">
        <div>
          <div class="ticket-number">${user.email}</div>
          <h3 style="margin: 0.2rem 0;">${user.full_name}</h3>
          <p style="margin:0;">Role: ${user.role} | Status: ${user.status}</p>
        </div>
        <div style="display:flex; gap:0.5rem; flex-wrap:wrap; align-items:center;">
          <select id="role-select-${user.id}">
            <option value="operator" ${user.role === 'operator' ? 'selected' : ''}>Operator</option>
            <option value="technician" ${user.role === 'technician' ? 'selected' : ''}>Technician</option>
          </select>
          <button class="btn-secondary" onclick="updateManagedUserRole('${user.id}')">Save Role</button>
          <button class="btn-secondary" onclick="toggleManagedUserStatus('${user.id}', '${user.status}')">${user.status === 'inactive' ? 'Activate' : 'Deactivate'}</button>
          <button class="btn-primary" onclick="resetManagedUserPassword('${user.id}')">Reset Password</button>
        </div>
      </div>
    </div>
  `).join('');
}

async function updateManagedUserRole(userId) {
  const select = document.getElementById(`role-select-${userId}`);
  if (!select) return;

  try {
    const result = await TicketAPI.updateManagedUser(userId, { role: select.value });
    if (result?.error) {
      showStatusBanner(result.error, 'error', 7000);
      return;
    }

    showStatusBanner('User role updated.', 'success', 3500);
    loadManagedUsers();
  } catch (err) {
    handleNetworkError('Role update failed', err);
  }
}

async function toggleManagedUserStatus(userId, currentStatus) {
  const nextStatus = currentStatus === 'inactive' ? 'active' : 'inactive';

  try {
    const result = await TicketAPI.updateManagedUser(userId, { status: nextStatus });
    if (result?.error) {
      showStatusBanner(result.error, 'error', 7000);
      return;
    }

    showStatusBanner(`User ${nextStatus === 'active' ? 'activated' : 'deactivated'}.`, 'success', 3500);
    loadManagedUsers();
  } catch (err) {
    handleNetworkError('Status update failed', err);
  }
}

async function resetManagedUserPassword(userId) {
  try {
    const result = await TicketAPI.resetManagedUserPassword(userId);
    if (result?.error) {
      showStatusBanner(result.error, 'error', 7000);
      return;
    }

    document.getElementById('admin-setup-token').value = result.setupToken || '';
    showStatusBanner('Password reset token generated. Share securely.', 'success', 5000);
    loadManagedUsers();
  } catch (err) {
    handleNetworkError('Password reset failed', err);
  }
}

// Dashboard
async function loadDashboardStats() {
  if (isOperator()) return;

  try {
    const stats = await TicketAPI.getStats();
    document.getElementById('total-tickets').textContent = stats.total;
    document.getElementById('open-tickets').textContent = stats.open;
    document.getElementById('closed-tickets').textContent = stats.closed;
  } catch (err) {
    console.error('Failed to load stats:', err);
  }
}

// Tickets
async function loadTickets(listId = 'tickets-list', filters = {}) {
  try {
    const tickets = await TicketAPI.getTickets(
      filters.status || '',
      filters.startDate || '',
      filters.endDate || ''
    );
    renderTickets(tickets, listId);
  } catch (err) {
    handleNetworkError('Failed to load tickets', err);
  }
}

async function loadOperatorTickets() {
  const status = document.getElementById('operator-status-filter')?.value || '';
  const startDate = document.getElementById('operator-start-date')?.value || '';
  const endDate = document.getElementById('operator-end-date')?.value || '';
  await loadTickets('operator-tickets-list', { status, startDate, endDate });
}

async function applyOperatorFilters() {
  if (!isOperator()) return;
  await loadOperatorTickets();
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderTickets(tickets, listId = 'tickets-list') {
  const list = document.getElementById(listId);
  if (!list) return;
  list.innerHTML = '';

  if (tickets?.error) {
    showStatusBanner(`Failed to load tickets: ${tickets.error}`, 'error', 8000);
    list.innerHTML = '<p>Could not load tickets right now.</p>';
    return;
  }

  if (!Array.isArray(tickets)) {
    showStatusBanner('Failed to load tickets: Unexpected server response.', 'error', 8000);
    list.innerHTML = '<p>Could not load tickets right now.</p>';
    return;
  }

  if (!tickets || tickets.length === 0) {
    list.innerHTML = '<p>No tickets found.</p>';
    return;
  }

  tickets.forEach(ticket => {
    const isUrgent = (ticket.priority || '').toLowerCase() === 'urgent';
    const isTechnicianView = listId === 'tickets-list' || listId === 'tickets-list-secondary';
    const preview = escapeHtml((ticket.description || '').slice(0, 120));
    const createdBy = escapeHtml(ticket.created_by?.full_name || ticket.created_by?.email || 'Unknown operator');

    const card = document.createElement('div');
    card.className = `ticket-card ${isUrgent ? 'priority-urgent' : ''}`;
    card.innerHTML = `
      <div class="ticket-number">#${ticket.ticket_number}</div>
      ${isUrgent && isTechnicianView ? '<div class="urgent-banner">URGENT: Immediate attention required</div>' : ''}
      <h3>${escapeHtml(ticket.title)}</h3>
      <p>${preview}${ticket.description && ticket.description.length > 120 ? '...' : ''}</p>
      <div class="ticket-card-meta">Priority: ${(ticket.priority || 'medium').toUpperCase()} | By: ${createdBy}</div>
      <span class="status-badge ${ticket.status}">${ticket.status.replace('_', ' ').toUpperCase()}</span>
    `;
    card.onclick = () => showTicketDetail(ticket.id);
    list.appendChild(card);
  });
}

async function applyFilters() {
  if (isOperator()) return;

  try {
    const status = document.getElementById('status-filter').value;
    const startDate = document.getElementById('start-date').value;
    const endDate = document.getElementById('end-date').value;

    await loadTickets('tickets-list', { status, startDate, endDate });
    const statusSecondary = document.getElementById('status-filter-secondary');
    const startSecondary = document.getElementById('start-date-secondary');
    const endSecondary = document.getElementById('end-date-secondary');
    if (statusSecondary) statusSecondary.value = status;
    if (startSecondary) startSecondary.value = startDate;
    if (endSecondary) endSecondary.value = endDate;
  } catch (err) {
    handleNetworkError('Filter failed', err);
  }
}

async function applyFiltersFromTicketsPage() {
  if (isOperator()) return;

  try {
    const status = document.getElementById('status-filter-secondary').value;
    const startDate = document.getElementById('start-date-secondary').value;
    const endDate = document.getElementById('end-date-secondary').value;

    await loadTickets('tickets-list-secondary', { status, startDate, endDate });

    const statusPrimary = document.getElementById('status-filter');
    const startPrimary = document.getElementById('start-date');
    const endPrimary = document.getElementById('end-date');
    if (statusPrimary) statusPrimary.value = status;
    if (startPrimary) startPrimary.value = startDate;
    if (endPrimary) endPrimary.value = endDate;
  } catch (err) {
    handleNetworkError('Filter failed', err);
  }
}

// Timeframe helper functions for export
function calculateDateRange(timeframe) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const endDate = today.toISOString().split('T')[0];
  
  let startDate;
  
  switch(timeframe) {
    case '7days':
      const date7 = new Date(today);
      date7.setDate(date7.getDate() - 7);
      startDate = date7.toISOString().split('T')[0];
      break;
    case '1month':
      const date1m = new Date(today);
      date1m.setMonth(date1m.getMonth() - 1);
      startDate = date1m.toISOString().split('T')[0];
      break;
    case '3months':
      const date3m = new Date(today);
      date3m.setMonth(date3m.getMonth() - 3);
      startDate = date3m.toISOString().split('T')[0];
      break;
    default:
      startDate = endDate;
  }
  
  return { startDate, endDate };
}

function handleTimeframeChange() {
  const selectedTimeframe = document.querySelector('input[name="timeframe"]:checked').value;
  const customDatesSection = document.getElementById('custom-dates-section');
  
  if (selectedTimeframe === 'custom') {
    customDatesSection.classList.remove('hidden');
  } else {
    customDatesSection.classList.add('hidden');
  }
}

function showExportModal() {
  const modal = document.getElementById('export-timeframe-modal');
  modal.classList.remove('hidden');
  
  // Add event listeners for radio buttons
  const radioButtons = document.querySelectorAll('input[name="timeframe"]');
  radioButtons.forEach(radio => {
    radio.addEventListener('change', handleTimeframeChange);
  });
  
  // Set default dates to today
  const today = new Date().toISOString().split('T')[0];
  document.getElementById('modal-end-date').value = today;
  
  // Trigger change event to ensure custom section is hidden initially
  handleTimeframeChange();
}

function closeExportModal() {
  const modal = document.getElementById('export-timeframe-modal');
  modal.classList.add('hidden');
}

async function proceedWithExport() {
  try {
    const selectedTimeframe = document.querySelector('input[name="timeframe"]:checked').value;
    let startDate = '';
    let endDate = '';
    
    if (selectedTimeframe === 'custom') {
      startDate = document.getElementById('modal-start-date').value;
      endDate = document.getElementById('modal-end-date').value;
      
      if (!startDate || !endDate) {
        showStatusBanner('Please select both start and end dates for custom range', 'error', 5000);
        return;
      }
    } else {
      const { startDate: calculatedStart, endDate: calculatedEnd } = calculateDateRange(selectedTimeframe);
      startDate = calculatedStart;
      endDate = calculatedEnd;
    }
    
    // Close the modal
    closeExportModal();
    
    // Get other filters from the page
    const isTicketQueuePage = !document.getElementById('tickets-page').classList.contains('hidden');
    const status = isTicketQueuePage
      ? document.getElementById('status-filter-secondary')?.value || ''
      : document.getElementById('status-filter')?.value || '';
    
    // Show export in progress
    showStatusBanner('Preparing Excel export...', 'info', 2500);
    
    // Call the actual export function
    await performExport(status, startDate, endDate);
  } catch (err) {
    handleNetworkError('Export failed', err);
  }
}

async function performExport(status, startDate, endDate) {
  try {
    const blob = await TicketAPI.exportXLSX(status, startDate, endDate);
    const fileName = `complaints-report-${new Date().toISOString().split('T')[0]}.xlsx`;

    if (window.Capacitor) {
      const Filesystem = window.Capacitor.Plugins?.Filesystem;
      const Share = window.Capacitor.Plugins?.Share;

      if (Filesystem?.writeFile && Filesystem?.getUri && Share?.share) {
        const base64Data = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => {
            const result = String(reader.result || '');
            const commaIndex = result.indexOf(',');
            resolve(commaIndex > -1 ? result.slice(commaIndex + 1) : result);
          };
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });

        await Filesystem.writeFile({
          path: fileName,
          data: base64Data,
          directory: 'CACHE',
          recursive: true
        });

        const fileUri = await Filesystem.getUri({
          path: fileName,
          directory: 'CACHE'
        });

        await Share.share({
          title: 'Complaints Export',
          text: 'Complaints register export',
          url: fileUri.uri,
          dialogTitle: 'Save or share export file'
        });

        showStatusBanner('Export ready. Choose where to save the Excel file.', 'success', 5500);
        return;
      }
    }

    // Fallback to browser download
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    showStatusBanner('Excel report downloaded successfully!', 'success', 5000);
  } catch (err) {
    handleNetworkError('Export failed', err);
  }
}

async function exportCSV() {
  try {
    showExportModal();
  } catch (err) {
    handleNetworkError('Export failed', err);
  }
}

// Create Ticket
async function handleCreateTicket(e) {
  e.preventDefault();

  const title = document.getElementById('ticket-title').value.trim();
  const description = document.getElementById('ticket-description').value.trim();
  const equipmentName = document.getElementById('equipment-name').value.trim();
  const location = document.getElementById('location').value.trim();
  const priority = document.getElementById('priority').value;
  const filesInput = document.getElementById('ticket-files');
  const files = filesInput.files;
  const allowedPriorities = ['low', 'medium', 'urgent'];

  if (!location) {
    showStatusBanner('RTG/QC is required before submitting a complaint.', 'error', 5000);
    return;
  }

  if (!allowedPriorities.includes(priority)) {
    showStatusBanner('Invalid priority selected. Use Low, Medium, or Urgent.', 'error', 5000);
    return;
  }

  try {
    const result = await TicketAPI.createTicket(
      title,
      description,
      equipmentName,
      location,
      priority
    );

    if (result.error) {
      showStatusBanner(result.error, 'error');
      return;
    }

    // Upload files if any
    if (files && files.length > 0) {
      try {
        await TicketAPI.uploadFiles(result.id, files);
      } catch (err) {
        console.error('File upload failed:', err);
        handleNetworkError('Ticket created, but file upload failed', err);
      }
    }

    showStatusBanner('Complaint submitted successfully.', 'success', 3500);
    document.getElementById('create-ticket-form').reset();
    showDashboard();
  } catch (err) {
    handleNetworkError('Failed to create ticket', err);
  }
}

// Ticket Detail
async function showTicketDetail(ticketId) {
  if (!currentUser) {
    showLogin();
    return;
  }

  currentTicketId = ticketId;
  showPage('ticket-detail-page');
  try {
    const ticket = await TicketAPI.getTicket(ticketId);
    if (ticket?.error) {
      showStatusBanner(ticket.error, 'error', 6000);
      showTicketsForCurrentRole();
      return;
    }

    if ((ticket.priority || '').toLowerCase() === 'urgent' && (isTechnician() || isAdmin())) {
      showStatusBanner('URGENT complaint. Please review this ticket immediately.', 'error', 7000);
    }

    renderTicketDetail(ticket);
    loadTicketFiles();
  } catch (err) {
    handleNetworkError('Failed to load ticket', err);
  }
}

function renderConversationMessage({ author, role, text, createdAt, type = 'comment' }) {
  const safeAuthor = escapeHtml(author || 'Unknown user');
  const safeRole = escapeHtml((role || 'user').toUpperCase());
  const safeText = escapeHtml(text || '');
  const dateText = createdAt ? new Date(createdAt).toLocaleString() : '';

  return `
    <div class="comment ${type === 'initial' ? 'initial-message' : ''}">
      <div class="comment-header">
        <div class="comment-author">${safeAuthor}</div>
        <span class="role-chip role-${(role || 'user').toLowerCase()}">${safeRole}</span>
      </div>
      <div class="comment-time">${escapeHtml(dateText)}</div>
      <p>${safeText}</p>
    </div>
  `;
}

function renderTicketDetail(ticket) {
  document.getElementById('detail-title').textContent = ticket.title;
  document.getElementById('detail-ticket-number').textContent = `#${ticket.ticket_number}`;
  document.getElementById('detail-status').textContent = ticket.status.replace('_', ' ').toUpperCase();
  document.getElementById('detail-priority').textContent = `Priority: ${ticket.priority.toUpperCase()}`;
  document.getElementById('detail-equipment').textContent = ticket.equipment_name || '-';
  document.getElementById('detail-location').textContent = ticket.location || '-';
  document.getElementById('detail-created').textContent = new Date(ticket.created_at).toLocaleDateString();
  document.getElementById('detail-assigned').textContent = 
    ticket.assigned_to?.full_name || 'Unassigned';

  document.getElementById('status-update').value = ticket.status;

  const ticketActions = document.querySelector('.ticket-actions');
  if (ticketActions) {
    ticketActions.classList.toggle('hidden', !isTechnician());
  }

  currentTicketCanReply = Boolean(isTechnician() || isAdmin() || ticket.can_operator_reply);

  const commentForm = document.getElementById('add-comment-form');
  const commentNote = document.getElementById('comment-permission-note');
  const commentInput = document.getElementById('comment-text');
  if (commentInput) {
    commentInput.placeholder = isOperator()
      ? 'Reply to technician...'
      : 'Add a response...';
  }

  if (commentForm) {
    commentForm.classList.toggle('hidden', !currentTicketCanReply);
  }

  if (commentNote) {
    if (isOperator() && !ticket.can_operator_reply) {
      commentNote.classList.remove('hidden');
      commentNote.textContent = 'You can reply after a technician posts the first response.';
    } else {
      commentNote.classList.add('hidden');
      commentNote.textContent = '';
    }
  }

  // Render comments
  const commentsList = document.getElementById('comments-list');
  commentsList.innerHTML = '';

  commentsList.insertAdjacentHTML('beforeend', renderConversationMessage({
    author: ticket.created_by?.full_name || ticket.created_by?.email || 'Operator',
    role: 'operator',
    text: ticket.description,
    createdAt: ticket.created_at,
    type: 'initial'
  }));

  if (ticket.comments && ticket.comments.length > 0) {
    ticket.comments.forEach(comment => {
      const author = comment.user?.full_name || comment.user?.email || 'Unknown user';
      const role = comment.user?.role || 'user';
      commentsList.insertAdjacentHTML('beforeend', renderConversationMessage({
        author,
        role,
        text: comment.comment_text,
        createdAt: comment.created_at,
        type: 'comment'
      }));
    });
  }
}

async function loadTicketFiles() {
  try {
    const files = await TicketAPI.getTicketFiles(currentTicketId);
    renderTicketFiles(files);
  } catch (err) {
    console.error('Failed to load files:', err);
  }
}

function renderTicketFiles(files) {
  const filesList = document.getElementById('files-list');
  filesList.innerHTML = '';

  if (!files || files.length === 0) {
    filesList.innerHTML = '<p>No attachments</p>';
    return;
  }

  files.forEach(file => {
    const fileDiv = document.createElement('div');
    fileDiv.className = 'file-item';
    const fileSizeKB = (file.file_size / 1024).toFixed(2);
    const isImage = (file.file_type || '').startsWith('image/');
    const previewUrl = file.preview_url || '';
    const actionLabel = isImage ? 'Preview image' : 'Open file';
    const canDelete = isTechnician() || isAdmin();

    fileDiv.innerHTML = `
      <div class="file-info">
        ${isImage && previewUrl ? `<img src="${previewUrl}" alt="${escapeHtml(file.file_name)}" class="ticket-file-thumbnail" onclick="openAttachmentPreview('${previewUrl}')">` : ''}
        <div class="file-name">📎 ${file.file_name}</div>
        <div class="file-meta">${fileSizeKB} KB • Uploaded by ${file.uploaded_by.full_name}</div>
        ${previewUrl ? `<button type="button" class="btn-secondary file-open-btn" onclick="openAttachmentPreview('${previewUrl}')">${actionLabel}</button>` : ''}
      </div>
      ${canDelete ? `<button onclick="deleteFile('${file.id}')" class="btn-delete">Delete</button>` : ''}
    `;
    filesList.appendChild(fileDiv);
  });
}

function openAttachmentPreview(url) {
  if (!url) {
    showStatusBanner('Preview link is unavailable. Refresh ticket and try again.', 'error', 4500);
    return;
  }

  window.open(url, '_blank', 'noopener');
}

async function deleteFile(fileId) {
  if (!confirm('Are you sure you want to delete this file?')) return;

  try {
    await TicketAPI.deleteFile(fileId);
    loadTicketFiles();
    showStatusBanner('Attachment deleted.', 'success', 3000);
  } catch (err) {
    handleNetworkError('Delete failed', err);
  }
}

async function updateStatus() {
  if (!isTechnician()) {
    showStatusBanner('Only technicians can update complaint status.', 'error', 4500);
    return;
  }

  const newStatus = document.getElementById('status-update').value;

  try {
    const result = await TicketAPI.updateTicket(currentTicketId, newStatus);
    if (result.error) {
      showStatusBanner(result.error, 'error');
      return;
    }

    showStatusBanner('Ticket updated successfully.', 'success', 3500);
    showTicketDetail(currentTicketId);
  } catch (err) {
    handleNetworkError('Update failed', err);
  }
}

async function addComment(e) {
  if (!currentTicketCanReply) {
    showStatusBanner('You are not allowed to reply yet.', 'error', 4500);
    return;
  }

  e.preventDefault();

  const commentText = document.getElementById('comment-text').value.trim();
  const filesInput = document.getElementById('comment-files');
  const files = filesInput.files;

  if (!commentText) {
    showStatusBanner('Response text is required.', 'error', 4500);
    return;
  }

  try {
    const result = await TicketAPI.addComment(currentTicketId, commentText);
    if (result.error) {
      showStatusBanner(result.error, 'error');
      return;
    }

    const commentId = result.id;

    // Upload files if any (associated with this comment)
    if (files && files.length > 0) {
      try {
        await TicketAPI.uploadFiles(currentTicketId, files, commentId);
      } catch (err) {
        console.error('File upload failed:', err);
        handleNetworkError('Comment posted, but file upload failed', err);
      }
    }

    document.getElementById('comment-text').value = '';
    filesInput.value = '';
    showTicketDetail(currentTicketId);
    showStatusBanner('Comment posted.', 'success', 3000);
  } catch (err) {
    handleNetworkError('Failed to add comment', err);
  }
}
