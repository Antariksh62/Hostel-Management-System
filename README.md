# Hostel Management System

A MERN stack web app for managing PICT hostel complaints across three roles — Student, Staff, and Warden.

## Tech Stack

- **Frontend:** React, Vite, React Router, TanStack Query, Recharts
- **Backend:** Node.js, Express 5, MongoDB, Mongoose
- **Auth:** JWT (access token) + HTTP-only refresh token cookie
- **Other:** Multer (file uploads), Nodemailer (OTP email), Helmet, Rate Limiting, Joi validation

## Roles

| Role | Access |
|------|--------|
| **Student** | OTP-based login · Raise complaints with images/video · Track complaint timeline · Submit feedback |
| **Warden** | Email/password login · View all complaints · Assign staff · Update status · Analytics |
| **Staff** | Email/password login · View assigned tasks · Mark as resolved |

## Getting Started

### 1. Clone & install

```bash
git clone https://github.com/YOUR_USERNAME/Hostel-Management-System.git

cd backend && npm install
cd ../frontend-react && npm install
```

### 2. Backend `.env`

```env
MONGO_URI=mongodb://127.0.0.1:27017/hostelDB
JWT_SECRET=your_secret
JWT_REFRESH_SECRET=your_refresh_secret
PORT=5000
EMAIL_USER=youremail@gmail.com
EMAIL_PASS=your_gmail_app_password
```

### 3. Run

```bash
# Terminal 1 — backend
cd backend && npm run dev

# Terminal 2 — frontend
cd frontend-react && npm run dev
```

- Backend: `http://localhost:5000`
- Frontend: `http://localhost:5173`

## Key Features

- **Complaint timeline** — every stage (Raised → Assigned → In Progress → Resolved) is recorded with an exact timestamp and shown to all three roles
- **Media attachments** — up to 5 images + 1 video per complaint (20 MB each)
- **Analytics dashboard** — complaint counts by status/category, daily trend chart, avg resolution time
- **Satisfaction feedback** — students can mark a resolved complaint as unsatisfied (auto-reopens it)

## License

MIT
