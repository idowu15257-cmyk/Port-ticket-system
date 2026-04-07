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
      .select('id, ticket_number, title, status, priority, equipment_name, location, created_at, resolved_at, created_by, assigned_to');

    if (status) query = query.eq('status', status);
    if (startDate) query = query.gte('created_at', startDate);
    if (endDate) query = query.lte('created_at', endDate);

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) throw error;

    const ticketsWithUsers = await attachTicketUsers(data);
    const exportRows = ticketsWithUsers.map((ticket) => ({
      ticket_number: ticket.ticket_number,
      title: ticket.title,
      status: ticket.status,
      priority: ticket.priority,
      equipment_name: ticket.equipment_name,
      location: ticket.location,
      created_at: ticket.created_at,
      resolved_at: ticket.resolved_at,
      created_by: ticket.created_by?.full_name || '',
      assigned_to: ticket.assigned_to?.full_name || ''
    }));

    // Convert to CSV
    const csv = Papa.unparse(exportRows);

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

// === FILE UPLOAD ENDPOINTS ===
app.post('/api/tickets/:id/upload', verifyToken, upload.array('files', 5), async (req, res) => {
  try {
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

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
