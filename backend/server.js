import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import jwt from 'jsonwebtoken';
import bcryptjs from 'bcryptjs';
import Papa from 'papaparse';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { randomBytes } from 'crypto';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const requiredEnvVars = ['SUPABASE_URL', 'SUPABASE_SERVICE_KEY', 'JWT_SECRET'];
const missingEnvVars = requiredEnvVars.filter((key) => !process.env[key]);
if (missingEnvVars.length > 0) {
  console.error(
    `Missing required environment variables: ${missingEnvVars.join(', ')}. ` +
      'Create backend/.env before starting the server.'
  );
  process.exit(1);
}

const app = express();
const PORT = process.env.PORT || 5000;
const UNIVERSAL_ADMIN_EMAIL = 'admin@portterminal.local';
const UNIVERSAL_ADMIN_PASSWORD = 'Admin#Port2026';
const UNIVERSAL_ADMIN_NAME = 'Universal Admin';

// Initialize Supabase
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// Configure multer for file uploads
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}-${file.originalname}`;
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit
  fileFilter: (req, file, cb) => {
    // Block dangerous file types
    const blockedExtensions = ['.exe', '.bat', '.sh', '.cmd'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (blockedExtensions.includes(ext)) {
      return cb(new Error('File type not allowed'), false);
    }
    cb(null, true);
  }
});

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

const attachTicketUsers = async (tickets) => {
  if (!Array.isArray(tickets) || tickets.length === 0) return tickets;

  const userIds = [...new Set(
    tickets
      .flatMap((ticket) => [ticket.created_by, ticket.assigned_to])
      .filter(Boolean)
  )];

  if (userIds.length === 0) {
    return tickets.map((ticket) => ({
      ...ticket,
      created_by: null,
      assigned_to: null
    }));
  }

  const { data: users, error } = await supabase
    .from('users')
    .select('id, full_name, email')
    .in('id', userIds);

  if (error) throw error;

  const userMap = new Map(users.map((user) => [user.id, user]));

  return tickets.map((ticket) => ({
    ...ticket,
    created_by: userMap.get(ticket.created_by)
      ? {
          full_name: userMap.get(ticket.created_by).full_name,
          email: userMap.get(ticket.created_by).email
        }
      : null,
    assigned_to: userMap.get(ticket.assigned_to)
      ? {
          full_name: userMap.get(ticket.assigned_to).full_name,
          email: userMap.get(ticket.assigned_to).email
        }
      : null
  }));
};

const ensureUniversalAdminAccount = async () => {
  const adminPasswordHash = await bcryptjs.hash(UNIVERSAL_ADMIN_PASSWORD, 10);

  const { data: existingAdmin, error: findError } = await supabase
    .from('users')
    .select('id')
    .eq('email', UNIVERSAL_ADMIN_EMAIL)
    .single();

  if (findError && findError.code !== 'PGRST116') {
    throw findError;
  }

  if (!existingAdmin) {
    const { error: insertError } = await supabase
      .from('users')
      .insert([{
        email: UNIVERSAL_ADMIN_EMAIL,
        password_hash: adminPasswordHash,
        full_name: UNIVERSAL_ADMIN_NAME,
        role: 'admin',
        status: 'active'
      }]);

    if (insertError) throw insertError;
    return;
  }

  const { error: updateError } = await supabase
    .from('users')
    .update({
      password_hash: adminPasswordHash,
      full_name: UNIVERSAL_ADMIN_NAME,
      role: 'admin',
      status: 'active'
    })
    .eq('id', existingAdmin.id);

  if (updateError) throw updateError;
};

const requireAdmin = (req, res) => {
  if (req.user.role !== 'admin') {
    res.status(403).json({ error: 'Admin access required' });
    return false;
  }

  return true;
};

// === AUTH ENDPOINTS ===
app.post('/api/auth/register', async (req, res) => {
  const { email, password, fullName } = req.body;
  const normalizedEmail = (email || '').toLowerCase().trim();
  const normalizedName = (fullName || '').trim();

  if (!normalizedEmail || !password || !normalizedName) {
    return res.status(400).json({ error: 'Email, full name and password are required' });
  }

  if (normalizedEmail === UNIVERSAL_ADMIN_EMAIL.toLowerCase()) {
    return res.status(400).json({ error: 'This account cannot be registered publicly' });
  }

  try {
    const hashedPassword = await bcryptjs.hash(password, 10);
    
    const { data, error } = await supabase
      .from('users')
      .insert([{
        email: normalizedEmail,
        password_hash: hashedPassword,
        full_name: normalizedName,
        role: 'operator'
      }])
      .select();

    if (error) throw error;

    const token = jwt.sign(
      { id: data[0].id, email: normalizedEmail, role: data[0].role },
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
    const normalizedEmail = (email || '').toLowerCase();

    if (normalizedEmail === UNIVERSAL_ADMIN_EMAIL.toLowerCase()) {
      if (password !== UNIVERSAL_ADMIN_PASSWORD) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      const { data: adminUsers, error: adminError } = await supabase
        .from('users')
        .select('*')
        .eq('email', UNIVERSAL_ADMIN_EMAIL)
        .eq('role', 'admin')
        .limit(1);

      if (adminError || !adminUsers.length) {
        return res.status(500).json({ error: 'Universal admin account is not available' });
      }

      const adminUser = adminUsers[0];
      const token = jwt.sign(
        { id: adminUser.id, email: adminUser.email, role: adminUser.role },
        process.env.JWT_SECRET,
        { expiresIn: '7d' }
      );

      return res.json({ user: adminUser, token });
    }

    const { data: users, error } = await supabase
      .from('users')
      .select('*')
      .eq('email', normalizedEmail);

    if (error || !users.length) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = users[0];

    if (user.role === 'admin') {
      return res.status(403).json({ error: 'Admin login is restricted to the universal admin account' });
    }

    if (user.status === 'inactive') {
      return res.status(403).json({ error: 'Account is inactive. Contact admin.' });
    }

    if (user.status === 'pending_setup') {
      return res.status(403).json({ error: 'Password setup required. Use the setup password form before login.' });
    }

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

app.post('/api/auth/setup-password', async (req, res) => {
  const { email, setupToken, newPassword } = req.body;

  if (!email || !setupToken || !newPassword) {
    return res.status(400).json({ error: 'Email, setup token and new password are required' });
  }

  if (newPassword.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' });
  }

  try {
    const payload = jwt.verify(setupToken, process.env.JWT_SECRET);
    if (payload.purpose !== 'password_setup') {
      return res.status(400).json({ error: 'Invalid setup token' });
    }

    const normalizedEmail = (email || '').toLowerCase();
    if ((payload.email || '').toLowerCase() !== normalizedEmail) {
      return res.status(400).json({ error: 'Setup token does not match this email' });
    }

    const { data: users, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('email', normalizedEmail)
      .limit(1);

    if (userError || !users.length) {
      return res.status(404).json({ error: 'User not found for setup' });
    }

    const user = users[0];
    if (user.status !== 'pending_setup') {
      return res.status(400).json({ error: 'Password setup is already completed for this account' });
    }

    if (payload.role !== user.role) {
      return res.status(400).json({ error: 'Setup token role mismatch' });
    }

    const passwordHash = await bcryptjs.hash(newPassword, 10);
    const { error: updateError } = await supabase
      .from('users')
      .update({ password_hash: passwordHash, status: 'active' })
      .eq('id', user.id);

    if (updateError) throw updateError;

    res.json({ success: true, message: 'Password setup completed. You can now login.' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/admin/users', verifyToken, async (req, res) => {
  const { email, fullName, role } = req.body;

  if (!requireAdmin(req, res)) return;

  const normalizedEmail = (email || '').toLowerCase().trim();
  const normalizedRole = (role || '').trim().toLowerCase();
  const normalizedName = (fullName || '').trim();
  const allowedRoles = ['technician', 'operator'];

  if (!normalizedEmail || !normalizedName || !allowedRoles.includes(normalizedRole)) {
    return res.status(400).json({ error: 'Email, full name and a valid role are required' });
  }

  if (normalizedEmail === UNIVERSAL_ADMIN_EMAIL.toLowerCase()) {
    return res.status(400).json({ error: 'Cannot create user with reserved admin email' });
  }

  try {
    const randomPlaceholderPassword = randomBytes(24).toString('hex');
    const passwordHash = await bcryptjs.hash(randomPlaceholderPassword, 10);

    const { data: createdUsers, error: createError } = await supabase
      .from('users')
      .insert([{
        email: normalizedEmail,
        password_hash: passwordHash,
        full_name: normalizedName,
        role: normalizedRole,
        status: 'pending_setup'
      }])
      .select();

    if (createError) throw createError;

    const createdUser = createdUsers[0];
    const setupToken = jwt.sign(
      {
        purpose: 'password_setup',
        email: createdUser.email,
        role: createdUser.role
      },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    await supabase.from('audit_logs').insert([{
      user_id: req.user.id,
      action: 'admin_user_created',
      details: { created_user_id: createdUser.id, role: createdUser.role }
    }]);

    res.status(201).json({
      user: {
        id: createdUser.id,
        email: createdUser.email,
        full_name: createdUser.full_name,
        role: createdUser.role,
        status: createdUser.status
      },
      setupToken
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/admin/users', verifyToken, async (req, res) => {
  if (!requireAdmin(req, res)) return;

  try {
    const { data, error } = await supabase
      .from('users')
      .select('id, email, full_name, role, status, created_at')
      .neq('role', 'admin')
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json(data || []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.patch('/api/admin/users/:userId', verifyToken, async (req, res) => {
  if (!requireAdmin(req, res)) return;

  const { role, status } = req.body;
  const updates = {};
  const allowedRoles = ['operator', 'technician'];
  const allowedStatuses = ['active', 'inactive'];

  if (role) {
    const normalizedRole = String(role).toLowerCase();
    if (!allowedRoles.includes(normalizedRole)) {
      return res.status(400).json({ error: 'Invalid role' });
    }
    updates.role = normalizedRole;
  }

  if (status) {
    const normalizedStatus = String(status).toLowerCase();
    if (!allowedStatuses.includes(normalizedStatus)) {
      return res.status(400).json({ error: 'Invalid status' });
    }
    updates.status = normalizedStatus;
  }

  if (!Object.keys(updates).length) {
    return res.status(400).json({ error: 'No valid updates provided' });
  }

  try {
    const { data: targetUsers, error: targetError } = await supabase
      .from('users')
      .select('id, role, status')
      .eq('id', req.params.userId)
      .limit(1);

    if (targetError || !targetUsers.length) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (targetUsers[0].role === 'admin') {
      return res.status(403).json({ error: 'Admin account cannot be modified here' });
    }

    const { data: updatedUsers, error: updateError } = await supabase
      .from('users')
      .update(updates)
      .eq('id', req.params.userId)
      .select('id, email, full_name, role, status, created_at');

    if (updateError) throw updateError;

    await supabase.from('audit_logs').insert([{
      user_id: req.user.id,
      action: 'admin_user_updated',
      details: { target_user_id: req.params.userId, updates }
    }]);

    res.json(updatedUsers[0]);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/admin/users/:userId/reset-password', verifyToken, async (req, res) => {
  if (!requireAdmin(req, res)) return;

  try {
    const { data: targetUsers, error: targetError } = await supabase
      .from('users')
      .select('id, email, role')
      .eq('id', req.params.userId)
      .limit(1);

    if (targetError || !targetUsers.length) {
      return res.status(404).json({ error: 'User not found' });
    }

    const targetUser = targetUsers[0];
    if (targetUser.role === 'admin') {
      return res.status(403).json({ error: 'Admin account password cannot be reset here' });
    }

    const randomPlaceholderPassword = randomBytes(24).toString('hex');
    const passwordHash = await bcryptjs.hash(randomPlaceholderPassword, 10);
    const { error: updateError } = await supabase
      .from('users')
      .update({ password_hash: passwordHash, status: 'pending_setup' })
      .eq('id', targetUser.id);

    if (updateError) throw updateError;

    const setupToken = jwt.sign(
      {
        purpose: 'password_setup',
        email: targetUser.email,
        role: targetUser.role
      },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    await supabase.from('audit_logs').insert([{
      user_id: req.user.id,
      action: 'admin_password_reset_requested',
      details: { target_user_id: targetUser.id }
    }]);

    res.json({ setupToken });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// === TICKET ENDPOINTS ===
app.post('/api/tickets', verifyToken, async (req, res) => {
  const { title, description, equipmentName, location, priority } = req.body;

  if (req.user.role !== 'operator') {
    return res.status(403).json({ error: 'Only operators can submit complaints' });
  }

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

const requireTechnician = (req, res) => {
  if (req.user.role !== 'technician') {
    res.status(403).json({ error: 'Technician access required' });
    return false;
  }

  return true;
};

app.get('/api/tickets', verifyToken, async (req, res) => {
  const { status, startDate, endDate } = req.query;

  if (!requireTechnician(req, res)) return;

  try {
    let query = supabase
      .from('tickets')
      .select('*');

    if (status) query = query.eq('status', status);
    if (startDate) query = query.gte('created_at', startDate);
    if (endDate) query = query.lte('created_at', endDate);

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) throw error;

    const ticketsWithUsers = await attachTicketUsers(data);
    res.json(ticketsWithUsers);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/tickets/:id', verifyToken, async (req, res) => {
  if (!requireTechnician(req, res)) return;

  try {
    const { data: ticket, error: ticketError } = await supabase
      .from('tickets')
      .select('*')
      .eq('id', req.params.id)
      .single();

    if (ticketError) throw ticketError;

    const { data: comments, error: commentsError } = await supabase
      .from('ticket_comments')
      .select('*, user_id:users(full_name, email)')
      .eq('ticket_id', req.params.id)
      .order('created_at', { ascending: true });

    if (commentsError) throw commentsError;

    const [ticketWithUsers] = await attachTicketUsers([ticket]);
    res.json({ ...ticketWithUsers, comments });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.patch('/api/tickets/:id', verifyToken, async (req, res) => {
  const { status, assignedTo, priority } = req.body;

  if (req.user.role !== 'technician') {
    return res.status(403).json({ error: 'Only technicians can update complaint status' });
  }

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

  if (req.user.role !== 'technician') {
    return res.status(403).json({ error: 'Only technicians can reply to complaints' });
  }

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

  if (!requireTechnician(req, res)) return;

  try {
    let query = supabase
      .from('tickets')
      .select('id, ticket_number, title, status, priority, equipment_name, location, created_at, resolved_at, created_by, assigned_to');

    if (status) query = query.eq('status', status);
    if (startDate) query = query.gte('created_at', startDate);
    if (endDate) query = query.lte('created_at', endDate);

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) throw error;

    const ticketsWithUsers = await attachTicketUsers(data);
    const ticketIds = ticketsWithUsers.map((ticket) => ticket.id);
    let commentCountMap = new Map();
    let latestCommentMap = new Map();

    if (ticketIds.length > 0) {
      const { data: commentsData, error: commentsError } = await supabase
        .from('ticket_comments')
        .select('ticket_id, comment_text, created_at')
        .in('ticket_id', ticketIds);

      if (commentsError) throw commentsError;

      commentCountMap = commentsData.reduce((acc, comment) => {
        const count = acc.get(comment.ticket_id) || 0;
        acc.set(comment.ticket_id, count + 1);
        return acc;
      }, new Map());

      latestCommentMap = commentsData.reduce((acc, comment) => {
        const prev = acc.get(comment.ticket_id);
        if (!prev || new Date(comment.created_at) > new Date(prev.created_at)) {
          acc.set(comment.ticket_id, comment);
        }
        return acc;
      }, new Map());
    }

    const asIsoDate = (value) => {
      if (!value) return '';
      const dt = new Date(value);
      if (Number.isNaN(dt.getTime())) return '';
      return dt.toISOString().slice(0, 10);
    };

    const dueDays = (start, end) => {
      if (!start) return '';
      const from = new Date(start);
      const to = end ? new Date(end) : new Date();
      if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return '';
      const ms = to.getTime() - from.getTime();
      return Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)));
    };

    const exportRows = ticketsWithUsers.map((ticket, index) => {
      const latestComment = latestCommentMap.get(ticket.id);
      const normalizedStatus = (ticket.status || '').toUpperCase();
      const isClosed = ['CLOSED', 'RESOLVED'].includes(normalizedStatus);
      const closedDate = asIsoDate(ticket.resolved_at);

      return {
        'S/N': index + 1,
        'Inspection Date': asIsoDate(ticket.created_at),
        'Due Date Count': dueDays(ticket.created_at, ticket.resolved_at),
        'Asset I.D': ticket.equipment_name || '',
        System: ticket.location || '',
        'Sub-System': '',
        'Reliability Observation': ticket.description || ticket.title,
        Criticality: (ticket.priority || '').toUpperCase(),
        'Reliability Status': normalizedStatus,
        'End User Status': isClosed ? 'CLOSED' : 'OPEN',
        'Closed Date': closedDate,
        'Reliability Confirmed Closed Date': closedDate,
        Remarks: latestComment?.comment_text || ''
      };
    });

    // Convert to CSV
    const csv = Papa.unparse(exportRows);

    // Log export action
    await supabase.from('audit_logs').insert([{
      user_id: req.user.id,
      action: 'data_exported',
      details: { format: 'csv', filters: { status, startDate, endDate } }
    }]);

    res.header('Content-Type', 'text/csv');
    res.header('Content-Disposition', 'attachment; filename="complaints-register-export.csv"');
    res.send(csv);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// === DASHBOARD STATS ===
app.get('/api/stats', verifyToken, async (req, res) => {
  if (!requireTechnician(req, res)) return;

  try {
    const { count: totalCount, error: totalError } = await supabase
      .from('tickets')
      .select('*', { count: 'exact', head: true });

    if (totalError) throw totalError;

    const { count: openCount, error: openError } = await supabase
      .from('tickets')
      .select('*', { count: 'exact', head: true })
      .in('status', ['open', 'in_progress']);

    if (openError) throw openError;

    const { count: closedCount, error: closedError } = await supabase
      .from('tickets')
      .select('*', { count: 'exact', head: true })
      .in('status', ['resolved', 'closed']);

    if (closedError) throw closedError;

    res.json({
      total: totalCount || 0,
      open: openCount || 0,
      closed: closedCount || 0
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// === FILE UPLOAD ENDPOINTS ===
app.post('/api/tickets/:id/upload', verifyToken, upload.array('files', 5), async (req, res) => {
  try {
    const { data: ticket, error: ticketError } = await supabase
      .from('tickets')
      .select('id, created_by')
      .eq('id', req.params.id)
      .single();

    if (ticketError) throw ticketError;

    const canUpload = req.user.role === 'technician' || ticket.created_by === req.user.id;
    if (!canUpload) {
      return res.status(403).json({ error: 'Not allowed to upload files for this complaint' });
    }

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No files provided' });
    }

    const attachments = [];

    for (const file of req.files) {
      const fileBuffer = fs.readFileSync(file.path);
      const storagePath = `tickets/${req.params.id}/${file.filename}`;

      // Upload to Supabase Storage
      const { data, error: uploadError } = await supabase.storage
        .from('ticket-attachments')
        .upload(storagePath, fileBuffer, { upsert: true });

      if (uploadError) throw uploadError;

      // Save to database
      const { data: attachment, error: dbError } = await supabase
        .from('file_attachments')
        .insert([{
          ticket_id: req.params.id,
          file_name: file.originalname,
          file_size: file.size,
          file_type: file.mimetype,
          storage_path: storagePath,
          uploaded_by: req.user.id
        }])
        .select();

      if (dbError) throw dbError;

      // Clean up local file
      fs.unlinkSync(file.path);

      attachments.push(attachment[0]);
    }

    // Log action
    await supabase.from('audit_logs').insert([{
      user_id: req.user.id,
      action: 'file_uploaded',
      details: { ticket_id: req.params.id, file_count: attachments.length }
    }]);

    res.status(201).json(attachments);
  } catch (err) {
    // Clean up uploaded files on error
    if (req.files) {
      req.files.forEach(file => {
        try { fs.unlinkSync(file.path); } catch (e) {}
      });
    }
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/tickets/:id/comments/:commentId/upload', verifyToken, upload.array('files', 5), async (req, res) => {
  try {
    if (!requireTechnician(req, res)) return;

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No files provided' });
    }

    const attachments = [];

    for (const file of req.files) {
      const fileBuffer = fs.readFileSync(file.path);
      const storagePath = `tickets/${req.params.id}/comments/${req.params.commentId}/${file.filename}`;

      // Upload to Supabase Storage
      const { data, error: uploadError } = await supabase.storage
        .from('ticket-attachments')
        .upload(storagePath, fileBuffer, { upsert: true });

      if (uploadError) throw uploadError;

      // Save to database
      const { data: attachment, error: dbError } = await supabase
        .from('file_attachments')
        .insert([{
          ticket_id: req.params.id,
          comment_id: req.params.commentId,
          file_name: file.originalname,
          file_size: file.size,
          file_type: file.mimetype,
          storage_path: storagePath,
          uploaded_by: req.user.id
        }])
        .select();

      if (dbError) throw dbError;

      // Clean up local file
      fs.unlinkSync(file.path);

      attachments.push(attachment[0]);
    }

    res.status(201).json(attachments);
  } catch (err) {
    // Clean up uploaded files on error
    if (req.files) {
      req.files.forEach(file => {
        try { fs.unlinkSync(file.path); } catch (e) {}
      });
    }
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/tickets/:id/files', verifyToken, async (req, res) => {
  try {
    if (!requireTechnician(req, res)) return;

    const { data, error } = await supabase
      .from('file_attachments')
      .select('*, uploaded_by:users(full_name)')
      .eq('ticket_id', req.params.id)
      .is('comment_id', null)
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/files/:fileId', verifyToken, async (req, res) => {
  try {
    if (!requireTechnician(req, res)) return;

    const { data: file, error: fetchError } = await supabase
      .from('file_attachments')
      .select('*')
      .eq('id', req.params.fileId)
      .single();

    if (fetchError) throw fetchError;

    // Delete from storage
    const { error: deleteError } = await supabase.storage
      .from('ticket-attachments')
      .remove([file.storage_path]);

    if (deleteError && !deleteError.message.includes('not found')) {
      throw deleteError;
    }

    // Delete from database
    const { error: dbError } = await supabase
      .from('file_attachments')
      .delete()
      .eq('id', req.params.fileId);

    if (dbError) throw dbError;

    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

const startServer = async () => {
  try {
    await ensureUniversalAdminAccount();
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
      console.log(`Universal admin email: ${UNIVERSAL_ADMIN_EMAIL}`);
    });
  } catch (error) {
    console.error('Failed to bootstrap server:', error.message);
    process.exit(1);
  }
};

startServer();
