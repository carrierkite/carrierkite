const express = require('express');
const cors = require('cors');
const path = require('path');
const https = require('https');
const crypto = require('crypto');
require('dotenv').config();
const REQUIRED_ENV = [
    'VITE_SUPABASE_URL',
    'VITE_SUPABASE_ANON_KEY',
    'SUPABASE_SERVICE_ROLE_KEY',
    'RESEND_API_KEY',
    'APP_URL',
    'STRIPE_SECRET_KEY',
    'STRIPE_PRICE_ID',
    'STRIPE_WEBHOOK_SECRET',
];
const missingEnv = REQUIRED_ENV.filter(k => !process.env[k]);
if (missingEnv.length) {
    console.error('❌ Missing required environment variables:', missingEnv.join(', '));
    process.exit(1);
}
const fs = require('fs');



const authRoutes = require('./routes/auth');
const packetRoutes = require('./routes/packets');
const signatureRoutes = require('./routes/signatures');
const rateLimit = require('express-rate-limit');
const paymentRoutes = require('./routes/payments');
const carrierRoutes = require('./routes/carriers');

const compression = require('compression');
const app = express();
const PORT = process.env.PORT || 3000;

// Auto-create uploads dir if missing (Hostinger wipes it on redeploy)
const uploadsDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

// MUST be first — Hostinger sits behind a reverse proxy
// MUST be first — Hostinger sits behind a reverse proxy
app.set('trust proxy', 1);

app.use((req, res, next) => {
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Keep-Alive', 'timeout=60');
    next();
});

const helmet = require('helmet');
app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false
}));

// Compress all text responses — reduces transfer size by 60-80%
app.use(compression({
    threshold: 1024,
    filter: (req, res) => {
        if (req.headers['x-no-compression']) return false;
        return compression.filter(req, res);
    }
}));

const staticOptions = {
    etag: true,
    lastModified: true,
    maxAge: process.env.NODE_ENV === 'production' ? '30d' : '0',
    setHeaders: (res, filePath) => {
        if (/\.html$/i.test(filePath)) {
            res.setHeader('Cache-Control', 'no-cache');
        } else if (/\.(?:css|js|mjs|png|jpg|jpeg|webp|svg|gif|ico|woff2?)$/i.test(filePath)) {
            res.setHeader('Cache-Control', 'public, max-age=2592000, immutable');
        }
    }
};

const allowedOrigins = new Set([
    'https://carrierkite.com',
    'https://www.carrierkite.com'
]);

try {
    allowedOrigins.add(
        new URL(process.env.APP_URL).origin
    );
} catch {
    console.error(
        '❌ APP_URL must be a valid absolute URL'
    );
    process.exit(1);
}

if (process.env.NODE_ENV !== 'production') {
    allowedOrigins.add('http://localhost:3000');
    allowedOrigins.add('http://localhost:5500');
    allowedOrigins.add('http://127.0.0.1:3000');
    allowedOrigins.add('http://127.0.0.1:5500');
}

app.use(cors({
    origin(origin, callback) {
        if (!origin || allowedOrigins.has(origin)) {
            return callback(null, true);
        }

        return callback(null, false);
    },
    credentials: true,
    methods: [
        'GET',
        'POST',
        'PUT',
        'PATCH',
        'DELETE',
        'OPTIONS'
    ],
    allowedHeaders: [
        'Content-Type',
        'Authorization'
    ],
    maxAge: 600
}));

// Stripe webhook needs raw body — must be before express.json()
app.use('/api/payments/webhook', express.raw({ type: 'application/json' }));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
// ── RATE LIMITING ─────────────────────────────────────────────

// Auth routes — strict limit (login, signup, forgot password)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50,
  message: { error: 'Too many attempts. Please try again in 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false
});

// Forgot password — strict per-IP limit.
const forgotPasswordLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: {
    error:
      'Too many password reset attempts. Please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false
});

// Also limit requests targeting the same normalized email.
// The email is hashed before being used as a rate-limit key.
const forgotPasswordEmailLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,

  keyGenerator: (req) => {
    const email =
      typeof req.body?.email === 'string'
        ? req.body.email.trim().toLowerCase()
        : 'invalid-email';

    return crypto
      .createHash('sha256')
      .update(email)
      .digest('hex');
  },

  message: {
    error:
      'Too many password reset attempts. Please try again later.'
  },

  standardHeaders: true,
  legacyHeaders: false
});

const resetPasswordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,

  message: {
    error:
      'Too many reset attempts. Please request a new link and try again later.'
  },

  standardHeaders: true,
  legacyHeaders: false
});

// Signing endpoint — prevent abuse of carrier signing
const signLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { error: 'Too many requests. Please try again shortly.' },
  standardHeaders: true,
  legacyHeaders: false
});

