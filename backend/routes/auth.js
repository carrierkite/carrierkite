const express = require('express');
const crypto = require('crypto');
const router = express.Router();
const supabase = require('../config/supabase');
const { createClient } = require('@supabase/supabase-js');
const { sendPasswordResetEmail } = require('../utils/email');

const SUPABASE_AUTH_OPTIONS = {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false
  }
};

function createAuthClient() {
  return createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.VITE_SUPABASE_ANON_KEY,
    SUPABASE_AUTH_OPTIONS
  );
}

const supabaseAuth = createAuthClient();

const GENERIC_RECOVERY_MESSAGE =
  'If an account exists with this email, you will receive a reset link shortly.';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const COMMON_PASSWORDS = new Set([
  '123456789012',
  'qwertyuiop12',
  'password1234',
  'password123!',
  'letmein123456',
  'carrierkite123'
]);

function normalizeEmail(value) {
  return typeof value === 'string'
    ? value.trim().toLowerCase()
    : '';
}

function isValidEmail(email) {
  if (!email || email.length > 254 || !EMAIL_PATTERN.test(email)) {
    return false;
  }

  const [localPart] = email.split('@');
  return localPart.length > 0 && localPart.length <= 64;
}

function validatePassword(password) {
  if (typeof password !== 'string') {
    return 'Password is required.';
  }

  if (password.length < 12) {
    return 'Password must be at least 12 characters.';
  }

  if (password.length > 128) {
    return 'Password must be no more than 128 characters.';
  }

  if (/[\u0000-\u001F\u007F]/.test(password)) {
    return 'Password cannot contain control characters.';
  }

  if (COMMON_PASSWORDS.has(password.toLowerCase())) {
    return 'That password is too common. Please choose a different password.';
  }

  return null;
}

function getRecoveryTokenHash(linkData) {
  const directToken = linkData?.properties?.hashed_token;

  if (typeof directToken === 'string' && directToken) {
    return directToken;
  }

  // Compatibility fallback for older supabase-js versions.
  const actionLink = linkData?.properties?.action_link;

  if (typeof actionLink !== 'string') {
    return null;
  }

  try {
    return new URL(actionLink).searchParams.get('token');
  } catch {
    return null;
  }
}

function buildResetUrl(tokenHash) {
  const resetUrl = new URL(
    '/reset-password.html',
    process.env.APP_URL
  );

  // URL fragments are not sent to the web server or normal Referer headers.
  resetUrl.hash = new URLSearchParams({
    token_hash: tokenHash,
    type: 'recovery'
  }).toString();

  return resetUrl.toString();
}

async function applyRecoveryResponseDelay(startedAt) {
  // Reduce timing differences between existing and unknown accounts.
  const targetMs = 1000 + crypto.randomInt(0, 301);
  const remainingMs = targetMs - (Date.now() - startedAt);

  if (remainingMs > 0) {
    await new Promise(resolve => setTimeout(resolve, remainingMs));
  }
}

function setSensitiveResponseHeaders(res) {
  res.set({
    'Cache-Control': 'no-store, max-age=0',
    Pragma: 'no-cache'
  });
}

