import nodemailer from "nodemailer";
import fs from "fs";
import path from "path";

/**
 * Returns configured Nodemailer transporter if SMTP credentials are provided,
 * or null if credentials have not yet been placed in .env.local.
 */
function getTransporter() {
  const host = process.env.SMTP_HOST || "smtp.gmail.com";
  const port = process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT, 10) : 587;
  const user = process.env.SMTP_USER || process.env.EMAIL_USER;
  const pass = process.env.SMTP_PASS || process.env.SMTP_PASSWORD || process.env.SMTP_KEY || process.env.EMAIL_PASS;
  const secure = process.env.SMTP_SECURE === "true" || port === 465;

  if (!user || !pass) {
    return null;
  }

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: {
      user,
      pass,
    },
    tls: {
      rejectUnauthorized: process.env.NODE_ENV === "production",
    },
  });
}

/**
 * Generates the full HTML email with official Shotzi neo-brutalist branding.
 */
export function renderResetOtpEmailHtml({
  otp,
  expiresInMinutes = 5,
  recipientEmail = "",
  isPreview = false,
}) {
  // Use CID for email clients so images load without external CDN dependency,
  // or relative URLs for web browser preview.
  const logoSrc = isPreview ? "/brand/shotzi-logo-clean.png" : "cid:shotzilogo";
  const iconSrc = isPreview ? "/brand/shotzi-icon-app.png" : "cid:shotzicon";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>Your Shotzi Password Reset Code</title>
</head>
<body style="margin: 0; padding: 0; background-color: #FBF9F2; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased; color: #18181B;">
  <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #FBF9F2; padding: 32px 16px;">
    <tr>
      <td align="center">
        <!-- Main Email Container -->
        <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 520px; background-color: #ffffff; border: 3px solid #18181B; border-radius: 24px; box-shadow: 6px 6px 0px #18181B; overflow: hidden; border-collapse: separate;">
          
          <!-- Top Yellow Header Bar -->
          <tr>
            <td style="background-color: #FFD21E; padding: 18px 24px; border-bottom: 3px solid #18181B;">
              <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0">
                <tr>
                  <td align="left" style="vertical-align: middle;">
                    <img src="${logoSrc}" alt="Shotzi" height="34" style="height: 34px; width: auto; max-width: 140px; display: block; border: 0; outline: none; text-decoration: none;" />
                  </td>
                  <td align="right" style="vertical-align: middle;">
                    <span style="display: inline-block; background-color: #18181B; color: #FFD21E; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 11px; font-weight: 900; text-transform: uppercase; letter-spacing: 1px; padding: 4px 12px; border-radius: 9999px;">
                      Verification
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Body Content -->
          <tr>
            <td style="padding: 32px 28px; text-align: center;">
              
              <!-- Icon Pill -->
              <div style="display: inline-block; width: 60px; height: 60px; background-color: #FFF9DB; border: 2px solid #18181B; border-radius: 18px; box-shadow: 3px 3px 0px #18181B; padding: 6px; box-sizing: border-box; margin-bottom: 18px;">
                <img src="${iconSrc}" alt="Shotzi Icon" width="44" height="44" style="width: 44px; height: 44px; display: block; border: 0;" />
              </div>

              <!-- Title -->
              <h1 style="font-family: Georgia, 'Times New Roman', serif; font-size: 28px; font-weight: 900; color: #18181B; margin: 0 0 10px 0; line-height: 1.2;">
                Reset Your Password
              </h1>

              <p style="font-size: 14px; font-weight: 500; color: #52525B; line-height: 1.5; margin: 0 0 24px 0;">
                We received a password reset request${recipientEmail ? ` for <strong style="color: #18181B;">${recipientEmail}</strong>` : ""}. Enter this 6-digit code in Shotzi to create a new password.
              </p>

              <!-- Hero OTP Code Card -->
              <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="margin: 0 0 24px 0;">
                <tr>
                  <td style="background-color: #FFFDEB; border: 3px dashed #18181B; border-radius: 20px; padding: 22px 16px; text-align: center;">
                    <div style="font-size: 11px; font-weight: 900; text-transform: uppercase; letter-spacing: 2px; color: #71717A; margin-bottom: 8px;">
                      Your 6-Digit Verification Code
                    </div>

                    <!-- 6 Digit Big Box -->
                    <div style="display: inline-block; background-color: #FFD21E; border: 2.5px solid #18181B; border-radius: 14px; padding: 10px 24px; box-shadow: 3.5px 3.5px 0px #18181B; margin: 6px 0 12px 0;">
                      <span style="font-family: 'Courier New', Courier, monospace; font-size: 38px; font-weight: 900; letter-spacing: 12px; color: #18181B; margin-left: 12px;">
                        ${otp}
                      </span>
                    </div>

                    <!-- Expiry Badge -->
                    <div>
                      <span style="display: inline-block; background-color: #18181B; color: #FFD21E; font-size: 11.5px; font-weight: 800; padding: 4px 14px; border-radius: 9999px;">
                        ⏳ Valid for ${expiresInMinutes} minutes only
                      </span>
                    </div>
                  </td>
                </tr>
              </table>

              <!-- Steps Guide -->
              <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #FAFAFA; border: 2px solid #18181B; border-radius: 16px; padding: 16px 18px; margin: 0 0 20px 0; text-align: left;">
                <tr>
                  <td>
                    <div style="font-size: 12px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.5px; color: #18181B; margin-bottom: 8px;">
                      How to complete your reset:
                    </div>
                    <ol style="margin: 0; padding-left: 20px; font-size: 12.5px; color: #52525B; line-height: 1.6; font-weight: 600;">
                      <li>Return to the open Shotzi window or tab.</li>
                      <li>Type or paste the 6-digit code above into the boxes.</li>
                      <li>Enter and confirm your new password (min. 6 characters).</li>
                    </ol>
                  </td>
                </tr>
              </table>

              <!-- Security Caution Note -->
              <p style="font-size: 12px; color: #71717A; line-height: 1.5; margin: 0 0 20px 0; padding: 0 8px;">
                <strong>Didn't request this?</strong> You can safely disregard this email. Your current password is safe and nobody can access your account without this code.
              </p>

              <!-- Neo-brutalist Divider -->
              <div style="height: 2px; background-color: #E4E4E7; margin: 20px 0;"></div>

              <!-- Brand Slogan & Sub-footer -->
              <div style="font-size: 12px; font-weight: 800; color: #18181B; margin-bottom: 4px;">
                Shotzi &bull; A soft place for loud feelings.
              </div>
              <div style="font-size: 11px; color: #A1A1AA; font-weight: 600;">
                Automated security notification. Please do not reply directly to this email.
              </div>

            </td>
          </tr>

          <!-- Bottom Footer Strip -->
          <tr>
            <td style="background-color: #18181B; padding: 12px 24px; text-align: center;">
              <span style="font-family: 'Courier New', Courier, monospace; font-size: 10.5px; color: #A1A1AA; font-weight: 700; text-transform: uppercase; letter-spacing: 1px;">
                &copy; ${new Date().getFullYear()} Shotzi Community. All rights reserved.
              </span>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/**
 * Sends a neo-brutalist styled OTP email for password reset via SMTP.
 */
export async function sendPasswordResetOtpEmail({ to, otp, expiresInMinutes = 5 }) {
  const transporter = getTransporter();
  const fromAddress = process.env.SMTP_FROM || process.env.EMAIL_FROM || '"Shotzi" <noreply@shotzi.com>';

  const logoPath = path.join(process.cwd(), "public", "brand", "shotzi-logo-clean.png");
  const iconPath = path.join(process.cwd(), "public", "brand", "shotzi-icon-app.png");

  const attachments = [];
  if (fs.existsSync(logoPath)) {
    attachments.push({
      filename: "shotzi-logo.png",
      path: logoPath,
      cid: "shotzilogo",
    });
  }
  if (fs.existsSync(iconPath)) {
    attachments.push({
      filename: "shotzi-icon.png",
      path: iconPath,
      cid: "shotzicon",
    });
  }

  const htmlContent = renderResetOtpEmailHtml({
    otp,
    expiresInMinutes,
    recipientEmail: to,
    isPreview: false,
  });

  const textContent = `Your Shotzi password reset code is: ${otp}\n\nThis verification code expires in ${expiresInMinutes} minutes.\n\nIf you did not request this, please safely ignore this message.\n\nShotzi — A soft place for loud feelings.`;

  if (!transporter) {
    console.log("\n=======================================================");
    console.log("🟡 [SHOTZI SMTP DEV MODE] Password Reset Requested");
    console.log(`To: ${to}`);
    console.log(`OTP Code: ${otp}`);
    console.log(`Expires in: ${expiresInMinutes} minutes (Randomized)`);
    console.log("Notice: Set SMTP_USER and SMTP_PASS in .env.local to send live emails.");
    console.log("=======================================================\n");

    return {
      success: true,
      simulated: true,
      message: "SMTP key pending; OTP logged for development testing.",
      otp,
      htmlContent,
    };
  }

  try {
    const info = await transporter.sendMail({
      from: fromAddress,
      to,
      subject: `Shotzi: ${otp} is your password reset code`,
      text: textContent,
      html: htmlContent,
      attachments,
    });

    console.log(`[Shotzi SMTP] Reset email sent to ${to}, messageId: ${info.messageId}`);
    return {
      success: true,
      messageId: info.messageId,
      htmlContent,
    };
  } catch (err) {
    console.error("[Shotzi SMTP] Failed to deliver email:", err);
    throw new Error(`Failed to send email: ${err.message}`);
  }
}
