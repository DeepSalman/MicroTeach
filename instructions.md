# MicroTeach — Local Setup Guide

## Prerequisites

- Node.js (v18+)
- MySQL server running locally
- npm or yarn

## 1. Clone & Install

```bash
# Clone the repo
git clone <repo-url>
cd MicroTeach

# Install backend dependencies
cd back_end
npm install

# Install frontend dependencies
cd ../front_end
npm install
```

## 2. Database Setup

Create the database in MySQL:

```sql
CREATE DATABASE microteach_db;
```

Update `back_end/.env` with your MySQL credentials:

```
PORT=3001
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=
DB_NAME=microteach_db
```

## 3. Seed the Database

From the `back_end/` directory:

```bash
node seed.js --reset
```

This drops existing tables, recreates them, and populates sample data.

Other seed options:

| Command | What it does |
|---------|-------------|
| `node seed.js` | Seed data (skips if tables already have data) |
| `node seed.js --force` | Clear all data and re-seed |
| `node seed.js --reset` | Drop tables, recreate, then seed |

## 4. Run the App

Open two terminals:

**Terminal 1 — Backend (port 3001):**
```bash
cd back_end
npm start
```

**Terminal 2 — Frontend (port 5173):**
```bash
cd front_end
npm run dev
```

Open http://localhost:5173 in your browser.

## 5. Test Accounts

All users login with password: `password123`

| Email | Role | Department |
|-------|------|------------|
| rafiq@bracu.ac.bd | Student & Tutor | Computer Science & Engineering |
| sadia@bracu.ac.bd | Student | Computer Science & Engineering |
| tanvir@bracu.ac.bd | Tutor | Electrical & Electronic Engineering |
| nusrat@bracu.ac.bd | Student & Tutor | Mathematics |
| imran@bracu.ac.bd | Student | Software Engineering |
| fatima@bracu.ac.bd | Tutor | Data Science & AI |

## 6. User Roles

| Role | Description |
|------|-------------|
| `student` | Can post problems, browse tutors, book sessions |
| `tutor` | Can apply to posts, manage sessions, earn from wallet |
| `both` | Can post problems AND apply to other posts |

## 7. Project Structure

```
MicroTeach/
├── front_end/          # React SPA (Vite)
│   ├── src/
│   │   ├── global.css          # Global typography & font variables
│   │   ├── App.jsx             # Routes & auth state
│   │   ├── api.js              # Axios API client
│   │   ├── Home.jsx            # Marketplace feed
│   │   ├── Login.jsx           # Login page
│   │   ├── Register.jsx        # Registration page
│   │   ├── CreatePost.jsx      # Post a bounty
│   │   ├── Profile.jsx         # User profile view
│   │   └── EditProfile.jsx     # Edit profile form
│   └── package.json
│
├── back_end/           # Express REST API
│   ├── server.js               # Entry point (port 3001)
│   ├── db.js                   # MySQL connection pool
│   ├── seed.js                 # Database seeder
│   ├── .env                    # DB config
│   └── routes/
│       ├── userRoutes.js       # /api/users
│       ├── skillRoutes.js      # /api/skills
│       ├── sessionRoutes.js    # /api/sessions
│       └── postRoutes.js       # /api/posts
│
└── instructions.md     # This file
```

## 8. API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/users` | List all users |
| POST | `/api/users/register` | Register new user |
| POST | `/api/users/login` | Login |
| GET | `/api/users/profile/:id` | Get user profile + posts |
| PUT | `/api/users/profile/:id` | Update user profile |
| GET | `/api/posts` | List all posts |
| POST | `/api/posts` | Create a post |
| PATCH | `/api/posts/:id/status` | Update post status |
| GET | `/api/skills` | List all skills |
| POST | `/api/skills` | Add a skill |
| GET | `/api/sessions` | List all sessions |
| POST | `/api/sessions` | Create a session |
