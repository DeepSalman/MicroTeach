# MicroTeach — Setup Instructions

## Step 1: Install Requirements

You need these installed on your computer:
- [Node.js](https://nodejs.org/) (v18 or higher) — includes npm
- [XAMPP](https://www.apachefriends.org/) — start **MySQL** from the XAMPP Control Panel (Apache is only needed to use phpMyAdmin)

## Step 2: Clone the Project

```bash
git clone <repo-url>
cd MicroTeach
```

## Step 3: Install Dependencies

```bash
npm --prefix back_end install
npm --prefix front_end install
```

## Step 4: Set Up Database

Copy `back_end/.env.example` to `back_end/.env` (do not overwrite an existing `.env`). Set the port to the MySQL port shown in XAMPP; the default is usually `3306`:

```env
PORT=3001
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=root
DB_PASSWORD=
DB_NAME=microteach_db
```

> If your MySQL has a password, put it after `DB_PASSWORD=`

> `supabase_schema.sql` is for PostgreSQL and should not be imported into XAMPP. The MySQL setup below creates its own database and tables.

## Step 5: Create and Seed the Database

With XAMPP MySQL running, run this from the project root. It creates the database, MySQL tables, and sample data automatically:

```bash
npm run local:db
```

That's it. No manual SQL needed.

## Step 6: Start the App

Open **two terminal windows** from the project root:

**Terminal 1 — Backend:**
```bash
npm run local:api
```

**Terminal 2 — Frontend:**
```bash
npm run local:web
```

Now open http://localhost:5173 in your browser.

## Test Accounts

Login with any of these emails. Password for all: **`password123`**

| Email | Role |
|-------|------|
| rafiq@bracu.ac.bd | Student & Tutor |
| sadia@bracu.ac.bd | Student |
| tanvir@bracu.ac.bd | Tutor |
| nusrat@bracu.ac.bd | Student & Tutor |
| imran@bracu.ac.bd | Student |
| fatima@bracu.ac.bd | Tutor |

## How the App is Connected

| Connection | File | What it does |
|-----------|------|-------------|
| Frontend → Backend | `front_end/src/api.js` | Sends HTTP requests to `http://localhost:3001/api` |
| Backend routes | `back_end/server.js` | Maps URLs like `/api/users` to route files |
| Backend → Database | `back_end/db.js` | Uses MySQL unless `DATABASE_URL` explicitly selects PostgreSQL |
| DB credentials | `back_end/.env` | Stores XAMPP host, port, user, password, and database name |
