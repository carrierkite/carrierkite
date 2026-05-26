const { Resend } = require('resend');
require('dotenv').config();

const resend = new Resend(process.env.RESEND_API_KEY);

const FROM = 'Verifreight <noreply@carrierkite.com>';

async function sendCarrierSigningEmail(carrierEmail, carrierName, packetId, secureToken) {
  const signingUrl = `${process.env.APP_URL}/sign.html?token=${secureToken}`;
  await resend.emails.send({
    from: FROM,
    to: carrierEmail,
    subject: 'Carrier Packet - Signature Required',
    html: `
      <!DOCTYPE html>
      <html>
      <body style="margin:0;padding:0;background:#f4f4f4;font-family:Arial,sans-serif;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f4;padding:30px 0;">
          <tr>
            <td align="center">
              <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.1);">
                <tr>
                  <td style="background:#1a1a1a;padding:30px;text-align:center;">
                    <h1 style="margin:0;color:#d4af37;font-size:24px;font-weight:700;">Verifreight</h1>
                    <p style="margin:8px 0 0;color:#999;font-size:14px;">Carrier Packet Signature Request</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding:40px 40px 20px;">
                    <p style="margin:0 0 16px;font-size:16px;color:#333;">Hello <strong>${carrierName}</strong>,</p>
                    <p style="margin:0 0 16px;font-size:15px;color:#555;line-height:1.6;">
                      You have received a carrier packet that requires your signature and documents.
                    </p>
                    <p style="margin:0 0 24px;font-size:15px;color:#555;line-height:1.6;">
                      Please click the button below to review and submit your documents:
                    </p>
                    <table cellpadding="0" cellspacing="0" width="100%">
                      <tr>
                        <td align="center" style="padding:10px 0 30px;">
                          <a href="${signingUrl}"
                             style="display:inline-block;padding:16px 40px;background-color:#4CAF50;color:#ffffff;text-decoration:none;border-radius:6px;font-size:16px;font-weight:700;">
                            View and Sign Packet
                          </a>
                        </td>
                      </tr>
                    </table>
                    <p style="margin:0 0 8px;font-size:14px;color:#777;">Or copy and paste this link:</p>
                    <p style="margin:0 0 24px;font-size:13px;color:#555;word-break:break-all;background:#f8f8f8;padding:12px;border:1px solid #e0e0e0;border-radius:4px;">
                      ${signingUrl}
                    </p>
                    <p style="margin:0;font-size:13px;color:#999;border-top:1px solid #eee;padding-top:20px;">
                      <strong style="color:#555;">Important:</strong> This link is unique to you and should not be shared.
                    </p>
                  </td>
                </tr>
                <tr>
                  <td style="background:#f8f8f8;padding:20px;text-align:center;border-top:1px solid #eee;">
                    <p style="margin:0;font-size:12px;color:#999;">This is an automated email from Verifreight. Please do not reply.</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `
  });
}

async function sendBrokerNotificationEmail(brokerEmail, carrierName, packetId) {
  await resend.emails.send({
    from: FROM,
    to: brokerEmail,
    subject: 'Carrier Packet Signed - Notification',
    html: `
      <!DOCTYPE html>
      <html>
      <body style="margin:0;padding:0;background:#f4f4f4;font-family:Arial,sans-serif;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f4;padding:30px 0;">
          <tr><td align="center">
            <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;">
              <tr><td style="background:#1a1a1a;padding:30px;text-align:center;">
                <h1 style="margin:0;color:#d4af37;font-size:24px;">Verifreight</h1>
              </td></tr>
              <tr><td style="padding:40px;">
                <p style="font-size:16px;color:#333;">Good news!</p>
                <p style="font-size:15px;color:#555;"><strong>${carrierName}</strong> has signed the carrier packet.</p>
                <p style="font-size:15px;color:#555;">You can review it in your dashboard.</p>
                <p style="text-align:center;">
                  <a href="${process.env.APP_URL}/dashboard.html"
                     style="display:inline-block;padding:12px 24px;background:#d4af37;color:#000;text-decoration:none;border-radius:4px;font-weight:bold;">
                    View Dashboard
                  </a>
                </p>
              </td></tr>
              <tr><td style="background:#f8f8f8;padding:20px;text-align:center;border-top:1px solid #eee;">
                <p style="margin:0;font-size:12px;color:#999;">Automated notification from Verifreight.</p>
              </td></tr>
            </table>
          </td></tr>
        </table>
      </body>
      </html>
    `
  });
}

