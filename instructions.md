# MicroTeach — Setup Instructions

## Step 1: Install Requirements

You need these installed on your computer:
- [Node.js](https://nodejs.org/) (v18 or higher) — includes npm
- [MySQL](https://dev.mysql.com/downloads/mysql/) — database server

## Step 2: Clone the Project

```bash
git clone <repo-url>
cd MicroTeach
```

## Step 3: Install Dependencies

```bash
cd back_end
npm install

cd ../front_end
npm install
```

## Step 4: Set Up Database

Open `back_end/.env` and make sure it matches your MySQL setup:

```
PORT=3001
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=
DB_NAME=microteach_db
```

> If your MySQL has a password, put it after `DB_PASSWORD=`

## Step 5: Seed the Database

Run this ONE command from the `back_end/` folder — it creates the database, tables, and sample data automatically:

```bash
cd back_end
node seed.js
```

That's it. No manual SQL needed.

## Step 6: Start the App

Open **two terminal windows**:

**Terminal 1 — Backend:**
```bash
cd back_end
npm start
```

**Terminal 2 — Frontend:**
```bash
cd front_end
npm run dev
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
