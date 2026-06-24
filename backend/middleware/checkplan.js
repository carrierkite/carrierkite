module.exports = function checkPlan(req, res, next) {
  const broker = req.user;

  if (!broker) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (broker.role === 'super_admin') {
    req.planLimit = Infinity;
    req.planName = 'Admin';
    return next();
  }

  if (broker.subscription_status !== 'active' || broker.is_active !== true) {
    return res.status(403).json({
      error: 'Active subscription required. Please subscribe to continue.',
      paymentRequired: true,
      redirectTo: '/pricing.html'
    });
  }

  req.planLimit = Infinity;
  req.planName = 'Pro';

  next();
};
