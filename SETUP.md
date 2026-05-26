# Quick Setup Guide for Beginners

This guide will help you set up and run the Broker-Carrier Packet SaaS application on your local computer.

## Step 1: Install Node.js

If you don't have Node.js installed:

1. Go to https://nodejs.org/
2. Download the LTS (Long Term Support) version
3. Run the installer and follow the instructions
4. Verify installation by opening Terminal/Command Prompt and typing:
   ```bash
   node --version
   npm --version
   ```

## Step 2: Set Up Supabase

1. **Create a Supabase Account**
   - Go to https://supabase.com
   - Click "Start your project"
   - Sign up with GitHub, Google, or email

2. **Create a New Project**
   - Click "New Project"
   - Choose an organization (or create one)
   - Enter project name (e.g., "broker-carrier-packet")
   - Create a strong database password (save this!)
   - Choose a region close to you
   - Click "Create new project"
   - Wait 2-3 minutes for setup to complete

3. **Get Your Supabase Credentials**
   - In your project dashboard, click the "Settings" icon (gear) in the left sidebar
   - Click "API" under Project Settings
   - Copy the following:
     - **Project URL** (looks like: https://xxxxx.supabase.co)
     - **anon public key** (starts with: eyJhbGc...)
   - Keep these safe, you'll need them in Step 4

4. **Database is Already Set Up!**
   - The database schema was automatically created when you loaded this project
   - No manual SQL needed!

## Step 3: Set Up Email (Gmail)

1. **Enable 2-Step Verification on Gmail**
   - Go to https://myaccount.google.com/security
   - Find "2-Step Verification" and turn it on
   - Follow the setup process

2. **Create an App Password**
   - After enabling 2-Step Verification, go back to https://myaccount.google.com/security
   - Find "App passwords" (you may need to search for it)
   - Click "App passwords"
   - Select "Mail" and "Other (Custom name)"
   - Enter "Broker Carrier App" as the name
   - Click "Generate"
   - **IMPORTANT**: Copy the 16-character password (looks like: xxxx xxxx xxxx xxxx)
   - Save this password, you can't see it again!

## Step 4: Configure Environment Variables

1. Open the `.env` file in your project folder
2. Replace the placeholder values with your actual credentials:

```env
# Supabase Configuration (from Step 2)
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGc...your-anon-key-here

# Server Configuration (leave as is)
PORT=3000
NODE_ENV=development

# Email Configuration (from Step 3)
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=xxxx xxxx xxxx xxxx
EMAIL_FROM=your-email@gmail.com

# Application URL (leave as is for local testing)
APP_URL=http://localhost:3000
```

3. Save the file

## Step 5: Install Dependencies

1. Open Terminal (Mac/Linux) or Command Prompt (Windows)
2. Navigate to the project folder:
   ```bash
   cd path/to/broker-carrier-packet-saas
   ```
3. Install dependencies:
   ```bash
   npm install
   ```
4. Wait for installation to complete (may take 1-2 minutes)

## Step 6: Start the Server

1. In the same Terminal/Command Prompt, run:
   ```bash
   npm start
   ```
2. You should see a message like:
   ```
   🚀 Broker-Carrier Packet SaaS Server Started!
   Server running on: http://localhost:3000
   ```
3. **Don't close this Terminal/Command Prompt window!** The server needs to keep running.

## Step 7: Use the Application

1. **Open your web browser** (Chrome, Firefox, Safari, etc.)

2. **Go to** http://localhost:3000

3. **Create a Broker Account**
   - Click the "Sign Up" tab
   - Enter your company name
   - Enter your email
   - Create a password (at least 6 characters)
   - Click "Sign Up"

4. **Login**
   - After signup, you'll be redirected to login
   - Enter your email and password
   - Click "Login"

5. **Upload a Carrier Packet**
   - You'll see the dashboard
   - Fill in:
     - Carrier Name (e.g., "John Doe")
     - Carrier Email (use your own email for testing)
     - Upload a PDF file
   - Click "Upload Packet"

6. **Send Packet to Carrier**
   - You'll see your packet in the table below
   - Click "Send to Carrier"
   - An email will be sent!

7. **Sign as Carrier**
   - Check your email (the carrier email you entered)
   - Click the link in the email
   - You'll see the signing page
   - Choose "Draw Signature" or "Upload Signed PDF"
   - Enter your name and draw a signature (or upload a PDF)
   - Click "Submit Signature"

8. **Check Dashboard**
   - Go back to the dashboard (http://localhost:3000/dashboard.html)
   - You'll see the packet status changed to "Signed"
   - You'll receive a notification email as the broker!

## Troubleshooting

### Problem: Email not sending

**Solution 1**: Make sure you're using the App Password (16 characters) from Step 3, not your regular Gmail password

**Solution 2**: Check that 2-Step Verification is enabled on your Google account

**Solution 3**: Try sending a test email first to make sure your email configuration is correct

### Problem: "Database connection error"

**Solution**: Double-check your Supabase URL and anon key in the `.env` file. Make sure there are no extra spaces.

### Problem: "Cannot find module"

**Solution**: Run `npm install` again to make sure all dependencies are installed

### Problem: Port 3000 already in use

**Solution**: Change the PORT in your `.env` file to a different number (e.g., 3001, 8080)

### Problem: Cannot access http://localhost:3000

**Solution**: Make sure the server is running (you should see the startup message in Terminal/Command Prompt)

## Next Steps

Now that you have the app running, you can:

1. **Test the full workflow** multiple times with different carriers
2. **Customize the email templates** in `backend/utils/email.js`
3. **Modify the styling** in the HTML files
4. **Add new features** based on your needs
5. **Deploy to production** (see README.md for deployment instructions)

## Getting Help

If you run into issues:

1. Check the Terminal/Command Prompt for error messages
2. Check the browser console (F12 → Console tab) for errors
3. Review the README.md file for more detailed information
4. Make sure all environment variables are set correctly
5. Try restarting the server

## Stopping the Server

When you're done:

1. Go to the Terminal/Command Prompt where the server is running
2. Press `Ctrl + C` to stop the server
3. You can start it again anytime with `npm start`

---

Congratulations! You now have a working Broker-Carrier Packet SaaS application running locally.
