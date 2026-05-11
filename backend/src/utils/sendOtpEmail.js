import SibApiV3Sdk from "sib-api-v3-sdk";

const client = SibApiV3Sdk.ApiClient.instance;
client.authentications["api-key"].apiKey = process.env.BREVO_API_KEY;

const apiInstance = new SibApiV3Sdk.TransactionalEmailsApi();

// type: "register" | "set-password" | "change-password"
export const sendOtpEmail = async (to, otp, type = "register") => {

  const config = {
    "register": {
      subject: "Verify your Chatify account",
      heading: "Verify your email address",
      subtext: "Use the code below to complete your Chatify registration. It expires in <strong>10 minutes</strong>.",
      footer: "You are receiving this because you requested to create a Chatify account.",
    },
    "set-password": {
      subject: "Set your Chatify password",
      heading: "Set your password",
      subtext: "Use the code below to verify it's you before setting your password. It expires in <strong>10 minutes</strong>.",
      footer: "You are receiving this because you requested to add a password to your Chatify account.",
    },
    "change-password": {
      subject: "Change your Chatify password",
      heading: "Change your password",
      subtext: "Use the code below to verify it's you before updating your password. It expires in <strong>10 minutes</strong>.",
      footer: "You are receiving this because you requested a password change on your Chatify account.",
    },
  };

  const { subject, heading, subtext, footer } = config[type] || config["register"];

  const otpCells = otp
    .split("")
    .map(
      (d) => `
      <td style="padding:0 4px;">
        <div style="
          width:48px;height:56px;
          background:#f0fdf4;
          border:2px solid #10b981;
          border-radius:12px;
          font-size:26px;font-weight:700;
          color:#065f46;
          text-align:center;line-height:56px;
        ">${d}</div>
      </td>`
    )
    .join("");

  const emailData = {
    sender: {
      email: process.env.BREVO_SENDER_EMAIL,
      name: "Chatify",
    },
    to: [{ email: to }],
    subject,
    textContent: `Your Chatify verification code is: ${otp}\n\nThis code expires in 10 minutes.\nDo not share it with anyone.\n\nIf you didn't request this, please ignore this email.`,
    htmlContent: `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#f3f4f6;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f3f4f6;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="480" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.07);">
          <tr>
            <td style="background:linear-gradient(135deg,#10b981,#14b8a6);padding:32px;text-align:center;">
              <h1 style="margin:0;color:#ffffff;font-size:24px;font-weight:700;letter-spacing:-0.5px;">Chatify</h1>
              <p style="margin:6px 0 0;color:rgba(255,255,255,0.8);font-size:13px;">Email Verification</p>
            </td>
          </tr>
          <tr>
            <td style="padding:40px 32px;">
              <p style="margin:0 0 8px;color:#111827;font-size:16px;font-weight:600;">${heading}</p>
              <p style="margin:0 0 32px;color:#6b7280;font-size:14px;line-height:1.6;">${subtext}</p>
              <table cellpadding="0" cellspacing="0" style="margin:0 auto 32px;">
                <tr>${otpCells}</tr>
              </table>
              <p style="margin:0;color:#9ca3af;font-size:12px;text-align:center;line-height:1.6;">
                Never share this code with anyone.
              </p>
            </td>
          </tr>
          <tr>
            <td style="background:#f9fafb;border-top:1px solid #e5e7eb;padding:20px 32px;text-align:center;">
              <p style="margin:0;color:#9ca3af;font-size:11px;">
                This is an automated message, please do not reply.<br/>
                ${footer}
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`,
  };

  try {
    await apiInstance.sendTransacEmail(emailData);
    console.log(`✅ [sendOtpEmail] [${type}] Delivered to:`, to);
  } catch (err) {
    console.error(`❌ [sendOtpEmail] [${type}] Failed:`, err?.response?.body || err?.message);
    throw err;
  }
};