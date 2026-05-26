# Feature Documentation

This document provides a detailed overview of all features in the Broker-Carrier Packet SaaS MVP.

## Core Features

### 1. Multi-Tenant Architecture

**What it does**: Ensures complete data isolation between different brokers.

**How it works**:
- Each broker has a unique ID linked to their Supabase auth account
- Database Row Level Security (RLS) policies enforce access control at the database level
- Brokers can only see and manage their own packets
- No broker can access another broker's data

**Technical implementation**:
- RLS policies on `packets` table filter by `broker_id = auth.uid()`
- Middleware checks authentication before allowing API access
- All file uploads are stored in broker-specific folders

---

### 2. Broker Account Management

#### 2.1 Signup

**What it does**: Allows new brokers to create an account.

**How it works**:
1. Broker fills out signup form with company name, email, and password
2. System creates a Supabase auth account
3. System creates a broker profile in the `brokers` table
4. Broker receives a session token and is logged in

**Validation**:
- Email must be valid format
- Password must be at least 6 characters
- Company name is required
- Email must be unique

**Files involved**:
- Frontend: `frontend/index.html`
- Backend: `backend/routes/auth.js` (signup route)

#### 2.2 Login

**What it does**: Allows existing brokers to access their account.

**How it works**:
1. Broker enters email and password
2. System validates credentials with Supabase Auth
3. System retrieves broker profile from database
4. Broker receives session token and access to dashboard

**Security**:
- Passwords are hashed by Supabase Auth
- JWT tokens expire after session timeout
- Session stored in browser localStorage

**Files involved**:
- Frontend: `frontend/index.html`
- Backend: `backend/routes/auth.js` (login route)

#### 2.3 Logout

**What it does**: Securely ends broker session.

**How it works**:
1. Broker clicks logout button
2. System invalidates session token
3. Browser localStorage is cleared
4. Broker is redirected to login page

**Files involved**:
- Frontend: `frontend/dashboard.html`
- Backend: `backend/routes/auth.js` (logout route)

---

### 3. Packet Management

#### 3.1 Upload Packet

**What it does**: Allows brokers to upload PDF carrier packets.

**How it works**:
1. Broker fills in carrier name and email
2. Broker selects a PDF file from their computer
3. System validates the file (PDF only, max 10MB)
4. File is uploaded to broker-specific folder
5. Packet record is created in database with 'pending' status

**Validation**:
- Only PDF files accepted
- File size limit: 10MB
- Carrier name and email are required
- Email must be valid format

**Storage**:
- Files stored in `uploads/{broker_id}/{filename}`
- Filename includes timestamp and UUID to prevent conflicts

**Files involved**:
- Frontend: `frontend/dashboard.html`
- Backend: `backend/routes/packets.js` (upload route)

#### 3.2 Send Packet to Carrier

**What it does**: Sends an email to the carrier with a secure signing link.

**How it works**:
1. Broker clicks "Send to Carrier" button
2. System generates a unique secure token
3. Email is sent to carrier with signing link containing the token
4. Packet status is updated to 'sent'
5. `sent_at` timestamp is recorded

**Email contents**:
- Professional HTML template
- Carrier name personalization
- Secure signing link
- Instructions for signing

**Security**:
- Unique UUID token for each packet
- Token is required to access signing page
- Link expires after packet is signed

**Files involved**:
- Frontend: `frontend/dashboard.html`
- Backend: `backend/routes/packets.js` (send route)
- Email utility: `backend/utils/email.js`

#### 3.3 View All Packets

**What it does**: Displays all packets for the logged-in broker.

**How it works**:
1. Dashboard fetches all packets for current broker
2. Packets are displayed in a table with status badges
3. Table shows carrier info, dates, and actions
4. Auto-refreshes every 30 seconds

**Status indicators**:
- **Pending**: Yellow badge - not yet sent to carrier
- **Sent**: Blue badge - email sent, waiting for signature
- **Signed**: Green badge - carrier has signed

**Files involved**:
- Frontend: `frontend/dashboard.html`
- Backend: `backend/routes/packets.js` (get all packets route)

---

### 4. Carrier Signing Workflow

#### 4.1 Access Signing Page

**What it does**: Allows carriers to access packets without creating an account.

**How it works**:
1. Carrier receives email with secure link
2. Link contains unique token
3. Carrier clicks link and is taken to signing page
4. System validates token and loads packet

**Security**:
- No authentication required (passwordless)
- Access controlled by secure token
- Token is single-use (packet can only be signed once)

