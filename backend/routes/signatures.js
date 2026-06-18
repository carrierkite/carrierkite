const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const supabase = require('../config/supabase');
const { sendBrokerNotificationEmail } = require('../utils/email');

const storage = multer.memoryStorage();


const ALLOWED_MIME_TYPES = ['application/pdf', 'image/jpeg', 'image/png'];
const ALLOWED_EXTENSIONS = ['.pdf', '.jpg', '.jpeg', '.png'];

const fileFilter = (req, file, cb) => {
  if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    return cb(new Error(`Invalid file type: ${file.originalname}. Only PDF, JPG, JPEG, and PNG files are allowed.`), false);
  }

  const ext = path.extname(file.originalname).toLowerCase();
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    return cb(new Error(`Invalid file extension: ${file.originalname}. Only .pdf, .jpg, .jpeg, and .png files are accepted.`), false);
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

router.get('/packet/:token', async (req, res) => {
  try {
    const { token } = req.params;

     const { data: packet, error } = await supabase
      .from('packets')
      .select('id, carrier_name, carrier_email, packet_url, status')
      .eq('secure_token', token)
      .maybeSingle();

    if (error || !packet) {
      return res.status(404).json({ error: 'Packet not found or invalid token' });
    }

    return res.status(200).json({ packet });

  } catch (error) {
    console.error('Get packet by token error:', error);
    return res.status(500).json({ error: 'Failed to retrieve packet' });
  }
});

router.post('/submit', upload.fields([
  { name: 'signedPdf',     maxCount: 1 },
  { name: 'mcCertificate', maxCount: 1 },
  { name: 'w9',            maxCount: 1 },
  { name: 'coi',           maxCount: 1 }
]), async (req, res) => {
  try {
    const { token, carrierName, signatureType } = req.body;

    if (!token || !carrierName || !signatureType) {
      return res.status(400).json({ error: 'Token, carrier name, and signature type are required' });
    }

    const { data: packet, error: packetError } = await supabase
      .from('packets')
      .select('*')
      .eq('secure_token', token)
      .maybeSingle();

    if (packetError || !packet) {
      return res.status(404).json({ error: 'Packet not found or invalid token' });
    }

 if (['signed', 'approved', 'rejected'].includes(packet.status)) {
      return res.status(400).json({ error: 'This packet has already been completed and cannot be resubmitted' });
    }

    const signedPdf = req.files?.signedPdf?.[0];
    const mcCert    = req.files?.mcCertificate?.[0];
    const w9        = req.files?.w9?.[0];
    const coi       = req.files?.coi?.[0];

    if (!mcCert || !w9 || !coi) {
      return res.status(400).json({ error: 'MC Certificate, W9, and COI are required' });
    }
async function uploadFile(file, folder) {
  const extFromName = path.extname(file.originalname).toLowerCase();
  const extFromMime = file.mimetype === 'image/jpeg' ? '.jpg' : file.mimetype === 'image/png' ? '.png' : '.pdf';
  const ext = ALLOWED_EXTENSIONS.includes(extFromName) ? extFromName : extFromMime;

  const fileName = `${folder}/${Date.now()}-${uuidv4()}${ext}`;

  const { error } = await supabase.storage
    .from('packets')
    .upload(fileName, file.buffer, { contentType: file.mimetype, upsert: false });

  if (error) throw new Error(`Failed to upload ${folder}: ${error.message}`);

  const { data: { publicUrl } } = supabase.storage.from('packets').getPublicUrl(fileName);
  return publicUrl;
}
    const signedPacketUrl  = signedPdf ? await uploadFile(signedPdf, 'signed') : null;
    const mcCertificateUrl = await uploadFile(mcCert, 'mc-certificates');
    const w9Url            = await uploadFile(w9,     'w9');
    const coiUrl           = await uploadFile(coi,    'coi');

    const { error: signatureError } = await supabase
      .from('signatures')
      .insert([{
        packet_id: packet.id,
        carrier_name: carrierName,
        signature_data: signedPacketUrl || packet.packet_url,
        signature_type: 'upload'
      }]);

    if (signatureError) {
      console.error('Signature creation error:', signatureError);
      return res.status(500).json({ error: 'Failed to save signature' });
    }

    const { error: updateError } = await supabase
      .from('packets')
      .update({
        status: 'signed',
        signed_at: new Date().toISOString(),
        signed_packet_url: signedPacketUrl || packet.packet_url,
        mc_certificate_url: mcCertificateUrl,
        w9_url: w9Url,
        coi_url: coiUrl
      })
      .eq('id', packet.id);

    if (updateError) {
      console.error('Packet update error:', updateError);
      return res.status(500).json({ error: 'Signature saved but failed to update packet status' });
    }

    const { data: broker, error: brokerError } = await supabase
      .from('brokers')
      .select('email')
      .eq('id', packet.broker_id)
      .maybeSingle();

    if (!brokerError && broker) {
      try {
        await sendBrokerNotificationEmail(broker.email, carrierName, packet.id);
      } catch (emailError) {
        console.error('Failed to send notification email:', emailError);
      }
    }

    return res.status(200).json({
      message: 'Packet signed successfully',
      packet: { ...packet, status: 'signed' }
    });

  } catch (error) {
    console.error('Submit signature error:', error);
    return res.status(500).json({ error: 'Failed to submit signature' });
  }
});

router.get('/packet/:packetId/signature', async (req, res) => {
  try {
    const { packetId } = req.params;

    const { data: signature, error } = await supabase
      .from('signatures')
      .select('*')
      .eq('packet_id', packetId)
      .maybeSingle();

    if (error) {
      console.error('Fetch signature error:', error);
      return res.status(500).json({ error: 'Failed to fetch signature' });
    }

    if (!signature) {
      return res.status(404).json({ error: 'Signature not found' });
    }

    return res.status(200).json({ signature });

  } catch (error) {
    console.error('Get signature error:', error);
    return res.status(500).json({ error: 'Failed to retrieve signature' });
  }
});

module.exports = router;
