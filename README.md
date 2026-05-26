# Broker-Carrier Packet SaaS MVP

A multi-tenant SaaS application where brokers can create carrier packets (PDF documents), send them to carriers for signing, store signed documents, and receive email notifications.

## Features

- **Multi-tenant architecture**: Each broker can only see their own packets
- **Broker functionality**:
  - Create account and login
  - Upload PDF carrier packets
  - Send packets to carriers via email
  - View all packets and their statuses
  - Receive email notifications when packets are signed
- **Carrier functionality**:
  - Receive email with secure signing link
  - View packet PDF
  - Sign using signature pad or upload signed PDF
  - No login required
- **Secure authentication**: Using Supabase Auth with JWT tokens
- **Row Level Security**: Database-level multi-tenancy enforcement

## Tech Stack

- **Frontend**: HTML, CSS, JavaScript (vanilla)
- **Backend**: Node.js + Express
- **Database**: Supabase (PostgreSQL)
- **File Uploads**: Multer
- **Email**: Nodemailer
- **Authentication**: Supabase Auth

## Project Structure

```
broker-carrier-packet-saas/
├── backend/
│   ├── config/
│   │   └── supabase.js          # Supabase client configuration
│   ├── middleware/
│   │   └── auth.js              # Authentication middleware
│   ├── routes/
│   │   ├── auth.js              # Authentication routes (signup, login, logout)
│   │   ├── packets.js           # Packet management routes
│   │   └── signatures.js        # Signature handling routes
│   ├── utils/
│   │   └── email.js             # Email sending utilities
│   └── server.js                # Main Express server
├── frontend/
│   ├── index.html               # Login/Signup page
│   ├── dashboard.html           # Broker dashboard
│   └── sign.html                # Carrier signing page
├── uploads/                     # Uploaded PDF files (local storage)
│   ├── {broker_id}/             # Broker-specific folders
│   └── signed/                  # Signed PDFs
├── supabase/
│   └── migrations/              # Database migrations
├── .env                         # Environment variables
├── .env.example                 # Environment variables template
├── package.json                 # Dependencies
└── README.md                    # This file
```

## Getting Started

### Prerequisites

- Node.js (v14 or higher)
- A Supabase account and project
- A Gmail account (for sending emails) or other SMTP service

### Installation

1. **Clone or download the project**

2. **Install dependencies**

```bash
npm install
```

3. **Set up Supabase**

   - Create a Supabase project at https://supabase.com
   - The database schema has already been created with the migration
   - Copy your Supabase URL and anon key from your project settings

4. **Configure environment variables**

   Edit the `.env` file with your credentials:

   ```env
   # Supabase Configuration
   VITE_SUPABASE_URL=your_supabase_project_url
   VITE_SUPABASE_ANON_KEY=your_supabase_anon_key

   # Server Configuration
   PORT=3000
   NODE_ENV=development

   # Email Configuration (Gmail example)
   EMAIL_USER=your_email@gmail.com
   EMAIL_PASS=your_gmail_app_password
   EMAIL_FROM=your_email@gmail.com

   # Application URL
   APP_URL=http://localhost:3000
   ```

   **Important Email Setup:**
   - For Gmail, you need to create an "App Password" (not your regular Gmail password)
   - Go to: Google Account → Security → 2-Step Verification → App Passwords
   - Generate a new app password for "Mail"
   - Use this generated password in the `EMAIL_PASS` field

5. **Create uploads directory**

```bash
mkdir -p uploads/signed
```

6. **Start the server**

```bash
npm start
```

The server will start at http://localhost:3000

## Usage Guide

### For Brokers

1. **Sign Up**
   - Navigate to http://localhost:3000
   - Click "Sign Up" tab
   - Enter your company name, email, and password
   - Click "Sign Up"

2. **Login**
   - Navigate to http://localhost:3000
   - Enter your email and password
   - Click "Login"

3. **Upload a Carrier Packet**
   - From the dashboard, fill in the carrier's name and email
   - Upload a PDF document
   - Click "Upload Packet"

4. **Send Packet to Carrier**
   - Once uploaded, click "Send to Carrier" button
   - An email will be sent to the carrier with a secure signing link
   - The packet status will change to "Sent"

5. **View Signed Packets**
   - When a carrier signs a packet, you'll receive an email notification
   - The packet status will change to "Signed" in your dashboard

