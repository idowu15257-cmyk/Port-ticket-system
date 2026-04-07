# Port Terminal Ticket System

A lightweight ticket management system for RTG operators and technical teams at port terminals.

## Features

- ✅ User authentication (Operator, Technician, Admin roles)
- ✅ Create, view, and manage tickets
- ✅ Threaded comments and responses
- ✅ **File uploads** (up to 5 files per ticket/comment, 50MB each)
- ✅ Ticket status tracking (Open → In Progress → Resolved → Closed)
- ✅ Priority levels (Low, Medium, High, Urgent)
- ✅ Date-range filtering
- ✅ CSV export with filters
- ✅ Simple, lightweight UI
- ✅ Zero-cost deployment on free tiers

## Tech Stack

- **Frontend**: HTML5, CSS3, Vanilla JavaScript
- **Backend**: Node.js + Express.js
- **Database**: PostgreSQL (via Supabase)
- **Hosting**: Vercel (frontend) + can host backend on Railway/Render (free tier)

## Setup Instructions

### 1. Create Supabase Account

1. Go to [supabase.com](https://supabase.com)
2. Create a new project
3. Copy your `SUPABASE_URL` and `SERVICE_KEY` from project settings
4. Run the SQL from `DATABASE_SCHEMA.sql` in your Supabase SQL editor
5. **Create Storage Bucket for File Uploads:**
   - Go to **Storage** tab
   - Click **Create a new bucket**
   - Name: `ticket-attachments`
   - Choose Public or Private (Public for direct downloads, Private for API-only)
   - Click **Create bucket**

### 2. Backend Setup

```bash
cd backend
npm install
```

Create `.env` file:
```env
PORT=5000
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_KEY=your_service_key
JWT_SECRET=your_random_secret_key_here
```

Start the server:
```bash
npm start
# or for development with auto-reload
npm run dev
```

### 3. Frontend Setup

The frontend is a standalone app. Update the API_BASE_URL in `frontend/api.js` if needed:

```javascript
const API_BASE_URL = 'http://localhost:5000/api'; // Change for production
```

Open `frontend/index.html` in a browser or serve with a simple server:

```bash
cd frontend
python -m http.server 8000
# or with node
npx http-server
```

Visit `http://localhost:8000`

### 4. Deployment

**Frontend (Vercel)**:
1. Push frontend folder to GitHub
2. Connect to Vercel
3. Set environment variables if needed
4. Deploy

**Backend (Railway/Render)**:
1. Push backend to GitHub
2. Connect to Railway or Render
3. Add environment variables
4. Deploy

## Usage

### For Operators

1. **Login** with operator credentials
2. **Create Ticket**: Describe the issue with equipment
3. **View Responses**: Technical team responds in the ticket thread
4. **Update Status**: Mark as resolved when fixed

### For Technical Team

1. **Login** with technician credentials
2. **View Open Tickets**: See all filed complaints
3. **Assign & Respond**: Assign to yourself and post responses
4. **Update Status**: Change status to "In Progress" or "Resolved"

### File Uploads

- **When creating a ticket**: Attach up to 5 files (images, PDFs, documents)
- **When responding**: Attach files to comments for additional context
- **Supported types**: PDF, images (JPG, PNG), Office files (DOC, XLSX), text files
- **Limits**: Max 5 files per upload, 50MB per file
- **Delete files**: Click the delete button next to any attachment
- **Blocked types**: Executables (.exe, .bat, .sh, .cmd) for security

### Export Data

- Filter tickets by date range and status
- Click "Export CSV" to download
- Opens in Excel/Google Sheets for reporting

## API Endpoints

```
POST   /api/auth/register        - Create account
POST   /api/auth/login           - Login
GET    /api/tickets              - List tickets (with filters)
POST   /api/tickets              - Create ticket
GET    /api/tickets/:id          - View ticket detail
PATCH  /api/tickets/:id          - Update ticket
POST   /api/tickets/:id/comments - Add comment
GET    /api/stats                - Dashboard stats
GET    /api/export/csv           - Export to CSV
```

## Cost Breakdown

| Service | Free Tier | When Cost Starts |
|---------|-----------|------------------|
| Supabase | 500MB DB, sufficient for years | >500MB storage |
| Vercel | Unlimited projects | Custom domain |
| Railway | $5/month credits | After credits |
| Small team usage | ~0-5 USD/month | High volume |

## Future Enhancements

- Email notifications
- File attachments in tickets
- SLA tracking
- Advanced analytics dashboard
- Mobile app
- Bulk ticket operations
- Ticket templates

---

Made for port terminal operations efficiency.
