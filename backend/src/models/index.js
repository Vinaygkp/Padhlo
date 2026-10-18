const mongoose = require('mongoose');

// User schema: ADMIN or STUDENT only
const UserSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
  mobile: { type: String, default: '' },
  password: { type: String, required: true },
  role: { type: String, enum: ['ADMIN', 'STUDENT'], default: 'STUDENT' },
  branch: { type: String, default: 'CSE' },
  academicYear: { type: String, enum: ['1st Year', '2nd Year', '3rd Year', '4th Year', 'ALL'], default: '1st Year' },
  isVerified: { type: Boolean, default: false },
  avatar: { type: String, default: 'ST' },
  profilePicture: { type: String, default: '' },
  profilePictureKey: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now },
});

// Secure OTP Verification Schema
const OtpVerificationSchema = new mongoose.Schema({
  identifier: { type: String, required: true, lowercase: true, trim: true, index: true }, // email or mobile
  otpHash: { type: String, required: true }, // SHA-256 or bcrypt hashed
  purpose: { type: String, enum: ['REGISTRATION', 'LOGIN', 'PASSWORD_RESET'], default: 'REGISTRATION' },
  attempts: { type: Number, default: 0 },
  maxAttempts: { type: Number, default: 5 },
  resendCount: { type: Number, default: 0 },
  lastSentAt: { type: Date, default: Date.now },
  expiresAt: { type: Date, required: true, index: { expires: '10m' } }, // Auto-delete TTL
  isUsed: { type: Boolean, default: false },
  tempUserData: { type: Object, default: null }, // Optional storage for registration info until OTP is confirmed
});

// PDF Lecture Notes (Uploaded by ADMIN or Registered from External/Drive URL)
const NoteSchema = new mongoose.Schema({
  title: { type: String, required: true },
  subject: { type: String, required: true },
  subjectCode: { type: String, default: '' },
  semester: { type: Number, default: 1 },
  unit: { type: String, default: 'Unit 1' },
  provider: { type: String, default: 'College Faculty' },
  teacherName: { type: String, default: '' },
  type: { type: String, default: 'Lecture Notes' }, // Handwritten Notes, Quantum Revision, PYQ Solved, Lecture Notes
  description: { type: String, default: '' },
  branches: [{ type: String, default: 'ALL' }],
  years: [{ type: String, default: 'ALL' }],
  fileUrl: { type: String, required: true },
  externalUrl: { type: String, default: '' },
  previewUrl: { type: String, default: '' },
  isExternal: { type: Boolean, default: false },
  fileName: { type: String, required: true },
  fileSizeFormatted: { type: String, default: '2.5 MB' },
  fileSize: { type: Number, default: 0 },
  mimeType: { type: String, default: 'application/pdf' },
  storageProvider: { type: String, enum: ['APPWRITE', 'R2', 'S3', 'LOCAL_PERSISTENT', 'EXTERNAL'], default: 'LOCAL_PERSISTENT' },
  storageKey: { type: String, default: '' },
  storageBucket: { type: String, default: '' },
  course: { type: String, default: 'B.Tech' },
  resourceType: { 
    type: String, 
    enum: ['Notes', 'Short Notes', 'PYQ', 'Question Bank', 'Practical File', 'Syllabus', 'Quantum'], 
    default: 'Notes' 
  },
  academicScheme: { type: String, default: 'AKTU B.Tech Curriculum' },
  sourceUrl: { type: String, default: '' },
  sourceId: { type: String, default: '', index: true },
  storageType: { type: String, enum: ['appwrite', 'external', 'local'], default: 'appwrite' },
  fileId: { type: String, default: '' },
  visibilityStatus: { type: String, enum: ['ACTIVE', 'DRAFT', 'ARCHIVED'], default: 'ACTIVE' },
  isImportant: { type: Boolean, default: false },
  isPublished: { type: Boolean, default: true },
  isPyq: { type: Boolean, default: false },
  pyqYear: { type: String, default: '' },
  isDeleted: { type: Boolean, default: false },
  deletedAt: { type: Date, default: null },
  deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  uploadedAt: { type: Date, default: Date.now },
});
NoteSchema.index({ uploadedAt: -1 });
NoteSchema.index({ isDeleted: 1 });
NoteSchema.index({ subject: 1, semester: 1 });

