
const supabase = require('../config/supabase');


module.exports = async function auth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const token = authHeader.split(' ')[1];

    // Validate Supabase JWT
    const { data, error } = await supabase.auth.getUser(token);

    if (error || !data.user) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    // Fetch broker record
    const { data: broker, error: brokerError } = await supabase
      .from('brokers')
      .select('*')
      .eq('id', data.user.id)
      .single();

    if (brokerError || !broker) {
      return res.status(401).json({ error: 'Broker not found' });
    }

    if (!broker.is_active) {
      return res.status(403).json({ error: 'Account disabled' });
    }

    req.user = broker;
    
    next();
  } catch (err) {
    return res.status(500).json({ error: 'Server error' });
  }
};