router.post('/signup', async (req, res) => {
  
  try {
    const { email, password, companyName, selectedPlan } = req.body; 
    
    const allowedPlans = ['basic', 'pro', 'enterprise'];
    const plan = allowedPlans.includes(selectedPlan) ? selectedPlan : 'basic';

        if (!email || !password || !companyName) {
      return res.status(400).json({
        error: 'Email, password, and company name are required'
      });
    }

    const normalizedEmail = normalizeEmail(email);

    if (!isValidEmail(normalizedEmail)) {
      return res.status(400).json({
        error: 'Please enter a valid email address.'
      });
    }

    const passwordError = validatePassword(password);

    if (passwordError) {
      return res.status(400).json({
        error: passwordError
      });
    }

    const { data: authData, error: authError } =
      await supabaseAuth.auth.signUp({
        email: normalizedEmail,
        password
      });

    if (authError) {
      console.error('Signup error:', authError);
      return res.status(400).json({ error: authError.message });
    }

    if (!authData.user) {
      return res.status(400).json({ error: 'Failed to create user account' });
    }

    const { error: profileError } = await supabase
      .from('brokers')
      .insert([{
        id: authData.user.id,
        email: normalizedEmail,
        company_name: companyName,
        subscription_plan: plan,
subscription_status: 'inactive',
is_active: false
      }]);

    if (profileError) {
      console.error('Profile creation error:', profileError);
      return res.status(500).json({
        error: 'Account created but failed to create broker profile. Please contact support.'
      });
    }

     const { data: newBroker } = await supabase
      .from('brokers')
      .select('*')
      .eq('id', authData.user.id)
      .maybeSingle();

    return res.status(201).json({
      message: 'Account created successfully.',
      user: {
        id: authData.user.id,
        email: authData.user.email
      },
      broker: newBroker,
      session: authData.session,
      requiresPayment: true

    });

  } catch (error) {
    console.error('Signup error:', error);
    return res.status(500).json({ error: 'Internal server error during signup' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const { data, error } = await supabaseAuth.auth.signInWithPassword({
      email,
      password
    });

    if (error) {
      console.error('Login error:', error);
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    
    const { data: broker, error: brokerError } = await supabase
      .from('brokers')
      .select('*')
      .eq('id', data.user.id)
      .maybeSingle();

    if (brokerError || !broker) {
      console.error('Broker fetch error:', brokerError);
      return res.status(404).json({
        error: 'Broker profile not found. Please complete signup.'
      });
    }
//     if (!broker.is_active) {
//   if (broker.subscription_status === 'inactive') {
//     // Has account but never paid — let them through to pay
//     return res.status(200).json({
//       message: 'Login successful',
//       user: { id: data.user.id, email: data.user.email },
//       broker: broker,
//       session: data.session,
//       requiresPayment: true
//     });
//   }
//   // Actually disabled by admin
//   await supabaseAuth.auth.signOut();
//   return res.status(403).json({ error: 'Your account has been disabled. Please contact support.' });
// }
    
    const requiresPayment = broker.role !== 'super_admin' && broker.subscription_status !== 'active';

return res.status(200).json({
  message: 'Login successful',
  user: {
    id: data.user.id,
    email: data.user.email
  },
  broker: broker,
  session: data.session,
  requiresPayment
});

  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ error: 'Internal server error during login' });
    
  }
  
});

router.post('/logout', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.replace('Bearer ', '');
    
    const { error } = token
      ? await supabaseAuth.auth.admin.signOut(token)
      : { error: null };

    if (error) {
      console.error('Logout error:', error);
      return res.status(500).json({ error: 'Failed to logout' });
    }

    return res.status(200).json({ message: 'Logout successful' });

  } catch (error) {
    console.error('Logout error:', error);
    return res.status(500).json({ error: 'Internal server error during logout' });
  }
});

// ── FORGOT PASSWORD ──────────────────────────────────────────
router.post('/forgot-password', async (req, res) => {
  const startedAt = Date.now();
  setSensitiveResponseHeaders(res);

  const email = normalizeEmail(req.body?.email);

  if (!isValidEmail(email)) {
    return res.status(400).json({
      error: 'Please enter a valid email address.'
    });
  }

  try {
    // Supabase Auth is the source of truth.
    // Do not query brokers first because that can expose account existence.
    const { data, error } =
      await supabase.auth.admin.generateLink({
        type: 'recovery',
        email
      });

    const tokenHash = getRecoveryTokenHash(data);

    if (error || !tokenHash) {
      // Unknown accounts also arrive here. Never expose that to the client.
      console.error(
        'Password recovery link generation failed:',
        error?.message || 'No recovery token returned'
      );
    } else {
      const resetUrl = buildResetUrl(tokenHash);

      await sendPasswordResetEmail(
        email,
        resetUrl
      );
    }
  } catch (error) {
    // Always keep the public response generic.
    console.error(
      'Password recovery request failed:',
      error?.message || 'Unknown error'
    );
  }

  await applyRecoveryResponseDelay(startedAt);

  return res.status(200).json({
    message: GENERIC_RECOVERY_MESSAGE
  });
});

// ── RESET PASSWORD ───────────────────────────────────────────
router.post('/reset-password', async (req, res) => {
  setSensitiveResponseHeaders(res);

  const { password, tokenHash } = req.body || {};
  const passwordError = validatePassword(password);

  if (passwordError) {
    return res.status(400).json({
      error: passwordError
    });
  }

  if (
    typeof tokenHash !== 'string' ||
    tokenHash.length < 32 ||
    tokenHash.length > 512 ||
    !/^[A-Za-z0-9._~-]+$/.test(tokenHash)
  ) {
    return res.status(400).json({
      error: 'Invalid or expired reset link.'
    });
  }

  try {
    // Use a new client for every recovery request.
    const recoveryClient = createAuthClient();

    // The hard-coded "recovery" type proves this is a recovery token.
    const { data: recoveryData, error: verifyError } =
      await recoveryClient.auth.verifyOtp({
        token_hash: tokenHash,
        type: 'recovery'
      });

    if (
      verifyError ||
      !recoveryData?.user ||
      !recoveryData?.session
    ) {
      return res.status(400).json({
        error: 'Invalid or expired reset link.'
      });
    }

    // Update using the verified recovery session.
    // Do not use admin.updateUserById here.
    const { error: updateError } =
      await recoveryClient.auth.updateUser({
        password
      });

    if (updateError) {
      console.error(
        'Password update failed:',
        updateError.message
      );

      return res.status(400).json({
        error:
          'Unable to update the password. Please request a new reset link.'
      });
    }

    // Revoke refresh sessions on every device.
    const { error: signOutError } =
      await recoveryClient.auth.signOut({
        scope: 'global'
      });

    if (signOutError) {
      console.error(
        'Post-reset session revocation failed:',
        signOutError.message
      );
    }

    return res.status(200).json({
      message:
        'Password updated successfully. Please sign in again.'
    });
  } catch (error) {
    console.error(
      'Password reset failed:',
      error?.message || 'Unknown error'
    );

    return res.status(400).json({
      error: 'Invalid or expired reset link.'
    });
  }
});

