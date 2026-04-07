# Code Citations

## License: unknown
https://github.com/TheEvolution7/HTML-2/blob/294c6d5bf224f89f9d982fd6ec6ee27ae19d51f4/royal-residence-realty/leads-manage-edit-task.html

```
I need file editing capabilities to create this project structure. Let me provide you with the complete code for all files, organized by directory. You can either:

1. **Enable editing tools** in VS Code (I can create all files automatically)
2. **Manually create the files** using the code blocks I'll provide

Here's the complete full-stack architecture:

## **Project Structure**
```
port-ticket-system/
├── DATABASE_SCHEMA.sql
├── README.md
├── .env.example
├── backend/
│   ├── package.json
│   ├── server.js
│   └── .env (user creates from .env.example)
└── frontend/
    ├── index.html
    ├── styles.css
    ├── app.js
    └── api.js
```

---

## **1. DATABASE_SCHEMA.sql**
PostgreSQL schema for Supabase:

```sql
-- Users table (operators and tech team)
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  full_name VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL CHECK (role IN ('operator', 'technician', 'admin')),
  department VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  status VARCHAR(50) DEFAULT 'active'
);

-- Tickets table
CREATE TABLE tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_number VARCHAR(50) UNIQUE NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
  priority VARCHAR(50) DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  assigned_to UUID REFERENCES users(id) ON DELETE SET NULL,
  equipment_name VARCHAR(255),
  location VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  resolved_at TIMESTAMP
);

-- Ticket comments/responses
CREATE TABLE ticket_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  comment_text TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  is_internal BOOLEAN DEFAULT FALSE
);

-- Audit log for exports
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  action VARCHAR(100) NOT NULL,
  details JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX idx_tickets_status ON tickets(status);
CREATE INDEX idx_tickets_created_by ON tickets(created_by);
CREATE INDEX idx_tickets_assigned_to ON tickets(assigned_to);
CREATE INDEX idx_tickets_created_at ON tickets(created_at);
CREATE INDEX idx_comments_ticket_id ON ticket_comments(ticket_id);

-- Enable Row Level Security (RLS)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_comments ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own profile" ON users
  FOR SELECT USING (auth.uid()::text = id::text);

CREATE POLICY "Operators can view assigned tickets" ON tickets
  FOR SELECT USING (
    created_by = auth.uid()::uuid OR 
    assigned_to = auth.uid()::uuid OR 
    (SELECT role FROM users WHERE id = auth.uid()::uuid) = 'admin'
  );
```

---

## **2. backend/package.json**

```json
{
  "name": "port-ticket-system-api",
  "version": "1.0.0",
  "description": "Ticket system API for port terminal operations",
  "main": "server.js",
  "type": "module",
  "scripts": {
    "start": "node server.js",
    "dev": "node --watch server.js"
  },
  "dependencies": {
    "express": "^4.18.2",
    "cors": "^2.8.5",
    "dotenv": "^16.3.1",
    "@supabase/supabase-js": "^2.38.4",
    "jsonwebtoken": "^9.1.0",
    "bcryptjs": "^2.4.3",
    "papaparse": "^5.4.1"
  }
}
```

---

## **3. backend/server.js**

```javascript
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import jwt from 'jsonwebtoken';
import bcryptjs from 'bcryptjs';
import Papa from 'papaparse';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Initialize Supabase
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// Middleware
app.use(cors());
app.use(express.json());

// Authentication middleware
const verifyToken = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token provided' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    res.status(401).json({ error: 'Invalid token' });
  }
};

