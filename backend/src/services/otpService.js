const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const nodemailer = require('nodemailer');
const crypto = require('crypto');

/**
 * Real OTP Delivery Service for Padhlo
 * 
 * Supports:
 * 1. Real SMTP (Gmail, Hostinger, Amazon SES, Brevo, custom college mail servers)
 * 2. Real Resend API (via HTTPS or SMTP)
 * 3. Real Twilio SMS
 * 
 * Security:
 * - Never logs OTP codes, passwords, or credentials.
 * - Fails safely if email delivery cannot be completed.
 * - Cryptographically secure OTP generation & HMAC-SHA256 hashing.
 */

class OtpDeliveryService {
  constructor() {
    this.transporter = null;
    this.initMailTransporter();
  }

  initMailTransporter() {
    const host = process.env.SMTP_HOST?.trim();
    const port = process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT.trim(), 10) : undefined;
    const user = process.env.SMTP_USER?.trim();
    const pass = process.env.SMTP_PASS?.trim();
    const secureEnv = process.env.SMTP_SECURE?.trim();

    // Determine secure connection: true if SMTP_SECURE is 'true' or port is 465
    const isSecure = secureEnv === 'true' || port === 465;
    const finalPort = port || (isSecure ? 465 : 587);

    if (host) {
      const transportConfig = {
        host,
        port: finalPort,
        secure: isSecure,
        connectionTimeout: 10000, // 10 seconds
        greetingTimeout: 10000,   // 10 seconds
        socketTimeout: 15000,     // 15 seconds
      };

      if (user && pass) {
        transportConfig.auth = {
          user,
          pass,
        };
      }

      this.transporter = nodemailer.createTransport(transportConfig);
      console.log(`📧 SMTP Transporter initialized (Host: ${host}, Port: ${finalPort}, Secure: ${isSecure}, AuthConfigured: ${Boolean(user && pass)})`);
    } else {
      console.log('ℹ️ SMTP_HOST not detected in .env.');
      this.transporter = null;
    }
  }

  /**
   * Verifies SMTP server handshake and authentication
   */
  async verifySmtpConnection() {
    if (!this.transporter) {
      return {
        configured: false,
        verified: false,
        error: 'SMTP_HOST is not configured in backend/.env.',
      };
    }

    const hasAuth = Boolean(process.env.SMTP_USER?.trim() && process.env.SMTP_PASS?.trim());
    if (!hasAuth) {
      return {
        configured: true,
        verified: false,
        error: 'SMTP_USER and/or SMTP_PASS are missing or empty in backend/.env. Authentication credentials are required for mail delivery.',
      };
    }

    try {
      await this.transporter.verify();
      return { configured: true, verified: true };
    } catch (err) {
      return {
        configured: true,
        verified: false,
        error: err.message || 'SMTP server connection or authentication failed.',
      };
    }
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
   * Sends real OTP to Email
   * Sends to the specific student's entered email address (cleanEmail)
   */
  async sendEmailOtp(email, otp, purpose = 'Verification') {
    const cleanEmail = email.toLowerCase().trim();
    const appName = 'Padhlo College Portal';

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

    // 1. If SMTP transporter is configured, dispatch genuine email
    if (this.transporter) {
      const fromAddress = process.env.SMTP_FROM?.trim() || `"${appName}" <${process.env.SMTP_USER?.trim() || 'no-reply@padhlo.edu'}>`;
      try {
        const info = await this.transporter.sendMail({
          from: fromAddress,
          to: cleanEmail,
          subject: `${otp} is your Padhlo ${purpose} Code`,
          text: `Your ${appName} OTP is: ${otp}. It is valid for 5 minutes.`,
          html: htmlContent,
        });
        console.log(`✅ Real email OTP successfully dispatched to recipient (MessageId: ${info.messageId})`);
        return { success: true, mode: 'real_smtp', messageId: info.messageId };
      } catch (err) {
        console.error('❌ Failed to dispatch SMTP email:', err.message);
        return {
          success: false,
          error: `SMTP delivery failed: ${err.message}`,
        };
      }
    }

    // 2. Resend API support if configured via API Key
    if (process.env.RESEND_API_KEY) {
      try {
        const res = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: process.env.RESEND_FROM || `${appName} <onboarding@resend.dev>`,
            to: [cleanEmail],
            subject: `${otp} is your Padhlo ${purpose} Code`,
            html: htmlContent,
          }),
        });
        const resData = await res.json();
        if (!res.ok) throw new Error(resData.message || 'Resend error');
        console.log(`✅ Real Resend OTP successfully dispatched to recipient (ID: ${resData.id})`);
        return { success: true, mode: 'resend_api', id: resData.id };
      } catch (err) {
        console.error('❌ Resend delivery failure:', err.message);
        return {
          success: false,
          error: `Resend delivery failed: ${err.message}`,
        };
      }
    }

    // If no real email provider is configured, return explicit error
    return {
      success: false,
      error: 'Email delivery service is not configured on the server. Please configure SMTP_USER and SMTP_PASS in backend/.env.',
    };
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

