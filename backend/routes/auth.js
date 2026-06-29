const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');
const { createClient } = require('@supabase/supabase-js');
const { sendPasswordResetEmail } = require('../utils/email');
const supabaseAuth = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

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

    const { data: authData, error: authError } = await supabaseAuth.auth.signUp({
      email,
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
        email: email,
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
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    // Check broker exists
    const { data: broker } = await supabase
      .from('brokers')
      .select('id')
      .eq('email', email)
      .maybeSingle();

    // Always return success to prevent email enumeration
    if (!broker) {
      return res.status(200).json({
        message: 'If an account exists with this email, you will receive a reset link shortly.'
      });
    }

    // Generate reset token using Supabase admin (doesn't send email)
    const { data, error } = await supabase.auth.admin.generateLink({
      type: 'recovery',
      email: email,
      options: {
        redirectTo: `${process.env.APP_URL}/reset-password.html`
      }
    });

    if (error) {
      console.error('Generate reset link error:', error);
      return res.status(500).json({ error: 'Failed to generate reset link' });
    }

    // Send the email ourselves via Gmail
    const resetUrl = data.properties.action_link;
    await sendPasswordResetEmail(email, resetUrl);

    return res.status(200).json({
      message: 'If an account exists with this email, you will receive a reset link shortly.'
    });

  } catch (error) {
    console.error('Forgot password error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});
// ── RESET PASSWORD ───────────────────────────────────────────
router.post('/reset-password', async (req, res) => {
  try {
    const { password, accessToken } = req.body;

    if (!password || !accessToken) {
      return res.status(400).json({ error: 'Password and token are required' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    // Set the session using the access token from the email link
    // First validate the token and get the user
const { data: userData, error: userError } = await supabaseAuth.auth.getUser(accessToken);
if (userError || !userData?.user) {
    return res.status(401).json({ error: 'Invalid or expired reset link' });
}

// Then update the password using admin client
const { error } = await supabase.auth.admin.updateUserById(
    userData.user.id,
    { password }
);

    if (error) {
      console.error('Update password error:', error);
      return res.status(400).json({ error: 'Failed to update password. Link may have expired.' });
    }

    return res.status(200).json({ message: 'Password updated successfully' });

  } catch (error) {
    console.error('Reset password error:', error);
    return res.status(500).json({ error: 'Internal server error' });
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
router.get('/ping', (req, res) => res.json({ ok: true }));

module.exports = router;
