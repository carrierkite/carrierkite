const express = require('express');
const router = express.Router();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const supabase = require('../config/supabase');

// TEMP: Payments disabled for testing
router.all('*', (req, res) => {
  res.status(503).json({ error: 'Payments not available yet.' });
});
module.exports = router;

// ── CREATE CHECKOUT SESSION ──────────────────────────────────
// No auth middleware — account is inactive at this point
router.post('/create-checkout-session', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'Unauthorized' });

    const token = authHeader.replace('Bearer ', '');

    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError || !userData.user) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    const { data: broker } = await supabase
      .from('brokers')
      .select('*')
      .eq('id', userData.user.id)
      .maybeSingle();



    if (!broker) {
      return res.status(404).json({ error: 'Account not found' });
    }

    if (broker.subscription_status === 'active') {
      return res.status(400).json({ error: 'You already have an active subscription.' });
    }

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'subscription',
      line_items: [{
        price: process.env.STRIPE_PRICE_ID,
        quantity: 1
      }],
      customer_email: broker.email,
      metadata: { broker_id: broker.id },
      success_url: `${process.env.APP_URL}/dashboard.html?payment=success`,
      cancel_url:  `${process.env.APP_URL}/index.html?payment=cancelled`
    });

    return res.status(200).json({ url: session.url });

  } catch (err) {
    console.error('Checkout session error:', err);
    return res.status(500).json({ error: 'Failed to create checkout session' });
  }
});
// ── STRIPE WEBHOOK ───────────────────────────────────────────
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error('Webhook signature error:', err.message);
    return res.status(400).json({ error: `Webhook Error: ${err.message}` });
  }

  try {
    switch (event.type) {

      case 'checkout.session.completed': {
        const session    = event.data.object;
        const brokerId   = session.metadata.broker_id;
        const customerId = session.customer;

        const { error } = await supabase
          .from('brokers')
          .update({
            subscription_status: 'active',
            subscription_plan:   'pro',
            stripe_customer_id:  customerId,
            is_active:           true
          })
          .eq('id', brokerId);

        if (error) console.error('Failed to activate broker:', error);
        else console.log(`✅ Broker activated: ${brokerId}`);
        break;
      }

      case 'invoice.payment_succeeded': {
        const invoice    = event.data.object;
        const customerId = invoice.customer;

        await supabase
          .from('brokers')
          .update({ subscription_status: 'active', is_active: true })
          .eq('stripe_customer_id', customerId);

        console.log(`✅ Subscription renewed: ${customerId}`);
        break;
      }

      case 'invoice.payment_failed': {
        const invoice    = event.data.object;
        const customerId = invoice.customer;

        await supabase
          .from('brokers')
          .update({ subscription_status: 'past_due' })
          .eq('stripe_customer_id', customerId);

        console.log(`⚠️ Payment failed: ${customerId}`);
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object;
        const customerId   = subscription.customer;

        await supabase
          .from('brokers')
          .update({
            subscription_status: 'cancelled',
            subscription_plan:   'free',
            is_active:           false
          })
          .eq('stripe_customer_id', customerId);

        console.log(`❌ Subscription cancelled: ${customerId}`);
        break;
      }
    }

    return res.status(200).json({ received: true });

  } catch (err) {
    console.error('Webhook handler error:', err);
    return res.status(500).json({ error: 'Webhook handler failed' });
  }
});

// ── CANCEL SUBSCRIPTION ──────────────────────────────────────
router.post('/cancel-subscription', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'Unauthorized' });

    const token = authHeader.replace('Bearer ', '');
    const { data: userData } = await supabase.auth.getUser(token);
    if (!userData?.user) return res.status(401).json({ error: 'Invalid token' });

    const { data: broker } = await supabase
      .from('brokers')
      .select('*')
      .eq('id', userData.user.id)
      .maybeSingle();

    if (!broker?.stripe_customer_id) {
      return res.status(400).json({ error: 'No active subscription found.' });
    }

    const subscriptions = await stripe.subscriptions.list({
      customer: broker.stripe_customer_id,
      status: 'active'
    });

    if (subscriptions.data.length === 0) {
      return res.status(400).json({ error: 'No active subscription found.' });
    }

    await stripe.subscriptions.update(subscriptions.data[0].id, {
      cancel_at_period_end: true
    });

    return res.status(200).json({
      message: 'Subscription will be cancelled at end of billing period.'
    });

  } catch (err) {
    console.error('Cancel subscription error:', err);
    return res.status(500).json({ error: 'Failed to cancel subscription' });
  }
});

module.exports = router;