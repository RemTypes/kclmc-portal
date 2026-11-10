/**
 * KCLMC Auth Email Templates
 * 
 * Styled, mobile-first transactional HTML emails matching the club visual identity:
 * - Brand Colors: Dark Slate (#041F1E), Forest Accent (#084746), Gold Accent (#FFBD59)
 * - Accessible typography, fallback plain text, SPF/DKIM spam-optimized headers
 */

export function renderPasswordResetEmail(name: string, resetUrl: string): { html: string; text: string } {
  const plainName = name || "Climber";
  const text = `Hi ${plainName},

We received a request to reset your password for the King's College London Mountaineering Club (KCLMC) Portal.

Click the link below to set a new password:
${resetUrl}

This link is valid for 60 minutes. If you did not request this password reset, you can safely ignore this email; your account remains secure.

Safe climbing,
The KCLMC Committee
kclmc.org`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reset Your KCLMC Password</title>
</head>
<body style="margin: 0; padding: 0; background-color: #031716; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #f1f5f9;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #031716; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width: 520px; background-color: #052322; border: 1px solid rgba(255, 189, 89, 0.3); border-radius: 20px; overflow: hidden; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5);">
          <!-- Header -->
          <tr>
            <td style="background-color: #084746; padding: 30px 40px; text-align: center; border-bottom: 2px solid #FFBD59;">
              <div style="font-size: 36px; line-height: 1; margin-bottom: 8px;">⛰️</div>
              <h1 style="margin: 0; color: #FFBD59; font-size: 20px; font-weight: 700; letter-spacing: 0.5px; text-transform: uppercase;">KCL Mountaineering Club</h1>
              <p style="margin: 4px 0 0 0; color: #cbd5e1; font-size: 13px;">Member Portal // Security</p>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding: 35px 40px;">
              <h2 style="margin: 0 0 16px 0; color: #ffffff; font-size: 20px; font-weight: 600;">Reset Your Password</h2>
              <p style="margin: 0 0 20px 0; color: #cbd5e1; font-size: 15px; line-height: 1.6;">
                Hi <strong style="color: #ffffff;">${plainName}</strong>, we received a request to reset your password for your KCLMC Portal account.
              </p>
              
              <!-- Action Button -->
              <table role="presentation" cellspacing="0" cellpadding="0" style="margin: 28px 0;">
                <tr>
                  <td align="center" style="border-radius: 12px; background-color: #FFBD59;">
                    <a href="${resetUrl}" target="_blank" style="display: inline-block; padding: 14px 32px; font-size: 15px; font-weight: 700; color: #041F1E; text-decoration: none; border-radius: 12px; letter-spacing: 0.3px;">
                      Reset Password →
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin: 0 0 12px 0; color: #94a3b8; font-size: 13px; line-height: 1.5;">
                ⏱️ This password reset link is valid for <strong>60 minutes</strong>.
              </p>
              <p style="margin: 0; color: #94a3b8; font-size: 13px; line-height: 1.5;">
                If you did not make this request, you can safely ignore this email. Your existing password will not change.
              </p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background-color: #041b1a; padding: 20px 40px; text-align: center; border-top: 1px solid rgba(255, 255, 255, 0.05);">
              <p style="margin: 0; color: #64748b; font-size: 12px;">
                King's College London Mountaineering Club • <a href="https://kclmc.org" style="color: #FFBD59; text-decoration: none;">kclmc.org</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return { html, text };
}

export function renderMagicLinkEmail(magicUrl: string): { html: string; text: string } {
  const text = `Hi Climber,

Click the link below to sign in to the King's College London Mountaineering Club (KCLMC) Portal:
${magicUrl}

This link is valid for 15 minutes and can only be used once.

Safe climbing,
The KCLMC Committee
kclmc.org`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Sign in to KCLMC</title>
</head>
<body style="margin: 0; padding: 0; background-color: #031716; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #f1f5f9;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #031716; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width: 520px; background-color: #052322; border: 1px solid rgba(255, 189, 89, 0.3); border-radius: 20px; overflow: hidden; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5);">
          <!-- Header -->
          <tr>
            <td style="background-color: #084746; padding: 30px 40px; text-align: center; border-bottom: 2px solid #FFBD59;">
              <div style="font-size: 36px; line-height: 1; margin-bottom: 8px;">🧗</div>
              <h1 style="margin: 0; color: #FFBD59; font-size: 20px; font-weight: 700; letter-spacing: 0.5px; text-transform: uppercase;">KCL Mountaineering Club</h1>
              <p style="margin: 4px 0 0 0; color: #cbd5e1; font-size: 13px;">1-Click Instant Sign-In</p>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding: 35px 40px;">
              <h2 style="margin: 0 0 16px 0; color: #ffffff; font-size: 20px; font-weight: 600;">Welcome Back!</h2>
              <p style="margin: 0 0 20px 0; color: #cbd5e1; font-size: 15px; line-height: 1.6;">
                Click the button below to log in directly to your KCLMC membership and digital climbing pass. Zero password required.
              </p>
              
              <!-- Action Button -->
              <table role="presentation" cellspacing="0" cellpadding="0" style="margin: 28px 0;">
                <tr>
                  <td align="center" style="border-radius: 12px; background-color: #FFBD59;">
                    <a href="${magicUrl}" target="_blank" style="display: inline-block; padding: 14px 32px; font-size: 15px; font-weight: 700; color: #041F1E; text-decoration: none; border-radius: 12px; letter-spacing: 0.3px;">
                      Sign In to KCLMC Portal →
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin: 0 0 12px 0; color: #94a3b8; font-size: 13px; line-height: 1.5;">
                ⏱️ This link is valid for <strong>15 minutes</strong> and can only be used once.
              </p>
              <p style="margin: 0; color: #94a3b8; font-size: 13px; line-height: 1.5;">
                If you did not request this login link, you can safely ignore this email.
              </p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background-color: #041b1a; padding: 20px 40px; text-align: center; border-top: 1px solid rgba(255, 255, 255, 0.05);">
              <p style="margin: 0; color: #64748b; font-size: 12px;">
                King's College London Mountaineering Club • <a href="https://kclmc.org" style="color: #FFBD59; text-decoration: none;">kclmc.org</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return { html, text };
}