// === AUTH ENDPOINTS ===
app.post('/api/auth/register', async (req, res) => {
  const { email, password, fullName, role } = req.body;

  try {
    const hashedPassword = await bcryptjs.hash(password, 10);
    
    const { data, error } = await supabase
      .from('users')
      .insert([{
        email,
        password_hash: hashedPassword,
        full_name: fullName,
        role: role || 'operator'
      }])
      .select();

    if (error) throw error;

    const token = jwt.sign(
      { id: data[0].id, email, role: data[0].role },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(201).json({ user: data[0], token });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    const { data: users, error } = await supabase
      .from('users')
      .select('*')
      .eq('email', email);

    if (error || !users.length) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = users[0];
    const validPassword = await bcryptjs.compare(password, user.password_hash);

    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({ user, token });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// === TICKET ENDPOINTS ===
app.post('/api/tickets', verifyToken, async (req, res) => {
  const { title, description, equipmentName, location, priority } = req.body;

  try {
    const ticketNumber = `TKT-${Date.now()}`;
    
    const { data, error } = await supabase
      .from('tickets')
      .insert([{
        ticket_number: ticketNumber,
        title,
        description,
        equipment_name: equipmentName,
        location,
        priority: priority || 'medium',
        created_by: req.user.id
      }])
      .select();

    if (error) throw error;

    // Log action
    await supabase.from('audit_logs').insert([{
      user_id: req.user.id,
      action: 'ticket_created',
      details: { ticket_id: data[0].id }
    }]);

    res.status(201).json(data[0]);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/tickets', verifyToken, async (req, res) => {
  const { status, startDate, endDate } = req.query;

  try {
    let query = supabase
      .from('tickets')
      .select('*, created_by:users(full_name, email), assigned_to:users(full_name, email)');

    if (status) query = query.eq('status', status);
    if (startDate) query = query.gte('created_at', startDate);
    if (endDate) query = query.lte('created_at', endDate);

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/tickets/:id', verifyToken, async (req, res) => {
  try {
    const { data: ticket, error: ticketError } = await supabase
      .from('tickets')
      .select('*, created_by:users(full_name, email), assigned_to:users(full_name, email)')
      .eq('id', req.params.id)
      .single();

    if (ticketError) throw ticketError;

    const { data: comments, error: commentsError } = await supabase
      .from('ticket_comments')
      .select('*, user_id:users(full_name, email)')
      .eq('ticket_id', req.params.id)
      .order('created_at', { ascending: true });

    if (commentsError) throw commentsError;

    res.json({ ...ticket, comments });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.patch('/api/tickets/:id', verifyToken, async (req, res) => {
  const { status, assignedTo, priority } = req.body;

  try {
    const updateData = { updated_at: new Date() };
    if (status) updateData.status = status;
    if (assignedTo) updateData.assigned_to = assignedTo;
    if (priority) updateData.priority = priority;
    if (status === 'resolved') updateData.resolved_at = new Date();

    const { data, error } = await supabase
      .from('tickets')
      .update(updateData)
      .eq('id', req.params.id)
      .select();

    if (error) throw error;

    // Log action
    await supabase.from('audit_logs').insert([{
      user_id: req.user.id,
      action: 'ticket_updated',
      details: { ticket_id: req.params.id, changes: updateData }
    }]);

    res.json(data[0]);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// === COMMENTS ENDPOINTS ===
app.post('/api/tickets/:id/comments', verifyToken, async (req, res) => {
  const { commentText, isInternal } = req.body;

  try {
    const { data, error } = await supabase
      .from('ticket_comments')
      .insert([{
        ticket_id: req.params.id,
        user_id: req.user.id,
        comment_text: commentText,
        is_internal: isInternal || false
      }])
      .select('*, user_id:users(full_name, email)');

    if (error) throw error;
    res.status(201).json(data[0]);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// === EXPORT ENDPOINTS ===
app.get('/api/export/csv', verifyToken, async (req, res) => {
  const { status, startDate, endDate } = req.query;

  try {
    let query = supabase
      .from('tickets')
      .select('ticket_number, title, status, priority, equipment_name, location, created_at, resolved_at, created_by:users(full_name), assigned_to:users(full_name)');

    if (status) query = query.eq('status', status);
    if (startDate) query = query.gte('created_at', startDate);
    if (endDate) query = query.lte('created_at', endDate);

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) throw error;

    // Convert to CSV
    const csv = Papa.unparse(data);

    // Log export action
    await supabase.from('audit_logs').insert([{
      user_id: req.user.id,
      action: 'data_exported',
      details: { format: 'csv', filters: { status, startDate, endDate } }
    }]);

    res.header('Content-Type', 'text/csv');
    res.header('Content-Disposition', 'attachment; filename="tickets-export.csv"');
    res.send(csv);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// === DASHBOARD STATS ===
app.get('/api/stats', verifyToken, async (req, res) => {
  try {
    const { data: totalTickets } = await supabase
      .from('tickets')
      .select('count()', { count: 'exact' });

    const { data: openTickets } = await supabase
      .from('tickets')
      .select('count()', { count: 'exact' })
      .eq('status', 'open');

    const { data: resolvedTickets } = await supabase
      .from('tickets')
      .select('count()', { count: 'exact' })
      .eq('status', 'resolved');

    res.json({
      total: totalTickets?.count || 0,
      open: openTickets?.count || 0,
      resolved: resolvedTickets?.count || 0
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
```

---

## **4. backend/.env.example**

```env
PORT=5000
SUPABASE_URL=your_supabase_url_here
SUPABASE_SERVICE_KEY=your_service_key_here
JWT_SECRET=your_jwt_secret_here_use_strong_random_string
```

---

## **5. frontend/index.html**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Port Terminal Ticket System</title>
  <link rel="stylesheet" href="styles.css">
</head>
<body>
  <div id="app"></div>

  <!-- Auth Pages -->
  <div id="login-page" class="page hidden">
    <form id="login-form" class="auth-form">
      <h1>Port Terminal Ticket System</h1>
      <input type="email" id="email" placeholder="Email" required>
      <input type="password" id="password" placeholder="Password" required>
      <button type="submit">Login</button>
      <p>Don't have an account? <a href="#" onclick="showRegister()">Sign up</a></p>
    </form>
  </div>

  <div id="register-page" class="page hidden">
    <form id="register-form" class="auth-form">
      <h1>Create Account</h1>
      <input type="email" id="reg-email" placeholder="Email" required>
      <input type="password" id="reg-password" placeholder="Password" required>
      <input type="text" id="full-name" placeholder="Full Name" required>
      <select id="role">
        <option value="operator">Operator</option>
        <option value="technician">Technician</option>
      </select>
      <button type="submit">Sign Up</button>
      <p>Already have an account? <a href="#" onclick="showLogin()">Login</a></p>
    </form>
  </div>

  <!-- Main App -->
  <nav class="navbar hidden" id="navbar">
    <div class="nav-container">
      <h2>🎫 Ticket System</h2>
      <div class="nav-links">
        <button onclick="showDashboard()">Dashboard</button>
        <button onclick="showTickets()">Tickets</button>
        <button onclick="showCreateTicket()">+ New Ticket</button>
        <button onclick="logout()">Logout</button>
      </div>
    </div>
  </nav>

  <!-- Dashboard -->
  <div id="dashboard-page" class="page hidden">
    <main class="dashboard">
      <h1>Dashboard</h1>
      <div class="stats-grid">
        <div class="stat-card">
          <h3>Total Tickets</h3>
          <p class="stat-number" id="total-tickets">0</p>
        </div>
        <div class="stat-card">
          <h3>Open Tickets</h3>
          <p class="stat-number open" id="open-tickets">0</p>
        </div>
        <div class="stat-card">
          <h3>Resolved Tickets</h3>
          <p class="stat-number resolved" id="resolved-tickets">0</p>
        </div>
      </div>
    </main>
  </div>

  <!-- Tickets List -->
  <div id="tickets-page" class="page hidden">
    <main class="tickets-container">
      <div class="tickets-header">
        <h1>Tickets</h1>
        <div class="filters">
          <select id="status-filter" onchange="applyFilters()">
            <option value="">All Statuses</option>
            <option value="open">Open</option>
            <option value="in_progress">In Progress</option>
            <option value="resolved">Resolved</option>
            <option value="closed">Closed</option>
          </select>
          <input type="date" id="start-date" placeholder="Start Date" onchange="applyFilters()">
          <input type="date" id="end-date" placeholder="End Date" onchange="applyFilters()">
          <button onclick="exportCSV()" class="btn-primary">📥 Export CSV</button>
        </div>
      </div>
      <div id="tickets-list" class="tickets-grid"></div>
    </main>
  </div>

  <!-- Create Ticket -->
  <div id="create-ticket-page" class="page hidden">
    <main class="form-container">
      <h1>Create New Ticket</h1>
      <form id="create-ticket-form">
        <div class="form-group">
          <label>Title</label>
          <input type="text" id="ticket-title" required>
        </div>
        <div class="form-group">
          <label>Description</label>
          <textarea id="ticket-description" rows="5" required></textarea>
        </div>
        <div class="form-group">
          <label>Equipment Name</label>
          <input type="text" id="equipment-name">
        </div>
        <div class="form-group">
          <label>Location</label>
          <input type="text" id="location">
        </div>
        <div class="form-group">
          <label>Priority</label>
          <select id="priority">
            <option value="low">Low</option>
            <option value="medium" selected>Medium</option>
            <option value="high">High</option>
            <option value="urgent">Urgent</option>
          </select>
        </div>
        <button type="submit" class="btn-primary">Create Ticket</button>
        <button type="button" onclick="showTickets()" class="btn-secondary">Cancel</button>
      </form>
    </main>
  </div>

  <!-- Ticket Detail -->
  <div id="ticket-detail-page" class="page hidden">
    <main class="ticket-detail-container">
      <button onclick="showTickets()" class="btn-secondary">← Back</button>
      <div class="ticket-header">
        <h1 id="detail-title"></h1>
        <div class="ticket-meta">
          <span id="detail-ticket-number"></span>
          <span id="detail-status"></span>
          <span id="detail-priority"></span>
        </div>
      </div>

      <div class="ticket-content">
        <section class="ticket-info">
          <h3>Information</h3>
          <p><strong>Equipment:</strong> <span id="detail-equipment"></span></p>
          <p><strong>Location:</strong> <span id="detail-location"></span></p>
          <p><strong>Created:</strong> <span id="detail-created"></span></p>
          <p><strong>Assigned To:</strong> <span id="detail-assigned"></span></p>
        </section>

        <section class="ticket-actions">
          <h3>Update Status</h3>
          <select id="status-update">
            <option value="open">Open</option>
            <option value="in_progress">In Progress</option>
            <option value="resolved">Resolved</option>
            <option value="closed">Closed
```


## License: unknown
https://github.com/TheEvolution7/HTML-2/blob/294c6d5bf224f89f9d982fd6ec6ee27ae19d51f4/royal-residence-realty/leads-manage-edit-task.html

```
I need file editing capabilities to create this project structure. Let me provide you with the complete code for all files, organized by directory. You can either:

1. **Enable editing tools** in VS Code (I can create all files automatically)
2. **Manually create the files** using the code blocks I'll provide

Here's the complete full-stack architecture:

## **Project Structure**
```
port-ticket-system/
├── DATABASE_SCHEMA.sql
├── README.md
├── .env.example
├── backend/
│   ├── package.json
│   ├── server.js
│   └── .env (user creates from .env.example)
└── frontend/
    ├── index.html
    ├── styles.css
    ├── app.js
    └── api.js
```

---

## **1. DATABASE_SCHEMA.sql**
PostgreSQL schema for Supabase:

```sql
-- Users table (operators and tech team)
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  full_name VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL CHECK (role IN ('operator', 'technician', 'admin')),
  department VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  status VARCHAR(50) DEFAULT 'active'
);

-- Tickets table
CREATE TABLE tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_number VARCHAR(50) UNIQUE NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
  priority VARCHAR(50) DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  assigned_to UUID REFERENCES users(id) ON DELETE SET NULL,
  equipment_name VARCHAR(255),
  location VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  resolved_at TIMESTAMP
);

-- Ticket comments/responses
CREATE TABLE ticket_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  comment_text TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  is_internal BOOLEAN DEFAULT FALSE
);

-- Audit log for exports
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  action VARCHAR(100) NOT NULL,
  details JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX idx_tickets_status ON tickets(status);
CREATE INDEX idx_tickets_created_by ON tickets(created_by);
CREATE INDEX idx_tickets_assigned_to ON tickets(assigned_to);
CREATE INDEX idx_tickets_created_at ON tickets(created_at);
CREATE INDEX idx_comments_ticket_id ON ticket_comments(ticket_id);

-- Enable Row Level Security (RLS)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_comments ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own profile" ON users
  FOR SELECT USING (auth.uid()::text = id::text);

CREATE POLICY "Operators can view assigned tickets" ON tickets
  FOR SELECT USING (
    created_by = auth.uid()::uuid OR 
    assigned_to = auth.uid()::uuid OR 
    (SELECT role FROM users WHERE id = auth.uid()::uuid) = 'admin'
  );
```

---

## **2. backend/package.json**

```json
{
  "name": "port-ticket-system-api",
  "version": "1.0.0",
  "description": "Ticket system API for port terminal operations",
  "main": "server.js",
  "type": "module",
  "scripts": {
    "start": "node server.js",
    "dev": "node --watch server.js"
  },
  "dependencies": {
    "express": "^4.18.2",
    "cors": "^2.8.5",
    "dotenv": "^16.3.1",
    "@supabase/supabase-js": "^2.38.4",
    "jsonwebtoken": "^9.1.0",
    "bcryptjs": "^2.4.3",
    "papaparse": "^5.4.1"
  }
}
```

---

## **3. backend/server.js**

```javascript
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import jwt from 'jsonwebtoken';
import bcryptjs from 'bcryptjs';
import Papa from 'papaparse';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Initialize Supabase
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// Middleware
app.use(cors());
app.use(express.json());

// Authentication middleware
const verifyToken = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token provided' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    res.status(401).json({ error: 'Invalid token' });
  }
};

// === AUTH ENDPOINTS ===
app.post('/api/auth/register', async (req, res) => {
  const { email, password, fullName, role } = req.body;

  try {
    const hashedPassword = await bcryptjs.hash(password, 10);
    
    const { data, error } = await supabase
      .from('users')
      .insert([{
        email,
        password_hash: hashedPassword,
        full_name: fullName,
        role: role || 'operator'
      }])
      .select();

    if (error) throw error;

    const token = jwt.sign(
      { id: data[0].id, email, role: data[0].role },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(201).json({ user: data[0], token });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    const { data: users, error } = await supabase
      .from('users')
      .select('*')
      .eq('email', email);

    if (error || !users.length) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = users[0];
    const validPassword = await bcryptjs.compare(password, user.password_hash);

    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({ user, token });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// === TICKET ENDPOINTS ===
app.post('/api/tickets', verifyToken, async (req, res) => {
  const { title, description, equipmentName, location, priority } = req.body;

  try {
    const ticketNumber = `TKT-${Date.now()}`;
    
    const { data, error } = await supabase
      .from('tickets')
      .insert([{
        ticket_number: ticketNumber,
        title,
        description,
        equipment_name: equipmentName,
        location,
        priority: priority || 'medium',
        created_by: req.user.id
      }])
      .select();

    if (error) throw error;

    // Log action
    await supabase.from('audit_logs').insert([{
      user_id: req.user.id,
      action: 'ticket_created',
      details: { ticket_id: data[0].id }
    }]);

    res.status(201).json(data[0]);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/tickets', verifyToken, async (req, res) => {
  const { status, startDate, endDate } = req.query;

  try {
    let query = supabase
      .from('tickets')
      .select('*, created_by:users(full_name, email), assigned_to:users(full_name, email)');

    if (status) query = query.eq('status', status);
    if (startDate) query = query.gte('created_at', startDate);
    if (endDate) query = query.lte('created_at', endDate);

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/tickets/:id', verifyToken, async (req, res) => {
  try {
    const { data: ticket, error: ticketError } = await supabase
      .from('tickets')
      .select('*, created_by:users(full_name, email), assigned_to:users(full_name, email)')
      .eq('id', req.params.id)
      .single();

    if (ticketError) throw ticketError;

    const { data: comments, error: commentsError } = await supabase
      .from('ticket_comments')
      .select('*, user_id:users(full_name, email)')
      .eq('ticket_id', req.params.id)
      .order('created_at', { ascending: true });

    if (commentsError) throw commentsError;

    res.json({ ...ticket, comments });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.patch('/api/tickets/:id', verifyToken, async (req, res) => {
  const { status, assignedTo, priority } = req.body;

  try {
    const updateData = { updated_at: new Date() };
    if (status) updateData.status = status;
    if (assignedTo) updateData.assigned_to = assignedTo;
    if (priority) updateData.priority = priority;
    if (status === 'resolved') updateData.resolved_at = new Date();

    const { data, error } = await supabase
      .from('tickets')
      .update(updateData)
      .eq('id', req.params.id)
      .select();

    if (error) throw error;

    // Log action
    await supabase.from('audit_logs').insert([{
      user_id: req.user.id,
      action: 'ticket_updated',
      details: { ticket_id: req.params.id, changes: updateData }
    }]);

    res.json(data[0]);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// === COMMENTS ENDPOINTS ===
app.post('/api/tickets/:id/comments', verifyToken, async (req, res) => {
  const { commentText, isInternal } = req.body;

  try {
    const { data, error } = await supabase
      .from('ticket_comments')
      .insert([{
        ticket_id: req.params.id,
        user_id: req.user.id,
        comment_text: commentText,
        is_internal: isInternal || false
      }])
      .select('*, user_id:users(full_name, email)');

    if (error) throw error;
    res.status(201).json(data[0]);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// === EXPORT ENDPOINTS ===
app.get('/api/export/csv', verifyToken, async (req, res) => {
  const { status, startDate, endDate } = req.query;

  try {
    let query = supabase
      .from('tickets')
      .select('ticket_number, title, status, priority, equipment_name, location, created_at, resolved_at, created_by:users(full_name), assigned_to:users(full_name)');

    if (status) query = query.eq('status', status);
    if (startDate) query = query.gte('created_at', startDate);
    if (endDate) query = query.lte('created_at', endDate);

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) throw error;

    // Convert to CSV
    const csv = Papa.unparse(data);

    // Log export action
    await supabase.from('audit_logs').insert([{
      user_id: req.user.id,
      action: 'data_exported',
      details: { format: 'csv', filters: { status, startDate, endDate } }
    }]);

    res.header('Content-Type', 'text/csv');
    res.header('Content-Disposition', 'attachment; filename="tickets-export.csv"');
    res.send(csv);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// === DASHBOARD STATS ===
app.get('/api/stats', verifyToken, async (req, res) => {
  try {
    const { data: totalTickets } = await supabase
      .from('tickets')
      .select('count()', { count: 'exact' });

    const { data: openTickets } = await supabase
      .from('tickets')
      .select('count()', { count: 'exact' })
      .eq('status', 'open');

    const { data: resolvedTickets } = await supabase
      .from('tickets')
      .select('count()', { count: 'exact' })
      .eq('status', 'resolved');

    res.json({
      total: totalTickets?.count || 0,
      open: openTickets?.count || 0,
      resolved: resolvedTickets?.count || 0
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
```

---

## **4. backend/.env.example**

```env
PORT=5000
SUPABASE_URL=your_supabase_url_here
SUPABASE_SERVICE_KEY=your_service_key_here
JWT_SECRET=your_jwt_secret_here_use_strong_random_string
```

---

## **5. frontend/index.html**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Port Terminal Ticket System</title>
  <link rel="stylesheet" href="styles.css">
</head>
<body>
  <div id="app"></div>

  <!-- Auth Pages -->
  <div id="login-page" class="page hidden">
    <form id="login-form" class="auth-form">
      <h1>Port Terminal Ticket System</h1>
      <input type="email" id="email" placeholder="Email" required>
      <input type="password" id="password" placeholder="Password" required>
      <button type="submit">Login</button>
      <p>Don't have an account? <a href="#" onclick="showRegister()">Sign up</a></p>
    </form>
  </div>

  <div id="register-page" class="page hidden">
    <form id="register-form" class="auth-form">
      <h1>Create Account</h1>
      <input type="email" id="reg-email" placeholder="Email" required>
      <input type="password" id="reg-password" placeholder="Password" required>
      <input type="text" id="full-name" placeholder="Full Name" required>
      <select id="role">
        <option value="operator">Operator</option>
        <option value="technician">Technician</option>
      </select>
      <button type="submit">Sign Up</button>
      <p>Already have an account? <a href="#" onclick="showLogin()">Login</a></p>
    </form>
  </div>

  <!-- Main App -->
  <nav class="navbar hidden" id="navbar">
    <div class="nav-container">
      <h2>🎫 Ticket System</h2>
      <div class="nav-links">
        <button onclick="showDashboard()">Dashboard</button>
        <button onclick="showTickets()">Tickets</button>
        <button onclick="showCreateTicket()">+ New Ticket</button>
        <button onclick="logout()">Logout</button>
      </div>
    </div>
  </nav>

  <!-- Dashboard -->
  <div id="dashboard-page" class="page hidden">
    <main class="dashboard">
      <h1>Dashboard</h1>
      <div class="stats-grid">
        <div class="stat-card">
          <h3>Total Tickets</h3>
          <p class="stat-number" id="total-tickets">0</p>
        </div>
        <div class="stat-card">
          <h3>Open Tickets</h3>
          <p class="stat-number open" id="open-tickets">0</p>
        </div>
        <div class="stat-card">
          <h3>Resolved Tickets</h3>
          <p class="stat-number resolved" id="resolved-tickets">0</p>
        </div>
      </div>
    </main>
  </div>

  <!-- Tickets List -->
  <div id="tickets-page" class="page hidden">
    <main class="tickets-container">
      <div class="tickets-header">
        <h1>Tickets</h1>
        <div class="filters">
          <select id="status-filter" onchange="applyFilters()">
            <option value="">All Statuses</option>
            <option value="open">Open</option>
            <option value="in_progress">In Progress</option>
            <option value="resolved">Resolved</option>
            <option value="closed">Closed</option>
          </select>
          <input type="date" id="start-date" placeholder="Start Date" onchange="applyFilters()">
          <input type="date" id="end-date" placeholder="End Date" onchange="applyFilters()">
          <button onclick="exportCSV()" class="btn-primary">📥 Export CSV</button>
        </div>
      </div>
      <div id="tickets-list" class="tickets-grid"></div>
    </main>
  </div>

  <!-- Create Ticket -->
  <div id="create-ticket-page" class="page hidden">
    <main class="form-container">
      <h1>Create New Ticket</h1>
      <form id="create-ticket-form">
        <div class="form-group">
          <label>Title</label>
          <input type="text" id="ticket-title" required>
        </div>
        <div class="form-group">
          <label>Description</label>
          <textarea id="ticket-description" rows="5" required></textarea>
        </div>
        <div class="form-group">
          <label>Equipment Name</label>
          <input type="text" id="equipment-name">
        </div>
        <div class="form-group">
          <label>Location</label>
          <input type="text" id="location">
        </div>
        <div class="form-group">
          <label>Priority</label>
          <select id="priority">
            <option value="low">Low</option>
            <option value="medium" selected>Medium</option>
            <option value="high">High</option>
            <option value="urgent">Urgent</option>
          </select>
        </div>
        <button type="submit" class="btn-primary">Create Ticket</button>
        <button type="button" onclick="showTickets()" class="btn-secondary">Cancel</button>
      </form>
    </main>
  </div>

  <!-- Ticket Detail -->
  <div id="ticket-detail-page" class="page hidden">
    <main class="ticket-detail-container">
      <button onclick="showTickets()" class="btn-secondary">← Back</button>
      <div class="ticket-header">
        <h1 id="detail-title"></h1>
        <div class="ticket-meta">
          <span id="detail-ticket-number"></span>
          <span id="detail-status"></span>
          <span id="detail-priority"></span>
        </div>
      </div>

      <div class="ticket-content">
        <section class="ticket-info">
          <h3>Information</h3>
          <p><strong>Equipment:</strong> <span id="detail-equipment"></span></p>
          <p><strong>Location:</strong> <span id="detail-location"></span></p>
          <p><strong>Created:</strong> <span id="detail-created"></span></p>
          <p><strong>Assigned To:</strong> <span id="detail-assigned"></span></p>
        </section>

        <section class="ticket-actions">
          <h3>Update Status</h3>
          <select id="status-update">
            <option value="open">Open</option>
            <option value="in_progress">In Progress</option>
            <option value="resolved">Resolved</option>
            <option value="closed">Closed
```


## License: unknown
https://github.com/krutzzio/Project-G/blob/1f7169eb09133a08782d6e6af301b6a2d0f1c393/regira/src/components/Modal/AddIssue.tsx

```
I need file editing capabilities to create this project structure. Let me provide you with the complete code for all files, organized by directory. You can either:

1. **Enable editing tools** in VS Code (I can create all files automatically)
2. **Manually create the files** using the code blocks I'll provide

Here's the complete full-stack architecture:

## **Project Structure**
```
port-ticket-system/
├── DATABASE_SCHEMA.sql
├── README.md
├── .env.example
├── backend/
│   ├── package.json
│   ├── server.js
│   └── .env (user creates from .env.example)
└── frontend/
    ├── index.html
    ├── styles.css
    ├── app.js
    └── api.js
```

---

## **1. DATABASE_SCHEMA.sql**
PostgreSQL schema for Supabase:

```sql
-- Users table (operators and tech team)
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  full_name VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL CHECK (role IN ('operator', 'technician', 'admin')),
  department VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  status VARCHAR(50) DEFAULT 'active'
);

-- Tickets table
CREATE TABLE tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_number VARCHAR(50) UNIQUE NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
  priority VARCHAR(50) DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  assigned_to UUID REFERENCES users(id) ON DELETE SET NULL,
  equipment_name VARCHAR(255),
  location VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  resolved_at TIMESTAMP
);

-- Ticket comments/responses
CREATE TABLE ticket_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  comment_text TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  is_internal BOOLEAN DEFAULT FALSE
);

-- Audit log for exports
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  action VARCHAR(100) NOT NULL,
  details JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX idx_tickets_status ON tickets(status);
CREATE INDEX idx_tickets_created_by ON tickets(created_by);
CREATE INDEX idx_tickets_assigned_to ON tickets(assigned_to);
CREATE INDEX idx_tickets_created_at ON tickets(created_at);
CREATE INDEX idx_comments_ticket_id ON ticket_comments(ticket_id);

-- Enable Row Level Security (RLS)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_comments ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own profile" ON users
  FOR SELECT USING (auth.uid()::text = id::text);

CREATE POLICY "Operators can view assigned tickets" ON tickets
  FOR SELECT USING (
    created_by = auth.uid()::uuid OR 
    assigned_to = auth.uid()::uuid OR 
    (SELECT role FROM users WHERE id = auth.uid()::uuid) = 'admin'
  );
```

---

## **2. backend/package.json**

```json
{
  "name": "port-ticket-system-api",
  "version": "1.0.0",
  "description": "Ticket system API for port terminal operations",
  "main": "server.js",
  "type": "module",
  "scripts": {
    "start": "node server.js",
    "dev": "node --watch server.js"
  },
  "dependencies": {
    "express": "^4.18.2",
    "cors": "^2.8.5",
    "dotenv": "^16.3.1",
    "@supabase/supabase-js": "^2.38.4",
    "jsonwebtoken": "^9.1.0",
    "bcryptjs": "^2.4.3",
    "papaparse": "^5.4.1"
  }
}
```

---

## **3. backend/server.js**

```javascript
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import jwt from 'jsonwebtoken';
import bcryptjs from 'bcryptjs';
import Papa from 'papaparse';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Initialize Supabase
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// Middleware
app.use(cors());
app.use(express.json());

// Authentication middleware
const verifyToken = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token provided' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    res.status(401).json({ error: 'Invalid token' });
  }
};

// === AUTH ENDPOINTS ===
app.post('/api/auth/register', async (req, res) => {
  const { email, password, fullName, role } = req.body;

  try {
    const hashedPassword = await bcryptjs.hash(password, 10);
    
    const { data, error } = await supabase
      .from('users')
      .insert([{
        email,
        password_hash: hashedPassword,
        full_name: fullName,
        role: role || 'operator'
      }])
      .select();

    if (error) throw error;

    const token = jwt.sign(
      { id: data[0].id, email, role: data[0].role },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(201).json({ user: data[0], token });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    const { data: users, error } = await supabase
      .from('users')
      .select('*')
      .eq('email', email);

    if (error || !users.length) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = users[0];
    const validPassword = await bcryptjs.compare(password, user.password_hash);

    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({ user, token });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// === TICKET ENDPOINTS ===
app.post('/api/tickets', verifyToken, async (req, res) => {
  const { title, description, equipmentName, location, priority } = req.body;

  try {
    const ticketNumber = `TKT-${Date.now()}`;
    
    const { data, error } = await supabase
      .from('tickets')
      .insert([{
        ticket_number: ticketNumber,
        title,
        description,
        equipment_name: equipmentName,
        location,
        priority: priority || 'medium',
        created_by: req.user.id
      }])
      .select();

    if (error) throw error;

    // Log action
    await supabase.from('audit_logs').insert([{
      user_id: req.user.id,
      action: 'ticket_created',
      details: { ticket_id: data[0].id }
    }]);

    res.status(201).json(data[0]);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/tickets', verifyToken, async (req, res) => {
  const { status, startDate, endDate } = req.query;

  try {
    let query = supabase
      .from('tickets')
      .select('*, created_by:users(full_name, email), assigned_to:users(full_name, email)');

    if (status) query = query.eq('status', status);
    if (startDate) query = query.gte('created_at', startDate);
    if (endDate) query = query.lte('created_at', endDate);

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/tickets/:id', verifyToken, async (req, res) => {
  try {
    const { data: ticket, error: ticketError } = await supabase
      .from('tickets')
      .select('*, created_by:users(full_name, email), assigned_to:users(full_name, email)')
      .eq('id', req.params.id)
      .single();

    if (ticketError) throw ticketError;

    const { data: comments, error: commentsError } = await supabase
      .from('ticket_comments')
      .select('*, user_id:users(full_name, email)')
      .eq('ticket_id', req.params.id)
      .order('created_at', { ascending: true });

    if (commentsError) throw commentsError;

    res.json({ ...ticket, comments });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.patch('/api/tickets/:id', verifyToken, async (req, res) => {
  const { status, assignedTo, priority } = req.body;

  try {
    const updateData = { updated_at: new Date() };
    if (status) updateData.status = status;
    if (assignedTo) updateData.assigned_to = assignedTo;
    if (priority) updateData.priority = priority;
    if (status === 'resolved') updateData.resolved_at = new Date();

    const { data, error } = await supabase
      .from('tickets')
      .update(updateData)
      .eq('id', req.params.id)
      .select();

    if (error) throw error;

    // Log action
    await supabase.from('audit_logs').insert([{
      user_id: req.user.id,
      action: 'ticket_updated',
      details: { ticket_id: req.params.id, changes: updateData }
    }]);

    res.json(data[0]);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// === COMMENTS ENDPOINTS ===
app.post('/api/tickets/:id/comments', verifyToken, async (req, res) => {
  const { commentText, isInternal } = req.body;

  try {
    const { data, error } = await supabase
      .from('ticket_comments')
      .insert([{
        ticket_id: req.params.id,
        user_id: req.user.id,
        comment_text: commentText,
        is_internal: isInternal || false
      }])
      .select('*, user_id:users(full_name, email)');

    if (error) throw error;
    res.status(201).json(data[0]);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// === EXPORT ENDPOINTS ===
app.get('/api/export/csv', verifyToken, async (req, res) => {
  const { status, startDate, endDate } = req.query;

  try {
    let query = supabase
      .from('tickets')
      .select('ticket_number, title, status, priority, equipment_name, location, created_at, resolved_at, created_by:users(full_name), assigned_to:users(full_name)');

    if (status) query = query.eq('status', status);
    if (startDate) query = query.gte('created_at', startDate);
    if (endDate) query = query.lte('created_at', endDate);

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) throw error;

    // Convert to CSV
    const csv = Papa.unparse(data);

    // Log export action
    await supabase.from('audit_logs').insert([{
      user_id: req.user.id,
      action: 'data_exported',
      details: { format: 'csv', filters: { status, startDate, endDate } }
    }]);

    res.header('Content-Type', 'text/csv');
    res.header('Content-Disposition', 'attachment; filename="tickets-export.csv"');
    res.send(csv);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// === DASHBOARD STATS ===
app.get('/api/stats', verifyToken, async (req, res) => {
  try {
    const { data: totalTickets } = await supabase
      .from('tickets')
      .select('count()', { count: 'exact' });

    const { data: openTickets } = await supabase
      .from('tickets')
      .select('count()', { count: 'exact' })
      .eq('status', 'open');

    const { data: resolvedTickets } = await supabase
      .from('tickets')
      .select('count()', { count: 'exact' })
      .eq('status', 'resolved');

    res.json({
      total: totalTickets?.count || 0,
      open: openTickets?.count || 0,
      resolved: resolvedTickets?.count || 0
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
```

---

## **4. backend/.env.example**

```env
PORT=5000
SUPABASE_URL=your_supabase_url_here
SUPABASE_SERVICE_KEY=your_service_key_here
JWT_SECRET=your_jwt_secret_here_use_strong_random_string
```

---

## **5. frontend/index.html**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Port Terminal Ticket System</title>
  <link rel="stylesheet" href="styles.css">
</head>
<body>
  <div id="app"></div>

  <!-- Auth Pages -->
  <div id="login-page" class="page hidden">
    <form id="login-form" class="auth-form">
      <h1>Port Terminal Ticket System</h1>
      <input type="email" id="email" placeholder="Email" required>
      <input type="password" id="password" placeholder="Password" required>
      <button type="submit">Login</button>
      <p>Don't have an account? <a href="#" onclick="showRegister()">Sign up</a></p>
    </form>
  </div>

  <div id="register-page" class="page hidden">
    <form id="register-form" class="auth-form">
      <h1>Create Account</h1>
      <input type="email" id="reg-email" placeholder="Email" required>
      <input type="password" id="reg-password" placeholder="Password" required>
      <input type="text" id="full-name" placeholder="Full Name" required>
      <select id="role">
        <option value="operator">Operator</option>
        <option value="technician">Technician</option>
      </select>
      <button type="submit">Sign Up</button>
      <p>Already have an account? <a href="#" onclick="showLogin()">Login</a></p>
    </form>
  </div>

  <!-- Main App -->
  <nav class="navbar hidden" id="navbar">
    <div class="nav-container">
      <h2>🎫 Ticket System</h2>
      <div class="nav-links">
        <button onclick="showDashboard()">Dashboard</button>
        <button onclick="showTickets()">Tickets</button>
        <button onclick="showCreateTicket()">+ New Ticket</button>
        <button onclick="logout()">Logout</button>
      </div>
    </div>
  </nav>

  <!-- Dashboard -->
  <div id="dashboard-page" class="page hidden">
    <main class="dashboard">
      <h1>Dashboard</h1>
      <div class="stats-grid">
        <div class="stat-card">
          <h3>Total Tickets</h3>
          <p class="stat-number" id="total-tickets">0</p>
        </div>
        <div class="stat-card">
          <h3>Open Tickets</h3>
          <p class="stat-number open" id="open-tickets">0</p>
        </div>
        <div class="stat-card">
          <h3>Resolved Tickets</h3>
          <p class="stat-number resolved" id="resolved-tickets">0</p>
        </div>
      </div>
    </main>
  </div>

  <!-- Tickets List -->
  <div id="tickets-page" class="page hidden">
    <main class="tickets-container">
      <div class="tickets-header">
        <h1>Tickets</h1>
        <div class="filters">
          <select id="status-filter" onchange="applyFilters()">
            <option value="">All Statuses</option>
            <option value="open">Open</option>
            <option value="in_progress">In Progress</option>
            <option value="resolved">Resolved</option>
            <option value="closed">Closed</option>
          </select>
          <input type="date" id="start-date" placeholder="Start Date" onchange="applyFilters()">
          <input type="date" id="end-date" placeholder="End Date" onchange="applyFilters()">
          <button onclick="exportCSV()" class="btn-primary">📥 Export CSV</button>
        </div>
      </div>
      <div id="tickets-list" class="tickets-grid"></div>
    </main>
  </div>

  <!-- Create Ticket -->
  <div id="create-ticket-page" class="page hidden">
    <main class="form-container">
      <h1>Create New Ticket</h1>
      <form id="create-ticket-form">
        <div class="form-group">
          <label>Title</label>
          <input type="text" id="ticket-title" required>
        </div>
        <div class="form-group">
          <label>Description</label>
          <textarea id="ticket-description" rows="5" required></textarea>
        </div>
        <div class="form-group">
          <label>Equipment Name</label>
          <input type="text" id="equipment-name">
        </div>
        <div class="form-group">
          <label>Location</label>
          <input type="text" id="location">
        </div>
        <div class="form-group">
          <label>Priority</label>
          <select id="priority">
            <option value="low">Low</option>
            <option value="medium" selected>Medium</option>
            <option value="high">High</option>
            <option value="urgent">Urgent</option>
          </select>
        </div>
        <button type="submit" class="btn-primary">Create Ticket</button>
        <button type="button" onclick="showTickets()" class="btn-secondary">Cancel</button>
      </form>
    </main>
  </div>

  <!-- Ticket Detail -->
  <div id="ticket-detail-page" class="page hidden">
    <main class="ticket-detail-container">
      <button onclick="showTickets()" class="btn-secondary">← Back</button>
      <div class="ticket-header">
        <h1 id="detail-title"></h1>
        <div class="ticket-meta">
          <span id="detail-ticket-number"></span>
          <span id="detail-status"></span>
          <span id="detail-priority"></span>
        </div>
      </div>

      <div class="ticket-content">
        <section class="ticket-info">
          <h3>Information</h3>
          <p><strong>Equipment:</strong> <span id="detail-equipment"></span></p>
          <p><strong>Location:</strong> <span id="detail-location"></span></p>
          <p><strong>Created:</strong> <span id="detail-created"></span></p>
          <p><strong>Assigned To:</strong> <span id="detail-assigned"></span></p>
        </section>

        <section class="ticket-actions">
          <h3>Update Status</h3>
          <select id="status-update">
            <option value="open">Open</option>
            <option value="in_progress">In Progress</option>
            <option value="resolved">Resolved</option>
            <option value="closed">Closed</option>
          </select>
          <button onclick="updateStatus()" class="btn-primary">Update</button>
        </section>

        <section class="ticket-comments">
          <h3>Responses</h3>
          <div id="comments-list"></div>
          <form id="add-comment-form" onsubmit="addComment(event)">
            <textarea id="comment-text" placeholder="Add a response..." required></textarea>
            <button type="submit" class="btn-primary">Post Response</button>
          </form>
        </section>
      </div>
    </main>
  </div>

  <script src="api.js"></script>
  <script src="app.js"></script>
</body>
</html>
```

---

## **6. frontend/styles.css**

```css
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

:root {
  --primary: #2563eb;
  --primary-dark: #1e40af;
  --secondary: #64748b;
  --success: #10b981;
  --warning: #f59e0b;
  --danger: #ef4444;
  --bg: #f8fafc;
  --surface: #ffffff;
  --border: #e2e8f0;
  --text: #1e293b;
  --text-light: #64748b;
}

body {
  font-family: -
```

