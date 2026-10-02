# MicroTeach Cloud Deployment Guide: Vercel + Supabase

This guide walks you through hosting the **MicroTeach** platform on **Vercel** with a **Supabase (PostgreSQL)** cloud database.

---

## Architecture Overview

- **Database**: [Supabase](https://supabase.com/) (Managed Cloud PostgreSQL).
- **Frontend**: [Vercel](https://vercel.com/) (High-performance Vite + React SPA).
- **Backend API**: Can be hosted either:
  - **Option 1 (All-in-One Vercel)**: As serverless functions on Vercel via the included `api/index.js` and `vercel.json`.
  - **Option 2 (Decoupled)**: Frontend on Vercel, Express backend on [Render](https://render.com/) or [Railway](https://railway.app/).

---

## Step 1: Set Up Supabase Database

1. **Create an Account & Project**:
   - Go to [Supabase](https://supabase.com/) and sign in with GitHub.
   - Click **New Project**.
   - Enter a name (e.g. `microteach-db`), set a secure **Database Password** (save this password!), and pick a region close to your users (e.g., `Singapore (ap-southeast-1)` or `Mumbai (ap-south-1)`).
   - Click **Create new project** and wait ~1 minute for provisioning.

2. **Execute Database Schema & Seed Data**:
   - In your Supabase project dashboard, click on **SQL Editor** in the left sidebar (icon with `>_`).
   - Click **New query**.
   - Open [`supabase_schema.sql`](./supabase_schema.sql) in this repository, copy all contents, paste into the Supabase SQL Editor.
   - Click the green **Run** button (or press `Ctrl+Enter` / `Cmd+Enter`).
   - You should see `Success. No rows returned`. All 16 tables, constraints, sequences, and initial seed users are now created!

3. **Get Your Database Connection String**:
   - In Supabase, go to **Project Settings** (gear icon) -> **Database**.
   - Scroll down to the **Connection parameters** section -> **Connection string**.
   - Select the **URI** tab.
   - **Crucial for Serverless (Vercel)**:
     - Select **Connection pooling** mode: **Transaction** (Port `6543`).
     - Copy the connection string. It will look like:
       ```
       postgresql://postgres.[PROJECT-REF]:[YOUR-PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres?pgbouncer=true
       ```
     - Replace `[YOUR-PASSWORD]` with the actual database password you created in step 1.

---

## Step 2: Push Repository to GitHub

Ensure your latest code with Vercel and Supabase configuration files is pushed to your GitHub repository:

```bash
git add .
git commit -m "Add Supabase schema and Vercel deployment configuration"
git push origin main
```

---

## Step 3: Deploy to Vercel

### Method A: Single-Project Deployment (Frontend + Serverless API together)

The repository includes a root `vercel.json` and `api/index.js` which automatically builds the React frontend and runs the Express API as a serverless function on the same domain.

1. Go to [Vercel Dashboard](https://vercel.com/dashboard) and click **Add New... -> Project**.
2. Import your `MicroTeach` GitHub repository.
3. Configure Project Settings:
   - **Framework Preset**: Vite
   - **Root Directory**: `./` (leave default)
   - **Build Command**: `cd front_end && npm install && npm run build`
   - **Output Directory**: `front_end/dist`
4. **Add Environment Variables**:
   In the **Environment Variables** section on Vercel, add:
   | Key | Value | Description |
   |---|---|---|
   | `DATABASE_URL` | `postgresql://postgres.[REF]:[PASS]@aws-0-[REGION].pooler.supabase.com:6543/postgres?pgbouncer=true` | Your Supabase pooled connection string |
   | `NODE_ENV` | `production` | Production environment |
5. Click **Deploy**.
6. Once deployed, Vercel gives you a live URL like `https://microteach.vercel.app`!
   - Frontend is served at `/`
   - API endpoints are served at `/api/...` on the same domain without any CORS issues.

---

### Method B: Decoupled Deployment (Frontend on Vercel + Backend on Render/Railway)

If you prefer keeping Express running as a persistent long-running daemon (e.g. for WebSockets or local uploads):

#### 1. Deploy Backend to Render or Railway:
1. Connect repo to [Render.com](https://render.com) or [Railway.app](https://railway.app).
2. Set **Root Directory**: `back_end`.
3. Set **Build Command**: `npm install`.
4. Set **Start Command**: `node server.js`.
5. Set Environment Variable on Render/Railway:
   - `DATABASE_URL`: Your Supabase connection string.
6. Note your live backend URL: `https://microteach-api.onrender.com`.

#### 2. Deploy Frontend to Vercel:
1. In Vercel, import your repository.
2. Set **Root Directory**: `front_end`.
3. Set **Framework Preset**: Vite.
4. Add Environment Variable:
   - `VITE_API_URL`: `https://microteach-api.onrender.com/api`
   - `VITE_SERVER_URL`: `https://microteach-api.onrender.com`
5. Click **Deploy**.

---

## Step 4: Verify Deployment

1. **Browse Platform**: Open your Vercel URL.
2. **Login**: Test logging in with sample seed accounts:
   - **Admin Account**: `admin@bracu.ac.bd` / `password123`
   - **Student Account**: `rafiq@bracu.ac.bd` / `password123`
   - **Tutor Account**: `tanvir@bracu.ac.bd` / `password123`
3. **Admin Portal**: Navigate to `/admin` to verify:
   - User Management
   - Teacher Applications
   - Disputes & Escrow
   - Report Queue
   - Master Data Registry

---

## Local Development vs Production

The backend database adapter in [`back_end/db.js`](./back_end/db.js) is **dual-mode**:
- If `DATABASE_URL` is set to a PostgreSQL URL: Connects to **Supabase**.
- If `DATABASE_URL` is not set: Connects to **MySQL** using `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, and `DB_NAME`.

To run locally with XAMPP, leave `DATABASE_URL` unset and configure the MySQL values in `back_end/.env`. Run `npm run local:db`, then start the app with `npm run local:api` and `npm run local:web` in separate terminals. See [`instructions.md`](./instructions.md) for the full steps. The `supabase_schema.sql` file is PostgreSQL-only; `back_end/seed.js` creates the MySQL schema.

To test with Supabase locally, put your `DATABASE_URL` in `back_end/.env`:
```env
DATABASE_URL=postgresql://postgres.[REF]:[PASS]@aws-0-[REGION].pooler.supabase.com:6543/postgres?pgbouncer=true
```