**Files involved**:
- Frontend: `frontend/sign.html`
- Backend: `backend/routes/signatures.js` (get packet by token)

#### 4.2 Review Document

**What it does**: Displays the PDF for carrier review.

**How it works**:
1. PDF is loaded in an iframe viewer
2. Carrier can scroll through the document
3. Carrier can review all pages before signing

**Files involved**:
- Frontend: `frontend/sign.html`

#### 4.3 Draw Signature

**What it does**: Allows carrier to draw their signature using mouse/touch.

**How it works**:
1. Carrier enters their full name
2. Carrier draws signature on canvas
3. Signature is captured as base64 image data
4. Carrier can clear and redraw if needed
5. Signature is submitted with packet

**Technology**:
- Uses signature_pad library
- HTML5 Canvas for drawing
- Touch-friendly for mobile devices

**Files involved**:
- Frontend: `frontend/sign.html`
- Backend: `backend/routes/signatures.js` (submit signature)

#### 4.4 Upload Signed PDF

**What it does**: Alternative method - carrier can upload a pre-signed PDF.

**How it works**:
1. Carrier enters their full name
2. Carrier selects a signed PDF from their computer
3. System validates file (PDF only, max 10MB)
4. File is uploaded and stored
5. Signature record is created

**Use case**: When carrier prefers to print, sign physically, scan, and upload.

**Files involved**:
- Frontend: `frontend/sign.html`
- Backend: `backend/routes/signatures.js` (submit signature with file upload)

#### 4.5 Submit Signature

**What it does**: Finalizes the signing process.

**How it works**:
1. System validates signature data
2. Signature record is created in database
3. Packet status is updated to 'signed'
4. `signed_at` timestamp is recorded
5. Email notification is sent to broker
6. Success message is displayed to carrier

**Files involved**:
- Frontend: `frontend/sign.html`
- Backend: `backend/routes/signatures.js` (submit signature)

---

### 5. Email Notifications

#### 5.1 Carrier Signing Request Email

**Triggered when**: Broker sends packet to carrier

**Recipients**: Carrier

**Contents**:
- Professional HTML template
- Personalized greeting with carrier name
- Clear call-to-action button
- Signing link (also provided as plain text)
- Security notice

**Files involved**:
- `backend/utils/email.js` (sendCarrierSigningEmail function)

#### 5.2 Broker Notification Email

**Triggered when**: Carrier signs packet

**Recipients**: Broker

**Contents**:
- Confirmation that packet was signed
- Carrier name
- Link to dashboard
- Timestamp

**Files involved**:
- `backend/utils/email.js` (sendBrokerNotificationEmail function)

---

### 6. Security Features

#### 6.1 JWT Authentication

**What it does**: Secures API endpoints for brokers.

**How it works**:
- Supabase Auth generates JWT tokens on login
- Tokens are sent with each API request
- Backend middleware validates tokens
- Expired/invalid tokens are rejected

**Files involved**:
- `backend/middleware/auth.js`

#### 6.2 Row Level Security (RLS)

**What it does**: Database-level access control.

