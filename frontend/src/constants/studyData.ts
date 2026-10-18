import { User, NoteItem, ShortNoteItem, ExamItem, SyllabusItem, AnnouncementItem } from '../types';

export const INITIAL_ADMIN: User = {
  id: 'admin_vinay',
  name: 'vinay kumar',
  email: 'vinay55ti@gmail.com',
  role: 'ADMIN',
  branch: 'ALL',
  academicYear: 'ALL',
  avatar: 'VK',
  isVerified: true,
};

export const INITIAL_STUDENT: User = {
  id: 'student_1',
  name: 'Student',
  email: 'student@padhlo.edu',
  role: 'STUDENT',
  branch: 'CSE',
  academicYear: '2nd Year',
  avatar: 'ST',
  isVerified: true,
};

// Branch & Year-Wise PDF Notes (Subjects, Semesters, Units, Providers & External Links)
export const INITIAL_NOTES: NoteItem[] = [];

// Branch & Year-Wise Image Short Notes (Handwritten / Diagrams / Quick Formula Sheets)
export const INITIAL_SHORT_NOTES: ShortNoteItem[] = [];

// Branch & Year-Wise Exams
export const INITIAL_EXAMS: ExamItem[] = [];

// Branch & Year-Wise Syllabus
export const INITIAL_SYLLABUS: SyllabusItem[] = [];

export const INITIAL_ANNOUNCEMENTS: AnnouncementItem[] = [
  {
    id: 'ann_1',
    title: 'Mid-Term Exam Schedule Officially Published',
    description: 'Branch-specific timetables are updated. Check your exam tab for room allotments and timings.',
    branches: ['ALL'],
    years: ['ALL'],
    isPinned: true,
    publishedAt: '2026-10-12T09:00:00.000Z',
  },
  {
    id: 'ann_2',
    title: 'CSE & IT Capstone Project Proposals Due',
    description: 'All 3rd-year Computer Science & IT students must upload synopsis reports before Oct 25.',
    branches: ['CSE', 'IT'],
    years: ['3rd Year'],
    isPinned: false,
    publishedAt: '2026-10-11T16:20:00.000Z',
  },
];
