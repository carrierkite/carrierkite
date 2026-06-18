const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const supabase = require('../config/supabase');
const auth = require('../middleware/auth');
const { sendCarrierSigningEmail, sendReviewEmail } = require('../utils/email');
const checkPlan = require('../middleware/checkplan');


const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
 const allowedMimes = ['application/pdf', 'image/jpeg', 'image/png'];
  const allowedExts = ['.pdf', '.jpg', '.jpeg', '.png'];
  if (!allowedMimes.includes(file.mimetype)) {
    return cb(new Error('Only PDF, JPG, and PNG files are allowed'), false);
  }
  const ext = path.extname(file.originalname).toLowerCase();
  if (!allowedExts.includes(ext)) {
    return cb(new Error('Only .pdf, .jpg, .jpeg, .png files are accepted'), false);
  }
  cb(null, true);
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
  fileSize: 20 * 1024 * 1024
}
});

router.post('/upload', auth, upload.single('packet'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No packet file uploaded' });
    }

    const { carrierEmail, carrierName } = req.body;

    if (!carrierEmail || !carrierName) {
      return res.status(400).json({ error: 'Carrier email and name are required' });
    }

    const ext = path.extname(req.file.originalname).toLowerCase();
    const fileName = `${req.user.id}/${Date.now()}-${uuidv4()}${ext}`;

    const { error: uploadError } = await supabase.storage
      .from('packets')
      .upload(fileName, req.file.buffer, {
        contentType: req.file.mimetype,
        upsert: false
      });

    if (uploadError) {
      console.error('Supabase storage upload error:', uploadError);
      return res.status(500).json({ error: 'Failed to upload file' });
    }

    const { data: { publicUrl } } = supabase.storage
      .from('packets')
      .getPublicUrl(fileName);

    const secureToken = uuidv4();

    const { data: packet, error: packetError } = await supabase
      .from('packets')
      .insert([{
        broker_id: req.user.id,
        carrier_email: carrierEmail,
        carrier_name: carrierName,
        packet_url: publicUrl,
        status: 'pending',
        secure_token: secureToken
      }])
      .select()
      .single();

    if (packetError) {
      console.error('Packet creation error:', packetError);
      return res.status(500).json({ error: 'Failed to create packet record' });
    }

    return res.status(201).json({
      message: 'Packet uploaded successfully',
      packet
    });

  } catch (error) {
    console.error('Upload error:', error);
    return res.status(500).json({ error: 'Failed to upload packet' });
  }
});
router.post('/templates/save', auth, upload.single('packet'), async (req, res) => {
  try {
    const { name } = req.body;

    if (!name) return res.status(400).json({ error: 'Template name is required' });

    let packetUrl;

    // Either upload a new file or save from existing packet_url
    if (req.file) {
  const ext = path.extname(req.file.originalname).toLowerCase();
  const fileName = `${req.user.id}/${Date.now()}-${uuidv4()}${ext}`;
  const { error: uploadError } = await supabase.storage
    .from('packets')
    .upload(fileName, req.file.buffer, { contentType: req.file.mimetype, upsert: false });
  if (uploadError) return res.status(500).json({ error: 'Failed to upload template file' });
  const { data: { publicUrl } } = supabase.storage.from('packets').getPublicUrl(fileName);
  packetUrl = publicUrl;
}else if (req.body.packet_url) {
      packetUrl = req.body.packet_url;
    } else {
      return res.status(400).json({ error: 'No file or packet URL provided' });
    }

    const { data, error } = await supabase
      .from('packet_templates')
      .insert([{ broker_id: req.user.id, name, packet_url: packetUrl }])
      .select()
      .single();

    if (error) return res.status(500).json({ error: 'Failed to save template' });

    return res.status(201).json({ message: 'Template saved', template: data });

  } catch (err) {
    console.error('Save template error:', err);
    return res.status(500).json({ error: 'Failed to save template' });
  }
});

// ── GET ALL TEMPLATES ─────────────────────────────────────────
router.get('/templates/list', auth, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('packet_templates')
      .select('*')
      .eq('broker_id', req.user.id)
      .order('created_at', { ascending: false });

    if (error) return res.status(500).json({ error: 'Failed to fetch templates' });

    return res.status(200).json({ templates: data || [] });

  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch templates' });
  }
});

// ── DELETE TEMPLATE ───────────────────────────────────────────
router.delete('/templates/:templateId', auth, async (req, res) => {
  try {
    const { templateId } = req.params;

    const { data: template } = await supabase
      .from('packet_templates')
      .select('*')
      .eq('id', templateId)
      .eq('broker_id', req.user.id)
      .maybeSingle();

    if (!template) return res.status(404).json({ error: 'Template not found' });

await supabase.from('packet_templates').delete().eq('id', templateId);

// Also remove the file from storage
if (template.packet_url) {
    const filePath = template.packet_url.split('/packets/')[1];
    if (filePath) {
        await supabase.storage.from('packets').remove([filePath]);
    }
}

return res.status(200).json({ message: 'Template deleted' });

  } catch (err) {
    return res.status(500).json({ error: 'Failed to delete template' });
  }
});