**How it works**:
- PostgreSQL RLS policies filter data based on user ID
- Brokers can only query their own packets
- Carriers can access packets via token (no auth required)
- Policies are enforced at database level (can't be bypassed)

**Policies implemented**:
- Brokers table: Users can read/update own profile
- Packets table: Brokers can CRUD own packets
- Signatures table: Brokers can read signatures for own packets, anyone can insert

**Files involved**:
- `supabase/migrations/create_broker_carrier_schema.sql`

#### 6.3 File Upload Security

**What it does**: Prevents malicious file uploads.

**How it works**:
- Only PDF files accepted (MIME type validation)
- File size limit enforced (10MB max)
- Files stored outside web root
- Unique filenames prevent conflicts
- Broker-specific folders prevent cross-contamination

**Files involved**:
- `backend/routes/packets.js`
- `backend/routes/signatures.js`

#### 6.4 Secure Token System

**What it does**: Enables passwordless carrier access.

**How it works**:
- UUID v4 generates cryptographically random tokens
- Tokens are stored in database
- Token is required to access signing page
- Single-use (packet can only be signed once)

**Files involved**:
- `backend/routes/packets.js` (token generation)
- `backend/routes/signatures.js` (token validation)

---

### 7. User Experience Features

#### 7.1 Responsive Design

**What it does**: Works on all device sizes.

**How it works**:
- Mobile-first CSS
- Flexible grid layouts
- Touch-friendly buttons and inputs
- Signature canvas adapts to screen size

#### 7.2 Real-time Status Updates

**What it does**: Dashboard auto-updates without page refresh.

**How it works**:
- JavaScript fetches packets every 30 seconds
- Status badges update automatically
- New packets appear without reload

#### 7.3 Loading States

**What it does**: Provides feedback during async operations.

**How it works**:
- Spinner animations during data loading
- Disabled buttons during form submission
- Button text changes (e.g., "Uploading...")

#### 7.4 Error Handling

**What it does**: Graceful error messages for users.

**How it works**:
- Try-catch blocks around all async operations
- User-friendly error messages
- Console logging for debugging
- Validation errors shown inline

#### 7.5 Success Confirmations

**What it does**: Visual confirmation of completed actions.

**How it works**:
- Green success alerts
- Checkmark animations
- Confirmation messages
- Automatic redirects after success

---

## API Endpoints Summary

### Authentication Endpoints

| Endpoint | Method | Auth Required | Description |
|----------|--------|---------------|-------------|
| `/api/auth/signup` | POST | No | Create new broker account |
| `/api/auth/login` | POST | No | Login broker |
| `/api/auth/logout` | POST | No | Logout broker |

### Packet Endpoints

| Endpoint | Method | Auth Required | Description |
|----------|--------|---------------|-------------|
| `/api/packets/upload` | POST | Yes | Upload new packet |
| `/api/packets/:packetId/send` | POST | Yes | Send packet to carrier |
| `/api/packets` | GET | Yes | Get all broker's packets |
| `/api/packets/:packetId` | GET | Yes | Get specific packet |

### Signature Endpoints

| Endpoint | Method | Auth Required | Description |
|----------|--------|---------------|-------------|
| `/api/signatures/packet/:token` | GET | No | Get packet by token |
| `/api/signatures/submit` | POST | No | Submit signature |
| `/api/signatures/packet/:packetId/signature` | GET | Yes | Get signature for packet |

---

## Database Schema Summary

### brokers table
- Stores broker profile information
- Links to Supabase auth.users
- Contains company name, email, subscription status

### packets table
- Stores packet metadata
- Links to broker via broker_id
- Contains carrier info, file path, status, secure token
- Tracks creation, sending, and signing timestamps

### signatures table
- Stores signature information
- Links to packet via packet_id
- Contains carrier name, signature data (base64 or file path)
- Records signature type (draw vs upload) and timestamp

---

## Future Enhancement Ideas

Based on the current architecture, here are potential features to add:

1. **Super Admin Dashboard** - View all brokers and packets
2. **Subscription Management** - Integrate Stripe for payments
3. **Cloud Storage** - Move from local files to Supabase Storage
4. **Packet Templates** - Save and reuse common packet types
5. **Multiple Signatures** - Allow multiple carriers to sign one packet
6. **Audit Trail** - Track all actions and changes
7. **Custom Email Templates** - Let brokers customize email appearance
8. **Bulk Operations** - Send multiple packets at once
9. **Expiring Links** - Time-limited signing links
10. **PDF Annotations** - Allow carriers to add notes/comments
11. **Mobile App** - Native iOS/Android apps
12. **Two-Factor Authentication** - Enhanced security for brokers
13. **Packet Search** - Search by carrier name, email, date, etc.
14. **Export Reports** - Download packet reports as CSV/PDF
15. **Webhook Integration** - Notify external systems of events

---

## Technology Stack Details

### Frontend Technologies
- **HTML5**: Semantic markup, Canvas API
- **CSS3**: Flexbox, Grid, Gradients, Animations
- **Vanilla JavaScript**: No frameworks, modern ES6+ features
- **signature_pad**: Third-party library for signature capture

### Backend Technologies
- **Node.js**: JavaScript runtime
- **Express**: Web framework
- **Multer**: File upload middleware
- **Nodemailer**: Email sending
- **dotenv**: Environment variable management
- **uuid**: Secure token generation

### Database & Auth
- **Supabase**: Backend-as-a-Service
- **PostgreSQL**: Relational database
- **Row Level Security**: Database-level access control
- **Supabase Auth**: Authentication service

### Development Tools
- **npm**: Package manager
- **Git**: Version control
- **Environment Variables**: Configuration management

---

This feature documentation is intended to help developers understand the full scope of functionality in the application and serve as a reference for future development.
