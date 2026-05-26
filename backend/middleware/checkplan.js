

module.exports = function checkPlan(req, res, next) {
  const broker = req.user;

  // Block if subscription is not active
  if (broker.subscription_status !== 'active') {
    return res.status(403).json({
      error: 'Active subscription required. Please subscribe to continue.',
      paymentRequired: true,
      redirectTo: '/pricing.html'
    });
  }

  // No carrier limits — unlimited plan
  req.planLimit = Infinity;
  req.planName  = 'Pro';

  next();
};