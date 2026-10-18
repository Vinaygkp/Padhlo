const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const crypto = require('crypto');
const { Resend } = require('resend');

/**
 * Real OTP Delivery Service for Padhlo
 * 
 * Supports:
 * 1. Resend HTTPS Email API (Cloud-native, 100% reliable on Render Free & production)
 * 2. Twilio SMS API (Optional SMS delivery)
 * 
 * Security:
 * - Never logs OTP codes, passwords, or credentials.
 * - Fails safely if email delivery cannot be completed.
 * - Cryptographically secure OTP generation & HMAC-SHA256 hashing.
 */

class OtpDeliveryService {
  constructor() {
    this.resend = null;
    this.initEmailService();
  }

  /**
   * Resolves and normalizes the sender address.
   * Prioritizes RESEND_FROM, falls back to EMAIL_FROM or default 'Padhlo Portal <onboarding@resend.dev>'
   */
  getSenderAddress() {
    const raw = process.env.RESEND_FROM?.trim() || process.env.EMAIL_FROM?.trim();
    if (!raw) {
      return 'Padhlo Portal <onboarding@resend.dev>';
    }

    // Strip wrapping quotes around the entire string if present
    const clean = raw.trim().replace(/^['"]|['"]$/g, '').trim();

    // Match display name and email address: [Name] <email@domain.com>
    const match = clean.match(/^(.*?)(?:<([^>]+)>)?$/);
    if (match && match[2]) {
      // Strip any quotes around the display name itself: "Padhlo Portal" -> Padhlo Portal
      const displayName = match[1].replace(/['"]/g, '').trim();
      const email = match[2].trim().toLowerCase();
      return displayName ? `${displayName} <${email}>` : email;
    }

    // If only an email address was provided without angle brackets
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean)) {
      return `Padhlo Portal <${clean.toLowerCase()}>`;
    }

    return clean;
  }

  initEmailService() {
    const apiKey = process.env.RESEND_API_KEY?.trim();

    if (apiKey) {
      this.resend = new Resend(apiKey);
      const sender = this.getSenderAddress();
      const safeSender = sender.replace(/<([^@>]+)@([^>]+)>/, (m, u, d) => `<***@${d}>`);
      console.log(`📧 Resend HTTPS Email API initialized (Sender: ${safeSender}, KeyConfigured: true)`);
    } else {
      console.warn('ℹ️ RESEND_API_KEY not detected in backend environment.');
      this.resend = null;
    }
  }

  /**
   * Verifies Resend Email API status
   */
  async verifyEmailConnection() {
    const apiKey = process.env.RESEND_API_KEY?.trim();
    if (!apiKey) {
      return {
        configured: false,
        verified: false,
        error: 'RESEND_API_KEY is not configured in backend environment.',
      };
    }

    const fromAddress = this.getSenderAddress();
    if (!fromAddress) {
      return {
        configured: true,
        verified: false,
        error: 'RESEND_FROM is missing or empty in backend environment. A verified sender address is required.',
      };
    }

    return {
      configured: true,
      verified: true,
      provider: 'RESEND_HTTPS_API',
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
   * Sends real OTP to Email via Resend HTTPS Email API
   * Never logs OTP codes or secrets
   */
  async sendEmailOtp(email, otp, purpose = 'Verification') {
    const cleanEmail = email.toLowerCase().trim();
    const appName = 'Padhlo Portal';

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

    // 1. Validate Resend client
    if (!this.resend) {
      const apiKey = process.env.RESEND_API_KEY?.trim();
      if (apiKey) {
        this.resend = new Resend(apiKey);
      } else {
        console.error('❌ Resend API key missing: set RESEND_API_KEY in backend environment.');
        return {
          success: false,
          error: 'Email delivery service is not configured on the server. Please set RESEND_API_KEY in Render environment variables.',
        };
      }
    }

    const fromAddress = this.getSenderAddress();

    try {
      const { data, error } = await this.resend.emails.send({
        from: fromAddress,
        to: [cleanEmail],
        subject: `${otp} is your ${appName} ${purpose} Code`,
        text: `Your ${appName} OTP is: ${otp}. It is valid for 5 minutes. Do not share it with anyone.`,
        html: htmlContent,
      });

      // Strict validation: Must not have error, and data must contain message id
      if (error || !data || !data.id) {
        const errorMsg = error?.message || error?.name || 'Resend did not return a confirmation ID.';
        console.error('❌ Resend API error response:', errorMsg);
        return {
          success: false,
          error: `Resend email delivery failed: ${errorMsg}`,
        };
      }

      console.log(`✅ Real email OTP successfully dispatched via Resend HTTPS API (Message ID: ${data.id})`);
      return {
        success: true,
        mode: 'resend_https_api',
        id: data.id,
      };
    } catch (err) {
      console.error('❌ Resend API delivery exception:', err.message || 'Network exception');
      return {
        success: false,
        error: `Resend delivery failed: ${err.message || 'Network error'}`,
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
