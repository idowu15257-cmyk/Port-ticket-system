# Quick Start Guide - Port Terminal Ticket System

## ⚡ 5-Minute Setup

### Step 1: Create Supabase Project (2 min)
1. Go to https://supabase.com and sign up
2. Create a new project
3. Wait for project to be ready
4. Go to **Settings > API** and copy:
   - `Project URL` → SUPABASE_URL
   - `SERVICE_ROLE KEY` → SUPABASE_SERVICE_KEY

### Step 2: Set Up Database (1 min)
1. Go to **SQL Editor**
2. Click **Create new query**
3. Open `DATABASE_SCHEMA.sql` from this project
4. Copy all the SQL code
5. Paste into the query box
6. Click **Run**

### Step 3: Create Storage Bucket (30 sec)
1. Go to **Storage** tab
2. Click **Create new bucket**
3. Name: `ticket-attachments`
4. Choose **Public** (allows direct downloads) or Private (API only)
5. Click **Create bucket**

### Step 4: Configure Backend (1 min)
1. Go to `backend/` folder
2. Rename `.env.example` to `.env`
3. Replace values:
   ```
   SUPABASE_URL=<your project URL from step 1>
   SUPABASE_SERVICE_KEY=<your service role key from step 1>
   JWT_SECRET=<generate: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))">
   ```
4. Save

### Step 5: Start Server (30 sec)
```bash
cd backend
npm install  # Only first time
npm start    # Runs on port 5000
```

### Step 6: Run Frontend
- Open `frontend/index.html` in browser
- Or: `cd frontend && python -m http.server 8000`
- Visit: http://localhost:8000

---

## 🧪 Testing Checklist

### Create Your First Account
```
Email: operator@test.com
Password: Test123!
Name: Test Operator
Role: Operator
```

### Create a Ticket
1. Click **+ New Ticket**
2. Fill in fields
3. Attach a file (image, PDF, etc.)
4. Click **Create Ticket**
5. Check Supabase **Storage > ticket-attachments** to see uploaded file

### Test File Uploads
- ✅ Upload 1 file
- ✅ Upload 5 files (max)
- ❌ Try uploading 6 files (should fail)
- ❌ Try uploading .exe file (should be blocked)
- ❌ Try uploading 100MB file (should fail, 50MB limit)

### Test Comments with Files
1. Open a ticket detail
2. Add a response comment
3. Attach files to the comment
4. Should appear in Supabase storage under `/comments/` path

### Test File Deletion
1. Open ticket detail
2. Click delete next to a file
3. Confirm deletion
4. File should be removed from both DB and Supabase

---

## 📊 Verify Setup is Working

### Backend Health Check
```bash
curl http://localhost:5000/api/stats \
  -H "Authorization: Bearer <your_jwt_token>"
```
Should return: `{"total": 0, "open": 0, "resolved": 0}`

### Check Supabase Connection
Run this in frontend browser console:
```javascript
// Should return your user object
console.log(localStorage.getItem('user'))
```

### Check File Storage
In Supabase dashboard:
1. Go to **Storage > ticket-attachments**
2. You should see a folder structure like:
   ```
   /tickets
     /[ticket-id]
       /[filename]
   ```

---

## 🐛 Troubleshooting

### Issue: "Upload failed: bucket not found"
**Solution**: Create a storage bucket named exactly: `ticket-attachments`

### Issue: "Invalid token" errors
**Solution**: Check `.env` file has correct SUPABASE_URL and SERVICE_KEY

### Issue: Large files taking too long
**Solution**: Files over 50MB are blocked by design. This is intentional.

### Issue: Can't see uploaded files in storage
**Solution**: Files are uploaded to `ticket-attachments` bucket with path `tickets/{id}/{filename}`

### Issue: "CORS error" when uploading
**Solution**: Make sure backend is running on page load before uploading

---

## 🔒 Security Notes

### Before Production:
1. [ ] Implement RLS (Row Level Security) policies
2. [ ] Change JWT secret to random string
3. [ ] Set up HTTPS/SSL
4. [ ] Enable rate limiting
5. [ ] Consider adding virus scanning
6. [ ] Review file type whitelist

### User Security:
- Never share `.env` file
- Change default JWT_SECRET for each deployment
- Use strong passwords (frontend doesn't enforce yet)
- Set up HTTPS in production

---

## 📈 Default Limits

| Item | Limit | Notes |
|------|-------|-------|
| Files per upload | 5 | Can be changed in multer config |
| File size | 50MB | Per file |
| JWT expiry | 7 days | Configurable |
| Supabase free tier | 1GB | Storage limit |
| API rate limit | None yet | TODO: Add rate limiting |

---

## 📦 What's Included

```
port-ticket-system/
├── backend/
│   ├── server.js          # Express API server
│   ├── package.json       # Dependencies
│   └── uploads/           # Temp file storage (auto-created)
├── frontend/
│   ├── index.html         # Main app
│   ├── app.js             # Frontend logic
│   ├── api.js             # API wrapper
│   └── styles.css         # Styling
├── DATABASE_SCHEMA.sql    # PostgreSQL/Supabase schema
├── BUG_REPORT.md          # Known issues and fixes
└── README.md              # Full documentation
```

---

## 🚀 Next Steps After Setup

1. **Create test tickets** with files
2. **Test all features** (see Testing Checklist above)
3. **Read BUG_REPORT.md** to understand known limitations
4. **Review security issues** before production use
5. **Set up team accounts** for operators and technicians
6. **Configure backups** for Supabase data

---

## 💬 Support Resources

- [Supabase Docs](https://supabase.com/docs)
- [Express.js Docs](https://expressjs.com/)
- [JavaScript Fetch API](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API)

---

**Setup complete! Your ticket system is ready to use.** 🎉
