// backend/utils/emailService.js
const nodemailer = require('nodemailer');

/**
 * Sends an email.
 * Priority:
 * 1. Brevo HTTP API (if BREVO_API_KEY is configured) - bypasses Render port block
 * 2. SMTP Transport (if SMTP keys are configured)
 * 3. Terminal Console (Local dev mode fallback)
 * 
 * @param {Object} options
 * @param {string} options.to - Recipient email address
 * @param {string} options.subject - Email subject
 * @param {string} options.html - HTML content of the email
 */
const sendEmail = async ({ to, subject, html }) => {
  const brevoApiKey = process.env.BREVO_API_KEY;
  const brevoSenderEmail = process.env.BREVO_SENDER_EMAIL || process.env.SMTP_USER;

  // 1. Brevo HTTP API (Recommended for cloud hosting like Render)
  if (brevoApiKey && brevoSenderEmail) {
    try {
      const response = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          'accept': 'application/json',
          'api-key': brevoApiKey,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          sender: {
            name: 'AI Exam Monitor',
            email: brevoSenderEmail.trim(),
          },
          to: [
            {
              email: to.toLowerCase().trim(),
            },
          ],
          subject: subject,
          htmlContent: html,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `Brevo HTTP error ${response.status}`);
      }

      return true;
    } catch (error) {
      console.error('❌ Failed to send email via Brevo HTTP API:', error);
      throw error;
    }
  }

  // 2. SMTP Transport Fallback
  const host = process.env.SMTP_HOST;
  const port = process.env.SMTP_PORT;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  // 3. Local development console fallback
  if (!host || !port || !user || !pass) {
    console.log('\n=========================================');
    console.log(`[SMTP/Brevo Not Configured] Email simulation:`);
    console.log(`To:      ${to}`);
    console.log(`Subject: ${subject}`);
    console.log('-----------------------------------------');
    const cleanText = html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
    console.log(`Body:    ${cleanText}`);
    console.log('=========================================\n');
    return true;
  }

  try {
    const transporter = nodemailer.createTransport({
      host,
      port: parseInt(port, 10),
      secure: port === '465' || process.env.SMTP_SECURE === 'true',
      auth: {
        user,
        pass,
      },
    });

    const mailOptions = {
      from: `"AI Exam Monitor" <${user}>`,
      to,
      subject,
      html,
    };

    await transporter.sendMail(mailOptions);
    return true;
  } catch (error) {
    console.error('❌ Failed to send email via SMTP:', error);
    throw error;
  }
};

module.exports = { sendEmail };
