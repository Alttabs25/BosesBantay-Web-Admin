# 📣 BosesBantay - Web Admin Portal

Welcome to the **BosesBantay Web Admin Portal**, the centralized administrative dashboard for managing incidents, emergency alerts, resident accounts, digital blotters, and GIS mapping visualizations. 

This repository contains the front-end dashboard built with React and Vite, integrated directly with **Supabase** for secure authentication, real-time database management, and trigger-based profile synchronization.

---

## 🛠️ Technology Stack
* **Framework**: React.js (built with Vite)
* **Styling**: Tailwind CSS
* **Database & Auth**: Supabase (PostgreSQL + Supabase Auth)
* **State Management**: React Context API (`AuthContext`, `DataContext`)

---

## 🚀 Local Setup Instructions

Follow these steps to set up the project locally on your machine:

### 1. Prerequisites
Ensure you have the following installed on your machine:
* [Node.js](https://nodejs.org/) (v18.0.0 or higher recommended)
* [Git](https://git-scm.com/)

### 2. Clone the Repository
```bash
git clone https://github.com/Alttabs25/BosesBantay-Web-Admin.git
cd BosesBantay-Web-Admin
```

### 3. Install Dependencies
```bash
npm install
```

### 4. Set Up Environment Variables
1. In the root directory, create a new file named `.env.local` (this file is already ignored by Git, so your keys will not be leaked to GitHub).
2. Copy and paste the template below, replacing the values with your team's Supabase credentials:

```ini
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
```

---

## 🗄️ Supabase Database & Auth Setup
To make the dashboard fully functional, you need to execute the schema and trigger updates in your Supabase project.

### Step 1: Run the Core Schema
1. Open [supabase_schema.sql](supabase_schema.sql) in your code editor and copy the entire script.
2. Go to your **Supabase Dashboard > SQL Editor**, paste the code, and click **Run**. 
   * *This will create all database tables, columns, references, and initial role entries.*

### Step 2: Configure Roles, Triggers, and RLS
1. Open [update_roles_and_users.sql](update_roles_and_users.sql) and copy the script.
2. Go to **Supabase Dashboard > SQL Editor**, paste the code, and click **Run**.
   * *This disables Row Level Security (RLS) for active prototyping, updates default role strings to match the front-end constants, and registers the SQL trigger that automatically inserts new users into `public.users` when they sign up.*

### Step 3: Turn Off Email Confirmation (Critical)
To prevent getting rate-limited during sign-ups or getting the `"email rate limit exceeded"` error:
1. Navigate to your **Supabase Dashboard > Authentication > Providers > Email**.
2. Toggle **Confirm email** to **OFF** (Disabled).
3. Click **Save** at the bottom of the page.

---

## 💻 Running the App
Start the local development server:
```bash
npm run dev
```
Open your browser and navigate to the local URL (usually `http://localhost:5173`).

---

## 📂 Key Folders & Files
* `src/context/AuthContext.jsx`: Handles user authentication sessions, login/logout states, password resets, and admin registrations.
* `src/context/DataContext.jsx`: Connects frontend data requests (incidents, users, blotters) to Supabase tables.
* `src/pages/UserAccounts.jsx`: Contains the portal accounts management interface (verifications, suspensions, role upgrades).
* `src/pages/AuditLogs.jsx`: Handles the paginated compliance tracking viewer.
