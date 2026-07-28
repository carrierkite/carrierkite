const { Resend } = require('resend');
require('dotenv').config();

const resend = new Resend(process.env.RESEND_API_KEY);

const FROM = 'CarrierKite <noreply@carrierkite.com>';

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// async function sendCarrierSigningEmail(carrierEmail, carrierName, packetId, secureToken) {
//   const signingUrl = `${process.env.APP_URL}/sign.html?token=${secureToken}`;
//   await resend.emails.send({
//     from: FROM,
//     to: carrierEmail,
//     subject: 'Carrier Packet - Signature Required',
//     html: `
//       <!DOCTYPE html>
//       <html>
//       <body style="margin:0;padding:0;background:#f4f4f4;font-family:Arial,sans-serif;">
//         <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f4;padding:30px 0;">
//           <tr>
//             <td align="center">
//               <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.1);">
//                 <tr>
//                   <td style="background:#1a1a1a;padding:30px;text-align:center;">
//                     <h1 style="margin:0;color:#d4af37;font-size:24px;font-weight:700;">CarrierKite</h1>
//                     <p style="margin:8px 0 0;color:#999;font-size:14px;">Carrier Packet Signature Request</p>
//                   </td>
//                 </tr>
//                 <tr>
//                   <td style="padding:40px 40px 20px;">
//                     <p style="margin:0 0 16px;font-size:16px;color:#333;">Hello <strong>${carrierName}</strong>,</p>
//                     <p style="margin:0 0 16px;font-size:15px;color:#555;line-height:1.6;">
//                       You have received a carrier packet that requires your signature and documents.
//                     </p>
//                     <p style="margin:0 0 24px;font-size:15px;color:#555;line-height:1.6;">
//                       Please click the button below to review and submit your documents:
//                     </p>
//                     <table cellpadding="0" cellspacing="0" width="100%">
//                       <tr>
//                         <td align="center" style="padding:10px 0 30px;">
//                           <a href="${signingUrl}"
//                              style="display:inline-block;padding:16px 40px;background-color:#4CAF50;color:#ffffff;text-decoration:none;border-radius:6px;font-size:16px;font-weight:700;">
//                             View and Sign Packet
//                           </a>
//                         </td>
//                       </tr>
//                     </table>
//                     <p style="margin:0 0 8px;font-size:14px;color:#777;">Or copy and paste this link:</p>
//                     <p style="margin:0 0 24px;font-size:13px;color:#555;word-break:break-all;background:#f8f8f8;padding:12px;border:1px solid #e0e0e0;border-radius:4px;">
//                       ${signingUrl}
//                     </p>
//                     <p style="margin:0;font-size:13px;color:#999;border-top:1px solid #eee;padding-top:20px;">
//                       <strong style="color:#555;">Important:</strong> This link is unique to you and should not be shared.
//                     </p>
//                   </td>
//                 </tr>
//                 <tr>
//                   <td style="background:#f8f8f8;padding:20px;text-align:center;border-top:1px solid #eee;">
//                     <p style="margin:0;font-size:12px;color:#999;">This is an automated email from CarrierKite. Please do not reply.</p>
//                   </td>
//                 </tr>
//               </table>
//             </td>
//           </tr>
//         </table>
//       </body>
//       </html>
//     `
//   });
// }

