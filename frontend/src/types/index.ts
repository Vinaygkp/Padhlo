export type UserRole = 'ADMIN' | 'STUDENT';

export type BranchCode = 
  | 'ALL'
  | 'CSE'
  | 'IT'
  | 'ECE'
  | 'EE'
  | 'EEE'
  | 'ME'
  | 'CE'
  | 'AI/ML'
  | 'AI/DS'
  | 'CS-DS'
  | 'CS-CYBER'
  | 'CS-IOT'
  | 'Other';

export interface BranchOption {
  code: BranchCode;
  name: string;
  shortName: string;
}

export const BRANCHES: BranchOption[] = [
  { code: 'CSE', name: 'Computer Science & Engineering', shortName: 'CSE' },
  { code: 'IT', name: 'Information Technology', shortName: 'IT' },
  { code: 'ECE', name: 'Electronics & Communication Engineering', shortName: 'ECE' },
  { code: 'EE', name: 'Electrical Engineering', shortName: 'EE' },
  { code: 'EEE', name: 'Electrical & Electronics Engineering', shortName: 'EEE' },
  { code: 'ME', name: 'Mechanical Engineering', shortName: 'ME' },
  { code: 'CE', name: 'Civil Engineering', shortName: 'CE' },
  { code: 'AI/ML', name: 'Artificial Intelligence & Machine Learning', shortName: 'AI/ML' },
  { code: 'AI/DS', name: 'Artificial Intelligence & Data Science', shortName: 'AI/DS' },
  { code: 'CS-DS', name: 'CSE - Data Science Specialization', shortName: 'CS-DS' },
  { code: 'CS-CYBER', name: 'CSE - Cyber Security Specialization', shortName: 'CS-Cyber' },
  { code: 'CS-IOT', name: 'CSE - Internet of Things Specialization', shortName: 'CS-IoT' },
  { code: 'Other', name: 'Other B.Tech Department / Allied Engineering', shortName: 'Other' },
];

export type AcademicYear = 'ALL' | '1st Year' | '2nd Year' | '3rd Year' | '4th Year';

export interface YearOption {
  code: AcademicYear;
  name: string;
  shortName: string;
}

export const ACADEMIC_YEARS: YearOption[] = [
  { code: '1st Year', name: 'First Year (1st Year)', shortName: '1st Yr' },
  { code: '2nd Year', name: 'Second Year (2nd Year)', shortName: '2nd Yr' },
  { code: '3rd Year', name: 'Third Year (3rd Year)', shortName: '3rd Yr' },
  { code: '4th Year', name: 'Final Year (4th Year)', shortName: '4th Yr' },
];

export interface User {
  id: string;
  name: string;
  email: string;
  mobile?: string;
  role: UserRole;
  branch: BranchCode; // Student's chosen branch (Permanent)
  academicYear: AcademicYear; // Student's academic year (Permanent)
  avatar?: string;
  profilePicture?: string;
  isVerified?: boolean;
}

// PDF Notes & External Study Materials
export interface NoteItem {
  id: string;
  title: string;
  subject: string;
  subjectCode?: string;       // e.g. "BAS103", "KCS301", "BCS301"
  semester?: number;          // 1, 2, 3, 4, 5, 6, 7, 8
  unit?: string;              // "Unit 1", "Unit 2", "Unit 3", "Unit 4", "Unit 5", "Full Syllabus"
  provider?: string;          // "Gateway Classes", "Multi Atoms", "College Faculty", "Bitwise Classes"
  teacherName?: string;       // e.g. "Gulshan Sir", "Dr. Sharma"
  type?: string;              // "Handwritten Notes", "Quantum Revision", "PYQ Solved", "Lecture Notes"
  course?: 'B.Tech';          // B.Tech only
  resourceType?: 'Notes' | 'Short Notes' | 'PYQ' | 'Question Bank' | 'Practical File' | 'Syllabus' | 'Quantum';
  academicScheme?: string;
  description?: string;
  fileUrl: string;
  externalUrl?: string;       // Original external link (e.g. Google Drive / external viewer destination)
  previewUrl?: string;        // In-app embedded preview link (Google Drive preview or Docs viewer)
  isExternal?: boolean;       // Registered via external link vs uploaded file
  fileName: string;
  fileSizeFormatted: string;  // e.g. "2.4 MB"
  branches: BranchCode[];    // ['ALL'] or specific branches like ['CSE', 'IT']
  years: AcademicYear[];     // ['ALL'] or specific years like ['2nd Year']
  sourceUrl?: string;
  storageType?: 'appwrite' | 'external' | 'local';
  fileId?: string;
  visibilityStatus?: 'ACTIVE' | 'DRAFT' | 'ARCHIVED';
  isImportant: boolean;
  isPublished: boolean;
  isPyq?: boolean;            // Flag for Previous Year Question papers
  pyqYear?: string;           // e.g. "2024-25", "2023-24", "2022"
  uploadedAt: string;
}

