# GodMind AI - Deploy to Vercel (FREE)

## What You Need
- A [Supabase](https://supabase.com) account (FREE, no credit card)
- A [Vercel](https://vercel.com) account (FREE)
- A [GitHub](https://github.com) account (FREE)

---

## Step 1: Set Up Supabase Database (5 minutes)

### 1a. Create Supabase Project
1. Go to https://supabase.com → "Start your project" → Sign up with GitHub
2. Click **"New Project"**
3. Name: `godmind-ai` | Password: choose a strong one (SAVE IT!) | Region: closest to you
4. Click **"Create new project"** → Wait 2 minutes

### 1b. Run the SQL Setup
1. In Supabase, click **"SQL Editor"** (left sidebar)
2. Click **"New query"**
3. Open the file `supabase-setup.sql` from this project and **copy ALL of it**
4. Paste it in the SQL Editor and click **"Run"**
5. You should see **"Success"** ✅

### 1c. Get Your Keys
1. Click **⚙️ Settings** (bottom left) → **"API"**
2. Copy these 3 things:
   - **Project URL**: `https://xxxx.supabase.co`
   - **anon public key**: long string starting with `eyJ...`
   - **service_role key**: long string starting with `eyJ...`

---

## Step 2: Push to GitHub (3 minutes)

### 2a. Create GitHub Repo
1. Go to https://github.com → Click **"+"** → **"New repository"**
2. Name: `godmind-ai` → **Public** → Click **"Create repository"**

### 2b. Push Code
Open your terminal/command prompt and run:

```bash
# Go to this project folder
cd godmind-vercel

# Initialize git
git init
git add .
git commit -m "GodMind AI ready for Vercel"

# Connect to your GitHub (replace YOUR_USERNAME)
git remote add origin https://github.com/YOUR_USERNAME/godmind-ai.git
git branch -M main
git push -u origin main
```

---

## Step 3: Deploy to Vercel (2 minutes)

### 3a. Connect Vercel
1. Go to https://vercel.com → Sign up with GitHub
2. Click **"Add New"** → **"Project"**
3. Find `godmind-ai` → Click **"Import"**
4. Click **"Deploy"** → Wait 60 seconds

### 3b. Add Environment Variables
1. In Vercel, click your project → **"Settings"** → **"Environment Variables"**
2. Add these:

| Name | Value |
|------|-------|
| `SUPABASE_URL` | Your Supabase Project URL from Step 1c |
| `SUPABASE_SERVICE_KEY` | Your service_role key from Step 1c |
| `JWT_SECRET` | Any random string (e.g., `my-super-secret-2026`) |

3. Click **Save**

### 3c. Redeploy
1. Go to **"Deployments"** tab
2. Click **"..."** on latest deployment → **"Redeploy"**

🎉 **DONE!** Your app is live at `godmind-ai.vercel.app`

---

## Admin Login
- **Email:** `admin@godmind.ai`
- **Password:** `GodMode2026!`
- (You can change this in `supabase-setup.sql` before running it)

---

## Project Structure
```
godmind-vercel/
├── api/
│   └── index.js          ← All API routes (auth, chat, AI, image, video)
├── lib/
│   └── supabase.js       ← Supabase database connection
├── public/
│   └── app.html          ← Frontend (landing page + dashboard)
├── package.json           ← Dependencies
├── vercel.json            ← Vercel routing config
├── supabase-setup.sql     ← Database tables setup
└── .env.example           ← Environment variables template
```

---

## Troubleshooting

**"Module not found" error:**
→ Make sure `package.json` has all dependencies. Vercel installs them automatically.

**"Supabase error" on API calls:**
→ Check that `SUPABASE_URL` and `SUPABASE_SERVICE_KEY` are correct in Vercel env vars.

**"Not authenticated" error in chat:**
→ Register a new account or login with admin credentials first.

**Image/Video generation fails:**
→ The `z-ai-web-dev-sdk` must be available in Vercel. Make sure it's in `package.json`.

---

## Free Tier Limits
| Service | Free Limit |
|---------|-----------|
| Vercel | 100GB bandwidth, serverless functions |
| Supabase | 500MB database, unlimited API requests |
| Supabase Auth | 50,000 MAU |