// ── UPLOAD USING TEMPLATE ─────────────────────────────────────
router.post('/upload-from-template', auth, async (req, res) => {
  try {
    const { carrierEmail, carrierName, templateId } = req.body;

    if (!carrierEmail || !carrierName || !templateId) {
      return res.status(400).json({ error: 'Carrier email, name, and template are required' });
    }

    const { data: template } = await supabase
      .from('packet_templates')
      .select('*')
      .eq('id', templateId)
      .eq('broker_id', req.user.id)
      .maybeSingle();

    if (!template) return res.status(404).json({ error: 'Template not found' });

    const secureToken = uuidv4();

    const { data: packet, error: packetError } = await supabase
      .from('packets')
      .insert([{
        broker_id: req.user.id,
        carrier_email: carrierEmail,
        carrier_name: carrierName,
        packet_url: template.packet_url,
        status: 'pending',
        secure_token: secureToken
      }])
      .select()
      .single();

    if (packetError) return res.status(500).json({ error: 'Failed to create packet' });

    return res.status(201).json({ message: 'Packet created from template', packet });

  } catch (err) {
    console.error('Upload from template error:', err);
    return res.status(500).json({ error: 'Failed to create packet from template' });
  }
});


router.post('/:packetId/send', auth, checkPlan, async (req, res) => {
  try {
    const { packetId } = req.params;

    // 1. Fetch and validate packet belongs to this broker
    const { data: packet, error: fetchError } = await supabase
      .from('packets')
      .select('*')
      .eq('id', packetId)
      .eq('broker_id', req.user.id)
      .maybeSingle();

    if (fetchError || !packet) {
      return res.status(404).json({ error: 'Packet not found' });
    }

    // 2. Check if already sent/signed
    if (packet.status === 'sent' || packet.status === 'signed') {
      return res.status(400).json({
        error: `Packet has already been ${packet.status}`
      });
    }

    // 3. Check plan limit
    const { data: activePackets } = await supabase
      .from('packets')
      .select('id')
      .eq('broker_id', req.user.id)
      .in('status', ['sent', 'signed', 'approved']);

    if (activePackets && activePackets.length >= req.planLimit) {
      return res.status(403).json({
        error: `Your ${req.planName} plan allows up to ${req.planLimit} active carriers. Upgrade to send to more.`,
        upgradeRequired: true
      });
    }

    // 4. Update DB first, then send email
    const { error: updateError } = await supabase
      .from('packets')
      .update({
        status: 'sent',
        sent_at: new Date().toISOString()
      })
      .eq('id', packetId);

    if (updateError) {
      return res.status(500).json({
        error: 'Failed to update packet status'
      });
    }

    await sendCarrierSigningEmail(
      packet.carrier_email,
      packet.carrier_name,
      packet.id,
      packet.secure_token
    );

    return res.status(200).json({
      message: 'Packet sent to carrier successfully',
      packet: { ...packet, status: 'sent' }
    });

  } catch (error) {
    console.error('Send packet error:', error);
    return res.status(500).json({ error: 'Failed to send packet to carrier' });
  }
});

router.patch('/:packetId/review', auth, async (req, res) => {
  try {
    const { packetId } = req.params;
    const { action, rejection_reason } = req.body; // action = 'approved' or 'rejected'

    if (!['approved', 'rejected'].includes(action)) {
      return res.status(400).json({ error: 'Invalid action' });
    }

    // Make sure packet belongs to this broker
    const { data: packet, error: fetchError } = await supabase
      .from('packets')
      .select('*')
      .eq('id', packetId)
      .eq('broker_id', req.user.id)
      .maybeSingle();

    if (fetchError || !packet) {
      return res.status(404).json({ error: 'Packet not found' });
    }

    if (packet.status !== 'signed') {
      return res.status(400).json({ error: 'Can only review signed packets' });
    }

    const { error: updateError } = await supabase
      .from('packets')
      .update({
        status: action,
        reviewed_at: new Date().toISOString(),
        rejection_reason: action === 'rejected' ? rejection_reason : null
      })
      .eq('id', packetId);

    if (updateError) {
      return res.status(500).json({ error: updateError.message });
    }

    // Send email to carrier
    try {
  await sendReviewEmail(
    packet.carrier_email,
    packet.carrier_name,
    action,
    rejection_reason
  );
} catch (emailErr) {
  console.error('Failed to send review email:', emailErr);
}

return res.status(200).json({ success: true, status: action });

  } catch (err) {
    console.error('Review error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
});


router.get('/', auth, async (req, res) => {
  try {
    const { data: packets, error } = await supabase
      .from('packets')
      .select('*')
      .eq('broker_id', req.user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Fetch packets error:', error);
      return res.status(500).json({ error: 'Failed to fetch packets' });
    }

    return res.status(200).json({
      packets: packets || []
    });

  } catch (error) {
    console.error('Get packets error:', error);
    return res.status(500).json({ error: 'Failed to retrieve packets' });
  }
});

router.get('/:packetId', auth, async (req, res) => {
  try {
    const { packetId } = req.params;

    const { data: packet, error } = await supabase
      .from('packets')
      .select('*')
      .eq('id', packetId)
      .eq('broker_id', req.user.id)
      .maybeSingle();

    if (error || !packet) {
      return res.status(404).json({ error: 'Packet not found' });
    }

    return res.status(200).json({ packet });

  } catch (error) {
    console.error('Get packet error:', error);
    return res.status(500).json({ error: 'Failed to retrieve packet' });
  }
});




module.exports = router;
