const API_BASE_URL = window.APP_CONFIG?.API_BASE_URL || 'http://localhost:5000/api';
let currentToken = localStorage.getItem('token') || null;

class TicketAPI {
  static setToken(token) {
    currentToken = token;
    localStorage.setItem('token', token);
  }

  static getAuthHeader() {
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${currentToken}`
    };
  }

  static async register(email, password, fullName, role) {
    const response = await fetch(`${API_BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, fullName, role })
    });
    return response.json();
  }

  static async setupPassword(email, setupToken, newPassword) {
    const response = await fetch(`${API_BASE_URL}/auth/setup-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, setupToken, newPassword })
    });
    return response.json();
  }

  static async login(email, password) {
    const response = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    return response.json();
  }

  static async createTicket(title, description, equipmentName, location, priority) {
    const response = await fetch(`${API_BASE_URL}/tickets`, {
      method: 'POST',
      headers: this.getAuthHeader(),
      body: JSON.stringify({
        title,
        description,
        equipmentName,
        location,
        priority
      })
    });
    return response.json();
  }

  static async getTickets(status = '', startDate = '', endDate = '') {
    const params = new URLSearchParams();
    if (status) params.append('status', status);
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);

    const response = await fetch(`${API_BASE_URL}/tickets?${params}`, {
      headers: this.getAuthHeader()
    });
    return response.json();
  }

  static async getTicket(id) {
    const response = await fetch(`${API_BASE_URL}/tickets/${id}`, {
      headers: this.getAuthHeader()
    });
    return response.json();
  }

  static async updateTicket(id, status, assignedTo, priority) {
    const response = await fetch(`${API_BASE_URL}/tickets/${id}`, {
      method: 'PATCH',
      headers: this.getAuthHeader(),
      body: JSON.stringify({ status, assignedTo, priority })
    });
    return response.json();
  }

  static async addComment(ticketId, commentText, isInternal = false) {
    const response = await fetch(`${API_BASE_URL}/tickets/${ticketId}/comments`, {
      method: 'POST',
      headers: this.getAuthHeader(),
      body: JSON.stringify({ commentText, isInternal })
    });
    return response.json();
  }

  static async getStats() {
    const response = await fetch(`${API_BASE_URL}/stats`, {
      headers: this.getAuthHeader()
    });
    return response.json();
  }

  static async exportCSV(status = '', startDate = '', endDate = '') {
    const params = new URLSearchParams();
    if (status) params.append('status', status);
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);

    const response = await fetch(`${API_BASE_URL}/export/csv?${params}`, {
      headers: this.getAuthHeader()
    });

    if (!response.ok) {
      let errorMessage = `Export failed with status ${response.status}`;
      const contentType = response.headers.get('content-type') || '';

      if (contentType.includes('application/json')) {
        try {
          const payload = await response.json();
          if (payload?.error) errorMessage = payload.error;
        } catch (_) {
          // Keep fallback status message.
        }
      } else {
        try {
          const payloadText = await response.text();
          if (payloadText) errorMessage = payloadText;
        } catch (_) {
          // Keep fallback status message.
        }
      }

      throw new Error(errorMessage);
    }

    return response.text();
  }

  static async exportXLSX(status = '', startDate = '', endDate = '') {
    const params = new URLSearchParams();
    if (status) params.append('status', status);
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);

    const response = await fetch(`${API_BASE_URL}/export/xlsx?${params}`, {
      headers: this.getAuthHeader()
    });

    if (!response.ok) {
      let errorMessage = `Export failed with status ${response.status}`;
      const contentType = response.headers.get('content-type') || '';

      if (contentType.includes('application/json')) {
        try {
          const payload = await response.json();
          if (payload?.error) errorMessage = payload.error;
        } catch (_) {
          // Keep fallback status message.
        }
      } else {
        try {
          const payloadText = await response.text();
          if (payloadText) errorMessage = payloadText;
        } catch (_) {
          // Keep fallback status message.
        }
      }

      throw new Error(errorMessage);
    }

    return response.blob();
  }

  static async uploadFiles(ticketId, files, commentId = null) {
    const formData = new FormData();
    for (let i = 0; i < files.length; i++) {
      formData.append('files', files[i]);
    }

    const endpoint = commentId 
      ? `${API_BASE_URL}/tickets/${ticketId}/comments/${commentId}/upload`
      : `${API_BASE_URL}/tickets/${ticketId}/upload`;

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { Authorization: `Bearer ${currentToken}` },
      body: formData
    });
    return response.json();
  }

  static async getTicketFiles(ticketId) {
    const response = await fetch(`${API_BASE_URL}/tickets/${ticketId}/files`, {
      headers: this.getAuthHeader()
    });
    return response.json();
  }

  static async deleteFile(fileId) {
    const response = await fetch(`${API_BASE_URL}/files/${fileId}`, {
      method: 'DELETE',
      headers: this.getAuthHeader()
    });
    return response.json();
  }

  static async createManagedUser(email, fullName, role) {
    const response = await fetch(`${API_BASE_URL}/admin/users`, {
      method: 'POST',
      headers: this.getAuthHeader(),
      body: JSON.stringify({ email, fullName, role })
    });
    return response.json();
  }

  static async getManagedUsers() {
    const response = await fetch(`${API_BASE_URL}/admin/users`, {
      headers: this.getAuthHeader()
    });
    return response.json();
  }

  static async updateManagedUser(userId, updates) {
    const response = await fetch(`${API_BASE_URL}/admin/users/${userId}`, {
      method: 'PATCH',
      headers: this.getAuthHeader(),
      body: JSON.stringify(updates)
    });
    return response.json();
  }

  static async resetManagedUserPassword(userId) {
    const response = await fetch(`${API_BASE_URL}/admin/users/${userId}/reset-password`, {
      method: 'POST',
      headers: this.getAuthHeader()
    });
    return response.json();
  }
}
