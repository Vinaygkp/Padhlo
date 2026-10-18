const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const crypto = require('crypto');

/**
 * Real OTP Delivery Service for Padhlo
 * 
 * Supports:
 * 1. Brevo Transactional HTTPS Email API (Cloud-native, 100% reliable on Render Free & production)
 * 2. Twilio SMS API (Optional SMS delivery)
 * 
 * Security:
 * - Never logs OTP codes, passwords, or credentials.
 * - Fails safely if email delivery cannot be completed.
 * - Cryptographically secure OTP generation & HMAC-SHA256 hashing.
 */

class OtpDeliveryService {
  constructor() {
    this.initEmailService();
  }

  initEmailService() {
    const apiKey = process.env.BREVO_API_KEY?.trim();
    const senderEmail = process.env.BREVO_SENDER_EMAIL?.trim();
    const senderName = process.env.BREVO_SENDER_NAME?.trim() || 'Padhlo Portal';

    if (apiKey) {
      const safeEmail = senderEmail
        ? senderEmail.replace(/^([^@]+)@(.*)$/, (m, u, d) => `***@${d}`)
        : 'not_set';
      console.log(`📧 Brevo HTTPS Email API initialized (Sender: ${senderName} <${safeEmail}>, KeyConfigured: true)`);
    } else {
      console.warn('ℹ️ BREVO_API_KEY not detected in backend environment.');
    }
  }

  /**
   * Verifies Brevo Email API configuration status
   */
  async verifyEmailConnection() {
    const apiKey = process.env.BREVO_API_KEY?.trim();
    if (!apiKey) {
      return {
        configured: false,
        verified: false,
        error: 'BREVO_API_KEY is not configured in backend environment.',
      };
    }

    const senderEmail = process.env.BREVO_SENDER_EMAIL?.trim();
    if (!senderEmail) {
      return {
        configured: true,
        verified: false,
        error: 'BREVO_SENDER_EMAIL is missing or empty in backend environment. A verified sender email is required.',
      };
    }

    return {
      configured: true,
      verified: true,
      provider: 'BREVO_HTTPS_API',
      senderConfigured: true,
    };
  }

  /**
   * Backward-compatibility alias for verifySmtpConnection
   */
  async verifySmtpConnection() {
    return this.verifyEmailConnection();
  }

  /**
   * Generates a cryptographically strong 6-digit numeric OTP
   */
  generateOtp() {
    return crypto.randomInt(100000, 999999).toString();
  }

  /**
   * Hashes OTP with a secret salt using HMAC-SHA-256 (never store plaintext OTP in DB)
   */
  hashOtp(otp, identifier) {
    const isProd = process.env.NODE_ENV === 'production';
    const INSECURE_OTP_DEFAULTS = [
      'studyhub_secure_otp_salt_random_key_2026',
      'studyhub_otp_salt_secret_2026',
      'secret',
    ];
    const secret = process.env.OTP_SECRET;

    if (isProd) {
      if (!secret || INSECURE_OTP_DEFAULTS.includes(secret) || secret.length < 32) {
        console.error('FATAL: Insecure or missing OTP_SECRET in production environment. Aborting startup.');
        process.exit(1);
      }
    } else if (!secret || INSECURE_OTP_DEFAULTS.includes(secret)) {
      if (!this._warnedOtpSecret) {
        console.warn('⚠️ SECURITY WARNING: Running with default OTP_SECRET salt. In production, configure a 32+ char secret in .env.');
        this._warnedOtpSecret = true;
      }
    }

    const salt = secret || 'studyhub_otp_salt_secret_2026';
    return crypto
      .createHmac('sha256', salt)
      .update(`${identifier.toLowerCase().trim()}:${otp}`)
      .digest('hex');
  }

  /**
   * Verifies candidate OTP against stored hash using constant-time comparison
   */
  verifyOtpHash(candidateOtp, identifier, storedHash) {
    const candidateHash = this.hashOtp(candidateOtp, identifier);
    try {
      return crypto.timingSafeEqual(Buffer.from(candidateHash), Buffer.from(storedHash));
    } catch {
      return false;
    }
  }