async function sendReviewEmail(carrierEmail, carrierName, action, rejectionReason) {
  const isApproved = action === 'approved';
  await resend.emails.send({
    from: FROM,
    to: carrierEmail,
    subject: isApproved ? 'Your documents have been approved' : 'Your documents need attention',
    html: isApproved ? `
      <!DOCTYPE html>
      <html>
      <body style="margin:0;padding:0;background:#f4f4f4;font-family:Arial,sans-serif;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f4;padding:30px 0;">
          <tr><td align="center">
            <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;">
              <tr><td style="background:#1a1a1a;padding:30px;text-align:center;">
                <h1 style="margin:0;color:#d4af37;font-size:24px;">Verifreight</h1>
              </td></tr>
              <tr><td style="padding:40px;">
                <p style="font-size:16px;color:#333;">Hello <strong>${carrierName}</strong>,</p>
                <p style="font-size:15px;color:#555;">Your documents have been <strong style="color:#4CAF50;">approved</strong>. You are cleared to proceed!</p>
              </td></tr>
              <tr><td style="background:#f8f8f8;padding:20px;text-align:center;border-top:1px solid #eee;">
                <p style="margin:0;font-size:12px;color:#999;">Automated email from Verifreight. Please do not reply.</p>
              </td></tr>
            </table>
          </td></tr>
        </table>
      </body>
      </html>
    ` : `
      <!DOCTYPE html>
      <html>
      <body style="margin:0;padding:0;background:#f4f4f4;font-family:Arial,sans-serif;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f4;padding:30px 0;">
          <tr><td align="center">
            <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;">
              <tr><td style="background:#1a1a1a;padding:30px;text-align:center;">
                <h1 style="margin:0;color:#d4af37;font-size:24px;">Verifreight</h1>
              </td></tr>
              <tr><td style="padding:40px;">
                <p style="font-size:16px;color:#333;">Hello <strong>${carrierName}</strong>,</p>
                <p style="font-size:15px;color:#555;">Your submitted documents require attention.</p>
                ${rejectionReason ? `<p style="font-size:15px;color:#555;"><strong>Reason:</strong> ${rejectionReason}</p>` : ''}
                <p style="font-size:15px;color:#555;">Please contact your broker for further instructions.</p>
              </td></tr>
              <tr><td style="background:#f8f8f8;padding:20px;text-align:center;border-top:1px solid #eee;">
                <p style="margin:0;font-size:12px;color:#999;">Automated email from Verifreight. Please do not reply.</p>
              </td></tr>
            </table>
          </td></tr>
        </table>
      </body>
      </html>
    `
  });
}

async function sendPasswordResetEmail(email, resetUrl) {
  await resend.emails.send({
    from: FROM,
    to: email,
    subject: 'Reset Your Verifreight Password',
    html: `
      <!DOCTYPE html>
      <html>
      <body style="margin:0;padding:0;background:#f4f4f4;font-family:Arial,sans-serif;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f4;padding:30px 0;">
          <tr><td align="center">
            <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;">
              <tr><td style="background:#d4af37;padding:30px;text-align:center;">
                <h1 style="margin:0;color:#000;font-size:24px;">Password Reset Request</h1>
              </td></tr>
              <tr><td style="padding:40px;">
                <p style="font-size:15px;color:#555;">We received a request to reset your Verifreight password.</p>
                <p style="font-size:15px;color:#555;">Click below to reset it. This link expires in <strong>1 hour</strong>.</p>
                <p style="text-align:center;">
                  <a href="${resetUrl}"
                     style="display:inline-block;padding:12px 24px;background:#d4af37;color:#000;text-decoration:none;border-radius:4px;font-weight:bold;">
                    Reset My Password
                  </a>
                </p>
                <p style="font-size:13px;color:#777;word-break:break-all;background:#f8f8f8;padding:10px;border:1px solid #ddd;">${resetUrl}</p>
                <p style="font-size:13px;color:#999;"><strong>If you didn't request this, ignore this email.</strong></p>
              </td></tr>
              <tr><td style="background:#f8f8f8;padding:20px;text-align:center;border-top:1px solid #eee;">
                <p style="margin:0;font-size:12px;color:#999;">Automated email from Verifreight. Do not reply.</p>
              </td></tr>
            </table>
          </td></tr>
        </table>
      </body>
      </html>
    `
  });
}

async function sendVerificationEmail(email, verifyUrl) {
  await resend.emails.send({
    from: FROM,
    to: email,
    subject: 'Verify Your Verifreight Account',
    html: `
      <!DOCTYPE html>
      <html>
      <body style="margin:0;padding:0;background:#f4f4f4;font-family:Arial,sans-serif;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f4;padding:30px 0;">
          <tr><td align="center">
            <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;">
              <tr><td style="background:#d4af37;padding:30px;text-align:center;">
                <h1 style="margin:0;color:#000;font-size:24px;">Verify Your Email</h1>
              </td></tr>
              <tr><td style="padding:40px;">
                <p style="font-size:15px;color:#555;">Welcome to Verifreight! Please verify your email to activate your account.</p>
                <p style="text-align:center;">
                  <a href="${verifyUrl}"
                     style="display:inline-block;padding:12px 24px;background:#d4af37;color:#000;text-decoration:none;border-radius:4px;font-weight:bold;">
                    Verify My Email
                  </a>
                </p>
                <p style="font-size:13px;color:#777;">This link expires in <strong>24 hours</strong>.</p>
              </td></tr>
              <tr><td style="background:#f8f8f8;padding:20px;text-align:center;border-top:1px solid #eee;">
                <p style="margin:0;font-size:12px;color:#999;">Automated email from Verifreight. Do not reply.</p>
              </td></tr>
            </table>
          </td></tr>
        </table>
      </body>
      </html>
    `
  });
}

module.exports = {
  sendCarrierSigningEmail,
  sendBrokerNotificationEmail,
  sendReviewEmail,
  sendPasswordResetEmail,
  sendVerificationEmail
};