// Image-based Short Notes (Visual diagrams, cheat sheets)
const ShortNoteSchema = new mongoose.Schema({
  title: { type: String, required: true },
  subject: { type: String, required: true },
  chapter: { type: String, default: '' },
  description: { type: String, default: '' },
  branches: [{ type: String, default: 'ALL' }],
  years: [{ type: String, default: 'ALL' }],
  imageUrls: [{ type: String, required: true }],
  storageKeys: [{ type: String, default: [] }],
  fileIds: [{ type: String, default: [] }],
  storageProvider: { type: String, enum: ['APPWRITE', 'R2', 'S3', 'LOCAL_PERSISTENT', 'EXTERNAL'], default: 'LOCAL_PERSISTENT' },
  storageBucket: { type: String, default: '' },
  storageType: { type: String, enum: ['appwrite', 'external', 'local'], default: 'appwrite' },
  isImportant: { type: Boolean, default: false },
  isPublished: { type: Boolean, default: true },
  uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  uploadedAt: { type: Date, default: Date.now },
});

// Exam Timetable (Published by ADMIN)
const ExamSchema = new mongoose.Schema({
  subject: { type: String, required: true },
  title: { type: String, required: true },
  branches: [{ type: String, default: 'ALL' }],
  years: [{ type: String, default: 'ALL' }],
  examDate: { type: String, required: true }, // YYYY-MM-DD
  startTime: { type: String, required: true },
  endTime: { type: String, required: true },
  room: { type: String, default: '' },
  instructions: { type: String, default: '' },
  isPublished: { type: Boolean, default: true },
  isCancelled: { type: Boolean, default: false },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  createdAt: { type: Date, default: Date.now },
});

// Syllabus Outline with Units, Topics & PDF Document (Created by ADMIN)
const SyllabusSchema = new mongoose.Schema({
  subject: { type: String, required: true },
  courseCode: { type: String, required: true },
  description: { type: String, default: '' },
  semester: { type: Number, default: 1 },
  branches: [{ type: String, default: 'ALL' }],
  years: [{ type: String, default: 'ALL' }],
  pdfUrl: { type: String, default: '' },
  fileName: { type: String, default: '' },
  fileSizeFormatted: { type: String, default: '' },
  storageProvider: { type: String, enum: ['APPWRITE', 'R2', 'S3', 'LOCAL_PERSISTENT', 'EXTERNAL'], default: 'APPWRITE' },
  storageKey: { type: String, default: '' },
  fileId: { type: String, default: '' },
  units: [
    {
      unitNumber: { type: Number, required: true },
      unitTitle: { type: String, required: true },
      topics: [
        {
          title: { type: String, required: true },
          description: { type: String, default: '' },
          isExamImportant: { type: Boolean, default: false },
        },
      ],
    },
  ],
  isPublished: { type: Boolean, default: true },
  updatedAt: { type: Date, default: Date.now },
});

// Campus Announcements (Pinned to Student Home)
const AnnouncementSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String, required: true },
  category: { 
    type: String, 
    enum: ['General', 'Exams', 'Academic', 'Events', 'Important'], 
    default: 'General' 
  },
  priority: { 
    type: String, 
    enum: ['Normal', 'High', 'Urgent'], 
    default: 'Normal' 
  },
  branches: [{ type: String, default: 'ALL' }],
  years: [{ type: String, default: 'ALL' }],
  isPinned: { type: Boolean, default: false },
  isPublished: { type: Boolean, default: true },
  publishedAt: { type: Date, default: Date.now },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
});

