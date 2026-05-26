
const supabase = require('../config/supabase');

async function verifyAdmin(req, res, next) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.split(' ')[1];

    const { data, error } = await supabase.auth.getUser(token);

    if (error || !data.user) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    const { data: broker, error: brokerError } = await supabase
      .from('brokers')
      .select('*')
      .eq('id', data.user.id)
      .single();



    if (brokerError || !broker) {
      return res.status(403).json({ error: 'User not found' });
    }

    if (broker.role !== 'super_admin') {
      return res.status(403).json({ error: 'Not authorized' });
    }

    req.user = broker;
    next();

  } catch (err) {
    console.error('verifyAdmin CRASH:', err); // this will show the real error
    return res.status(500).json({ error: 'Server error' });
  }
}

module.exports = verifyAdmin;