### For Carriers

1. **Receive Email**
   - Check your email for a message with subject "Carrier Packet - Signature Required"
   - Click the signing link in the email

2. **Review and Sign**
   - Review the PDF document
   - Choose to either:
     - **Draw Signature**: Enter your name and draw your signature
     - **Upload Signed PDF**: Upload a PDF that you've already signed
   - Click "Submit Signature"

3. **Confirmation**
   - You'll see a success message
   - The broker will be notified automatically

## API Endpoints

### Authentication

- `POST /api/auth/signup` - Create new broker account
- `POST /api/auth/login` - Login broker
- `POST /api/auth/logout` - Logout broker

### Packets (Requires Authentication)

- `POST /api/packets/upload` - Upload new carrier packet
- `POST /api/packets/:packetId/send` - Send packet to carrier via email
- `GET /api/packets` - Get all packets for logged-in broker
- `GET /api/packets/:packetId` - Get specific packet

### Signatures (Public)

- `GET /api/signatures/packet/:token` - Get packet by secure token
- `POST /api/signatures/submit` - Submit signature
- `GET /api/signatures/packet/:packetId/signature` - Get signature for packet

## Database Schema

### Tables

1. **brokers**
   - `id` (uuid) - References auth.users
   - `company_name` (text)
   - `email` (text)
   - `subscription_status` (text)
   - `created_at` (timestamp)

2. **packets**
   - `id` (uuid)
   - `broker_id` (uuid) - References brokers
   - `carrier_email` (text)
   - `carrier_name` (text)
   - `packet_url` (text)
   - `status` (text) - 'pending', 'sent', 'signed'
   - `secure_token` (text)
   - `created_at` (timestamp)
   - `sent_at` (timestamp)
   - `signed_at` (timestamp)

3. **signatures**
   - `id` (uuid)
   - `packet_id` (uuid) - References packets
   - `carrier_name` (text)
   - `signature_data` (text)
   - `signature_type` (text) - 'draw' or 'upload'
   - `signed_at` (timestamp)

### Row Level Security (RLS)

All tables have RLS policies to ensure:
- Brokers can only access their own packets and signatures
- Carriers can access packets via secure token without authentication
- Multi-tenant data isolation at the database level

## Security Features

- **JWT Authentication**: Secure token-based authentication using Supabase Auth
- **Row Level Security**: Database-level access control
- **Multi-tenancy**: Brokers isolated from each other's data
- **Secure Tokens**: Unique tokens for carrier signing links
- **Password Hashing**: Passwords are hashed by Supabase Auth
- **File Upload Validation**: Only PDF files accepted, with size limits
- **CORS Protection**: Configured for secure API access

## Troubleshooting

### Email not sending

1. Check that you're using an App Password (not your regular password) for Gmail
2. Verify 2-Step Verification is enabled on your Google account
3. Check the console for error messages
4. Try a different email service if Gmail doesn't work

### Database connection issues

1. Verify your Supabase URL and anon key are correct
2. Check that the migrations have been applied in Supabase
3. Ensure your Supabase project is active

### File upload errors

1. Ensure the `uploads` directory exists
2. Check file permissions on the uploads directory
3. Verify the file is a valid PDF and under 10MB

### Authentication issues

1. Clear browser localStorage and try again
2. Check browser console for errors
3. Verify Supabase credentials are correct

## Future Enhancements

- Super Admin dashboard for managing brokers
- Payment integration for subscription management
- Cloud file storage (Supabase Storage instead of local storage)
- Email templates customization
- Packet templates
- Multiple carrier signatures on one packet
- PDF annotation and editing
- Audit trail and activity logs
- Mobile responsive improvements
- Export signed packets as ZIP
- Webhook notifications

## Deployment

### Backend Deployment (Railway/Render)

1. Create a new project on Railway or Render
2. Connect your GitHub repository
3. Set environment variables in the platform
4. Deploy

### Frontend Deployment (Vercel/Netlify)

1. Create a new project
2. Set the build directory to `frontend`
3. Update `API_URL` in all HTML files to your backend URL
4. Deploy

### Database

- Supabase is already cloud-hosted, no additional deployment needed

## Support

For issues or questions, please check:
- Database schema in `supabase/migrations/`
- API routes in `backend/routes/`
- Frontend code in `frontend/`

## License

ISC