// Student Bookmarks / Saved Items
const BookmarkSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  resourceId: { type: String, required: true },
  resourceType: { 
    type: String, 
    enum: ['NOTE', 'SHORT_NOTE', 'SYLLABUS', 'EXAM'], 
    required: true 
  },
  title: { type: String, required: true },
  subject: { type: String, default: '' },
  metadata: { type: Object, default: {} },
  savedAt: { type: Date, default: Date.now },
});
BookmarkSchema.index({ userId: 1, resourceId: 1, resourceType: 1 }, { unique: true });

// Personal Study Activity & Continue Reading
const StudyActivitySchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  resourceId: { type: String, required: true },
  resourceType: { 
    type: String, 
    enum: ['NOTE', 'SHORT_NOTE', 'SYLLABUS', 'EXAM'], 
    required: true 
  },
  title: { type: String, required: true },
  subject: { type: String, default: '' },
  lastPage: { type: Number, default: 1 },
  totalPages: { type: Number, default: 1 },
  lastOpenedAt: { type: Date, default: Date.now },
  metadata: { type: Object, default: {} },
});
StudyActivitySchema.index({ userId: 1, resourceId: 1 }, { unique: true });

// Exam Reminders (Per-Student Opt-in)
const ExamReminderSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  examId: { type: String, required: true },
  reminderType: { 
    type: String, 
    enum: ['1_DAY_BEFORE', '3_DAYS_BEFORE', '1_WEEK_BEFORE'], 
    default: '1_DAY_BEFORE' 
  },
  isEnabled: { type: Boolean, default: true },
  scheduledFor: { type: Date, required: true },
  createdAt: { type: Date, default: Date.now },
});
ExamReminderSchema.index({ userId: 1, examId: 1 }, { unique: true });

// Student Announcement Read Status Tracker
const AnnouncementReadSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  announcementId: { type: mongoose.Schema.Types.ObjectId, ref: 'Announcement', required: true, index: true },
  readAt: { type: Date, default: Date.now },
});
AnnouncementReadSchema.index({ userId: 1, announcementId: 1 }, { unique: true });

// Admin Audit Log
const AdminAuditLogSchema = new mongoose.Schema({
  adminId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  adminName: { type: String, default: 'Administrator' },
  action: { type: String, required: true }, // e.g., 'CREATE_NOTE', 'PUBLISH_EXAM', 'DELETE_ANNOUNCEMENT'
  resourceType: { type: String, required: true },
  resourceId: { type: String, default: '' },
  details: { type: String, default: '' },
  timestamp: { type: Date, default: Date.now },
});
AdminAuditLogSchema.index({ timestamp: -1 });

// Verified Download / Event Tracking for Real Analytics
const DownloadEventSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  resourceId: { type: String, required: true },
  resourceType: { type: String, required: true },
  fileName: { type: String, default: '' },
  branch: { type: String, default: 'CSE' },
  academicYear: { type: String, default: '1st Year' },
  downloadedAt: { type: Date, default: Date.now },
});
DownloadEventSchema.index({ downloadedAt: -1 });

module.exports = {
  User: mongoose.model('User', UserSchema),
  OtpVerification: mongoose.model('OtpVerification', OtpVerificationSchema),
  Note: mongoose.model('Note', NoteSchema),
  ShortNote: mongoose.model('ShortNote', ShortNoteSchema),
  Exam: mongoose.model('Exam', ExamSchema),
  Syllabus: mongoose.model('Syllabus', SyllabusSchema),
  Announcement: mongoose.model('Announcement', AnnouncementSchema),
  Bookmark: mongoose.model('Bookmark', BookmarkSchema),
  StudyActivity: mongoose.model('StudyActivity', StudyActivitySchema),
  ExamReminder: mongoose.model('ExamReminder', ExamReminderSchema),
  AnnouncementRead: mongoose.model('AnnouncementRead', AnnouncementReadSchema),
  AdminAuditLog: mongoose.model('AdminAuditLog', AdminAuditLogSchema),
  DownloadEvent: mongoose.model('DownloadEvent', DownloadEventSchema),
};
