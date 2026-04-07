let currentUser = null;
let currentTicketId = null;

let statusBannerTimeout = null;

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
    showDashboard();
  } else {
    showLogin();
  }
});

// Auth Functions
function showLogin() {
  document.getElementById('login-page').classList.remove('hidden');
  document.getElementById('register-page').classList.add('hidden');
  document.getElementById('navbar').classList.add('hidden');
  document.getElementById('dashboard-page').classList.add('hidden');
  document.getElementById('tickets-page').classList.add('hidden');
  document.getElementById('create-ticket-page').classList.add('hidden');
  document.getElementById('ticket-detail-page').classList.add('hidden');

  document.getElementById('login-form').onsubmit = handleLogin;
}

function showRegister() {
  document.getElementById('login-page').classList.add('hidden');
  document.getElementById('register-page').classList.remove('hidden');
  document.getElementById('navbar').classList.add('hidden');
  document.getElementById('dashboard-page').classList.add('hidden');
  document.getElementById('tickets-page').classList.add('hidden');

  document.getElementById('register-form').onsubmit = handleRegister;
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
  const role = document.getElementById('role').value;

  try {
    const result = await TicketAPI.register(email, password, fullName, role);
    if (result.error) {
      showStatusBanner(result.error, 'error');
      return;
    }

    currentUser = result.user;
    TicketAPI.setToken(result.token);
    localStorage.setItem('user', JSON.stringify(result.user));

    showDashboard();
    showStatusBanner('Registration successful.', 'success', 3500);
  } catch (err) {
    handleNetworkError('Registration failed', err);
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
  document.getElementById('navbar').classList.remove('hidden');
  document.getElementById('dashboard-page').classList.add('hidden');
  document.getElementById('tickets-page').classList.add('hidden');
  document.getElementById('create-ticket-page').classList.add('hidden');
  document.getElementById('ticket-detail-page').classList.add('hidden');

  document.getElementById(pageId).classList.remove('hidden');
}

function showDashboard() {
  showPage('dashboard-page');
  loadDashboardStats();
}

function showTickets() {
  showPage('tickets-page');
  loadTickets();
}

function showCreateTicket() {
  showPage('create-ticket-page');
  document.getElementById('create-ticket-form').onsubmit = handleCreateTicket;
}

// Dashboard
async function loadDashboardStats() {
  try {
    const stats = await TicketAPI.getStats();
    document.getElementById('total-tickets').textContent = stats.total;
    document.getElementById('open-tickets').textContent = stats.open;
    document.getElementById('resolved-tickets').textContent = stats.resolved;
  } catch (err) {
    console.error('Failed to load stats:', err);
  }
}

// Tickets
async function loadTickets() {
  try {
    const tickets = await TicketAPI.getTickets();
    renderTickets(tickets);
  } catch (err) {
    handleNetworkError('Failed to load tickets', err);
  }
}

function renderTickets(tickets) {
  const list = document.getElementById('tickets-list');
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
  try {
    const status = document.getElementById('status-filter').value;
    const startDate = document.getElementById('start-date').value;
    const endDate = document.getElementById('end-date').value;

    const tickets = await TicketAPI.getTickets(status, startDate, endDate);
    renderTickets(tickets);
  } catch (err) {
    handleNetworkError('Filter failed', err);
  }
}

async function exportCSV() {
  try {
    const status = document.getElementById('status-filter').value;
    const startDate = document.getElementById('start-date').value;
    const endDate = document.getElementById('end-date').value;

    const blob = await TicketAPI.exportCSV(status, startDate, endDate);
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tickets-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
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

    showStatusBanner('Ticket created successfully.', 'success', 3500);
    document.getElementById('create-ticket-form').reset();
    showTickets();
  } catch (err) {
    handleNetworkError('Failed to create ticket', err);
  }
}

// Ticket Detail
async function showTicketDetail(ticketId) {
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