// ── SEND VERIFICATION EMAIL ──────────────────────────────────
router.post('/send-verification', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const { error } = await supabaseAuth.auth.resend({
      type: 'signup',
      email,
      options: {
        emailRedirectTo: `${process.env.APP_URL}/verify.html`
      }
    });

    if (error) {
      console.error('Verification email error:', error);
      return res.status(500).json({ error: 'Failed to send verification email' });
    }

    return res.status(200).json({ message: 'Verification email sent' });

  } catch (error) {
    console.error('Send verification error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── VERIFY SESSION (used by frontend to check token validity) ─
router.get('/verify-session', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ valid: false });

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error } = await supabaseAuth.auth.getUser(token);

    if (error || !user) {
      return res.status(401).json({ valid: false });
    }

    return res.status(200).json({ valid: true });

  } catch (error) {
    return res.status(401).json({ valid: false });
  }
});

router.patch('/profile', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'Unauthorized' });

    const token = authHeader.replace('Bearer ', '');
    const { data: userData, error } = await supabaseAuth.auth.getUser(token);

    if (error || !userData.user) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    const { companyName } = req.body;

    if (!companyName || !companyName.trim()) {
      return res.status(400).json({ error: 'Company name is required' });
    }

    const { data: broker, error: updateError } = await supabase
      .from('brokers')
      .update({
        company_name: companyName.trim()
      })
      .eq('id', userData.user.id)
      .select('*')
      .maybeSingle();

    if (updateError) {
      console.error('Profile update error:', updateError);
      return res.status(500).json({ error: 'Failed to update profile' });
    }

    return res.status(200).json({
      message: 'Profile updated successfully',
      broker
    });

  } catch (err) {
    console.error('Profile update error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

router.get('/me', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'Unauthorized' });

    const token = authHeader.replace('Bearer ', '');
    const { data: userData, error } = await supabaseAuth.auth.getUser(token);
    if (error || !userData.user) return res.status(401).json({ error: 'Invalid token' });

    const { data: broker } = await supabase
      .from('brokers')
      .select('*')
      .eq('id', userData.user.id)
      .maybeSingle();

    if (!broker) return res.status(404).json({ error: 'Broker not found' });

    return res.status(200).json({ broker });
  } catch (err) {
    return res.status(500).json({ error: 'Server error' });
  }
});
// ── DISABLE OWN ACCOUNT ──────────────────────────────────────
router.post('/disable-account', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'Unauthorized' });

    const token = authHeader.replace('Bearer ', '');
    const { data: userData, error } = await supabaseAuth.auth.getUser(token);
    if (error || !userData.user) return res.status(401).json({ error: 'Invalid token' });

    // Set is_active to false immediately
    const { error: updateError } = await supabase
      .from('brokers')
      .update({ is_active: false })
      .eq('id', userData.user.id);

    if (updateError) {
      console.error('Disable account error:', updateError);
      return res.status(500).json({ error: 'Failed to disable account' });
    }

    // Also try to cancel any active Stripe subscription as a courtesy
    try {
      const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
      const { data: broker } = await supabase
        .from('brokers')
        .select('stripe_customer_id')
        .eq('id', userData.user.id)
        .maybeSingle();

      if (broker?.stripe_customer_id) {
        const subscriptions = await stripe.subscriptions.list({
          customer: broker.stripe_customer_id,
          status: 'active',
          limit: 1
        });
        if (subscriptions.data.length > 0) {
          await stripe.subscriptions.cancel(subscriptions.data[0].id);
        }
      }
    } catch (stripeErr) {
      // Non-critical — account is already disabled
      console.log('Stripe cleanup (optional):', stripeErr.message);
    }

    return res.status(200).json({
      message: 'Your account has been disabled. You will be logged out.'
    });

  } catch (err) {
    console.error('Disable account error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

router.get('/ping', (req, res) => res.json({ ok: true }));

module.exports = router;
