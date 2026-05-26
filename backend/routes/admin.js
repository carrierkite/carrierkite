const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');


/*
  Middleware to ensure user is super admin
*/


/*
  GET ALL BROKERS
*/
router.get('/brokers', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('brokers')
      .select('id, company_name, email, subscription_plan, is_active, created_at')
      .order('created_at', { ascending: false });

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    res.json({ brokers: data });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});


router.patch('/brokers/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { is_active } = req.body;


    if (typeof is_active !== 'boolean') {
      return res.status(400).json({ error: 'Invalid status value' });
    }

    const { data, error } = await supabase
      .from('brokers')
      .update({ is_active })
      .eq('id', id);



    if (error) {
      return res.status(500).json({ error: error.message });
    }

    res.json({ success: true });

  } catch (err) {
    console.error('PATCH CRASH:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.patch('/brokers/:id/plan', async (req, res) => {
  const { id } = req.params;
  const { subscription_plan } = req.body;

  const allowedPlans = ['basic', 'pro', 'enterprise'];
  if (!allowedPlans.includes(subscription_plan)) {
    return res.status(400).json({ error: 'Invalid subscription plan' });
  }

  const { error } = await supabase
    .from('brokers')
    .update({ subscription_plan })
    .eq('id', id);

  if (error) return res.status(500).json({ error: error.message });

  res.json({ success: true });
});


router.get('/analytics', async (req, res) => {
  try {
    const { count: totalBrokers } = await supabase
      .from('brokers')
      .select('*', { count: 'exact', head: true });

    const { count: activeBrokers } = await supabase
      .from('brokers')
      .select('*', { count: 'exact', head: true })
      .eq('is_active', true);

    const { data: plans } = await supabase
      .from('brokers')
      .select('subscription_plan');

    res.json({ totalBrokers, activeBrokers, plans });
  } catch (err) {
    console.error('Analytics error:', err);
    res.status(500).json({ error: 'Failed to load analytics' });
  }
});





module.exports = router;