// Carrier lookup — prevent abuse of the free FMCSA data source
const carrierLookupLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { error: 'Too many carrier lookups. Please try again in 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false
});

// General API limit
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  message: { error: 'Too many requests. Please try again in 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false
});

// Apply limiters
app.use('/api/', (req, res, next) => {
    if (req.path === '/auth/ping') return next();
    apiLimiter(req, res, next);
});

app.use('/api/auth/', (req, res, next) => {
    if (req.path === '/ping') return next();
    authLimiter(req, res, next);
});
app.use(
  '/api/auth/forgot-password',
  forgotPasswordLimiter,
  forgotPasswordEmailLimiter
);

app.use(
  '/api/auth/reset-password',
  resetPasswordLimiter
);
app.use('/api/signatures/submit', signLimiter);
app.use('/api/carriers/', carrierLookupLimiter);

app.use('/uploads', express.static(path.join(__dirname, '../uploads'), staticOptions));

// Debug — log the resolved uploads path on startup
console.log('Uploads path:', path.join(__dirname, '../uploads'));
app.use(express.static(path.join(__dirname, '../frontend'), staticOptions));
const verifyAdmin = require('./middleware/verifyAdmin');
app.use('/api/admin', verifyAdmin, require('./routes/admin'));
app.use('/api/auth', authRoutes);
app.use('/api/carriers', carrierRoutes);
app.use('/api/packets', packetRoutes);
app.use('/api/signatures', signatureRoutes);
app.use('/api/payments', paymentRoutes);

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

app.get('/dashboard.html', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/dashboard.html'));
});

app.get('/sign.html', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/sign.html'));
});

app.get('/forgot-password.html', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/forgot-password.html'));
});
app.get('/reset-password.html', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/reset-password.html'));
});
app.get('/admin.html', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/admin.html'));
});
app.get('/pricing.html', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/pricing.html'));
});


// 404 catch-all — must be before error handler
app.use((req, res, next) => {
    if (req.path.startsWith('/api/')) {
        return res.status(404).json({ error: 'API endpoint not found' });
    }
    res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

app.use((err, req, res, next) => {
  // Multer file errors
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ error: 'File too large. Maximum size is 20MB.' });
  }
  if (err.code === 'LIMIT_UNEXPECTED_FILE') {
    return res.status(400).json({ error: 'Unexpected file field.' });
  }
  if (err.message && err.message.includes('Only PDF')) {
    return res.status(400).json({ error: err.message });
  }
  if (err.message && err.message.includes('Invalid file')) {
    return res.status(400).json({ error: err.message });
  }

  console.error('Error:', err);
  res.status(500).json({
    error: err.message || 'Internal server error'
  });
});

const server = app.listen(PORT, () => {
  console.log('='.repeat(50));
  console.log('🚀 Broker-Carrier Packet SaaS Server Started!');
  console.log('='.repeat(50));
  console.log(`Server running on: http://localhost:${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log('='.repeat(50));
  console.log('Available Routes:');
  console.log('  Frontend:');
  console.log(`    - Home/Login:    http://localhost:${PORT}/`);
  console.log(`    - Dashboard:     http://localhost:${PORT}/dashboard.html`);
  console.log(`    - Sign Packet:   http://localhost:${PORT}/sign.html`);
  console.log('  API Endpoints:');
  console.log('    - POST /api/auth/signup');
  console.log('    - POST /api/auth/login');
  console.log('    - POST /api/auth/logout');
  console.log('    - POST /api/packets/upload');
  console.log('    - POST /api/packets/:packetId/send');
  console.log('    - GET  /api/packets');
  console.log('    - GET  /api/packets/:packetId');
  console.log('    - GET  /api/signatures/packet/:token');
  console.log('    - POST /api/signatures/submit');
  console.log('    - GET  /api/signatures/packet/:packetId/signature');
  console.log('='.repeat(50));
  console.log('');
  console.log('📝 Important Setup Steps:');
  console.log('  1. Update .env file with your Supabase credentials');
  console.log('  2. Update .env file with your email credentials');
  console.log('  3. Ensure database migrations are applied');
  console.log('');
  console.log('Ready to accept connections!');
  console.log('='.repeat(50));
});

server.keepAliveTimeout = 61000;
server.headersTimeout = 62000;
server.requestTimeout = 0;

process.on('SIGTERM', () => {
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 10000);
});
process.on('SIGINT', () => {
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 10000);
});

const SITE_URL = process.env.APP_URL || 'https://carrierkite.com';

setInterval(() => {
    // Skip keep-alive ping in local development
    if (SITE_URL.startsWith('http://')) return;
    https.get(`${SITE_URL}/api/auth/ping`, (res) => {
        console.log(`Keep-alive ping: ${res.statusCode}`);
    }).on('error', (err) => {
        console.log(`Keep-alive error: ${err.message}`);
    });
}, 1 * 60 * 1000);

module.exports = app;
