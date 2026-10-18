const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const dns = require('dns');

// Configure reliable DNS servers (Google & Cloudflare) to prevent querySrv ECONNREFUSED on Windows / ISP DNS
try {
  dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1', '1.0.0.1']);
} catch (dnsErr) {
  console.warn('DNS server override notice:', dnsErr.message);
}

const express = require('express');
const cors = require('cors');
const fs = require('fs');
const multer = require('multer');
const rateLimit = require('express-rate-limit');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const { 
  User, 
  OtpVerification, 
  Note, 
  ShortNote, 
  Exam, 
  Syllabus, 
  Announcement, 
  Bookmark, 
  StudyActivity, 
  ExamReminder, 
  AnnouncementRead, 
  AdminAuditLog, 
  DownloadEvent 
} = require('./models');
const { requireAuth, optionalAuth, requireAdmin, JWT_SECRET } = require('./middleware/auth');
const otpService = require('./services/otpService');
const storageService = require('./services/storageService');
const aiService = require('./services/aiService');
const aktuNotesService = require('./services/aktuNotesService');

const app = express();
const PORT = process.env.PORT || 5000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/studyhub';

// Ensure persistent uploads directory exists
const UPLOADS_DIR = path.join(__dirname, '../uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// Multer Storage Configuration for Files
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const safeName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
    cb(null, `${uniqueSuffix}-${safeName}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB maximum for PDFs
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf' || file.originalname.endsWith('.pdf')) {
      cb(null, true);
    } else {
      cb(new Error('Only PDF documents are allowed.'));
    }
  },
});

const uploadImage = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB maximum for Images
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/') || /\.(jpg|jpeg|png|webp|gif)$/i.test(file.originalname)) {
      cb(null, true);
    } else {
      cb(new Error('Only image files (JPEG, PNG, WEBP) are allowed.'));
    }
  },
});

// Middleware
app.use(cors());
app.use(express.json({ limit: '15mb' })); // Support base64 image uploads up to 15MB
// Public static route ONLY for user profile photos
app.use('/uploads/profiles', express.static(storageService.PERSISTENT_PROFILES_DIR));

// Rate limiting
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  message: { success: false, message: 'Too many requests, please slow down.' },
});
app.use('/api/', apiLimiter);

let isMongoConnected = false;

// Helper to enforce student branch and academic year authorization for private materials
async function checkFileAccessAuthorization(user, fileName, fileType = 'pdf') {
  if (!user) return false;
  if (user.role === 'ADMIN') return true;

  const studentBranch = user.branch || 'CSE';
  const studentYear = user.academicYear || '1st Year';
  const cleanBase = path.basename(fileName);

  try {
    if (fileType === 'pdf') {
      const note = await Note.findOne({
        isDeleted: { $ne: true },
        $or: [
          { fileName: cleanBase },
          { storageKey: cleanBase },
          { fileId: cleanBase },
          { storageKey: { $regex: cleanBase } },
          { fileUrl: { $regex: cleanBase } },
        ],
      });

      if (!note) {
        // Also check if it is an authorized syllabus PDF
        const syllabus = await Syllabus.findOne({
          isPublished: { $ne: false },
          $or: [
            { fileName: cleanBase },
            { storageKey: cleanBase },
            { fileId: cleanBase },
            { storageKey: { $regex: cleanBase } },
            { pdfUrl: { $regex: cleanBase } },
          ],
        });
        if (syllabus) {
          const branchAllowed = !syllabus.branches || syllabus.branches.length === 0 || syllabus.branches.includes('ALL') || syllabus.branches.includes(studentBranch);
          const yearAllowed = !syllabus.years || syllabus.years.length === 0 || syllabus.years.includes('ALL') || syllabus.years.includes(studentYear);
          return branchAllowed && yearAllowed;
        }
        return false;
      }

      if (note.isPublished === false) return false;

      const branchAllowed = !note.branches || note.branches.length === 0 || note.branches.includes('ALL') || note.branches.includes(studentBranch);
      const yearAllowed = !note.years || note.years.length === 0 || note.years.includes('ALL') || note.years.includes(studentYear);
      return branchAllowed && yearAllowed;
    }

    if (fileType === 'image') {
      const shortNote = await ShortNote.findOne({
        $or: [
          { imageUrls: { $regex: cleanBase } },
          { storageKeys: cleanBase },
          { fileIds: cleanBase },
          { title: { $regex: cleanBase } },
        ],
      });

      if (!shortNote) {
        return false;
      }

      if (shortNote.isPublished === false) return false;

      const branchAllowed = !shortNote.branches || shortNote.branches.length === 0 || shortNote.branches.includes('ALL') || shortNote.branches.includes(studentBranch);
      const yearAllowed = !shortNote.years || shortNote.years.length === 0 || shortNote.years.includes('ALL') || shortNote.years.includes(studentYear);
      return branchAllowed && yearAllowed;
    }
  } catch (err) {
    console.error('Error verifying file authorization:', err.message);
    return false;
  }

  return false;
}

// Protected Authorized Route: PDF Lecture Notes & PYQs
app.get('/uploads/pdf_notes/:filename', requireAuth, async (req, res) => {
  try {
    const filename = req.params.filename;
    const isAuthorized = await checkFileAccessAuthorization(req.user, filename, 'pdf');
    if (!isAuthorized) {
      return res.status(403).json({
        success: false,
        message: 'Access restricted: This study material is not assigned to your academic branch or year.',
      });
    }

    const filePath = path.join(storageService.PERSISTENT_DIR, path.basename(filename));
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ success: false, message: 'PDF document not found on server disk.' });
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.sendFile(filePath);
  } catch (err) {
    console.error('Error serving protected PDF:', err);
    res.status(500).json({ success: false, message: 'Failed to access protected PDF.' });
  }
});

// Protected Authorized Route: Short Notes Images
app.get('/uploads/images/:filename', requireAuth, async (req, res) => {
  try {
    const filename = req.params.filename;
    const isAuthorized = await checkFileAccessAuthorization(req.user, filename, 'image');
    if (!isAuthorized) {
      return res.status(403).json({
        success: false,
        message: 'Access restricted: This study material is not assigned to your academic branch or year.',
      });
    }

    const filePath = path.join(storageService.PERSISTENT_IMAGES_DIR, path.basename(filename));
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ success: false, message: 'Image file not found on server disk.' });
    }

    res.sendFile(filePath);
  } catch (err) {
    console.error('Error serving protected image:', err);
    res.status(500).json({ success: false, message: 'Failed to access protected image.' });
  }
});

mongoose
  .connect(MONGODB_URI)
  .then(async () => {
    isMongoConnected = true;
    console.log('✅ Connected to MongoDB at:', MONGODB_URI);
  })
  .catch((err) => {
    console.warn('⚠️ MongoDB connection error:', err.message);
  });

// --- API ROUTES ---

// Root Service Ping Endpoint
app.get('/', (req, res) => {
  res.status(200).json({
    message: 'Padhlo Backend is running',
    status: 'ok',
    health: '/health',
  });
});

// Lightweight Health-Check Endpoint (for Render, Cloud Health Checks & Monitoring)
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'Padhlo Backend',
    timestamp: new Date().toISOString(),
  });
});

// Detailed Health & Service Status
app.get('/api/health', (req, res) => {
  res.json({
    status: 'online',
    appName: 'Padhlo College API',
    mongoConnected: isMongoConnected,
    storage: {
      provider: storageService.getActiveProvider(),
      isAppwriteConfigured: storageService.isAppwriteConfigured(),
      isR2Configured: storageService.isR2Configured(),
      isS3Configured: storageService.isS3Configured(),
      bucket: process.env.APPWRITE_BUCKET_ID || process.env.R2_BUCKET_NAME || process.env.AWS_S3_BUCKET || 'local-persistent-volume',
    },
    ai: {
      isConfigured: aiService.isConfigured(),
      primaryProvider: aiService.getPrimaryProvider(),
      geminiConfigured: Boolean(process.env.GEMINI_API_KEY),
      openaiConfigured: Boolean(process.env.OPENAI_API_KEY),
    },
    otp: {
      provider: 'BREVO_HTTPS_API',
      brevoConfigured: Boolean(process.env.BREVO_API_KEY),
      senderEmailConfigured: Boolean(process.env.BREVO_SENDER_EMAIL),
      senderNameConfigured: Boolean(process.env.BREVO_SENDER_NAME),
      twilioConfigured: Boolean(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_PHONE_NUMBER),
    },
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  });
});

// App Version & Remote Update Manifest for Native APK Updates
app.get('/api/app/version', (req, res) => {
  res.json({
    latestVersion: process.env.APP_LATEST_VERSION || '1.0.0',
    minimumSupportedVersion: process.env.APP_MIN_SUPPORTED_VERSION || '1.0.0',
    apkUrl: process.env.APP_APK_URL || 'https://github.com/vinay-55/Padhlo-App/releases/latest/download/padhlo.apk',
    releaseNotes: process.env.APP_RELEASE_NOTES || 'Performance enhancements, bug fixes, and improved offline study experience.',
    updateRequired: process.env.APP_UPDATE_REQUIRED === 'true',
    publishedAt: process.env.APP_UPDATE_PUBLISHED_AT || new Date().toISOString(),
  });
});
app.get('/api/version', (req, res) => res.redirect('/api/app/version'));

// Storage Status & Cloud Storage Information
app.get('/api/storage/status', (req, res) => {
  const activeProvider = storageService.getActiveProvider();
  const appwriteStatus = storageService.getAppwriteStatus();

  res.json({
    success: true,
    provider: activeProvider,
    appwrite: {
      isConfigured: appwriteStatus.configured,
      endpoint: appwriteStatus.endpoint,
      projectId: appwriteStatus.projectId,
      hasApiKey: appwriteStatus.hasApiKey,
      bucketId: appwriteStatus.bucketId,
    },
    isR2Configured: storageService.isR2Configured(),
    bucket: process.env.APPWRITE_BUCKET_ID || process.env.R2_BUCKET_NAME || process.env.AWS_S3_BUCKET || 'local-persistent-volume',
    note: activeProvider === 'APPWRITE'
      ? 'Appwrite Cloud Storage is currently ACTIVE for new PDF notes and short-notes images.'
      : (activeProvider === 'R2'
          ? 'Cloudflare R2 is currently ACTIVE. All uploads and downloads use zero-egress object storage.'
          : 'Local persistent volume is active.'),
  });
});

// Admin: List files in Appwrite bucket (ADMIN ONLY)
app.get('/api/admin/storage/appwrite/files', requireAuth, requireAdmin, async (req, res) => {
  try {
    if (!storageService.isAppwriteConfigured()) {
      return res.status(503).json({
        success: false,
        message: 'Appwrite Storage is not configured in backend/.env.',
      });
    }

    const files = await storageService.listAppwriteFiles();
    res.json({ success: true, files });
  } catch (err) {
    console.error('Error listing Appwrite files:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

// --- REAL SECURE OTP APIS ---

// Rate limiter for OTP requests (max 5 requests per 10 minutes per IP/identifier)
const otpLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 10,
  message: { success: false, message: 'Too many OTP requests. Please wait a few minutes before trying again.' },
});

// 1. Send OTP (for REGISTRATION or LOGIN)
app.post('/api/auth/otp/send', otpLimiter, async (req, res) => {
  try {
    const { identifier, purpose, tempUserData } = req.body;
    if (!identifier || typeof identifier !== 'string') {
      return res.status(400).json({ success: false, message: 'Email address or mobile number is required.' });
    }

    const cleanId = identifier.toLowerCase().trim();
    const actionPurpose = purpose === 'LOGIN' ? 'LOGIN' : 'REGISTRATION';
    const isEmail = cleanId.includes('@');

    // Format validation
    if (isEmail) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(cleanId)) {
        return res.status(400).json({ success: false, message: 'Please enter a valid email address.' });
      }
    } else {
      const phoneRegex = /^\+?[0-9]{10,15}$/;
      if (!phoneRegex.test(cleanId)) {
        return res.status(400).json({ success: false, message: 'Please enter a valid email address or 10-digit mobile number.' });
      }
    }

    if (!isMongoConnected) {
      return res.status(503).json({
        success: false,
        message: 'Database service is currently offline. OTP service is unavailable.',
      });
    }

    // 1 Email = 1 Account: If registering, ensure account does not already exist
    if (actionPurpose === 'REGISTRATION') {
      const existingUser = await User.findOne({ email: cleanId });
      if (existingUser && existingUser.isVerified) {
        return res.status(409).json({
          success: false,
          code: 'EMAIL_ALREADY_EXISTS',
          message: 'An account already exists for this email. Please sign in.',
        });
      }
    }

    // If logging in, verify user exists
    if (actionPurpose === 'LOGIN') {
      const existingUser = await User.findOne({ email: cleanId });
      if (!existingUser) {
        return res.status(404).json({
          success: false,
          message: 'No registered account found with this email. Please register first.',
        });
      }
    }

    // Check cooldown / flood protection in MongoDB (45 seconds)
    const activeOtp = await OtpVerification.findOne({
      identifier: cleanId,
      purpose: actionPurpose,
      isUsed: false,
      expiresAt: { $gt: new Date() },
    }).sort({ lastSentAt: -1 });

    if (activeOtp) {
      const secondsSinceLastSent = (Date.now() - new Date(activeOtp.lastSentAt).getTime()) / 1000;
      if (secondsSinceLastSent < 45) {
        return res.status(429).json({
          success: false,
          message: `Please wait ${Math.ceil(45 - secondsSinceLastSent)}s before requesting a new OTP.`,
          cooldownSeconds: Math.ceil(45 - secondsSinceLastSent),
        });
      }

      // Invalidate old active OTP
      await OtpVerification.updateMany(
        { identifier: cleanId, purpose: actionPurpose, isUsed: false },
        { isUsed: true }
      );
    }

    // Generate cryptographically secure 6-digit OTP
    const rawOtp = otpService.generateOtp();
    const otpHash = otpService.hashOtp(rawOtp, cleanId);
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes TTL

    // Dispatch via real provider (SMTP / SMS)
    let deliveryResult;
    if (isEmail) {
      deliveryResult = await otpService.sendEmailOtp(cleanId, rawOtp, actionPurpose);
    } else {
      deliveryResult = await otpService.sendSmsOtp(cleanId, rawOtp, actionPurpose);
    }

    // If delivery failed, return explicit error and do NOT save OTP
    if (!deliveryResult || !deliveryResult.success) {
      return res.status(502).json({
        success: false,
        message: deliveryResult?.error || 'Failed to dispatch verification email. Please check server email service configuration.',
      });
    }

    // Email was successfully delivered to student's inbox - persist OTP record
    const newOtpRecord = new OtpVerification({
      identifier: cleanId,
      otpHash,
      purpose: actionPurpose,
      expiresAt,
      tempUserData: tempUserData || null,
      lastSentAt: new Date(),
    });
    await newOtpRecord.save();

    res.json({
      success: true,
      message: `A 6-digit verification code has been dispatched to ${cleanId}. Valid for 5 minutes.`,
      identifier: cleanId,
      expiresInSeconds: 300,
      deliveryMode: deliveryResult.mode,
      cooldownSeconds: 45,
    });
  } catch (err) {
    console.error('Error sending OTP:', err);
    res.status(500).json({ success: false, message: err.message || 'Failed to dispatch OTP.' });
  }
});

// 2. Verify OTP & Finalize Registration or Login
app.post('/api/auth/otp/verify', async (req, res) => {
  try {
    const { identifier, otp, purpose, name, password, branch, academicYear, mobile } = req.body;
    if (!identifier || !otp) {
      return res.status(400).json({ success: false, message: 'Identifier and OTP code are required.' });
    }

    const cleanId = identifier.toLowerCase().trim();
    const cleanOtp = otp.toString().trim();
    const actionPurpose = purpose === 'LOGIN' ? 'LOGIN' : 'REGISTRATION';

    // If database is disconnected, fail safely without granting synthetic accounts
    if (!isMongoConnected) {
      return res.status(503).json({
        success: false,
        message: 'Database service is currently offline. Verification is unavailable.',
      });
    }

    // MongoDB Connected: Find valid OTP record
    const otpRecord = await OtpVerification.findOne({
      identifier: cleanId,
      purpose: actionPurpose,
      isUsed: false,
      expiresAt: { $gt: new Date() },
    }).sort({ lastSentAt: -1 });

    if (!otpRecord) {
      return res.status(400).json({
        success: false,
        message: 'This verification code is expired or invalid. Please request a new code.',
      });
    }

    // Check maximum attempts abuse prevention
    if (otpRecord.attempts >= otpRecord.maxAttempts) {
      await OtpVerification.findByIdAndUpdate(otpRecord._id, { isUsed: true });
      return res.status(429).json({
        success: false,
        message: 'Too many incorrect attempts. Please request a new code.',
      });
    }

    // Verify cryptographic SHA-256 hash match
    const isValid = otpService.verifyOtpHash(cleanOtp, cleanId, otpRecord.otpHash);
    if (!isValid) {
      await OtpVerification.findByIdAndUpdate(otpRecord._id, { $inc: { attempts: 1 } });
      const remaining = otpRecord.maxAttempts - (otpRecord.attempts + 1);
      return res.status(400).json({
        success: false,
        message: `That code is incorrect. ${remaining > 0 ? `${remaining} attempts remaining.` : 'Please request a new code.'}`,
      });
    }

    // Mark OTP as used immediately (prevent replay)
    otpRecord.isUsed = true;
    await otpRecord.save();

    // Handling REGISTRATION completion
    if (actionPurpose === 'REGISTRATION') {
      let existing = await User.findOne({ email: cleanId });
      if (existing && existing.isVerified) {
        return res.status(409).json({
          success: false,
          code: 'EMAIL_ALREADY_EXISTS',
          message: 'An account already exists for this email. Please sign in.',
        });
      }

      if (existing && !existing.isVerified) {
        // Recovery/resume flow for unverified account: preserve registration values
        existing.isVerified = true;
        if (password) existing.password = await bcrypt.hash(password, 10);
        await existing.save();

        const token = jwt.sign(
          { id: existing._id, email: existing.email, role: existing.role, branch: existing.branch, academicYear: existing.academicYear },
          JWT_SECRET,
          { expiresIn: '7d' }
        );
        return res.json({
          success: true,
          message: 'Account verified successfully.',
          token,
          user: {
            id: existing._id,
            name: existing.name,
            email: existing.email,
            mobile: existing.mobile,
            role: existing.role,
            branch: existing.branch,
            academicYear: existing.academicYear,
            avatar: existing.avatar,
            profilePicture: existing.profilePicture || '',
            isVerified: true,
          },
        });
      }

      const hashedPassword = password ? await bcrypt.hash(password, 10) : await bcrypt.hash(cleanOtp, 10);
      const studentName = name || cleanId.split('@')[0];
      const newUser = new User({
        name: studentName,
        email: cleanId,
        mobile: mobile || '',
        password: hashedPassword,
        role: 'STUDENT', // Guaranteed STUDENT role for public registration
        branch: branch || 'CSE', // Permanent lock
        academicYear: academicYear || '1st Year', // Permanent lock
        isVerified: true,
        avatar: studentName.slice(0, 2).toUpperCase(),
        profilePicture: '',
      });
      await newUser.save();

      const token = jwt.sign(
        { id: newUser._id, email: newUser.email, role: 'STUDENT', branch: newUser.branch, academicYear: newUser.academicYear },
        JWT_SECRET,
        { expiresIn: '7d' }
      );
      return res.status(201).json({
        success: true,
        message: 'Account created and verified successfully.',
        token,
        user: {
          id: newUser._id,
          name: newUser.name,
          email: newUser.email,
          mobile: newUser.mobile,
          role: 'STUDENT',
          branch: newUser.branch,
          academicYear: newUser.academicYear,
          avatar: newUser.avatar,
          isVerified: true,
        },
      });
    }

    // Handling LOGIN completion
    const user = await User.findOne({ email: cleanId });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Account not found with this email. Please register first.',
      });
    }

    user.isVerified = true;
    await user.save();

    const token = jwt.sign(
      { id: user._id, email: user.email, role: user.role, branch: user.branch || 'CSE', academicYear: user.academicYear || '1st Year' },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      success: true,
      message: 'Login successful.',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        mobile: user.mobile || '',
        role: user.role,
        branch: user.branch || 'CSE',
        academicYear: user.academicYear || '1st Year',
        avatar: user.avatar,
        isVerified: true,
      },
    });
  } catch (err) {
    console.error('Error verifying OTP:', err);
    res.status(500).json({ success: false, message: err.message || 'OTP verification error.' });
  }
});

// Auth: Public Register (Enforces OTP verification requirement)
app.post('/api/auth/register', async (req, res) => {
  return res.status(400).json({
    success: false,
    message: 'Direct registration is disabled. Email OTP verification is mandatory. Please request an OTP and verify to complete registration.',
  });
});

// Auth: Login (Validates password & returns user with DB role)
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password required.' });
    }

    const cleanEmail = email.toLowerCase().trim();

    if (!isMongoConnected) {
      return res.status(503).json({
        success: false,
        message: 'Database service is currently offline. Login is unavailable.',
      });
    }

    const user = await User.findOne({ email: cleanEmail });
    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    }

    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    }

    const token = jwt.sign(
      { id: user._id, email: user.email, role: user.role, branch: user.branch || 'CSE', academicYear: user.academicYear || '1st Year' },
      JWT_SECRET,
      { expiresIn: '7d' }
    );
    res.json({
      success: true,
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        mobile: user.mobile,
        role: user.role,
        branch: user.branch || 'CSE',
        academicYear: user.academicYear || '1st Year',
        avatar: user.avatar,
        isVerified: user.isVerified,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Update Profile: Only allowed fields. Branch, Academic Year, Email and profilePicture are strictly immutable for regular users.
app.put('/api/auth/profile', requireAuth, async (req, res) => {
  try {
    const { branch, academicYear, email, profilePicture } = req.body;
    
    // Strictly reject any attempt to modify immutable student identity fields
    if (branch || academicYear || email) {
      return res.status(403).json({
        success: false,
        message: 'Branch, academic year, and email address are permanently locked and cannot be changed.',
      });
    }

    // Regular users/students cannot update profile pictures
    if (req.user.role !== 'ADMIN' && profilePicture !== undefined) {
      return res.status(403).json({
        success: false,
        message: 'Profile picture is locked. Regular users cannot update profile pictures.',
      });
    }

    const updates = {};
    if (req.user.role === 'ADMIN' && profilePicture !== undefined) {
      updates.profilePicture = profilePicture;
    }

    if (isMongoConnected && Object.keys(updates).length > 0) {
      await User.findByIdAndUpdate(req.user.id, updates);
    }

    res.json({ success: true, updates, message: 'Profile updated successfully.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Upload / Update Profile Picture (ADMIN ONLY with Appwrite Storage)
app.post('/api/auth/profile-picture', requireAuth, requireAdmin, uploadImage.single('avatar'), async (req, res) => {
  try {
    const targetUserId = req.body?.userId || req.user.id;
    let imageBuffer = null;
    let mimeType = 'image/jpeg';
    let originalFilename = `avatar_${targetUserId}.jpg`;
    let profilePictureUrl = req.body?.profilePicture;

    if (req.file) {
      imageBuffer = await fs.promises.readFile(req.file.path);
      mimeType = req.file.mimetype || 'image/jpeg';
      originalFilename = req.file.originalname || `avatar_${targetUserId}.jpg`;
    } else if (profilePictureUrl && profilePictureUrl.startsWith('data:image/')) {
      const match = profilePictureUrl.match(/^data:(image\/[a-zA-Z+]+);base64,(.+)$/);
      if (match) {
        mimeType = match[1];
        imageBuffer = Buffer.from(match[2], 'base64');
        const ext = mimeType.split('/')[1] || 'jpg';
        originalFilename = `avatar_${targetUserId}.${ext}`;
      }
    }

    if (!imageBuffer && !profilePictureUrl) {
      return res.status(400).json({ success: false, message: 'Image file or data URI is required.' });
    }

    // Check size limit: max 5 MB
    if (imageBuffer && imageBuffer.length > 5 * 1024 * 1024) {
      return res.status(413).json({ success: false, message: 'Profile picture must be under 5 MB.' });
    }

    let storageKey = '';
    let storageProvider = 'LOCAL_PERSISTENT';

    if (imageBuffer) {
      const storageResult = await storageService.uploadFilePermanently({
        buffer: imageBuffer,
        originalFilename,
        mimeType,
        folder: 'profiles',
      });

      profilePictureUrl = storageResult.fileUrl.startsWith('http')
        ? storageResult.fileUrl
        : `${req.protocol}://${req.get('host')}${storageResult.fileUrl}`;
      storageKey = storageResult.key;
      storageProvider = storageResult.provider;

      // Clean up previous image in storage if user had one
      if (isMongoConnected) {
        const currentUser = await User.findById(targetUserId);
        if (currentUser && currentUser.profilePictureKey && currentUser.profilePictureKey !== storageKey) {
          try {
            await storageService.deleteFilePermanently({
              provider: storageProvider,
              key: currentUser.profilePictureKey,
            });
          } catch (e) {
            console.warn('Failed to clean up old avatar:', e.message);
          }
        }
      }
    }

    if (isMongoConnected) {
      await User.findByIdAndUpdate(targetUserId, {
        profilePicture: profilePictureUrl,
        ...(storageKey ? { profilePictureKey: storageKey } : {}),
      });
    }

    res.json({
      success: true,
      profilePicture: profilePictureUrl,
      storageProvider,
      message: 'Profile picture updated successfully.',
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Delete Profile Picture (ADMIN ONLY)
app.delete('/api/auth/profile-picture', requireAuth, requireAdmin, async (req, res) => {
  try {
    const targetUserId = req.body?.userId || req.query?.userId || req.user.id;
    if (isMongoConnected) {
      if (!mongoose.isValidObjectId(targetUserId)) {
        return res.status(400).json({ success: false, message: 'Invalid user ID provided.' });
      }
      const user = await User.findById(targetUserId);
      if (!user) {
        return res.status(404).json({ success: false, message: 'User not found.' });
      }
      if (user.profilePictureKey) {
        try {
          await storageService.deleteFilePermanently({
            provider: 'APPWRITE',
            key: user.profilePictureKey,
          });
        } catch (e) {
          console.warn('Storage delete notice:', e.message);
        }
      }
      user.profilePicture = '';
      user.profilePictureKey = '';
      await user.save();
    }
    res.json({ success: true, message: 'Profile picture removed by administrator.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// --- NOTES (PDFs) APIS ---

// Helper to build branch, year, semester & resource filter
function buildAccessFilter(user, reqQuery = {}) {
  const query = { isDeleted: { $ne: true } };

  // Scope to B.Tech only
  query.$or = [
    { course: 'B.Tech' },
    { course: { $exists: false } },
    { course: null },
  ];

  if (!user || user.role === 'ADMIN') {
    if (!user) {
      query.isPublished = true;
    }
    // Admin or guest has full college-wide visibility with optional manual filters
    if (reqQuery.branch && reqQuery.branch !== 'ALL') {
      const canonicalBranch = aktuNotesService.normalizeBranch(reqQuery.branch);
      query.branches = { $in: ['ALL', canonicalBranch, reqQuery.branch] };
    }
    if (reqQuery.semester && reqQuery.semester !== 'All') {
      query.semester = Number(reqQuery.semester);
    }
    if (reqQuery.resourceType && reqQuery.resourceType !== 'All') {
      query.resourceType = reqQuery.resourceType;
    }
    if (reqQuery.subject && reqQuery.subject !== 'All') {
      query.subject = reqQuery.subject;
    }
    return query;
  }

  // --- STRICT REGISTRATION-BASED STUDENT ACCESS ---
  query.isPublished = true;
  const studentBranch = aktuNotesService.normalizeBranch(user.branch || 'CSE');
  const studentYear = user.academicYear || '1st Year';
  const allowedSemesters = aktuNotesService.getSemestersForYear(studentYear);

  // 1. Branch filter:
  const allowedBranches = studentYear === '1st Year'
    ? ['ALL', 'ALL_FIRST_YEAR', 'COMMON', studentBranch, user.branch]
    : ['ALL', studentBranch, user.branch];

  // 2. Build multi-condition filter that supports Notes, Exams, Announcements & Syllabus
  const conditions = [
    {
      $or: [
        { branches: { $exists: false } },
        { branches: { $size: 0 } },
        { branches: { $in: allowedBranches } },
      ],
    },
    {
      $or: [
        { years: { $exists: false } },
        { years: { $size: 0 } },
        { years: 'ALL' },
        { years: studentYear },
        { semester: { $in: allowedSemesters } },
      ],
    },
  ];

  if (reqQuery.semester && reqQuery.semester !== 'All') {
    const requestedSem = Number(reqQuery.semester);
    if (!allowedSemesters.includes(requestedSem)) {
      return { _id: null };
    }
    query.semester = requestedSem;
  }

  query.$and = conditions;

  // 3. Optional Subject and Resource Type filters
  if (reqQuery.resourceType && reqQuery.resourceType !== 'All') {
    query.resourceType = reqQuery.resourceType;
  }
  if (reqQuery.subject && reqQuery.subject !== 'All') {
    query.subject = reqQuery.subject;
  }

  return query;
}

// Get notes (branch and year filtered for students, all for admin, published for guest)
app.get('/api/notes', optionalAuth, async (req, res) => {
  try {
    const query = buildAccessFilter(req.user, req.query);
    const rawNotes = isMongoConnected ? await Note.find(query).sort({ semester: 1, uploadedAt: -1 }) : [];
    
    // Attach short-lived signed URLs for Cloudflare R2 / S3 files
    const notes = await Promise.all(
      rawNotes.map(async (n) => {
        const noteObj = n.toObject ? n.toObject() : { ...n };
        const provider = noteObj.storageProvider || 'LOCAL_PERSISTENT';
        
        if (provider === 'APPWRITE') {
          // Serve via authenticated proxy so Appwrite API Key is never exposed
          noteObj.fileUrl = `${req.protocol}://${req.get('host')}/api/notes/${noteObj._id || noteObj.id}/file`;
        } else if (noteObj.storageKey && (provider === 'R2' || provider === 'S3')) {
          try {
            const signedUrl = await storageService.getSignedDownloadUrl({
              provider,
              key: noteObj.storageKey,
              bucket: noteObj.storageBucket,
              expiresIn: 3600, // 1 hour validity
              fileName: noteObj.fileName,
            });
            noteObj.signedDownloadUrl = signedUrl;
            // If no public base URL is defined, provide signed URL as direct fileUrl
            if (!process.env.R2_PUBLIC_BASE_URL || !noteObj.fileUrl.startsWith('http')) {
              noteObj.fileUrl = signedUrl;
            }
          } catch (signErr) {
            // Fallback to authenticated backend proxy endpoint
            noteObj.fileUrl = `${req.protocol}://${req.get('host')}/api/notes/${noteObj._id || noteObj.id}/file`;
          }
        }

        // Clean any legacy gview wrapper from previewUrl or externalUrl
        if (noteObj.previewUrl && noteObj.previewUrl.includes('docs.google.com/gview') && noteObj.previewUrl.includes('url=')) {
          const match = noteObj.previewUrl.match(/[?&]url=([^&]+)/);
          if (match && match[1]) {
            try {
              noteObj.previewUrl = decodeURIComponent(match[1]);
            } catch {}
          }
        }
        if (noteObj.externalUrl && noteObj.externalUrl.includes('docs.google.com/gview') && noteObj.externalUrl.includes('url=')) {
          const match = noteObj.externalUrl.match(/[?&]url=([^&]+)/);
          if (match && match[1]) {
            try {
              noteObj.externalUrl = decodeURIComponent(match[1]);
            } catch {}
          }
        }

        return noteObj;
      })
    );

    res.json({ success: true, notes });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Download / Stream Note PDF (Authenticated, Branch & Year Authorized, with Download Tracking)
app.get('/api/notes/:id/file', requireAuth, async (req, res) => {
  try {
    const noteId = req.params.id;
    if (!isMongoConnected) {
      return res.status(503).json({ success: false, message: 'Database offline in demo mode.' });
    }

    if (!mongoose.isValidObjectId(noteId)) {
      return res.status(400).json({ success: false, message: 'Invalid note ID format.' });
    }

    const note = await Note.findById(noteId);
    if (!note || note.isDeleted) {
      return res.status(404).json({ success: false, message: 'Study note not found or removed.' });
    }

    // Authorization check: Admin has full access. Students must match branch & year rules
    if (req.user.role !== 'ADMIN') {
      const studentBranch = aktuNotesService.normalizeBranch(req.user.branch || 'CSE');
      const studentYear = req.user.academicYear || '1st Year';
      const allowedSemesters = aktuNotesService.getSemestersForYear(studentYear);

      const branchAllowed = 
        !note.branches || 
        note.branches.length === 0 || 
        note.branches.includes('ALL') || 
        note.branches.includes('ALL_FIRST_YEAR') ||
        note.branches.includes('COMMON') ||
        note.branches.some(b => aktuNotesService.normalizeBranch(b) === studentBranch);

      const yearAllowed = 
        !note.years || 
        note.years.length === 0 || 
        note.years.includes('ALL') || 
        note.years.includes(studentYear) ||
        (note.semester && allowedSemesters.includes(Number(note.semester)));

      if (!note.isPublished || !branchAllowed || !yearAllowed) {
        return res.status(403).json({
          success: false,
          message: 'Access restricted: This study material is not assigned to your registered branch or academic year.',
        });
      }
    }

    // Automatically record verified download event
    try {
      await DownloadEvent.create({
        userId: req.user.id,
        resourceId: note._id.toString(),
        resourceType: 'NOTE',
        fileName: note.fileName,
        branch: req.user.branch || 'CSE',
        academicYear: req.user.academicYear || '1st Year',
      });
    } catch (trackErr) {
      console.warn('Download tracking notice:', trackErr.message);
    }

    // If client requested stream or backend streaming is preferred
    const shouldStream = req.query.stream === 'true';
    if (shouldStream) {
      const fileData = await storageService.getFileStream({
        provider: note.storageProvider,
        key: note.fileId || note.storageKey || note.fileName,
        bucket: note.storageBucket,
      });

      if (!fileData) {
        return res.status(404).json({ success: false, message: 'Physical file not found in storage.' });
      }

      res.setHeader('Content-Type', fileData.contentType || 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="${note.fileName.replace(/[^a-zA-Z0-9.-]/g, '_')}"`);
      if (fileData.contentLength) res.setHeader('Content-Length', fileData.contentLength);

      return fileData.stream.pipe(res);
    }

    // For Appwrite Storage: Stream directly through authenticated backend proxy
    if (note.storageProvider === 'APPWRITE') {
      const fileData = await storageService.getFileStream({
        provider: 'APPWRITE',
        key: note.fileId || note.storageKey || note.fileName,
        bucket: note.storageBucket,
      });

      if (!fileData) {
        return res.status(404).json({ success: false, message: 'PDF document not found in Appwrite Storage.' });
      }

      res.setHeader('Content-Type', fileData.contentType || 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="${note.fileName.replace(/[^a-zA-Z0-9.-]/g, '_')}"`);
      if (fileData.contentLength) res.setHeader('Content-Length', fileData.contentLength);

      return fileData.stream.pipe(res);
    }

    // For Cloudflare R2 / S3: generate short-lived signed URL and redirect (302)
    if (note.storageProvider === 'R2' || note.storageProvider === 'S3') {
      const signedUrl = await storageService.getSignedDownloadUrl({
        provider: note.storageProvider,
        key: note.storageKey,
        bucket: note.storageBucket,
        expiresIn: 1800, // 30 minutes
        fileName: note.fileName,
      });
      return res.redirect(signedUrl);
    }

    // For local persistent files: serve directly
    const localFile = path.join(storageService.PERSISTENT_DIR, path.basename(note.storageKey || note.fileName));
    if (fs.existsSync(localFile)) {
      return res.sendFile(localFile);
    }

    res.status(404).json({ success: false, message: 'PDF document not found on server disk.' });
  } catch (err) {
    console.error('Error serving note file:', err);
    res.status(500).json({ success: false, message: 'Failed to access note file.' });
  }
});

// Get Short-Lived Signed Download URL for a Note (Authenticated)
app.get('/api/notes/:id/download-url', requireAuth, async (req, res) => {
  try {
    const noteId = req.params.id;
    if (!isMongoConnected) {
      return res.status(503).json({ success: false, message: 'Database offline in demo mode.' });
    }

    const note = await Note.findById(noteId);
    if (!note || note.isDeleted) {
      return res.status(404).json({ success: false, message: 'Study note not found.' });
    }

    // Branch & year authorization for students
    if (req.user.role !== 'ADMIN') {
      const studentBranch = req.user.branch || 'CSE';
      const studentYear = req.user.academicYear || '1st Year';
      const branchAllowed = !note.branches || note.branches.includes('ALL') || note.branches.includes(studentBranch);
      const yearAllowed = !note.years || note.years.includes('ALL') || note.years.includes(studentYear);
      if (!note.isPublished || !branchAllowed || !yearAllowed) {
        return res.status(403).json({ success: false, message: 'Not authorized for this document.' });
      }
    }

    // Track download event
    await DownloadEvent.create({
      userId: req.user.id,
      resourceId: note._id.toString(),
      resourceType: 'NOTE',
      fileName: note.fileName,
      branch: req.user.branch || 'CSE',
      academicYear: req.user.academicYear || '1st Year',
    });

    const downloadUrl = await storageService.getSignedDownloadUrl({
      provider: note.storageProvider,
      key: note.storageKey || note.fileName,
      bucket: note.storageBucket,
      expiresIn: 3600,
      fileName: note.fileName,
    });

    res.json({
      success: true,
      downloadUrl,
      fileName: note.fileName,
      expiresIn: 3600,
      provider: note.storageProvider,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Upload PDF note (ADMIN ONLY with Cloudflare R2 storage)
// Helper to parse and resolve in-app preview and external URLs
function resolvePdfUrls(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') {
    return { isDrive: false, previewUrl: '', externalUrl: '', downloadUrl: '' };
  }
  let clean = rawUrl.trim();

  // If already wrapped in Google Docs Viewer, unwrap to original URL
  if (clean.includes('docs.google.com/gview') && clean.includes('url=')) {
    try {
      const matchUrl = clean.match(/[?&]url=([^&]+)/);
      if (matchUrl && matchUrl[1]) {
        clean = decodeURIComponent(matchUrl[1]);
      }
    } catch {
      // Keep clean as is
    }
  }

  // Google Drive folder link
  const folderMatch = clean.match(/drive\.google\.com\/(?:drive\/(?:u\/\d+\/)?folders\/|embeddedfolderview\?id=)([a-zA-Z0-9_-]+)/);
  if (folderMatch && folderMatch[1]) {
    const folderId = folderMatch[1];
    return {
      isDrive: true,
      previewUrl: `https://drive.google.com/embeddedfolderview?id=${folderId}#list`,
      externalUrl: `https://drive.google.com/drive/folders/${folderId}`,
      downloadUrl: `https://drive.google.com/drive/folders/${folderId}`,
    };
  }

  // Google Drive file link
  const driveMatch = clean.match(/(?:drive\.google\.com\/(?:file\/d\/|(?:open|uc)\?(?:.*&)?id=)|docs\.google\.com\/(?:file|document)\/d\/)([a-zA-Z0-9_-]+)/);
  if (driveMatch && driveMatch[1]) {
    const driveId = driveMatch[1];
    return {
      isDrive: true,
      previewUrl: `https://drive.google.com/file/d/${driveId}/preview`,
      externalUrl: `https://drive.google.com/file/d/${driveId}/view?usp=sharing`,
      downloadUrl: `https://drive.google.com/uc?export=download&id=${driveId}`,
    };
  }

  // Direct PDF, Appwrite storage proxy, or external website link
  return {
    isDrive: false,
    previewUrl: clean,
    externalUrl: clean,
    downloadUrl: clean,
  };
}

// Upload PDF note (ADMIN ONLY with Cloudflare R2 storage)
app.post('/api/notes/upload', requireAuth, requireAdmin, upload.single('pdf'), async (req, res) => {
  try {
    const { 
      title, 
      subject, 
      subjectCode = '', 
      semester = 1, 
      unit = 'Unit 1', 
      provider = 'College Faculty', 
      teacherName = '', 
      type = 'Lecture Notes', 
      description, 
      branches, 
      years, 
      isImportant, 
      isPublished,
      isPyq,
      pyqYear,
    } = req.body;

    if (!title || !subject) {
      return res.status(400).json({ success: false, message: 'Title and subject are required.' });
    }

    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No PDF file uploaded.' });
    }

    const calculatedIsPyq = isPyq === 'true' || isPyq === true || type === 'PYQ' || type === 'PYQ Solved' || (title && title.toLowerCase().includes('pyq'));
    const safePyqYear = pyqYear || '';

    let parsedBranches = ['ALL'];
    if (branches) {
      try {
        parsedBranches = Array.isArray(branches) ? branches : JSON.parse(branches);
      } catch (e) {
        parsedBranches = [branches];
      }
    }

    let parsedYears = ['ALL'];
    if (years) {
      try {
        parsedYears = Array.isArray(years) ? years : JSON.parse(years);
      } catch (e) {
        parsedYears = [years];
      }
    }

    // Read the uploaded file into buffer for permanent Cloudflare R2 storage
    const fileBuffer = await fs.promises.readFile(req.file.path);
    const storageResult = await storageService.uploadPdfPermanently({
      buffer: fileBuffer,
      originalFilename: req.file.originalname,
      mimeType: req.file.mimetype || 'application/pdf',
      uniqueFilename: req.file.filename,
    });

    const fileUrl = storageResult.fileUrl.startsWith('http')
      ? storageResult.fileUrl
      : `${req.protocol}://${req.get('host')}${storageResult.fileUrl}`;
    const fileSizeFormatted = (req.file.size / (1024 * 1024)).toFixed(1) + ' MB';
    const urls = resolvePdfUrls(fileUrl);

    // Record in Admin Audit Log
    if (isMongoConnected) {
      await AdminAuditLog.create({
        adminId: req.user.id,
        adminName: req.user.name || 'Admin',
        action: 'PERMANENT_UPLOAD_PDF',
        resourceType: 'NOTE',
        details: `Uploaded permanent PDF to ${storageResult.provider}: "${title}" (${req.file.originalname}) [Key: ${storageResult.key}]`,
      });
    }

    if (!isMongoConnected) {
      return res.status(201).json({
        success: true,
        note: {
          id: 'note_' + Date.now(),
          title,
          subject,
          subjectCode: subjectCode || '',
          semester: Number(semester) || 1,
          unit: unit || 'Unit 1',
          provider: provider || 'College Faculty',
          teacherName: teacherName || '',
          type: type || 'Lecture Notes',
          description,
          branches: parsedBranches,
          years: parsedYears,
          fileUrl,
          externalUrl: fileUrl,
          previewUrl: urls.previewUrl || fileUrl,
          isExternal: false,
          fileName: req.file.originalname,
          fileSize: req.file.size,
          fileSizeFormatted,
          mimeType: req.file.mimetype || 'application/pdf',
          storageProvider: storageResult.provider,
          storageKey: storageResult.key,
          storageBucket: storageResult.bucket,
          fileId: storageResult.fileId || (storageResult.provider === 'APPWRITE' ? storageResult.key : ''),
          storageType: storageResult.provider === 'APPWRITE' ? 'appwrite' : 'local',
          isImportant: isImportant === 'true' || isImportant === true,
          isPublished: isPublished !== 'false',
          isPyq: calculatedIsPyq,
          pyqYear: safePyqYear,
          uploadedAt: new Date().toISOString(),
        },
      });
    }

    let existingNote = null;
    if (isMongoConnected) {
      const safeTitleRegex = new RegExp(`^${title.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i');
      const safeSubjectRegex = new RegExp(`^${subject.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i');
      existingNote = await Note.findOne({
        isDeleted: { $ne: true },
        title: safeTitleRegex,
        subject: safeSubjectRegex,
        unit: unit || 'Unit 1',
      });
    }

    if (existingNote) {
      existingNote.subjectCode = subjectCode || existingNote.subjectCode;
      existingNote.semester = Number(semester) || existingNote.semester;
      existingNote.provider = provider || existingNote.provider;
      existingNote.teacherName = teacherName || existingNote.teacherName;
      existingNote.type = type || existingNote.type;
      existingNote.description = description || existingNote.description;
      existingNote.branches = parsedBranches;
      existingNote.years = parsedYears;
      existingNote.fileUrl = fileUrl;
      existingNote.externalUrl = fileUrl;
      existingNote.previewUrl = urls.previewUrl || fileUrl;
      existingNote.fileName = req.file.originalname;
      existingNote.fileSize = req.file.size;
      existingNote.fileSizeFormatted = fileSizeFormatted;
      existingNote.mimeType = req.file.mimetype || 'application/pdf';
      existingNote.storageProvider = storageResult.provider;
      existingNote.storageKey = storageResult.key;
      existingNote.storageBucket = storageResult.bucket;
      existingNote.fileId = storageResult.fileId || (storageResult.provider === 'APPWRITE' ? storageResult.key : '');
      existingNote.storageType = storageResult.provider === 'APPWRITE' ? 'appwrite' : 'local';
      existingNote.isImportant = isImportant === 'true' || isImportant === true;
      existingNote.isPublished = isPublished !== 'false';
      existingNote.isPyq = calculatedIsPyq;
      existingNote.pyqYear = safePyqYear;
      await existingNote.save();
      return res.status(200).json({ success: true, note: existingNote, updated: true });
    }

    const newNote = new Note({
      title,
      subject,
      subjectCode: subjectCode || '',
      semester: Number(semester) || 1,
      unit: unit || 'Unit 1',
      provider: provider || 'College Faculty',
      teacherName: teacherName || '',
      type: type || 'Lecture Notes',
      description,
      branches: parsedBranches,
      years: parsedYears,
      fileUrl,
      externalUrl: fileUrl,
      previewUrl: urls.previewUrl || fileUrl,
      isExternal: false,
      fileName: req.file.originalname,
      fileSize: req.file.size,
      fileSizeFormatted,
      mimeType: req.file.mimetype || 'application/pdf',
      storageProvider: storageResult.provider,
      storageKey: storageResult.key,
      storageBucket: storageResult.bucket,
      fileId: storageResult.fileId || (storageResult.provider === 'APPWRITE' ? storageResult.key : ''),
      storageType: storageResult.provider === 'APPWRITE' ? 'appwrite' : 'local',
      isImportant: isImportant === 'true' || isImportant === true,
      isPublished: isPublished !== 'false',
      isPyq: calculatedIsPyq,
      pyqYear: safePyqYear,
      uploadedBy: req.user.id,
    });
    await newNote.save();

    res.status(201).json({ success: true, note: newNote });
  } catch (err) {
    console.error('Error uploading permanent PDF:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// Register External Link Note (ADMIN ONLY - Google Drive or External PDF link)
app.post('/api/notes/register-external', requireAuth, requireAdmin, async (req, res) => {
  try {
    const {
      title,
      subject,
      subjectCode = '',
      semester = 1,
      unit = 'Unit 1',
      provider = 'External Provider',
      teacherName = '',
      type = 'Handwritten Notes',
      description = '',
      externalUrl,
      branches = ['ALL'],
      years = ['ALL'],
      isImportant = false,
      isPublished = true,
      fileSizeFormatted = 'PDF Document',
      isPyq = false,
      pyqYear = ''
    } = req.body;

    if (!title || !subject || !externalUrl) {
      return res.status(400).json({
        success: false,
        message: 'Title, Subject, and External PDF/Drive URL are required.'
      });
    }

    const calculatedIsPyq = isPyq === 'true' || isPyq === true || type === 'PYQ' || type === 'PYQ Solved' || (title && title.toLowerCase().includes('pyq'));
    const safePyqYear = pyqYear || '';

    const urls = resolvePdfUrls(externalUrl);

    let parsedBranches = ['ALL'];
    if (branches) {
      try {
        parsedBranches = Array.isArray(branches) ? branches : JSON.parse(branches);
      } catch (e) {
        parsedBranches = [branches];
      }
    }

    let parsedYears = ['ALL'];
    if (years) {
      try {
        parsedYears = Array.isArray(years) ? years : JSON.parse(years);
      } catch (e) {
        parsedYears = [years];
      }
    }

    const fileName = title.trim().replace(/[^a-zA-Z0-9_\-\. ]/g, '') + '.pdf';

    // Record in Admin Audit Log
    if (isMongoConnected) {
      await AdminAuditLog.create({
        adminId: req.user.id,
        adminName: req.user.name || 'Admin',
        action: 'REGISTER_EXTERNAL_PDF',
        resourceType: 'NOTE',
        details: `Registered external PDF link: "${title}" (${urls.isDrive ? 'Google Drive' : 'External Web'}) [${urls.externalUrl}]`,
      });
    }

    if (!isMongoConnected) {
      return res.status(201).json({
        success: true,
        note: {
          id: 'note_ext_' + Date.now(),
          title,
          subject,
          subjectCode,
          semester: Number(semester) || 1,
          unit,
          provider,
          teacherName,
          type,
          description,
          branches: parsedBranches,
          years: parsedYears,
          fileUrl: urls.downloadUrl,
          externalUrl: urls.externalUrl,
          previewUrl: urls.previewUrl,
          isExternal: true,
          fileName,
          fileSize: 0,
          fileSizeFormatted,
          mimeType: 'application/pdf',
          storageProvider: 'EXTERNAL',
          isImportant: Boolean(isImportant),
          isPublished: Boolean(isPublished),
          isPyq: calculatedIsPyq,
          pyqYear: safePyqYear,
          uploadedAt: new Date().toISOString(),
        }
      });
    }

    let existing = null;
    if (isMongoConnected) {
      const safeTitleRegex = new RegExp(`^${title.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i');
      const safeSubjectRegex = new RegExp(`^${subject.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i');
      existing = await Note.findOne({
        isDeleted: { $ne: true },
        $or: [
          { externalUrl: urls.externalUrl },
          { title: safeTitleRegex, subject: safeSubjectRegex, unit: unit || 'Unit 1' }
        ]
      });
    }

    if (existing) {
      existing.title = title;
      existing.subject = subject;
      existing.subjectCode = subjectCode || existing.subjectCode;
      existing.semester = Number(semester) || existing.semester;
      existing.unit = unit || existing.unit;
      existing.provider = provider || existing.provider;
      existing.teacherName = teacherName || existing.teacherName;
      existing.type = type || existing.type;
      existing.description = description || existing.description;
      existing.branches = parsedBranches;
      existing.years = parsedYears;
      existing.fileUrl = urls.downloadUrl;
      existing.externalUrl = urls.externalUrl;
      existing.previewUrl = urls.previewUrl;
      existing.isExternal = true;
      existing.fileName = fileName;
      existing.fileSizeFormatted = fileSizeFormatted;
      existing.storageProvider = 'EXTERNAL';
      existing.isImportant = Boolean(isImportant);
      existing.isPublished = Boolean(isPublished);
      existing.isPyq = calculatedIsPyq;
      existing.pyqYear = safePyqYear;
      await existing.save();
      return res.status(200).json({ success: true, note: existing, updated: true });
    }

    const note = new Note({
      title,
      subject,
      subjectCode,
      semester: Number(semester) || 1,
      unit,
      provider,
      teacherName,
      type,
      description,
      branches: parsedBranches,
      years: parsedYears,
      fileUrl: urls.downloadUrl,
      externalUrl: urls.externalUrl,
      previewUrl: urls.previewUrl,
      isExternal: true,
      fileName,
      fileSize: 0,
      fileSizeFormatted,
      mimeType: 'application/pdf',
      storageProvider: 'EXTERNAL',
      isImportant: Boolean(isImportant),
      isPublished: Boolean(isPublished),
      isPyq: calculatedIsPyq,
      pyqYear: safePyqYear,
      uploadedBy: req.user.id,
    });
    await note.save();

    res.status(201).json({ success: true, note });
  } catch (err) {
    console.error('Error registering external PDF link:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// Admin: Inspect External Source for B.Tech AKTU Notes (SSRF-Safe)
app.post('/api/admin/notes/inspect-source', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { url } = req.body;
    const targetUrl = (url || '').trim() || 'https://notesgallery.com/aktu-notes/';

    if (!aktuNotesService.isSafeExternalUrl(targetUrl)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or restricted source URL. External HTTP/HTTPS URLs only.',
      });
    }

    let existingNotes = [];
    if (isMongoConnected) {
      existingNotes = await Note.find({ isDeleted: { $ne: true } }).select('title subject semester sourceUrl externalUrl fileUrl');
    }

    const discovered = await aktuNotesService.discoverNotesFromSource(targetUrl, existingNotes);

    res.json({
      success: true,
      url: targetUrl,
      course: 'B.Tech',
      count: discovered.length,
      resources: discovered,
    });
  } catch (err) {
    console.error('Error inspecting notes source:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

// Admin: Bulk Import B.Tech Notes
app.post('/api/admin/notes/bulk-import', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { items, overwriteDuplicates } = req.body;
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, message: 'No resources provided for import.' });
    }

    if (!isMongoConnected) {
      return res.status(503).json({ success: false, message: 'Database offline. Cannot perform import.' });
    }

    let importedCount = 0;
    let skippedCount = 0;
    let failedCount = 0;
    const results = [];

    for (const item of items) {
      try {
        if (!item.title || !item.subject) {
          failedCount++;
          results.push({ title: item.title || 'Untitled', status: 'FAILED', reason: 'Missing title or subject' });
          continue;
        }

        const sem = Number(item.semester) || 1;
        const normalizedBranch = aktuNotesService.normalizeBranch(item.branch || (item.branches && item.branches[0]) || 'ALL');
        const assignedBranches = Array.isArray(item.branches) && item.branches.length > 0 
          ? item.branches.map(b => aktuNotesService.normalizeBranch(b))
          : [normalizedBranch];
        const assignedYear = aktuNotesService.getYearForSemester(sem);

        const sourceUrl = (item.sourceUrl || item.externalUrl || item.fileUrl || '').trim();
        const sourceHash = aktuNotesService.generateResourceHash(sourceUrl, item.title, item.subject, sem);

        // Check for duplicates
        const existing = await Note.findOne({
          isDeleted: { $ne: true },
          $or: [
            { sourceId: sourceHash },
            ...(sourceUrl ? [{ sourceUrl }, { externalUrl: sourceUrl }] : []),
            { title: item.title.trim(), subject: item.subject.trim(), semester: sem }
          ]
        });

        if (existing && !overwriteDuplicates) {
          skippedCount++;
          results.push({ title: item.title, status: 'SKIPPED', reason: 'Resource already exists in library' });
          continue;
        }

        const resolved = aktuNotesService.resolvePdfUrls(sourceUrl);
        const fileName = `${item.title.replace(/[^a-zA-Z0-9.-]/g, '_')}.pdf`;

        const noteDoc = {
          title: item.title.trim(),
          subject: item.subject.trim(),
          subjectCode: item.subjectCode ? item.subjectCode.trim() : '',
          semester: sem,
          unit: item.unit || 'Full Syllabus',
          provider: item.provider || 'NotesGallery / AKTU Faculty',
          teacherName: item.teacherName || 'AKTU Faculty Pool',
          course: 'B.Tech',
          type: item.resourceType || item.type || 'Notes',
          resourceType: item.resourceType || 'Notes',
          description: item.description || `AKTU B.Tech Semester ${sem} study material for ${item.subject}.`,
          branches: assignedBranches,
          years: [assignedYear],
          fileUrl: resolved.downloadUrl || sourceUrl,
          externalUrl: resolved.externalUrl || sourceUrl,
          previewUrl: resolved.previewUrl || sourceUrl,
          isExternal: true,
          fileName,
          fileSizeFormatted: item.fileSizeFormatted || '1.8 MB',
          storageProvider: 'EXTERNAL',
          storageType: 'external',
          sourceUrl,
          sourceId: sourceHash,
          academicScheme: 'AKTU B.Tech Curriculum',
          isImportant: Boolean(item.isImportant),
          isPublished: true,
          isPyq: item.resourceType === 'PYQ' || Boolean(item.isPyq),
          pyqYear: item.pyqYear || '',
          visibilityStatus: 'ACTIVE',
          uploadedBy: req.user.id,
          uploadedAt: new Date(),
        };

        if (existing && overwriteDuplicates) {
          await Note.findByIdAndUpdate(existing._id, noteDoc);
          importedCount++;
          results.push({ id: existing._id, title: item.title, status: 'UPDATED' });
        } else {
          const created = await Note.create(noteDoc);
          importedCount++;
          results.push({ id: created._id, title: item.title, status: 'IMPORTED' });
        }
      } catch (itemErr) {
        failedCount++;
        results.push({ title: item.title || 'Untitled', status: 'FAILED', reason: itemErr.message });
      }
    }

    // Log admin audit
    try {
      await AdminAuditLog.create({
        adminId: req.user.id,
        adminName: req.user.name || 'Administrator',
        action: 'BULK_IMPORT_NOTES',
        resourceType: 'NOTE',
        details: `Imported ${importedCount} items, skipped ${skippedCount}, failed ${failedCount}.`,
      });
    } catch (auditErr) {
      console.warn('Audit log notice:', auditErr.message);
    }

    res.json({
      success: true,
      importedCount,
      skippedCount,
      failedCount,
      results,
    });
  } catch (err) {
    console.error('Error in bulk import:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// Update or Replace Note (ADMIN ONLY — Verifies replacement in R2 before removing old file)
app.put('/api/notes/:id', requireAuth, requireAdmin, upload.single('pdf'), async (req, res) => {
  try {
    const noteId = req.params.id;
    if (!isMongoConnected) {
      return res.status(503).json({ success: false, message: 'Database offline.' });
    }

    const note = await Note.findById(noteId);
    if (!note) {
      return res.status(404).json({ success: false, message: 'Note not found.' });
    }

    const { title, subject, description, branches, years, isImportant, isPublished } = req.body;

    if (title) note.title = title;
    if (subject) note.subject = subject;
    if (description !== undefined) note.description = description;
    if (isImportant !== undefined) note.isImportant = isImportant === 'true' || isImportant === true;
    if (isPublished !== undefined) note.isPublished = isPublished !== 'false' && isPublished !== false;

    if (branches) {
      try {
        note.branches = Array.isArray(branches) ? branches : JSON.parse(branches);
      } catch {
        note.branches = [branches];
      }
    }

    if (years) {
      try {
        note.years = Array.isArray(years) ? years : JSON.parse(years);
      } catch {
        note.years = [years];
      }
    }

    // If replacement PDF is attached
    if (req.file) {
      const oldStorageKey = note.storageKey;
      const oldProvider = note.storageProvider;

      // 1. Upload new file first
      const fileBuffer = await fs.promises.readFile(req.file.path);
      const storageResult = await storageService.uploadPdfPermanently({
        buffer: fileBuffer,
        originalFilename: req.file.originalname,
        mimeType: req.file.mimetype || 'application/pdf',
        uniqueFilename: req.file.filename,
      });

      // 2. Explicitly verify the replacement object physically exists in storage
      const exists = await storageService.verifyFileExists({
        provider: storageResult.provider,
        key: storageResult.key,
        bucket: storageResult.bucket,
      });

      if (!exists) {
        throw new Error('Replacement file verification failed in object storage.');
      }

      // 3. Update database references
      note.fileUrl = storageResult.fileUrl.startsWith('http')
        ? storageResult.fileUrl
        : `${req.protocol}://${req.get('host')}${storageResult.fileUrl}`;
      note.fileName = req.file.originalname;
      note.fileSize = req.file.size;
      note.fileSizeFormatted = (req.file.size / (1024 * 1024)).toFixed(1) + ' MB';
      note.mimeType = req.file.mimetype || 'application/pdf';
      note.storageProvider = storageResult.provider;
      note.storageKey = storageResult.key;
      note.storageBucket = storageResult.bucket;
      note.fileId = storageResult.fileId || (storageResult.provider === 'APPWRITE' ? storageResult.key : '');
      note.storageType = storageResult.provider === 'APPWRITE' ? 'appwrite' : 'local';

      await note.save();

      // 4. Safely remove old object only AFTER new one is saved and verified in DB
      if (oldStorageKey && oldStorageKey !== storageResult.key) {
        try {
          await storageService.deleteFilePermanently({
            provider: oldProvider,
            key: oldStorageKey,
            bucket: note.storageBucket,
          });
        } catch (cleanupErr) {
          console.warn('Notice: old storage cleanup warning:', cleanupErr.message);
        }
      }

      await AdminAuditLog.create({
        adminId: req.user.id,
        adminName: req.user.name || 'Admin',
        action: 'REPLACE_PDF_NOTE',
        resourceType: 'NOTE',
        resourceId: noteId,
        details: `Replaced note PDF: "${note.title}" with "${req.file.originalname}" on ${storageResult.provider}`,
      });

      return res.json({ success: true, note, message: 'Note and PDF replaced successfully.' });
    }

    await note.save();
    res.json({ success: true, note, message: 'Note metadata updated.' });
  } catch (err) {
    console.error('Error updating/replacing note:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// Delete Note (ADMIN ONLY — Permanent Explicit Deletion from R2 and MongoDB with Audit Log)
app.delete('/api/notes/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const noteId = req.params.id;

    if (!isMongoConnected) {
      return res.json({ success: true, message: 'Note permanently deleted.' });
    }

    if (!mongoose.isValidObjectId(noteId)) {
      return res.status(400).json({ success: false, message: 'Invalid note ID.' });
    }

    const note = await Note.findById(noteId);
    if (!note) {
      return res.status(404).json({ success: false, message: 'Study note not found.' });
    }

    // Explicitly delete from permanent storage (Cloudflare R2, S3, or local volume)
    if (note.storageKey) {
      try {
        await storageService.deleteFilePermanently({
          provider: note.storageProvider,
          key: note.storageKey,
          bucket: note.storageBucket,
        });
      } catch (storageErr) {
        console.warn('Storage removal warning during note delete:', storageErr.message);
      }
    }

    // Remove from MongoDB
    await Note.findByIdAndDelete(noteId);

    // Record in Admin Audit Log
    await AdminAuditLog.create({
      adminId: req.user.id,
      adminName: req.user.name || 'Admin',
      action: 'PERMANENT_DELETE_PDF',
      resourceType: 'NOTE',
      resourceId: noteId,
      details: `Admin explicitly deleted permanent PDF: "${note.title}" (${note.fileName}) from ${note.storageProvider}`,
    });

    res.json({ success: true, message: 'Note and permanent cloud file deleted successfully.' });
  } catch (err) {
    console.error('Error deleting note:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// --- SHORT NOTES (VISUAL DIAGRAMS) APIS ---

// Get Short Notes (branch and year filtered for students, all for admin, published for guest)
app.get('/api/short-notes', optionalAuth, async (req, res) => {
  try {
    const query = buildAccessFilter(req.user, req.query);
    const shortNotes = isMongoConnected ? await ShortNote.find(query).sort({ uploadedAt: -1 }) : [];
    res.json({ success: true, shortNotes });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Create Short Note (ADMIN ONLY)
app.post('/api/short-notes', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { title, subject, chapter, description, branches, years, imageUrls, storageKeys, fileIds, storageBucket, storageProvider, isImportant } = req.body;
    if (!title || !subject || !imageUrls || !imageUrls.length) {
      return res.status(400).json({ success: false, message: 'Title, subject, and at least one image are required.' });
    }

    const provider = storageProvider || storageService.getActiveProvider();
    const isAppwrite = provider === 'APPWRITE';

    const newShortNote = {
      title,
      subject,
      chapter: chapter || '',
      description: description || '',
      branches: branches && branches.length ? branches : ['ALL'],
      years: years && years.length ? years : ['ALL'],
      imageUrls,
      storageKeys: storageKeys || [],
      fileIds: fileIds || storageKeys || [],
      storageProvider: provider,
      storageBucket: storageBucket || (isAppwrite ? (process.env.APPWRITE_BUCKET_ID || '') : ''),
      storageType: isAppwrite ? 'appwrite' : (provider === 'EXTERNAL' ? 'external' : 'local'),
      isImportant: !!isImportant,
      isPublished: true,
      uploadedAt: new Date().toISOString(),
    };

    if (isMongoConnected) {
      const safeTitleRegex = new RegExp(`^${title.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i');
      const safeSubjectRegex = new RegExp(`^${subject.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i');
      const existing = await ShortNote.findOne({
        title: safeTitleRegex,
        subject: safeSubjectRegex,
        chapter: chapter || '',
      });
      if (existing) {
        Object.assign(existing, newShortNote);
        await existing.save();
        return res.status(200).json({ success: true, shortNote: existing, updated: true });
      }

      const saved = new ShortNote({ ...newShortNote, uploadedBy: req.user.id });
      await saved.save();
      return res.status(201).json({ success: true, shortNote: saved });
    }

    res.status(201).json({ success: true, shortNote: { id: 'sn_' + Date.now(), ...newShortNote } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Upload Short Note Diagram / Image to Storage (ADMIN ONLY)
app.post('/api/short-notes/upload-image', requireAuth, requireAdmin, uploadImage.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No image file uploaded.' });
    }

    const fileBuffer = await fs.promises.readFile(req.file.path);
    const storageResult = await storageService.uploadFilePermanently({
      buffer: fileBuffer,
      originalFilename: req.file.originalname,
      mimeType: req.file.mimetype || 'image/jpeg',
      folder: 'short_notes',
      uniqueFilename: req.file.filename,
    });

    const imageUrl = storageResult.fileUrl.startsWith('http')
      ? storageResult.fileUrl
      : `${req.protocol}://${req.get('host')}${storageResult.fileUrl}`;

    res.status(201).json({
      success: true,
      imageUrl,
      storageKey: storageResult.key,
      fileId: storageResult.fileId || storageResult.key,
      storageProvider: storageResult.provider,
      storageBucket: storageResult.bucket,
      storageType: storageResult.provider === 'APPWRITE' ? 'appwrite' : 'local',
    });
  } catch (err) {
    console.error('Error uploading short note diagram:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// Delete Short Note & Cloudflare R2 Images (ADMIN ONLY)
app.delete('/api/short-notes/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    if (!isMongoConnected) {
      return res.json({ success: true, message: 'Short note deleted.' });
    }

    const shortNote = await ShortNote.findById(id);
    if (!shortNote) {
      return res.status(404).json({ success: false, message: 'Short note not found.' });
    }

    // Clean up images in storage if keys were stored
    if (shortNote.storageKeys && shortNote.storageKeys.length) {
      for (const key of shortNote.storageKeys) {
        try {
          await storageService.deleteFilePermanently({
            provider: shortNote.storageProvider,
            key,
          });
        } catch (e) {
          console.warn('Storage cleanup notice for short note image:', e.message);
        }
      }
    }

    await ShortNote.findByIdAndDelete(id);

    await AdminAuditLog.create({
      adminId: req.user.id,
      adminName: req.user.name || 'Admin',
      action: 'DELETE_SHORT_NOTE',
      resourceType: 'SHORT_NOTE',
      resourceId: id,
      details: `Deleted short note: "${shortNote.title}"`,
    });

    res.json({ success: true, message: 'Short note deleted successfully.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Safe Admin Migration: Migrate Local Files to Cloudflare R2
// Verifies each file in R2 before updating the database, never deleting original files
app.post('/api/admin/storage/migrate-to-r2', requireAuth, requireAdmin, async (req, res) => {
  try {
    if (!storageService.isR2Configured()) {
      return res.status(400).json({
        success: false,
        message: 'Cloudflare R2 is not configured. Provide R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, and R2_BUCKET_NAME in backend/.env before running migration.',
      });
    }

    if (!isMongoConnected) {
      return res.status(503).json({ success: false, message: 'Database offline. Cannot perform migration.' });
    }

    const notesToMigrate = await Note.find({
      $or: [
        { storageProvider: 'LOCAL_PERSISTENT' },
        { storageProvider: { $ne: 'R2' } },
        { storageKey: { $exists: false } },
        { storageKey: '' },
      ],
    });

    const results = {
      totalFound: notesToMigrate.length,
      migratedCount: 0,
      alreadyOnR2Count: 0,
      failedCount: 0,
      details: [],
    };

    for (const note of notesToMigrate) {
      if (note.storageProvider === 'R2' && note.storageKey) {
        results.alreadyOnR2Count++;
        continue;
      }

      // Find local file path
      const candidates = [
        path.join(storageService.PERSISTENT_DIR, path.basename(note.storageKey || note.fileName)),
        path.join(storageService.PERSISTENT_DIR, note.fileName),
        path.join(UPLOADS_DIR, path.basename(note.storageKey || note.fileName)),
        path.join(UPLOADS_DIR, note.fileName),
      ];

      const localPath = candidates.find((p) => fs.existsSync(p));

      if (!localPath) {
        results.failedCount++;
        results.details.push({
          noteId: note._id,
          title: note.title,
          status: 'SKIPPED_LOCAL_NOT_FOUND',
          message: `Local file for "${note.fileName}" not found on disk. Preserved DB record untouched.`,
        });
        continue;
      }

      try {
        const uploadResult = await storageService.migrateLocalFileToR2(localPath, 'studyhub_pdfs');

        // Update database reference only after verified R2 upload
        note.storageProvider = 'R2';
        note.storageKey = uploadResult.key;
        note.storageBucket = uploadResult.bucket;
        note.fileUrl = uploadResult.fileUrl.startsWith('http')
          ? uploadResult.fileUrl
          : `${req.protocol}://${req.get('host')}${uploadResult.fileUrl}`;
        await note.save();

        results.migratedCount++;
        results.details.push({
          noteId: note._id,
          title: note.title,
          status: 'MIGRATED',
          r2Key: uploadResult.key,
        });
      } catch (migErr) {
        results.failedCount++;
        results.details.push({
          noteId: note._id,
          title: note.title,
          status: 'ERROR',
          error: migErr.message,
        });
      }
    }

    await AdminAuditLog.create({
      adminId: req.user.id,
      adminName: req.user.name || 'Admin',
      action: 'MIGRATE_STORAGE_R2',
      resourceType: 'STORAGE',
      details: `Admin executed Cloudflare R2 migration: ${results.migratedCount} files migrated, ${results.failedCount} skipped/failed.`,
    });

    res.json({
      success: true,
      message: `Migration completed: ${results.migratedCount} migrated to Cloudflare R2.`,
      results,
    });
  } catch (err) {
    console.error('Error during R2 migration:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// --- EXAM TIMETABLE APIS ---

// Get Exams (branch and year filtered for students, all for admin, published for guest)
app.get('/api/exams', optionalAuth, async (req, res) => {
  try {
    const query = buildAccessFilter(req.user, req.query);
    const exams = isMongoConnected ? await Exam.find(query).sort({ examDate: 1 }) : [];
    res.json({ success: true, exams });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Create Exam (ADMIN ONLY)
app.post('/api/exams', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { subject, title, examDate, startTime, endTime, room, instructions, branches, years } = req.body;
    if (!subject || !title || !examDate) {
      return res.status(400).json({ success: false, message: 'Subject, title, and examDate are required.' });
    }

    if (!isMongoConnected) {
      return res.status(201).json({
        success: true,
        exam: { id: 'exam_' + Date.now(), ...req.body, branches: branches || ['ALL'], years: years || ['ALL'], isPublished: true, isCancelled: false },
      });
    }

    const safeSubjectRegex = new RegExp(`^${subject.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i');
    const safeTitleRegex = new RegExp(`^${title.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i');
    const existing = await Exam.findOne({
      subject: safeSubjectRegex,
      title: safeTitleRegex,
      examDate: examDate,
    });

    if (existing) {
      Object.assign(existing, req.body);
      existing.branches = branches || existing.branches || ['ALL'];
      existing.years = years || existing.years || ['ALL'];
      await existing.save();
      return res.status(200).json({ success: true, exam: existing, updated: true });
    }

    const newExam = new Exam({ ...req.body, branches: branches || ['ALL'], years: years || ['ALL'], createdBy: req.user.id });
    await newExam.save();
    res.status(201).json({ success: true, exam: newExam });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Update Exam (ADMIN ONLY)
app.put('/api/exams/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    if (isMongoConnected && mongoose.isValidObjectId(id)) {
      const updated = await Exam.findByIdAndUpdate(id, { $set: req.body }, { new: true });
      return res.json({ success: true, exam: updated });
    }
    res.json({ success: true, exam: { id, ...req.body } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Delete Exam (ADMIN ONLY)
app.delete('/api/exams/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    if (isMongoConnected && mongoose.isValidObjectId(id)) {
      await Exam.findByIdAndDelete(id);
    }
    res.json({ success: true, message: 'Exam deleted successfully.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// --- SYLLABUS APIS ---

// Get Syllabus (branch and year filtered for students, all for admin, published for guest)
app.get('/api/syllabus', optionalAuth, async (req, res) => {
  try {
    const query = buildAccessFilter(req.user, req.query);
    const syllabus = isMongoConnected ? await Syllabus.find(query).sort({ updatedAt: -1 }) : [];
    res.json({ success: true, syllabus });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Create or Update Syllabus Units & Topics (ADMIN ONLY)
app.post('/api/syllabus', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { subject, courseCode, description, semester = 1, branches, years, units, pdfUrl, fileName, fileSizeFormatted } = req.body;
    if (!subject || !courseCode) {
      return res.status(400).json({ success: false, message: 'Subject and courseCode are required.' });
    }

    const cleanCode = courseCode.trim().toUpperCase();
    const cleanSubject = subject.trim();

    if (!isMongoConnected) {
      return res.status(201).json({
        success: true,
        syllabus: { 
          id: 'syl_' + Date.now(), 
          subject: cleanSubject,
          courseCode: cleanCode,
          description: description || '',
          semester: Number(semester) || 1,
          branches: branches || ['ALL'], 
          years: years || ['ALL'], 
          units: units || [],
          pdfUrl: pdfUrl || '',
          fileName: fileName || '',
          fileSizeFormatted: fileSizeFormatted || '',
          isPublished: true,
          updatedAt: new Date().toISOString()
        },
      });
    }

    // Check if syllabus for course code exists
    const existing = await Syllabus.findOne({ courseCode: cleanCode });
    if (existing) {
      if (cleanSubject) existing.subject = cleanSubject;
      if (description !== undefined) existing.description = description;
      if (semester) existing.semester = Number(semester);
      if (branches) existing.branches = branches;
      if (years) existing.years = years;
      if (pdfUrl) existing.pdfUrl = pdfUrl;
      if (fileName) existing.fileName = fileName;
      if (fileSizeFormatted) existing.fileSizeFormatted = fileSizeFormatted;
      if (units && units.length > 0) {
        existing.units = [...existing.units, ...units];
      }
      existing.updatedAt = new Date();
      await existing.save();

      if (isMongoConnected) {
        await AdminAuditLog.create({
          adminId: req.user.id,
          adminName: req.user.name || 'Admin',
          action: 'UPDATE_SYLLABUS',
          resourceType: 'SYLLABUS',
          details: `Updated syllabus units for ${cleanCode} (${cleanSubject})`,
        });
      }

      return res.status(200).json({ success: true, syllabus: existing });
    }

    const newSyl = new Syllabus({
      subject: cleanSubject,
      courseCode: cleanCode,
      description: description || '',
      semester: Number(semester) || 1,
      branches: branches || ['ALL'],
      years: years || ['ALL'],
      units: units || [],
      pdfUrl: pdfUrl || '',
      fileName: fileName || '',
      fileSizeFormatted: fileSizeFormatted || '',
      isPublished: true,
      updatedAt: new Date(),
    });
    await newSyl.save();

    if (isMongoConnected) {
      await AdminAuditLog.create({
        adminId: req.user.id,
        adminName: req.user.name || 'Admin',
        action: 'CREATE_SYLLABUS',
        resourceType: 'SYLLABUS',
        details: `Created syllabus for ${cleanCode} (${cleanSubject})`,
      });
    }

    res.status(201).json({ success: true, syllabus: newSyl });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Upload Syllabus PDF document (ADMIN ONLY - saved to Appwrite/Storage)
app.post('/api/syllabus/upload-pdf', requireAuth, requireAdmin, upload.single('pdf'), async (req, res) => {
  try {
    const { 
      subject, 
      courseCode, 
      description = '', 
      semester = 1, 
      branches, 
      years 
    } = req.body;

    if (!subject || !courseCode) {
      return res.status(400).json({ success: false, message: 'Subject and courseCode are required.' });
    }

    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No PDF file uploaded.' });
    }

    let parsedBranches = ['ALL'];
    if (branches) {
      try {
        parsedBranches = Array.isArray(branches) ? branches : JSON.parse(branches);
      } catch (e) {
        parsedBranches = [branches];
      }
    }

    let parsedYears = ['ALL'];
    if (years) {
      try {
        parsedYears = Array.isArray(years) ? years : JSON.parse(years);
      } catch (e) {
        parsedYears = [years];
      }
    }

    const fileBuffer = await fs.promises.readFile(req.file.path);
    const storageResult = await storageService.uploadPdfPermanently({
      buffer: fileBuffer,
      originalFilename: req.file.originalname,
      mimeType: req.file.mimetype || 'application/pdf',
      uniqueFilename: req.file.filename,
    });

    const fileUrl = storageResult.fileUrl.startsWith('http')
      ? storageResult.fileUrl
      : `${req.protocol}://${req.get('host')}${storageResult.fileUrl}`;
    const fileSizeFormatted = (req.file.size / (1024 * 1024)).toFixed(1) + ' MB';
    const cleanCode = courseCode.trim().toUpperCase();
    const cleanSubject = subject.trim();

    const syllabusPayload = {
      subject: cleanSubject,
      courseCode: cleanCode,
      description: description ? description.trim() : '',
      semester: Number(semester) || 1,
      branches: parsedBranches,
      years: parsedYears,
      pdfUrl: fileUrl,
      fileName: req.file.originalname,
      fileSizeFormatted,
      storageProvider: storageResult.provider,
      storageKey: storageResult.key,
      fileId: storageResult.fileId || (storageResult.provider === 'APPWRITE' ? storageResult.key : ''),
      units: [],
      isPublished: true,
      updatedAt: new Date(),
    };

    if (!isMongoConnected) {
      return res.status(201).json({
        success: true,
        syllabus: { id: 'syl_' + Date.now(), ...syllabusPayload },
      });
    }

    let existing = await Syllabus.findOne({ courseCode: cleanCode });
    if (existing) {
      existing.pdfUrl = fileUrl;
      existing.fileName = req.file.originalname;
      existing.fileSizeFormatted = fileSizeFormatted;
      existing.storageProvider = storageResult.provider;
      existing.storageKey = storageResult.key;
      existing.fileId = syllabusPayload.fileId;
      existing.semester = Number(semester) || existing.semester || 1;
      existing.updatedAt = new Date();
      await existing.save();

      await AdminAuditLog.create({
        adminId: req.user.id,
        adminName: req.user.name || 'Admin',
        action: 'UPLOAD_SYLLABUS_PDF',
        resourceType: 'SYLLABUS',
        details: `Updated syllabus PDF for ${cleanCode} (${cleanSubject}) [Key: ${storageResult.key}]`,
      });

      return res.status(200).json({ success: true, syllabus: existing });
    }

    const newSyl = new Syllabus(syllabusPayload);
    await newSyl.save();

    await AdminAuditLog.create({
      adminId: req.user.id,
      adminName: req.user.name || 'Admin',
      action: 'UPLOAD_SYLLABUS_PDF',
      resourceType: 'SYLLABUS',
      details: `Uploaded syllabus PDF for ${cleanCode} (${cleanSubject}) to ${storageResult.provider} [Key: ${storageResult.key}]`,
    });

    res.status(201).json({ success: true, syllabus: newSyl });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Delete Syllabus (ADMIN ONLY)
app.delete('/api/syllabus/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const sylId = req.params.id;
    if (!isMongoConnected) {
      return res.json({ success: true, message: 'Deleted from local session.' });
    }

    const syl = await Syllabus.findById(sylId);
    if (!syl) {
      return res.status(404).json({ success: false, message: 'Syllabus item not found.' });
    }

    if (syl.storageKey) {
      try {
        await storageService.deleteFilePermanently({
          provider: syl.storageProvider || 'APPWRITE',
          key: syl.storageKey,
        });
      } catch (storageErr) {
        console.error('Failed to delete syllabus PDF from storage:', storageErr.message);
      }
    }

    await Syllabus.findByIdAndDelete(sylId);

    await AdminAuditLog.create({
      adminId: req.user.id,
      adminName: req.user.name || 'Admin',
      action: 'DELETE_SYLLABUS',
      resourceType: 'SYLLABUS',
      details: `Deleted syllabus: ${syl.courseCode} - ${syl.subject}`,
    });

    res.json({ success: true, message: 'Syllabus deleted successfully.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});


// --- ANNOUNCEMENTS APIS ---

// Get Announcements (branch and year filtered for students, all for admin, published for guest)
app.get('/api/announcements', optionalAuth, async (req, res) => {
  try {
    const query = buildAccessFilter(req.user, req.query);
    const announcements = isMongoConnected ? await Announcement.find(query).sort({ publishedAt: -1 }) : [];
    res.json({ success: true, announcements });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Create Announcement (ADMIN ONLY)
app.post('/api/announcements', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { title, description, branches, years, isPinned } = req.body;
    if (!title || !description) {
      return res.status(400).json({ success: false, message: 'Title and description are required.' });
    }

    if (!isMongoConnected) {
      return res.status(201).json({
        success: true,
        announcement: { id: 'ann_' + Date.now(), title, description, branches: branches || ['ALL'], years: years || ['ALL'], isPinned: !!isPinned, publishedAt: new Date().toISOString() },
      });
    }

    const safeTitleRegex = new RegExp(`^${title.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i');
    const existing = await Announcement.findOne({
      title: safeTitleRegex,
    });

    if (existing) {
      existing.description = description;
      existing.branches = branches || existing.branches || ['ALL'];
      existing.years = years || existing.years || ['ALL'];
      existing.isPinned = !!isPinned;
      await existing.save();
      return res.status(200).json({ success: true, announcement: existing, updated: true });
    }

    const newAnn = new Announcement({ title, description, branches: branches || ['ALL'], years: years || ['ALL'], isPinned: !!isPinned });
    await newAnn.save();
    res.status(201).json({ success: true, announcement: newAnn });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Delete Announcement (ADMIN ONLY)
app.delete(['/api/announcements/:id', '/api/admin/announcements/:id'], requireAuth, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    if (isMongoConnected && mongoose.isValidObjectId(id)) {
      await Announcement.findByIdAndDelete(id);
    }
    res.json({ success: true, message: 'Announcement deleted successfully.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// --- FEATURE 2: BOOKMARKS AND SAVED MATERIALS APIS ---

// Get Bookmarks for currently authenticated student
app.get('/api/bookmarks', requireAuth, async (req, res) => {
  try {
    if (!isMongoConnected) {
      return res.json({ success: true, bookmarks: [] });
    }
    const bookmarks = await Bookmark.find({ userId: req.user.id }).sort({ savedAt: -1 });
    res.json({ success: true, bookmarks });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Add Bookmark
app.post('/api/bookmarks', requireAuth, async (req, res) => {
  try {
    const { resourceId, resourceType, title, subject, metadata } = req.body;
    if (!resourceId || !resourceType || !title) {
      return res.status(400).json({ success: false, message: 'Resource ID, type, and title are required.' });
    }

    if (!isMongoConnected) {
      return res.status(201).json({
        success: true,
        bookmark: { id: 'bm_' + Date.now(), userId: req.user.id, resourceId, resourceType, title, subject, metadata, savedAt: new Date().toISOString() },
      });
    }

    // Upsert to prevent duplicates
    const bookmark = await Bookmark.findOneAndUpdate(
      { userId: req.user.id, resourceId, resourceType },
      { title, subject, metadata: metadata || {}, savedAt: new Date() },
      { upsert: true, new: true }
    );

    res.status(201).json({ success: true, bookmark });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Remove Bookmark
app.delete('/api/bookmarks/:resourceId', requireAuth, async (req, res) => {
  try {
    const { resourceId } = req.params;
    if (isMongoConnected) {
      await Bookmark.deleteMany({ userId: req.user.id, resourceId });
    }
    res.json({ success: true, message: 'Bookmark removed successfully.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// --- FEATURE 1: PERSONAL STUDY DASHBOARD & ACTIVITY TRACKING ---

// Get Dashboard Data for authenticated student
app.get('/api/dashboard/study', requireAuth, async (req, res) => {
  try {
    if (!isMongoConnected) {
      return res.json({
        success: true,
        recentActivity: [],
        continueReading: null,
        stats: { totalOpened: 0, completedCount: 0, totalBookmarks: 0 },
      });
    }

    const activities = await StudyActivity.find({ userId: req.user.id })
      .sort({ lastOpenedAt: -1 })
      .limit(10);

    const continueReading = activities.length > 0 ? activities[0] : null;
    const bookmarkCount = await Bookmark.countDocuments({ userId: req.user.id });

    res.json({
      success: true,
      recentActivity: activities,
      continueReading,
      stats: {
        totalOpened: activities.length,
        completedCount: activities.filter(a => a.totalPages > 1 && a.lastPage >= a.totalPages).length,
        totalBookmarks: bookmarkCount,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Track Study Activity / Update PDF Reading Progress
app.post('/api/dashboard/activity', requireAuth, async (req, res) => {
  try {
    const { resourceId, resourceType, title, subject, lastPage, totalPages, metadata } = req.body;
    if (!resourceId || !resourceType || !title) {
      return res.status(400).json({ success: false, message: 'Resource ID, type, and title are required.' });
    }

    if (isMongoConnected) {
      await StudyActivity.findOneAndUpdate(
        { userId: req.user.id, resourceId },
        {
          resourceType,
          title,
          subject: subject || '',
          lastPage: lastPage || 1,
          totalPages: totalPages || 1,
          lastOpenedAt: new Date(),
          metadata: metadata || {},
        },
        { upsert: true, new: true }
      );
    }

    res.json({ success: true, message: 'Study activity recorded.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// --- FEATURE 4: EXAM COUNTDOWN & REMINDERS APIS ---

// Get reminders for authenticated student
app.get('/api/exams/reminders', requireAuth, async (req, res) => {
  try {
    if (!isMongoConnected) {
      return res.json({ success: true, reminders: [] });
    }
    const reminders = await ExamReminder.find({ userId: req.user.id });
    res.json({ success: true, reminders });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Set or Update Exam Reminder
app.post('/api/exams/reminders', requireAuth, async (req, res) => {
  try {
    const { examId, reminderType, scheduledFor, isEnabled } = req.body;
    if (!examId || !scheduledFor) {
      return res.status(400).json({ success: false, message: 'Exam ID and scheduled date are required.' });
    }

    if (isMongoConnected) {
      await ExamReminder.findOneAndUpdate(
        { userId: req.user.id, examId },
        {
          reminderType: reminderType || '1_DAY_BEFORE',
          scheduledFor: new Date(scheduledFor),
          isEnabled: isEnabled !== undefined ? isEnabled : true,
          createdAt: new Date(),
        },
        { upsert: true, new: true }
      );
    }

    res.json({ success: true, message: 'Exam reminder saved.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Delete Exam Reminder
app.delete('/api/exams/reminders/:examId', requireAuth, async (req, res) => {
  try {
    const { examId } = req.params;
    if (isMongoConnected) {
      await ExamReminder.deleteMany({ userId: req.user.id, examId });
    }
    res.json({ success: true, message: 'Exam reminder removed.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// --- FEATURE 7: SMART ANNOUNCEMENTS (FULL API) ---

// Get Announcements (Targeted to student branch & year + Unread status tracking)
app.get('/api/announcements/feed', requireAuth, async (req, res) => {
  try {
    const accessFilter = buildAccessFilter(req.user);
    // Announcements must be published
    accessFilter.isPublished = true;

    let announcements = [];
    let readSet = new Set();

    if (isMongoConnected) {
      announcements = await Announcement.find(accessFilter).sort({ isPinned: -1, publishedAt: -1 });
      const reads = await AnnouncementRead.find({ userId: req.user.id });
      readSet = new Set(reads.map(r => r.announcementId.toString()));
    }

    const result = announcements.map(a => ({
      id: a._id.toString(),
      title: a.title,
      description: a.description,
      category: a.category || 'General',
      priority: a.priority || 'Normal',
      branches: a.branches,
      years: a.years,
      isPinned: a.isPinned,
      publishedAt: a.publishedAt,
      isRead: readSet.has(a._id.toString()),
    }));

    res.json({ success: true, announcements: result });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Mark Announcement as Read
app.post('/api/announcements/:id/read', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    if (isMongoConnected && mongoose.isValidObjectId(id)) {
      await AnnouncementRead.findOneAndUpdate(
        { userId: req.user.id, announcementId: id },
        { readAt: new Date() },
        { upsert: true }
      );
    }
    res.json({ success: true, message: 'Announcement marked as read.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Admin Announcement Management (Create / Edit / Delete / Toggle Publish)
app.put('/api/admin/announcements/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    if (isMongoConnected && mongoose.isValidObjectId(id)) {
      const updated = await Announcement.findByIdAndUpdate(id, updates, { new: true });
      if (updated) {
        await AdminAuditLog.create({
          adminId: req.user.id,
          adminName: req.user.name || 'Admin',
          action: 'UPDATE_ANNOUNCEMENT',
          resourceType: 'ANNOUNCEMENT',
          resourceId: id,
          details: `Updated announcement: "${updated.title}"`,
        });
      }
      return res.json({ success: true, announcement: updated });
    }
    res.json({ success: true, message: 'Announcement updated.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.delete('/api/admin/announcements/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    if (isMongoConnected && mongoose.isValidObjectId(id)) {
      const ann = await Announcement.findByIdAndDelete(id);
      if (ann) {
        await AdminAuditLog.create({
          adminId: req.user.id,
          adminName: req.user.name || 'Admin',
          action: 'DELETE_ANNOUNCEMENT',
          resourceType: 'ANNOUNCEMENT',
          resourceId: id,
          details: `Deleted announcement: "${ann.title}"`,
        });
      }
    }
    res.json({ success: true, message: 'Announcement deleted.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// --- FEATURE 8: DOWNLOAD EVENT TRACKING ---

// Record verified download event
app.post('/api/downloads/track', requireAuth, async (req, res) => {
  try {
    const { resourceId, resourceType, fileName } = req.body;
    if (!resourceId) {
      return res.status(400).json({ success: false, message: 'Resource ID is required.' });
    }

    if (isMongoConnected) {
      await DownloadEvent.create({
        userId: req.user.id,
        resourceId,
        resourceType: resourceType || 'NOTE',
        fileName: fileName || '',
        branch: req.user.branch || 'CSE',
        academicYear: req.user.academicYear || '1st Year',
      });
    }

    res.json({ success: true, message: 'Download event verified.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Clear all notes, short notes, exams, and syllabus (ADMIN ONLY)
app.post('/api/admin/clear-all-materials', requireAuth, requireAdmin, async (req, res) => {
  try {
    if (isMongoConnected) {
      await Note.deleteMany({});
      await ShortNote.deleteMany({});
      await Exam.deleteMany({});
      await Syllabus.deleteMany({});
    }
    res.json({ success: true, message: 'All notes, exams, and syllabus have been cleared.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// --- FEATURE 10: ADMIN REAL ANALYTICS & AUDIT LOG APIS ---

// Get Real Aggregated Database Metrics
app.get('/api/admin/analytics', requireAuth, requireAdmin, async (req, res) => {
  try {
    if (!isMongoConnected) {
      return res.status(503).json({
        success: false,
        message: 'Database service is currently offline. Analytics metrics unavailable.',
      });
    }

    const totalStudents = await User.countDocuments({ role: 'STUDENT' });
    const verifiedStudents = await User.countDocuments({ role: 'STUDENT', isVerified: true });
    
    // Aggregation: students by branch
    const studentsByBranch = await User.aggregate([
      { $match: { role: 'STUDENT' } },
      { $group: { _id: '$branch', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);

    // Aggregation: students by year
    const studentsByYear = await User.aggregate([
      { $match: { role: 'STUDENT' } },
      { $group: { _id: '$academicYear', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);

    // Content counts
    const totalPdfs = await Note.countDocuments();
    const totalShortNotes = await ShortNote.countDocuments();
    const totalExams = await Exam.countDocuments();
    const totalAnnouncements = await Announcement.countDocuments();
    const totalDownloads = await DownloadEvent.countDocuments();

    // Top downloaded resources
    const topDownloads = await DownloadEvent.aggregate([
      { $group: { _id: '$fileName', count: { $sum: 1 }, resourceId: { $first: '$resourceId' } } },
      { $sort: { count: -1 } },
      { $limit: 5 },
    ]);

    // Recent Audit Logs
    const auditLogs = await AdminAuditLog.find().sort({ timestamp: -1 }).limit(20);

    res.json({
      success: true,
      metrics: {
        totalStudents,
        verifiedStudents,
        studentsByBranch,
        studentsByYear,
        totalPdfs,
        totalShortNotes,
        totalExams,
        totalAnnouncements,
        totalDownloads,
        topDownloads,
      },
      auditLogs,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// CSV Export for Admin Report
app.get('/api/admin/analytics/export-csv', requireAuth, requireAdmin, async (req, res) => {
  try {
    if (!isMongoConnected) {
      return res.status(503).json({
        success: false,
        message: 'Database service is currently offline. Report export unavailable.',
      });
    }

    let csvRows = ['Category,Field,Value\n'];
    const students = await User.countDocuments({ role: 'STUDENT' });
    const verified = await User.countDocuments({ role: 'STUDENT', isVerified: true });
    const notes = await Note.countDocuments();
    const exams = await Exam.countDocuments();
    const downloads = await DownloadEvent.countDocuments();

    csvRows.push(`Users,Total Students,${students}\n`);
    csvRows.push(`Users,Verified Students,${verified}\n`);
    csvRows.push(`Content,PDF Notes,${notes}\n`);
    csvRows.push(`Content,Exams,${exams}\n`);
    csvRows.push(`Usage,Total Downloads,${downloads}\n`);

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="studyhub_analytics_report.csv"');
    res.send(csvRows.join(''));
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// --- FEATURE 3: AI STUDY ASSISTANT PRO & ASK THIS PDF ---

// Grounded Document Q&A / Ask This PDF
// Grounded Document Q&A / Ask This PDF
app.post('/api/ai/ask-document', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    let user = null;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      try {
        user = jwt.verify(authHeader.split(' ')[1], JWT_SECRET);
      } catch (e) {}
    }

    const { documentId, documentTitle, question, contextSnippet } = req.body;
    if (!question) {
      return res.status(400).json({ success: false, message: 'Question is required.' });
    }

    const userBranch = user?.branch || 'CSE';
    const userYear = user?.academicYear || '1st Year';

    // Verify document authorization if note ID provided
    if (documentId && isMongoConnected && mongoose.isValidObjectId(documentId)) {
      const note = await Note.findById(documentId);
      if (note && user && user.role !== 'ADMIN') {
        const normUserBranch = (userBranch || '').toLowerCase().trim();
        const normUserYear = (userYear || '').toLowerCase().trim();
        const branchAllowed = !note.branches || note.branches.length === 0 || note.branches.some(b => {
          const s = String(b).toLowerCase().trim();
          return s === 'all' || s === normUserBranch || s.includes(normUserBranch) || normUserBranch.includes(s);
        });
        const yearAllowed = !note.years || note.years.length === 0 || note.years.some(y => {
          const s = String(y).toLowerCase().trim();
          return s === 'all' || s === normUserYear || s.includes(normUserYear) || normUserYear.includes(s);
        });
        if (!branchAllowed || !yearAllowed) {
          return res.status(403).json({
            success: false,
            message: 'Access denied: This study material is restricted to another department or academic year.',
          });
        }
      }
    }

    const aiResult = await aiService.askDocument({
      documentTitle: documentTitle || 'Course Document',
      question,
      contextSnippet,
      branch: userBranch,
      year: userYear,
    });

    res.json({
      success: true,
      isConfigured: aiService.isConfigured(),
      provider: aiResult.provider,
      answer: aiResult.answer,
      citation: aiResult.citation,
      sourceDocument: documentTitle || 'Course Lecture Notes',
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// General AI Study Assistant Query
app.post('/api/ai/chat', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    let user = null;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      try {
        user = jwt.verify(authHeader.split(' ')[1], JWT_SECRET);
      } catch (e) {}
    }

    const { prompt, quickAction, branch, year, history } = req.body;
    if (!prompt) {
      return res.status(400).json({ success: false, message: 'Prompt is required.' });
    }

    const effectiveBranch = branch || user?.branch || 'CSE';
    const effectiveYear = year || user?.academicYear || '1st Year';

    const aiResult = await aiService.chatAssistant({
      prompt,
      quickAction,
      branch: effectiveBranch,
      year: effectiveYear,
      history,
    });

    res.json({
      success: true,
      isConfigured: aiService.isConfigured(),
      provider: aiResult.provider,
      reply: aiResult.reply,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Secure Authorized Cloudflare R2 / Local File Download & Streaming Route
app.get('/api/files/download/:key(*)', requireAuth, async (req, res) => {
  try {
    const key = req.params.key;
    if (!key) {
      return res.status(400).json({ success: false, message: 'File key is required.' });
    }

    const isPdf = key.toLowerCase().endsWith('.pdf');
    const isImg = /\.(jpg|jpeg|png|webp|gif)$/i.test(key);
    const fileType = isPdf ? 'pdf' : (isImg ? 'image' : 'pdf');

    const isAuthorized = await checkFileAccessAuthorization(req.user, key, fileType);
    if (!isAuthorized) {
      return res.status(403).json({
        success: false,
        message: 'Access restricted: This study material is not assigned to your academic branch or year.',
      });
    }

    const provider = storageService.getActiveProvider();

    // If Appwrite Cloud Storage is configured, stream through authenticated proxy
    if (provider === 'APPWRITE') {
      const fileData = await storageService.getFileStream({ provider: 'APPWRITE', key });
      if (!fileData) {
        return res.status(404).json({ success: false, message: 'Requested file not found in Appwrite storage.' });
      }

      res.setHeader('Content-Type', fileData.contentType || (isPdf ? 'application/pdf' : 'application/octet-stream'));
      if (fileData.contentLength) res.setHeader('Content-Length', fileData.contentLength);
      const safeName = fileData.fileName || (key.endsWith('.pdf') ? key : `${key}.pdf`);
      res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(safeName)}"`);
      return fileData.stream.pipe(res);
    }

    // If Cloudflare R2 or S3 is configured, generate short-lived signed URL and redirect
    if (provider === 'R2' || provider === 'S3') {
      const signedUrl = await storageService.getSignedDownloadUrl({
        provider,
        key,
        expiresIn: 3600,
      });
      return res.redirect(signedUrl);
    }

    // Stream from local persistent storage
    const fileData = await storageService.getFileStream({ provider, key });
    if (!fileData) {
      return res.status(404).json({ success: false, message: 'Requested file not found in storage.' });
    }

    res.setHeader('Content-Type', fileData.contentType || 'application/octet-stream');
    if (fileData.contentLength) res.setHeader('Content-Length', fileData.contentLength);
    fileData.stream.pipe(res);
  } catch (err) {
    console.error('Error serving file:', err);
    res.status(500).json({ success: false, message: 'Failed to access storage file.' });
  }
});

// Start Server
app.listen(PORT, () => {
  console.log(`🚀 Padhlo Backend API listening on port ${PORT}`);
  const activeProvider = storageService.getActiveProvider();
  console.log(`📦 Active Storage Provider: ${activeProvider}`);
  if (storageService.isAppwriteConfigured()) {
    const appwrite = storageService.getAppwriteStatus();
    console.log(`☁️ Appwrite Cloud Storage: Active (Endpoint: ${appwrite.endpoint}, Project: ${appwrite.projectId}, Bucket: ${appwrite.bucketId})`);
  } else if (storageService.isR2Configured()) {
    console.log(`☁️ Cloudflare R2 Bucket: ${process.env.R2_BUCKET_NAME}`);
  }
});