  /**
   * Sends real OTP to Email via Brevo Transactional HTTPS Email API
   * Never logs OTP codes or secrets
   */
  async sendEmailOtp(email, otp, purpose = 'Verification') {
    const cleanEmail = email.toLowerCase().trim();
    const appName = process.env.BREVO_SENDER_NAME?.trim() || 'Padhlo Portal';

    const htmlContent = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 520px; margin: 0 auto; padding: 24px; background: #0B0C10; color: #FFFFFF; border-radius: 12px; border: 1px solid #1F2330;">
        <div style="text-align: center; margin-bottom: 24px;">
          <h1 style="margin: 0; color: #A855F7; font-size: 26px; font-weight: 800; letter-spacing: -0.5px;">Padh<span style="color: #38BDF8;">lo</span></h1>
          <p style="margin: 4px 0 0 0; color: #A1A1AA; font-size: 13px;">College Notes, Exams & Academic Portal</p>
        </div>

        <div style="background: #141724; padding: 20px; border-radius: 10px; border: 1px solid #282C3F; margin-bottom: 24px; text-align: center;">
          <p style="margin: 0 0 10px 0; color: #E2E8F0; font-size: 14px;">Your One-Time Password (${purpose}) is:</p>
          <div style="font-size: 32px; font-weight: 900; letter-spacing: 6px; color: #38BDF8; padding: 12px 20px; background: #0A0D18; border-radius: 8px; display: inline-block; border: 1px dashed #38BDF8;">
            ${otp}
          </div>
          <p style="margin: 12px 0 0 0; color: #94A3B8; font-size: 12px;">This OTP will expire in <b>5 minutes</b>. Do not share it with anyone.</p>
        </div>

        <p style="color: #64748B; font-size: 11px; text-align: center; margin: 0;">
          If you did not request this OTP, please ignore this email.
        </p>
      </div>
    `;

    const textContent = `Your ${appName} OTP is: ${otp}. It is valid for 5 minutes. Do not share it with anyone.`;

    const apiKey = process.env.BREVO_API_KEY?.trim();
    if (!apiKey) {
      console.error('❌ Brevo API key missing: set BREVO_API_KEY in backend environment.');
      return {
        success: false,
        error: 'Email delivery service is not configured on the server. Please set BREVO_API_KEY in Render environment variables.',
      };
    }

    const senderEmail = process.env.BREVO_SENDER_EMAIL?.trim();
    if (!senderEmail) {
      console.error('❌ Brevo sender email missing: set BREVO_SENDER_EMAIL in backend environment.');
      return {
        success: false,
        error: 'Sender email is not configured on the server. Please set BREVO_SENDER_EMAIL in Render environment variables.',
      };
    }

    const senderName = process.env.BREVO_SENDER_NAME?.trim() || 'Padhlo Portal';

    try {
      const response = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          'api-key': apiKey,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          sender: {
            name: senderName,
            email: senderEmail,
          },
          to: [
            {
              email: cleanEmail,
            },
          ],
          subject: `${otp} is your ${appName} ${purpose} Code`,
          htmlContent,
          textContent,
        }),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok || !data || !data.messageId) {
        const errorMsg = data?.message || data?.code || `Brevo API returned status ${response.status}`;
        console.error('❌ Brevo API error response:', errorMsg);
        return {
          success: false,
          error: `Brevo email delivery failed: ${errorMsg}`,
        };
      }

      console.log(`✅ Real email OTP successfully dispatched via Brevo HTTPS API (Message ID: ${data.messageId})`);
      return {
        success: true,
        mode: 'brevo_https_api',
        id: data.messageId,
      };
    } catch (err) {
      console.error('❌ Brevo API delivery exception:', err.message || 'Network exception');
      return {
        success: false,
        error: `Brevo delivery failed: ${err.message || 'Network error'}`,
      };
    }
  }

  /**
   * Sends real SMS OTP via Twilio if configured
   */
  async sendSmsOtp(mobile, otp, purpose = 'Verification') {
    const cleanMobile = mobile.trim();

    if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_PHONE_NUMBER) {
      try {
        const auth = Buffer.from(`${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`).toString('base64');
        const params = new URLSearchParams({
          To: cleanMobile,
          From: process.env.TWILIO_PHONE_NUMBER,
          Body: `Your Padhlo verification OTP is: ${otp}. Valid for 5 minutes.`,
        });

        const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${process.env.TWILIO_ACCOUNT_SID}/Messages.json`, {
          method: 'POST',
          headers: {
            Authorization: `Basic ${auth}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: params.toString(),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Twilio SMS failed');
        console.log(`✅ Real Twilio SMS sent to recipient (SID: ${data.sid})`);
        return { success: true, mode: 'twilio_sms', sid: data.sid };
      } catch (err) {
        console.error('❌ Twilio SMS delivery failed:', err.message);
        return {
          success: false,
          error: `SMS delivery failed: ${err.message}`,
        };
      }
    }

    return {
      success: false,
      error: 'SMS service is not configured on the server.',
    };
  }
}

module.exports = new OtpDeliveryService();
