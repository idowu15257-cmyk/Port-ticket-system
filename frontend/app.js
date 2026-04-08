let currentUser = null;
let currentTicketId = null;
let managedUsersCache = [];

let statusBannerTimeout = null;

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
    if (navTitle) navTitle.textContent = 'Universal Admin Console';
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
    if (navTitle) navTitle.textContent = 'Technician Admin Panel';
    if (dashboardBtn) {
      dashboardBtn.classList.remove('hidden');
      dashboardBtn.textContent = 'Dashboard';
    }
    if (ticketsBtn) ticketsBtn.classList.remove('hidden');
    if (createBtn) createBtn.classList.add('hidden');
    if (createTitle) createTitle.textContent = 'Submit Complaint';
    return;
  }

  if (navTitle) navTitle.textContent = 'Operator Complaint Desk';
  if (dashboardBtn) {
    dashboardBtn.classList.add('hidden');
    dashboardBtn.textContent = 'Dashboard';
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
      ? 'Current API uses localhost. Set a hosted API URL from the login screen "Set Server URL" section.'
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

  saveBtn.addEventListener('click', () => {
    try {
      const saved = window.setApiBaseUrl(input.value);
      current.textContent = `Current: ${saved}`;
      showStatusBanner('Server URL saved. Please login again to continue.', 'success', 4500);
    } catch (error) {
      showStatusBanner(`Invalid server URL: ${error.message}`, 'error', 5000);
    }
  });
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  initializeApiConfigUi();

  if ((window.APP_CONFIG?.API_BASE_URL || '').includes('localhost') && window.Capacitor) {
    showStatusBanner(
      'Set a hosted API URL from login > Set Server URL before using this app on phones.',
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
  document.getElementById('admin-page').classList.add('hidden');
  document.getElementById('tickets-page').classList.add('hidden');
  document.getElementById('create-ticket-page').classList.add('hidden');
  document.getElementById('ticket-detail-page').classList.add('hidden');

  document.getElementById('login-form').onsubmit = handleLogin;
}

function showRegister() {
  document.getElementById('login-page').classList.add('hidden');
  document.getElementById('register-page').classList.remove('hidden');
  document.getElementById('setup-password-page').classList.add('hidden');
  document.getElementById('navbar').classList.add('hidden');
  document.getElementById('dashboard-page').classList.add('hidden');
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

  try {
    const result = await TicketAPI.login(email, password);
    if (result.error) {
      showStatusBanner(result.error, 'error');
      return;
    }

    currentUser = result.user;
    TicketAPI.setToken(result.token);
    localStorage.setItem('user', JSON.stringify(result.user));

    configureRoleUi();
    showDashboard();
    showStatusBanner('Login successful.', 'success', 3500);
  } catch (err) {
    handleNetworkError('Login failed', err);
  }
}

async function handleRegister(e) {
  e.preventDefault();
  const email = document.getElementById('reg-email').value;
  const password = document.getElementById('reg-password').value;
  const fullName = document.getElementById('full-name').value;
  const role = 'operator';

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
    showCreateTicket();
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
    showCreateTicket();
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
  loadManagedUsers();
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
async function loadTickets(listId = 'tickets-list') {
  try {
    const tickets = await TicketAPI.getTickets();
    renderTickets(tickets, listId);
  } catch (err) {
    handleNetworkError('Failed to load tickets', err);
  }
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
    const card = document.createElement('div');
    card.className = 'ticket-card';
    card.innerHTML = `
      <div class="ticket-number">#${ticket.ticket_number}</div>
      <h3>${ticket.title}</h3>
      <p>${ticket.description.substring(0, 100)}...</p>
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

    const tickets = await TicketAPI.getTickets(status, startDate, endDate);
    renderTickets(tickets, 'tickets-list');
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

    const tickets = await TicketAPI.getTickets(status, startDate, endDate);
    renderTickets(tickets, 'tickets-list-secondary');

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

async function exportCSV() {
  try {
    showStatusBanner('Preparing Excel export...', 'info', 2500);

    const isTicketQueuePage = !document.getElementById('tickets-page').classList.contains('hidden');
    const status = isTicketQueuePage
      ? document.getElementById('status-filter-secondary')?.value || ''
      : document.getElementById('status-filter')?.value || '';
    const startDate = isTicketQueuePage
      ? document.getElementById('start-date-secondary')?.value || ''
      : document.getElementById('start-date')?.value || '';
    const endDate = isTicketQueuePage
      ? document.getElementById('end-date-secondary')?.value || ''
      : document.getElementById('end-date')?.value || '';

    const blob = await TicketAPI.exportXLSX(status, startDate, endDate);
    const fileName = `complaints-report-${new Date().toISOString().split('T')[0]}.xlsx`;
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
    showStatusBanner('Excel file downloaded successfully.', 'success', 3500);
  } catch (err) {
    handleNetworkError('Export failed', err);
  }
}

// Create Ticket
async function handleCreateTicket(e) {
  e.preventDefault();

  const title = document.getElementById('ticket-title').value;
  const description = document.getElementById('ticket-description').value;
  const equipmentName = document.getElementById('equipment-name').value;
  const location = document.getElementById('location').value;
  const priority = document.getElementById('priority').value;
  const filesInput = document.getElementById('ticket-files');
  const files = filesInput.files;

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
    if (isOperator()) {
      showCreateTicket();
    } else {
      showDashboard();
    }
  } catch (err) {
    handleNetworkError('Failed to create ticket', err);
  }
}

// Ticket Detail
async function showTicketDetail(ticketId) {
  if (!isTechnician()) {
    showStatusBanner('Only technicians can view complaint details.', 'info', 4500);
    if (isAdmin()) {
      showAdminPanel();
    } else {
      showCreateTicket();
    }
    return;
  }

  currentTicketId = ticketId;
  showPage('ticket-detail-page');
  try {
    const ticket = await TicketAPI.getTicket(ticketId);
    renderTicketDetail(ticket);
    loadTicketFiles();
  } catch (err) {
    handleNetworkError('Failed to load ticket', err);
  }
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

  // Render comments
  const commentsList = document.getElementById('comments-list');
  commentsList.innerHTML = '';

  if (ticket.comments && ticket.comments.length > 0) {
    ticket.comments.forEach(comment => {
      const commentDiv = document.createElement('div');
      commentDiv.className = 'comment';
      commentDiv.innerHTML = `
        <div class="comment-author">${comment.user_id.full_name}</div>
        <div class="comment-time">${new Date(comment.created_at).toLocaleString()}</div>
        <p>${comment.comment_text}</p>
      `;
      commentsList.appendChild(commentDiv);
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
    fileDiv.innerHTML = `
      <div class="file-info">
        <div class="file-name">📎 ${file.file_name}</div>
        <div class="file-meta">${fileSizeKB} KB • Uploaded by ${file.uploaded_by.full_name}</div>
      </div>
      <button onclick="deleteFile('${file.id}')" class="btn-delete">Delete</button>
    `;
    filesList.appendChild(fileDiv);
  });
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
  if (!isTechnician()) {
    showStatusBanner('Only technicians can reply to complaints.', 'error', 4500);
    return;
  }

  e.preventDefault();

  const commentText = document.getElementById('comment-text').value;
  const filesInput = document.getElementById('comment-files');
  const files = filesInput.files;

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