// Discovered External Resource for Admin Bulk Importer
export interface DiscoveredResource {
  title: string;
  subject: string;
  subjectCode?: string;
  semester: number;
  unit?: string;
  course: 'B.Tech';
  resourceType: 'Notes' | 'Short Notes' | 'PYQ' | 'Question Bank' | 'Practical File' | 'Syllabus' | 'Quantum';
  branches: BranchCode[];
  years: AcademicYear[];
  sourceUrl: string;
  storageType: 'external' | 'appwrite';
  description?: string;
  teacherName?: string;
  sourceId?: string;
  isDuplicate?: boolean;
  needsReview?: boolean;
  confidence?: 'VERIFIED' | 'DISCOVERED';
  selected?: boolean;
}

// Image-Based Short Notes
export interface ShortNoteItem {
  id: string;
  title: string;
  subject: string;
  chapter?: string;
  description?: string;
  imageUrls: string[];      // Multiple image pages/slides
  storageKeys?: string[];
  fileIds?: string[];
  storageProvider?: 'APPWRITE' | 'R2' | 'S3' | 'LOCAL_PERSISTENT' | 'EXTERNAL';
  storageBucket?: string;
  storageType?: 'appwrite' | 'external' | 'local';
  branches: BranchCode[];    // ['ALL'] or specific branches
  years: AcademicYear[];     // ['ALL'] or specific years
  isImportant: boolean;
  isPublished: boolean;
  uploadedAt: string;
}

// Exam Item
export interface ExamItem {
  id: string;
  subject: string;
  title: string;            // e.g. "Mid-Term Examination"
  branches: BranchCode[];   // ['ALL'] or specific branches
  years: AcademicYear[];    // ['ALL'] or specific years
  examDate: string;         // YYYY-MM-DD
  startTime: string;        // "10:00 AM"
  endTime: string;          // "01:00 PM"
  room?: string;            // e.g. "Hall B-201"
  instructions?: string;
  isPublished: boolean;
  isCancelled: boolean;
}

// Syllabus Item
export interface SyllabusUnit {
  id: string;
  unitNumber: number;
  unitTitle: string;
  topics: {
    id: string;
    title: string;
    description?: string;
    isExamImportant: boolean;
  }[];
}

export interface SyllabusItem {
  id: string;
  subject: string;
  courseCode: string;
  branches: BranchCode[];   // ['ALL'] or specific branches
  years: AcademicYear[];    // ['ALL'] or specific years
  description?: string;
  semester?: number;
  pdfUrl?: string;
  fileName?: string;
  fileSizeFormatted?: string;
  storageProvider?: string;
  storageKey?: string;
  fileId?: string;
  units: SyllabusUnit[];
  isPublished: boolean;
  updatedAt: string;
}

// Announcement
export interface AnnouncementItem {
  id: string;
  title: string;
  description: string;
  category?: 'General' | 'Exams' | 'Academic' | 'Events' | 'Important';
  priority?: 'Normal' | 'High' | 'Urgent';
  branches?: BranchCode[];  // Defaults to ALL
  years?: AcademicYear[];   // Defaults to ALL
  isPinned: boolean;
  isPublished?: boolean;
  isRead?: boolean;
  publishedAt: string;
}

// AI Message
export interface AIChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  citation?: string;
  sourceDocument?: string;
  quiz?: {
    question: string;
    options: string[];
    correctIndex: number;
    explanation: string;
  };
}

// Thought of the Day
export interface DailyThought {
  quote: string;
  author: string;
  dateStr: string; // YYYY-MM-DD local calendar date
  displayDate?: string; // Formatted display date e.g. "Tuesday, 13 October"
  source?: string;
  lastUpdated: string;
}

// Student Bookmark / Saved Resource
export interface BookmarkItem {
  id: string;
  resourceId: string;
  resourceType: 'NOTE' | 'SHORT_NOTE' | 'SYLLABUS' | 'EXAM';
  title: string;
  subject: string;
  metadata?: any;
  savedAt: string;
}

// Student Study Activity & Reading Progress
export interface StudyActivityItem {
  id: string;
  resourceId: string;
  resourceType: 'NOTE' | 'SHORT_NOTE' | 'SYLLABUS' | 'EXAM';
  title: string;
  subject: string;
  lastPage: number;
  totalPages: number;
  lastOpenedAt: string;
  metadata?: any;
}

// Exam Reminder Preference
export interface ExamReminderItem {
  examId: string;
  reminderType: '1_DAY_BEFORE' | '3_DAYS_BEFORE' | '1_WEEK_BEFORE';
  isEnabled: boolean;
  scheduledFor: string;
}

// Download Item
export interface DownloadRecord {
  id: string;
  resourceId: string;
  resourceType: 'NOTE' | 'SHORT_NOTE' | 'SYLLABUS';
  title: string;
  fileName: string;
  localUri: string;
  fileSizeFormatted: string;
  downloadedAt: string;
}

// Admin Real Analytics Data
export interface AdminAnalyticsData {
  totalStudents: number;
  verifiedStudents: number;
  studentsByBranch: { _id: string; count: number }[];
  studentsByYear: { _id: string; count: number }[];
  totalPdfs: number;
  totalShortNotes: number;
  totalExams: number;
  totalAnnouncements: number;
  totalDownloads: number;
  topDownloads: { _id: string; count: number; resourceId?: string }[];
  auditLogs: {
    adminName: string;
    action: string;
    resourceType: string;
    details: string;
    timestamp: string;
  }[];
}

