-- Row Level Security (RLS) Policies for Port Ticket System
-- Run these policies in your Supabase SQL Editor after creating the tables

-- ============================================
-- USERS TABLE POLICIES
-- ============================================

-- Allow users to view their own profile
CREATE POLICY "Users can view their own profile" ON users
  FOR SELECT USING (auth.uid()::text = id::text);

-- Allow users to view other users (for assignment purposes)
CREATE POLICY "Users can view other users" ON users
  FOR SELECT USING (true);

-- Only admins can insert new users
CREATE POLICY "Only admins can create users" ON users
  FOR INSERT WITH CHECK (
    (SELECT role FROM users WHERE id = auth.uid()::uuid) = 'admin'
  );

-- Only admins can update users
CREATE POLICY "Only admins can update users" ON users
  FOR UPDATE USING (
    (SELECT role FROM users WHERE id = auth.uid()::uuid) = 'admin'
  );

-- Only admins can delete users
CREATE POLICY "Only admins can delete users" ON users
  FOR DELETE USING (
    (SELECT role FROM users WHERE id = auth.uid()::uuid) = 'admin'
  );

-- ============================================
-- TICKETS TABLE POLICIES
-- ============================================

-- Users can view tickets they created or are assigned to, admins can view all
CREATE POLICY "Users can view relevant tickets" ON tickets
  FOR SELECT USING (
    created_by = auth.uid()::uuid OR 
    assigned_to = auth.uid()::uuid OR 
    (SELECT role FROM users WHERE id = auth.uid()::uuid) IN ('admin', 'technician')
  );

-- Operators and admins can create tickets
CREATE POLICY "Operators and admins can create tickets" ON tickets
  FOR INSERT WITH CHECK (
    (SELECT role FROM users WHERE id = auth.uid()::uuid) IN ('operator', 'admin')
  );

-- Technicians and admins can update tickets
CREATE POLICY "Technicians and admins can update tickets" ON tickets
  FOR UPDATE USING (
    (SELECT role FROM users WHERE id = auth.uid()::uuid) IN ('technician', 'admin') OR
    created_by = auth.uid()::uuid
  );

-- Only admins can delete tickets
CREATE POLICY "Only admins can delete tickets" ON tickets
  FOR DELETE USING (
    (SELECT role FROM users WHERE id = auth.uid()::uuid) = 'admin'
  );

-- ============================================
-- TICKET COMMENTS POLICIES
-- ============================================

-- Users can view comments on tickets they have access to
CREATE POLICY "Users can view comments on accessible tickets" ON ticket_comments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM tickets 
      WHERE tickets.id = ticket_comments.ticket_id 
      AND (
        tickets.created_by = auth.uid()::uuid OR 
        tickets.assigned_to = auth.uid()::uuid OR 
        (SELECT role FROM users WHERE id = auth.uid()::uuid) IN ('admin', 'technician')
      )
    )
  );

-- Users can add comments to tickets they have access to
CREATE POLICY "Users can add comments to accessible tickets" ON ticket_comments
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM tickets 
      WHERE tickets.id = ticket_comments.ticket_id 
      AND (
        tickets.created_by = auth.uid()::uuid OR 
        tickets.assigned_to = auth.uid()::uuid OR 
        (SELECT role FROM users WHERE id = auth.uid()::uuid) IN ('admin', 'technician')
      )
    )
  );

-- Users can update their own comments
CREATE POLICY "Users can update their own comments" ON ticket_comments
  FOR UPDATE USING (
    user_id = auth.uid()::uuid OR
    (SELECT role FROM users WHERE id = auth.uid()::uuid) = 'admin'
  );

-- Users can delete their own comments, admins can delete any
CREATE POLICY "Users can delete their own comments" ON ticket_comments
  FOR DELETE USING (
    user_id = auth.uid()::uuid OR
    (SELECT role FROM users WHERE id = auth.uid()::uuid) = 'admin'
  );

-- ============================================
-- FILE ATTACHMENTS POLICIES
-- ============================================

-- Users can view files on tickets they have access to
CREATE POLICY "Users can view files on accessible tickets" ON file_attachments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM tickets 
      WHERE tickets.id = file_attachments.ticket_id 
      AND (
        tickets.created_by = auth.uid()::uuid OR 
        tickets.assigned_to = auth.uid()::uuid OR 
        (SELECT role FROM users WHERE id = auth.uid()::uuid) IN ('admin', 'technician')
      )
    )
  );

-- Users can upload files to tickets they have access to
CREATE POLICY "Users can upload files to accessible tickets" ON file_attachments
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM tickets 
      WHERE tickets.id = file_attachments.ticket_id 
      AND (
        tickets.created_by = auth.uid()::uuid OR 
        tickets.assigned_to = auth.uid()::uuid OR 
        (SELECT role FROM users WHERE id = auth.uid()::uuid) IN ('admin', 'technician')
      )
    )
  );

-- Only technicians and admins can delete files
CREATE POLICY "Technicians and admins can delete files" ON file_attachments
  FOR DELETE USING (
    (SELECT role FROM users WHERE id = auth.uid()::uuid) IN ('technician', 'admin')
  );

-- ============================================
-- AUDIT LOGS POLICIES
-- ============================================

-- Only admins can view audit logs
CREATE POLICY "Only admins can view audit logs" ON audit_logs
  FOR SELECT USING (
    (SELECT role FROM users WHERE id = auth.uid()::uuid) = 'admin'
  );

-- All authenticated users can insert audit logs (system generated)
CREATE POLICY "Authenticated users can create audit logs" ON audit_logs
  FOR INSERT WITH CHECK (
    auth.uid() IS NOT NULL
  );

-- No one can update or delete audit logs (immutable)
CREATE POLICY "Audit logs are immutable" ON audit_logs
  FOR UPDATE USING (false);

CREATE POLICY "Audit logs cannot be deleted" ON audit_logs
  FOR DELETE USING (false);

-- ============================================
-- STORAGE BUCKET POLICIES (Run in Supabase Storage UI)
-- ============================================

-- For the 'ticket-attachments' bucket:
-- 1. Go to Storage > ticket-attachments > Policies
-- 2. Add these policies:

-- SELECT (Download): Allow authenticated users to download files from tickets they have access to
-- INSERT (Upload): Allow authenticated users to upload files to tickets they have access to
-- UPDATE: Deny all
-- DELETE: Allow only technicians and admins

-- Note: Storage policies are configured in the Supabase dashboard UI
-- They cannot be created via SQL

-- ============================================
-- VERIFICATION QUERIES
-- ============================================

-- Run these to verify RLS is working:

-- 1. Check if RLS is enabled on all tables
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN ('users', 'tickets', 'ticket_comments', 'file_attachments', 'audit_logs');

-- 2. List all policies
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual 
FROM pg_policies 
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- 3. Test as different users (replace UUID with actual user IDs)
-- SET LOCAL role TO authenticated;
-- SET LOCAL request.jwt.claim.sub TO 'user-uuid-here';
-- SELECT * FROM tickets; -- Should only show tickets user has access to

-- Made with Bob