async function sendCarrierSigningEmail(carrierEmail, carrierName, packetId, secureToken, brokerDetails = {}) {
  const signingUrl = `${process.env.APP_URL}/sign.html?token=${secureToken}`;

  const safeCarrierName = escapeHtml(carrierName);
  const brokerCompany = escapeHtml(
    brokerDetails.companyName ||
    brokerDetails.company_name ||
    'your broker'
  );
  const brokerEmail = escapeHtml(
    brokerDetails.email ||
    brokerDetails.brokerEmail ||
    ''
  );

  const subjectCompany = brokerDetails.companyName || brokerDetails.company_name || 'Your Broker';

  await resend.emails.send({
    from: FROM,
    to: carrierEmail,

    // If the carrier replies, it goes to the broker directly.
    ...(brokerEmail ? { reply_to: brokerEmail } : {}),

    subject: `Action Required: Carrier packet from ${subjectCompany}`,
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
                    <h1 style="margin:0;color:#d4af37;font-size:24px;font-weight:700;">CarrierKite</h1>
                    <p style="margin:8px 0 0;color:#999;font-size:14px;">Carrier Packet Signature Request</p>
                  </td>
                </tr>

                <tr>
                  <td style="padding:40px 40px 20px;">
                    <p style="margin:0 0 16px;font-size:16px;color:#333;">
                      Hello <strong>${safeCarrierName}</strong>,
                    </p>

                    <p style="margin:0 0 16px;font-size:15px;color:#555;line-height:1.6;">
                      You have received a carrier packet from 
                      <strong style="color:#333;">${brokerCompany}</strong>
                      that requires your signature and documents.
                    </p>

                    <table width="100%" cellpadding="0" cellspacing="0" style="margin:22px 0;background:#f9f7ef;border:1px solid #eadca8;border-radius:8px;">
                      <tr>
                        <td style="padding:18px;">
                          <p style="margin:0 0 10px;font-size:15px;color:#333;font-weight:700;">
                            Broker Details
                          </p>

                          <p style="margin:0 0 6px;font-size:14px;color:#555;line-height:1.5;">
                            <strong>Company:</strong> ${brokerCompany}
                          </p>

                          ${brokerEmail ? `
                          <p style="margin:0;font-size:14px;color:#555;line-height:1.5;">
                            <strong>Email:</strong>
                            <a href="mailto:${brokerEmail}" style="color:#b8941f;text-decoration:none;">
                              ${brokerEmail}
                            </a>
                          </p>
                          ` : ''}
                        </td>
                      </tr>
                    </table>

                    <p style="margin:0 0 16px;font-size:15px;color:#555;line-height:1.6;">
                      Please click the button below to review the packet and submit your documents.
                    </p>

                    <p style="margin:0 0 24px;font-size:15px;color:#555;line-height:1.6;">
                      If you have any questions, notice incorrect information, or need further assistance,
                      please contact <strong>${brokerCompany}</strong>${brokerEmail ? ` directly at <a href="mailto:${brokerEmail}" style="color:#b8941f;text-decoration:none;">${brokerEmail}</a>` : ' directly'}.
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

                    <p style="margin:0;font-size:13px;color:#999;border-top:1px solid #eee;padding-top:20px;line-height:1.6;">
                      <strong style="color:#555;">Important:</strong>
                      This link is unique to you and should not be shared.
                      CarrierKite is the secure software platform used to deliver and collect this packet.
                      For packet-specific questions, contact your broker directly.
                    </p>
                  </td>
                </tr>

                <tr>
                  <td style="background:#f8f8f8;padding:20px;text-align:center;border-top:1px solid #eee;">
                    <p style="margin:0 0 6px;font-size:12px;color:#777;">
                      Sent on behalf of <strong>${brokerCompany}</strong>${brokerEmail ? ` · ${brokerEmail}` : ''}
                    </p>
                    <p style="margin:0;font-size:12px;color:#999;">
                      Automated email from CarrierKite. Replies may be directed to your broker.
                    </p>
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
                <h1 style="margin:0;color:#d4af37;font-size:24px;">CarrierKite</h1>
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
                <p style="margin:0;font-size:12px;color:#999;">Automated notification from CarrierKite.</p>
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
                <h1 style="margin:0;color:#d4af37;font-size:24px;">CarrierKite</h1>
              </td></tr>
              <tr><td style="padding:40px;">
                <p style="font-size:16px;color:#333;">Hello <strong>${carrierName}</strong>,</p>
                <p style="font-size:15px;color:#555;">Your documents have been <strong style="color:#4CAF50;">approved</strong>. You are cleared to proceed!</p>
              </td></tr>
              <tr><td style="background:#f8f8f8;padding:20px;text-align:center;border-top:1px solid #eee;">
                <p style="margin:0;font-size:12px;color:#999;">Automated email from CarrierKite. Please do not reply.</p>
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
                <h1 style="margin:0;color:#d4af37;font-size:24px;">CarrierKite</h1>
              </td></tr>
              <tr><td style="padding:40px;">
                <p style="font-size:16px;color:#333;">Hello <strong>${carrierName}</strong>,</p>
                <p style="font-size:15px;color:#555;">Your submitted documents require attention.</p>
                ${rejectionReason ? `<p style="font-size:15px;color:#555;"><strong>Reason:</strong> ${rejectionReason}</p>` : ''}
                <p style="font-size:15px;color:#555;">Please contact your broker for further instructions.</p>
              </td></tr>
              <tr><td style="background:#f8f8f8;padding:20px;text-align:center;border-top:1px solid #eee;">
                <p style="margin:0;font-size:12px;color:#999;">Automated email from CarrierKite. Please do not reply.</p>
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
  const safeResetUrl = escapeHtml(resetUrl);

  const { data, error } = await resend.emails.send({
    from: FROM,
    to: email,
    subject: 'Reset Your CarrierKite Password',
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
                <p style="font-size:15px;color:#555;">We received a request to reset your CarrierKite password.</p>
                <p style="font-size:15px;color:#555;">Click below to reset it. This link expires in <strong>1 hour</strong>.</p>
                <p style="text-align:center;">
                  <a href="${safeResetUrl}"
                     style="display:inline-block;padding:12px 24px;background:#d4af37;color:#000;text-decoration:none;border-radius:4px;font-weight:bold;">
                    Reset My Password
                  </a>
                </p>
                <p style="font-size:13px;color:#777;word-break:break-all;background:#f8f8f8;padding:10px;border:1px solid #ddd;">${resetUrl}</p>
                <p style="font-size:13px;color:#999;"><strong>If you didn't request this, ignore this email.</strong></p>
              </td></tr>
              <tr><td style="background:#f8f8f8;padding:20px;text-align:center;border-top:1px solid #eee;">
                <p style="margin:0;font-size:12px;color:#999;">Automated email from CarrierKite. Do not reply.</p>
              </td></tr>
            </table>
          </td></tr>
        </table>
      </body>
      </html>
    `
  });

  if (error) {
    throw new Error(
      error.message ||
      'Password reset email delivery failed'
    );
  }

  return data;
}

async function sendVerificationEmail(email, verifyUrl) {
  await resend.emails.send({
    from: FROM,
    to: email,
    subject: 'Verify Your CarrierKite Account',
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
                <p style="font-size:15px;color:#555;">Welcome to CarrierKite! Please verify your email to activate your account.</p>
                <p style="text-align:center;">
                  <a href="${verifyUrl}"
                     style="display:inline-block;padding:12px 24px;background:#d4af37;color:#000;text-decoration:none;border-radius:4px;font-weight:bold;">
                    Verify My Email
                  </a>
                </p>
                <p style="font-size:13px;color:#777;">This link expires in <strong>24 hours</strong>.</p>
              </td></tr>
              <tr><td style="background:#f8f8f8;padding:20px;text-align:center;border-top:1px solid #eee;">
                <p style="margin:0;font-size:12px;color:#999;">Automated email from CarrierKite. Do not reply.</p>
              </td></tr>
            </table>
          </td></tr>
        </table>
      </body>
      </html>
    `
  });
}

async function sendSubscriptionThankYouEmail(brokerEmail, companyName) {
  const safeCompany = escapeHtml(companyName || 'Valued Broker');
  const dashboardUrl = `${process.env.APP_URL}/dashboard.html`;

  await resend.emails.send({
    from: FROM,
    to: brokerEmail,
    subject: 'Thank you for subscribing to CarrierKite!',
    html: `
      <!DOCTYPE html>
      <html>
      <body style="margin:0;padding:0;background:#f4f4f4;font-family:Arial,sans-serif;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f4;padding:30px 0;">
          <tr><td align="center">
            <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.1);">
              <tr><td style="background:#1a1a1a;padding:30px;text-align:center;">
                <h1 style="margin:0;color:#d4af37;font-size:24px;font-weight:700;">CarrierKite</h1>
                <p style="margin:8px 0 0;color:#999;font-size:14px;">Subscription Activated</p>
              </td></tr>
              <tr><td style="padding:40px;">
                <p style="font-size:16px;color:#333;margin:0 0 16px;">Hello <strong>${safeCompany}</strong>,</p>
                <p style="font-size:15px;color:#555;line-height:1.6;margin:0 0 16px;">
                  Thank you so much for purchasing your <strong>CarrierKite</strong> subscription! Your account is now fully active, and you have access to all professional features, including unlimited carrier packets, secure digital signatures, and instant notifications.
                </p>
                <p style="font-size:15px;color:#555;line-height:1.6;margin:0 0 24px;">
                  You can jump right into your dashboard to start sending packets and onboarding carriers:
                </p>
                <p style="text-align:center;margin:0 0 24px;">
                  <a href="${dashboardUrl}"
                     style="display:inline-block;padding:14px 32px;background:#d4af37;color:#000000;text-decoration:none;border-radius:6px;font-weight:bold;font-size:16px;">
                    Go to Dashboard
                  </a>
                </p>
                <p style="font-size:14px;color:#777;margin:0;line-height:1.5;">
                  If you have any questions or need assistance, simply reply to this email or contact our support team. We're thrilled to have you on board!
                </p>
              </td></tr>
              <tr><td style="background:#f8f8f8;padding:20px;text-align:center;border-top:1px solid #eee;">
                <p style="margin:0;font-size:12px;color:#999;">Automated email from CarrierKite. Thank you for your business.</p>
              </td></tr>
            </table>
          </td></tr>
        </table>
      </body>
      </html>
    `
  });
}

async function sendSubscriptionCancelledEmail(brokerEmail, companyName, endDate) {
  const safeCompany = escapeHtml(companyName || 'Valued Broker');
  const safeEndDate = escapeHtml(endDate || 'the end of your billing period');
  const pricingUrl = `${process.env.APP_URL}/pricing.html`;

  await resend.emails.send({
    from: FROM,
    to: brokerEmail,
    subject: 'Your CarrierKite subscription has been cancelled',
    html: `
      <!DOCTYPE html>
      <html>
      <body style="margin:0;padding:0;background:#f4f4f4;font-family:Arial,sans-serif;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f4;padding:30px 0;">
          <tr><td align="center">
            <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.1);">
              <tr><td style="background:#1a1a1a;padding:30px;text-align:center;">
                <h1 style="margin:0;color:#d4af37;font-size:24px;font-weight:700;">CarrierKite</h1>
                <p style="margin:8px 0 0;color:#999;font-size:14px;">Subscription Cancellation Notice</p>
              </td></tr>
              <tr><td style="padding:40px;">
                <p style="font-size:16px;color:#333;margin:0 0 16px;">Hello <strong>${safeCompany}</strong>,</p>
                <p style="font-size:15px;color:#555;line-height:1.6;margin:0 0 16px;">
                  We received your request to cancel your CarrierKite subscription. This email confirms that your subscription has been successfully cancelled.
                </p>
                <div style="background:#f9f7ef;border:1px solid #eadca8;border-radius:6px;padding:16px;margin:20px 0;">
                  <p style="font-size:15px;color:#333;margin:0;line-height:1.5;">
                    <strong>Important:</strong> You can continue using all CarrierKite features and your active packets until the end of your billing cycle</strong>. No further charges will be made to your payment method.
                  </p>
                </div>
                <p style="font-size:15px;color:#555;line-height:1.6;margin:0 0 24px;">
                  If you ever change your mind or want to reactivate your subscription in the future, you can do so anytime from your pricing or billing settings.
                </p>
                <p style="text-align:center;margin:0 0 24px;">
                  <a href="${pricingUrl}"
                     style="display:inline-block;padding:14px 32px;background:#1a1a1a;color:#d4af37;text-decoration:none;border-radius:6px;font-weight:bold;font-size:16px;">
                    View Pricing & Plans
                  </a>
                </p>
                <p style="font-size:14px;color:#777;margin:0;line-height:1.5;">
                  Thank you for using CarrierKite. We hope to serve you again in the future!
                </p>
              </td></tr>
              <tr><td style="background:#f8f8f8;padding:20px;text-align:center;border-top:1px solid #eee;">
                <p style="margin:0;font-size:12px;color:#999;">Automated email from CarrierKite. Please do not reply.</p>
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
  sendVerificationEmail,
  sendSubscriptionThankYouEmail,
  sendSubscriptionCancelledEmail
};