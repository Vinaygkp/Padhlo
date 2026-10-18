const crypto = require('crypto');
const http = require('http');
const https = require('https');
const { URL } = require('url');

// Canonical B.Tech branches supported for AKTU
const CANONICAL_BRANCHES = {
  CSE: ['CSE', 'CS', 'COMPUTER SCIENCE', 'COMPUTER SCIENCE & ENGINEERING', 'COMPUTER SCIENCE AND ENGINEERING'],
  IT: ['IT', 'INFORMATION TECHNOLOGY', 'COMPUTER SCIENCE & IT', 'CS/IT'],
  ECE: ['ECE', 'ELECTRONICS & COMMUNICATION', 'ELECTRONICS AND COMMUNICATION', 'ELECTRONICS', 'EC'],
  EE: ['EE', 'ELECTRICAL ENGINEERING', 'ELECTRICAL'],
  EEE: ['EEE', 'EN', 'ELECTRICAL & ELECTRONICS', 'ELECTRICAL AND ELECTRONICS'],
  ME: ['ME', 'MECHANICAL ENGINEERING', 'MECHANICAL'],
  CE: ['CE', 'CIVIL ENGINEERING', 'CIVIL'],
  'AI/ML': ['AI/ML', 'AIML', 'AI & ML', 'ARTIFICIAL INTELLIGENCE & MACHINE LEARNING', 'ARTIFICIAL INTELLIGENCE AND MACHINE LEARNING'],
  'AI/DS': ['AI/DS', 'AIDS', 'AI & DS', 'ARTIFICIAL INTELLIGENCE & DATA SCIENCE', 'ARTIFICIAL INTELLIGENCE AND DATA SCIENCE'],
  'CS-DS': ['CS-DS', 'CS(DS)', 'CSE(DS)', 'DATA SCIENCE', 'COMPUTER SCIENCE AND ENGINEERING (DATA SCIENCE)'],
  'CS-CYBER': ['CS-CYBER', 'CYBER SECURITY', 'CSE(CYBER SECURITY)'],
  'CS-IOT': ['CS-IOT', 'IOT', 'INTERNET OF THINGS'],
  ALL: ['ALL', 'ALL_FIRST_YEAR', 'COMMON'],
};

// Map academic year to semester range
function getSemestersForYear(academicYear) {
  switch (academicYear) {
    case '1st Year':
      return [1, 2];
    case '2nd Year':
      return [3, 4];
    case '3rd Year':
      return [5, 6];
    case '4th Year':
      return [7, 8];
    default:
      return [1, 2, 3, 4, 5, 6, 7, 8];
  }
}

// Map semester number (1-8) to academic year
function getYearForSemester(semester) {
  const semNum = Number(semester);
  if (semNum === 1 || semNum === 2) return '1st Year';
  if (semNum === 3 || semNum === 4) return '2nd Year';
  if (semNum === 5 || semNum === 6) return '3rd Year';
  if (semNum === 7 || semNum === 8) return '4th Year';
  return 'ALL';
}

// Normalize branch string to canonical branch code
function normalizeBranch(inputBranch) {
  if (!inputBranch) return 'ALL';
  const clean = inputBranch.trim().toUpperCase();
  if (clean === 'ALL' || clean === 'ALL_FIRST_YEAR' || clean === 'COMMON') return 'ALL';
  for (const [canonical, aliases] of Object.entries(CANONICAL_BRANCHES)) {
    if (canonical.toUpperCase() === clean || aliases.some((a) => a.toUpperCase() === clean)) {
      return canonical;
    }
  }
  return clean;
}

// Validate external source URL against SSRF and private networks
function isSafeExternalUrl(inputUrl) {
  try {
    const parsed = new URL(inputUrl);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false;
    const hostname = parsed.hostname.toLowerCase();

    // Prevent loopback, private ranges, link-local, cloud metadata
    if (
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname === '::1' ||
      hostname === '169.254.169.254' ||
      hostname.startsWith('10.') ||
      hostname.startsWith('192.168.') ||
      hostname.startsWith('172.16.') ||
      hostname.startsWith('172.17.') ||
      hostname.startsWith('172.18.') ||
      hostname.startsWith('172.19.') ||
      hostname.startsWith('172.20.') ||
      hostname.startsWith('172.21.') ||
      hostname.startsWith('172.22.') ||
      hostname.startsWith('172.23.') ||
      hostname.startsWith('172.24.') ||
      hostname.startsWith('172.25.') ||
      hostname.startsWith('172.26.') ||
      hostname.startsWith('172.27.') ||
      hostname.startsWith('172.28.') ||
      hostname.startsWith('172.29.') ||
      hostname.startsWith('172.30.') ||
      hostname.startsWith('172.31.') ||
      hostname.endsWith('.internal') ||
      hostname.endsWith('.local')
    ) {
      return false;
    }
    return true;
  } catch (err) {
    return false;
  }
}

// Resolve preview and external destination URLs
function resolvePdfUrls(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') {
    return { isDrive: false, previewUrl: '', externalUrl: '', downloadUrl: '' };
  }
  const clean = rawUrl.trim();

  // 1. Google Drive Folder
  const folderMatch = clean.match(/(?:drive\.google\.com\/drive\/(?:u\/\d+\/)?folders\/)([a-zA-Z0-9_-]+)/);
  if (folderMatch && folderMatch[1]) {
    const folderId = folderMatch[1];
    return {
      isDrive: true,
      previewUrl: `https://drive.google.com/embeddedfolderview?id=${folderId}#list`,
      externalUrl: `https://drive.google.com/drive/folders/${folderId}?usp=sharing`,
      downloadUrl: `https://drive.google.com/drive/folders/${folderId}?usp=sharing`,
    };
  }

  // 2. Google Drive File
  const fileMatch = clean.match(/(?:drive\.google\.com\/(?:file\/d\/|open\?id=)|docs\.google\.com\/file\/d\/)([a-zA-Z0-9_-]+)/);
  if (fileMatch && fileMatch[1]) {
    const fileId = fileMatch[1];
    return {
      isDrive: true,
      previewUrl: `https://drive.google.com/file/d/${fileId}/preview`,
      externalUrl: `https://drive.google.com/file/d/${fileId}/view?usp=sharing`,
      downloadUrl: `https://drive.google.com/uc?export=download&id=${fileId}`,
    };
  }

  // 3. Generic PDF, Appwrite Storage, or Web Link
  return {
    isDrive: false,
    previewUrl: clean,
    externalUrl: clean,
    downloadUrl: clean,
  };
}

// Generate unique hash for duplicate detection
function generateResourceHash(sourceUrl, title, subject, semester) {
  const raw = `${(sourceUrl || '').trim()}|${(title || '').trim().toLowerCase()}|${(subject || '').trim().toLowerCase()}|${semester}`;
  return crypto.createHash('sha256').update(raw).digest('hex').substring(0, 24);
}

// Verified catalog of AKTU B.Tech study resources derived from NotesGallery & AKTU curriculum
const VERIFIED_AKTU_CATALOG = [
  // --- SEMESTER 1 (Common 1st Year B.Tech) ---
  {
    title: 'Engineering Mathematics-I Complete Notes',
    subject: 'Engineering Mathematics-I',
    subjectCode: 'BAS103',
    semester: 1,
    unit: 'Unit 1-5',
    course: 'B.Tech',
    resourceType: 'Notes',
    branches: ['ALL'],
    years: ['1st Year'],
    sourceUrl: 'https://drive.google.com/drive/folders/1dQmS0IkSnkbz7mRJJOAprQDx9hRHf61K?usp=sharing',
    storageType: 'external',
    description: 'Matrices, Differential Calculus, Multiple Integrals and Vector Calculus handwritten notes for AKTU B.Tech 1st Year.',
    teacherName: 'AKTU Faculty Pool',
  },
  {
    title: 'Engineering Physics Unit-Wise Handwritten Notes',
    subject: 'Engineering Physics',
    subjectCode: 'BAS101',
    semester: 1,
    unit: 'Full Syllabus',
    course: 'B.Tech',
    resourceType: 'Notes',
    branches: ['ALL'],
    years: ['1st Year'],
    sourceUrl: 'https://drive.google.com/drive/folders/1vhlvuclQXtHXtNyAFSD5IyY_GTxRD7bR?usp=sharing',
    storageType: 'external',
    description: 'Relativistic Mechanics, Quantum Mechanics, Wave Optics, Fiber Optics & Lasers for AKTU B.Tech.',
    teacherName: 'AKTU Faculty Pool',
  },
  {
    title: 'Engineering Chemistry Comprehensive Study Material',
    subject: 'Engineering Chemistry',
    subjectCode: 'BAS102',
    semester: 1,
    unit: 'Full Syllabus',
    course: 'B.Tech',
    resourceType: 'Notes',
    branches: ['ALL'],
    years: ['1st Year'],
    sourceUrl: 'https://drive.google.com/drive/folders/1LtbGZwSDRpZE575COtVfnMwVyvAH1OZD?usp=sharing',
    storageType: 'external',
    description: 'Atomic & Molecular Structure, Spectroscopic Techniques, Electrochemistry, Water Technology and Polymers.',
    teacherName: 'AKTU Faculty Pool',
  },
  {
    title: 'Programming for Problem Solving (PPS / C Prog) Notes',
    subject: 'Programming for Problem Solving',
    subjectCode: 'BCS101',
    semester: 1,
    unit: 'Full Syllabus',
    course: 'B.Tech',
    resourceType: 'Notes',
    branches: ['ALL'],
    years: ['1st Year'],
    sourceUrl: 'https://drive.google.com/drive/folders/1YItuhFhm1RV2aGo3_MrYWKz9KmwT2s0C?usp=sharing',
    storageType: 'external',
    description: 'C programming fundamentals, arrays, pointers, functions, dynamic memory allocation and file handling.',
    teacherName: 'AKTU Faculty Pool',
  },
  {
    title: 'Basic Electrical Engineering Comprehensive Notes',
    subject: 'Basic Electrical Engineering',
    subjectCode: 'BEE101',
    semester: 1,
    unit: 'Full Syllabus',
    course: 'B.Tech',
    resourceType: 'Notes',
    branches: ['ALL'],
    years: ['1st Year'],
    sourceUrl: 'https://drive.google.com/drive/folders/1Y2v6FNTpJ1U-i6vZqloL-pr9bMvNa6Mq?usp=sharing',
    storageType: 'external',
    description: 'DC Circuits, Steady-State AC Circuits, Transformers, Electrical Machines and Electrical Installations.',
    teacherName: 'AKTU Faculty Pool',
  },
  {
    title: 'Fundamentals of Electronics Engineering Notes',
    subject: 'Fundamentals of Electronics Engineering',
    subjectCode: 'BEC101',
    semester: 1,
    unit: 'Full Syllabus',
    course: 'B.Tech',
    resourceType: 'Notes',
    branches: ['ALL'],
    years: ['1st Year'],
    sourceUrl: 'https://drive.google.com/drive/folders/1_jqHSTGScvANSGFLDZPWwG23bFzyPkdx?usp=sharing',
    storageType: 'external',
    description: 'Semiconductor Diodes, BJT, Op-Amps, Digital Electronics principles and Electronic Instrumentation.',
    teacherName: 'AKTU Faculty Pool',
  },
  {
    title: 'Fundamentals of Mechanical Engineering Notes',
    subject: 'Fundamentals of Mechanical Engineering',
    subjectCode: 'BME101',
    semester: 1,
    unit: 'Full Syllabus',
    course: 'B.Tech',
    resourceType: 'Notes',
    branches: ['ALL'],
    years: ['1st Year'],
    sourceUrl: 'https://drive.google.com/drive/folders/1bGfJGQpNDX_q8nc7VYgmushHnsvo3yq3?usp=sharing',
    storageType: 'external',
    description: 'Thermodynamics laws, IC engines, power transmission (belts, gears), and mechanics fundamentals.',
    teacherName: 'AKTU Faculty Pool',
  },
  {
    title: 'Soft Skills & Professional Communication Notes',
    subject: 'Soft Skills',
    subjectCode: 'BAS105',
    semester: 1,
    unit: 'Full Syllabus',
    course: 'B.Tech',
    resourceType: 'Notes',
    branches: ['ALL'],
    years: ['1st Year'],
    sourceUrl: 'https://drive.google.com/drive/folders/1by3XoBDkyVhKfFSPhg9_c7ljLzMn8iuh?usp=sharing',
    storageType: 'external',
    description: 'Communication skills, technical writing, presentation techniques, grammar and vocabulary enhancement.',
    teacherName: 'AKTU Faculty Pool',
  },

  // --- SEMESTER 2 (Common 1st Year B.Tech) ---
  {
    title: 'Engineering Mathematics-II Complete Notes',
    subject: 'Engineering Mathematics-II',
    subjectCode: 'BAS203',
    semester: 2,
    unit: 'Unit 1-5',
    course: 'B.Tech',
    resourceType: 'Notes',
    branches: ['ALL'],
    years: ['1st Year'],
    sourceUrl: 'https://drive.google.com/drive/folders/10yC35NfiXWtEV4pYmYIOpD96dApX4zk1?usp=sharing',
    storageType: 'external',
    description: 'Ordinary Differential Equations of Higher Order, Multivariable Calculus, Complex Variables and Probability.',
    teacherName: 'AKTU Faculty Pool',
  },
  {
    title: 'Environment & Ecology (EVS) Study Guide',
    subject: 'Environment and Ecology',
    subjectCode: 'BAS104',
    semester: 2,
    unit: 'Full Syllabus',
    course: 'B.Tech',
    resourceType: 'Notes',
    branches: ['ALL'],
    years: ['1st Year'],
    sourceUrl: 'https://drive.google.com/drive/folders/1cXBPW5M0gTnMYXqdYQImz5kKktyXGoQH?usp=sharing',
    storageType: 'external',
    description: 'Ecosystems, natural resources, environmental pollution, social issues and environmental acts.',
    teacherName: 'AKTU Faculty Pool',
  },

  // --- SEMESTER 3 (2nd Year B.Tech) ---
  {
    title: 'Data Structures & Algorithms (DSA) Handwritten Notes',
    subject: 'Data Structures',
    subjectCode: 'BCS301',
    semester: 3,
    unit: 'Full Syllabus',
    course: 'B.Tech',
    resourceType: 'Notes',
    branches: ['CSE', 'IT', 'AI/ML', 'AI/DS', 'CS-DS', 'CS-CYBER', 'CS-IOT'],
    years: ['2nd Year'],
    sourceUrl: 'https://drive.google.com/file/d/170ukWRMI9Vu1mZUswtpm-M5qL2G17lm6/view?usp=drivesdk',
    storageType: 'external',
    description: 'Arrays, Stacks, Queues, Linked Lists, Trees, AVL Trees, B-Trees, Graphs, Sorting & Hashing techniques.',
    teacherName: 'AKTU Faculty Pool',
  },
  {
    title: 'Computer Organization and Architecture (COA) Notes',
    subject: 'Computer Organization and Architecture',
    subjectCode: 'BCS302',
    semester: 3,
    unit: 'Full Syllabus',
    course: 'B.Tech',
    resourceType: 'Notes',
    branches: ['CSE', 'IT', 'AI/ML', 'AI/DS', 'CS-DS', 'CS-CYBER', 'CS-IOT'],
    years: ['2nd Year'],
    sourceUrl: 'https://drive.google.com/file/d/1-18qUX5fAu8CalOuc5N_pgbqQ8h-DxaV/view?usp=drivesdk',
    storageType: 'external',
    description: 'Functional units, Bus architecture, ALU, Hardwired & Microprogrammed Control, Memory hierarchy & Pipelining.',
    teacherName: 'AKTU Faculty Pool',
  },
  {
    title: 'Discrete Structures & Theory of Logic (DSTL) Notes',
    subject: 'Discrete Structures & Theory of Logic',
    subjectCode: 'BCS303',
    semester: 3,
    unit: 'Full Syllabus',
    course: 'B.Tech',
    resourceType: 'Notes',
    branches: ['CSE', 'IT', 'AI/ML', 'AI/DS', 'CS-DS', 'CS-CYBER', 'CS-IOT'],
    years: ['2nd Year'],
    sourceUrl: 'https://drive.google.com/drive/folders/1rzVdQ-e_SJcyyab8iAKxY3lwfSTcLPRP?usp=drive_link',
    storageType: 'external',
    description: 'Set theory, Relations, Functions, Propositional logic, Algebraic structures, Lattices and Graph theory.',
    teacherName: 'AKTU Faculty Pool',
  },
  {
    title: 'Python Programming Comprehensive Study Material',
    subject: 'Python Programming',
    subjectCode: 'BCC301',
    semester: 3,
    unit: 'Full Syllabus',
    course: 'B.Tech',
    resourceType: 'Notes',
    branches: ['CSE', 'IT', 'AI/ML', 'AI/DS', 'CS-DS', 'CS-CYBER', 'CS-IOT'],
    years: ['2nd Year'],
    sourceUrl: 'https://drive.google.com/drive/folders/1vu-tfGIOU6IOPJcI2X7v9kqJkGuE9_tf?usp=drive_link',
    storageType: 'external',
    description: 'Python syntax, data types, control flow, functions, OOP concepts, file I/O and standard libraries.',
    teacherName: 'AKTU Faculty Pool',
  },
  {
    title: 'Electronics Devices & Circuits (EDC) Notes',
    subject: 'Electronics Devices',
    subjectCode: 'BEC301',
    semester: 3,
    unit: 'Full Syllabus',
    course: 'B.Tech',
    resourceType: 'Notes',
    branches: ['ECE', 'EEE'],
    years: ['2nd Year'],
    sourceUrl: 'https://notesgallery.com/aktu-notes/aktu-2nd-year-notes-2/ece-2nd-year-notes/',
    storageType: 'external',
    description: 'PN junction diode, BJT characteristics, FET, MOSFET and amplifier frequency response.',
    teacherName: 'AKTU Faculty Pool',
  },
  {
    title: 'Thermodynamics Core Engineering Notes',
    subject: 'Thermodynamics',
    subjectCode: 'BME301',
    semester: 3,
    unit: 'Full Syllabus',
    course: 'B.Tech',
    resourceType: 'Notes',
    branches: ['ME'],
    years: ['2nd Year'],
    sourceUrl: 'https://notesgallery.com/aktu-notes/aktu-2nd-year-notes-2/mechanical-2nd-year-notes/',
    storageType: 'external',
    description: 'Zeroth, First, and Second laws of thermodynamics, entropy, availability and pure substance properties.',
    teacherName: 'AKTU Faculty Pool',
  },
  {
    title: 'Building Materials & Construction (BMC) Notes',
    subject: 'Building Materials & Construction',
    subjectCode: 'BCE301',
    semester: 3,
    unit: 'Full Syllabus',
    course: 'B.Tech',
    resourceType: 'Notes',
    branches: ['CE'],
    years: ['2nd Year'],
    sourceUrl: 'https://notesgallery.com/aktu-notes/aktu-2nd-year-notes-2/civil-2nd-year-notes/',
    storageType: 'external',
    description: 'Stones, bricks, cement, concrete technology, foundations, masonry, roofs and flooring.',
    teacherName: 'AKTU Faculty Pool',
  },

  // --- SEMESTER 4 (2nd Year B.Tech) ---
  {
    title: 'Operating Systems (OS) Notes & Exam Prep',
    subject: 'Operating Systems',
    subjectCode: 'BCS401',
    semester: 4,
    unit: 'Full Syllabus',
    course: 'B.Tech',
    resourceType: 'Notes',
    branches: ['CSE', 'IT', 'AI/ML', 'AI/DS', 'CS-DS', 'CS-CYBER', 'CS-IOT'],
    years: ['2nd Year'],
    sourceUrl: 'https://drive.google.com/file/d/170ukWRMI9Vu1mZUswtpm-M5qL2G17lm6/view?usp=drivesdk',
    storageType: 'external',
    description: 'Process management, CPU scheduling, Synchronization, Deadlocks, Memory management, Virtual memory and File systems.',
    teacherName: 'AKTU Faculty Pool',
  },
  {
    title: 'Cyber Security Concepts & Guidelines',
    subject: 'Cyber Security',
    subjectCode: 'BCC401',
    semester: 4,
    unit: 'Full Syllabus',
    course: 'B.Tech',
    resourceType: 'Notes',
    branches: ['ALL'],
    years: ['2nd Year'],
    sourceUrl: 'https://drive.google.com/file/d/1-2NL_4xaqTviAHpNwFJ4Flr-_ZMjkci6/view?usp=drivesdk',
    storageType: 'external',
    description: 'Information security principles, cryptography basics, network security, cyber crimes and IT Act.',
    teacherName: 'AKTU Faculty Pool',
  },
  {
    title: 'Mathematics-IV (PDE & Statistical Techniques)',
    subject: 'Mathematics-IV',
    subjectCode: 'BAS403',
    semester: 4,
    unit: 'Full Syllabus',
    course: 'B.Tech',
    resourceType: 'Notes',
    branches: ['CSE', 'IT', 'ECE', 'EE', 'EEE', 'ME', 'CE', 'AI/ML', 'AI/DS'],
    years: ['2nd Year'],
    sourceUrl: 'https://drive.google.com/drive/folders/1zjucfIXRiUGUYJn0nfo_CD6iI1Tary9T?usp=drive_link',
    storageType: 'external',
    description: 'Partial differential equations, statistical techniques, probability distributions and hypothesis testing.',
    teacherName: 'AKTU Faculty Pool',
  },
  {
    title: 'Theory of Automata and Formal Languages (TAFL)',
    subject: 'Theory of Automata',
    subjectCode: 'BCS402',
    semester: 4,
    unit: 'Full Syllabus',
    course: 'B.Tech',
    resourceType: 'Notes',
    branches: ['CSE', 'IT', 'AI/ML', 'AI/DS', 'CS-DS'],
    years: ['2nd Year'],
    sourceUrl: 'https://notesgallery.com/aktu-3rd-year-notes/',
    storageType: 'external',
    description: 'Finite Automata (DFA, NFA), Regular expressions, Context-Free Grammars, Pushdown Automata and Turing Machines.',
    teacherName: 'AKTU Faculty Pool',
  },

  // --- SEMESTER 5 (3rd Year B.Tech) ---
  {
    title: 'Database Management Systems (DBMS) Notes',
    subject: 'Database Management Systems',
    subjectCode: 'BCS501',
    semester: 5,
    unit: 'Full Syllabus',
    course: 'B.Tech',
    resourceType: 'Notes',
    branches: ['CSE', 'IT', 'AI/ML', 'AI/DS', 'CS-DS', 'CS-CYBER', 'CS-IOT'],
    years: ['3rd Year'],
    sourceUrl: 'https://notesgallery.com/aktu-3rd-year-notes/',
    storageType: 'external',
    description: 'ER Modeling, Relational Algebra, SQL, Normalization (1NF to BCNF), Transaction Processing and Concurrency Control.',
    teacherName: 'AKTU Faculty Pool',
  },
  {
    title: 'Computer Networks (CN) Lecture Notes',
    subject: 'Computer Networks',
    subjectCode: 'BCS502',
    semester: 5,
    unit: 'Full Syllabus',
    course: 'B.Tech',
    resourceType: 'Notes',
    branches: ['CSE', 'IT', 'AI/ML', 'AI/DS', 'CS-DS', 'CS-CYBER', 'CS-IOT', 'ECE'],
    years: ['3rd Year'],
    sourceUrl: 'https://notesgallery.com/aktu-3rd-year-notes/',
    storageType: 'external',
    description: 'OSI & TCP/IP models, Data link layer, Network layer routing (OSPF, BGP), Transport layer (TCP/UDP) & Application layer.',
    teacherName: 'AKTU Faculty Pool',
  },

  // --- SEMESTER 6 (3rd Year B.Tech) ---
  {
    title: 'Compiler Design Core Concepts & Solved Papers',
    subject: 'Compiler Design',
    subjectCode: 'BCS601',
    semester: 6,
    unit: 'Full Syllabus',
    course: 'B.Tech',
    resourceType: 'Notes',
    branches: ['CSE', 'IT', 'AI/ML', 'AI/DS', 'CS-DS'],
    years: ['3rd Year'],
    sourceUrl: 'https://notesgallery.com/aktu-3rd-year-notes/',
    storageType: 'external',
    description: 'Phases of compiler, Lexical analysis, Syntax analysis (LL, LR parsing), Intermediate code generation and Code optimization.',
    teacherName: 'AKTU Faculty Pool',
  },
  {
    title: 'Software Engineering Principles & Agile Guide',
    subject: 'Software Engineering',
    subjectCode: 'BCS602',
    semester: 6,
    unit: 'Full Syllabus',
    course: 'B.Tech',
    resourceType: 'Notes',
    branches: ['CSE', 'IT', 'AI/ML', 'AI/DS', 'CS-DS', 'CS-CYBER', 'CS-IOT'],
    years: ['3rd Year'],
    sourceUrl: 'https://notesgallery.com/aktu-3rd-year-notes/',
    storageType: 'external',
    description: 'SDLC models, Agile development, Requirement engineering, Architectural design, Software testing and Quality assurance.',
    teacherName: 'AKTU Faculty Pool',
  },
  {
    title: 'Web Technology (HTML5, CSS3, JS, PHP, XML) Notes',
    subject: 'Web Technology',
    subjectCode: 'BCS603',
    semester: 6,
    unit: 'Full Syllabus',
    course: 'B.Tech',
    resourceType: 'Notes',
    branches: ['CSE', 'IT'],
    years: ['3rd Year'],
    sourceUrl: 'https://notesgallery.com/aktu-3rd-year-notes/',
    storageType: 'external',
    description: 'Web development fundamentals, client-side scripting, server-side programming, and web protocols.',
    teacherName: 'AKTU Faculty Pool',
  },

  // --- SEMESTER 7 (4th Year B.Tech) ---
  {
    title: 'Artificial Intelligence (AI) Complete Study Material',
    subject: 'Artificial Intelligence',
    subjectCode: 'BCS701',
    semester: 7,
    unit: 'Full Syllabus',
    course: 'B.Tech',
    resourceType: 'Notes',
    branches: ['CSE', 'IT', 'AI/ML', 'AI/DS', 'CS-DS', 'CS-CYBER', 'CS-IOT', 'ECE'],
    years: ['4th Year'],
    sourceUrl: 'https://notesgallery.com/b-tech-aktu/',
    storageType: 'external',
    description: 'Search algorithms (A*, BFS, DFS), Knowledge representation, Expert systems, Game playing and Natural Language Processing.',
    teacherName: 'AKTU Faculty Pool',
  },
  {
    title: 'Cloud Computing Architecture & Security Notes',
    subject: 'Cloud Computing',
    subjectCode: 'BCS702',
    semester: 7,
    unit: 'Full Syllabus',
    course: 'B.Tech',
    resourceType: 'Notes',
    branches: ['CSE', 'IT', 'AI/ML', 'AI/DS', 'CS-DS', 'CS-CYBER', 'CS-IOT'],
    years: ['4th Year'],
    sourceUrl: 'https://notesgallery.com/b-tech-aktu/',
    storageType: 'external',
    description: 'Cloud service models (IaaS, PaaS, SaaS), Virtualization technologies, Cloud storage, Cloud security and AWS/Azure overview.',
    teacherName: 'AKTU Faculty Pool',
  },

  // --- SEMESTER 8 (4th Year B.Tech) ---
  {
    title: 'Machine Learning & Deep Learning Advanced Guide',
    subject: 'Machine Learning',
    subjectCode: 'BCS801',
    semester: 8,
    unit: 'Full Syllabus',
    course: 'B.Tech',
    resourceType: 'Notes',
    branches: ['CSE', 'IT', 'AI/ML', 'AI/DS', 'CS-DS'],
    years: ['4th Year'],
    sourceUrl: 'https://notesgallery.com/b-tech-aktu/',
    storageType: 'external',
    description: 'Supervised & Unsupervised learning, Neural networks, Convolutional Neural Networks (CNN), RNN, Model evaluation and Tuning.',
    teacherName: 'AKTU Faculty Pool',
  },
  {
    title: 'Open Elective OE-3 / OE-4 Solved Quantum & Revision Series',
    subject: 'Open Elective (Universal Studies)',
    subjectCode: 'BOE801',
    semester: 8,
    unit: 'Full Syllabus',
    course: 'B.Tech',
    resourceType: 'Quantum',
    branches: ['ALL'],
    years: ['4th Year'],
    sourceUrl: 'https://notesgallery.com/latest-b-tech-8th-sem-quantums-oe-3-oe-4-common-aktu/',
    storageType: 'external',
    description: 'Non-Conventional Energy Resources, Operations Research, Project Management and Entrepreneurship Development.',
    teacherName: 'AKTU Faculty Pool',
  },
];

// Helper to fetch content over HTTP/HTTPS safely with size limit and timeout
function fetchUrlContent(targetUrl, timeoutMs = 10000, maxBytes = 2 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    if (!isSafeExternalUrl(targetUrl)) {
      return reject(new Error('Target URL violates safety policies (private or restricted address).'));
    }

    const parsed = new URL(targetUrl);
    const lib = parsed.protocol === 'https:' ? https : http;

    const req = lib.get(
      targetUrl,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 PadhloBTechImporter/1.0',
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
        timeout: timeoutMs,
      },
      (res) => {
        // Handle HTTP redirects safely (max 3)
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          const redirectUrl = new URL(res.headers.location, targetUrl).toString();
          if (!isSafeExternalUrl(redirectUrl)) {
            return reject(new Error('Redirected URL violates safety policies.'));
          }
          return resolve(fetchUrlContent(redirectUrl, timeoutMs, maxBytes));
        }

        if (res.statusCode !== 200) {
          return reject(new Error(`Source returned HTTP status ${res.statusCode}`));
        }

        let totalBytes = 0;
        const chunks = [];

        res.on('data', (chunk) => {
          totalBytes += chunk.length;
          if (totalBytes > maxBytes) {
            req.destroy();
            return reject(new Error('Source response exceeds safe maximum size limit.'));
          }
          chunks.push(chunk);
        });

        res.on('end', () => {
          resolve(Buffer.concat(chunks).toString('utf8'));
        });

        res.on('error', (err) => reject(err));
      }
    );

    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Source request timed out after ' + timeoutMs + 'ms'));
    });

    req.on('error', (err) => reject(err));
  });
}

// Discover B.Tech notes from given URL and verified reference catalog
async function discoverNotesFromSource(sourceUrl, existingNotes = []) {
  const urlToFetch = (sourceUrl || '').trim() || 'https://notesgallery.com/aktu-notes/';
  let discovered = [];

  // 1. Always include verified AKTU B.Tech catalog mapped to the source
  discovered = VERIFIED_AKTU_CATALOG.map((item) => ({
    ...item,
    sourceId: generateResourceHash(item.sourceUrl, item.title, item.subject, item.semester),
    needsReview: false,
    confidence: 'VERIFIED',
  }));

  // 2. If a specific page URL was provided, attempt safe inspection
  try {
    if (isSafeExternalUrl(urlToFetch)) {
      const html = await fetchUrlContent(urlToFetch, 10000);
      const linkRegex = /<a\s+[^>]*href=["']([^"']+)["'][^>]*>(.*?)<\/a>/gis;
      let m;
      const seenUrls = new Set(discovered.map((d) => d.sourceUrl));

      while ((m = linkRegex.exec(html)) !== null) {
        const href = m[1];
        const text = m[2].replace(/<[^>]+>/g, '').trim();

        if (
          href &&
          text &&
          text.length > 2 &&
          !seenUrls.has(href) &&
          (href.includes('drive.google.com') || href.includes('notesgallery.com/aktu') || href.endsWith('.pdf'))
        ) {
          // Detect Semester
          let detectedSemester = 1;
          const lowerText = (text + ' ' + href).toLowerCase();
          if (lowerText.includes('8th') || lowerText.includes('sem-8') || lowerText.includes('sem 8')) detectedSemester = 8;
          else if (lowerText.includes('7th') || lowerText.includes('sem-7') || lowerText.includes('sem 7')) detectedSemester = 7;
          else if (lowerText.includes('6th') || lowerText.includes('sem-6') || lowerText.includes('sem 6')) detectedSemester = 6;
          else if (lowerText.includes('5th') || lowerText.includes('sem-5') || lowerText.includes('sem 5')) detectedSemester = 5;
          else if (lowerText.includes('4th') || lowerText.includes('sem-4') || lowerText.includes('sem 4')) detectedSemester = 4;
          else if (lowerText.includes('3rd') || lowerText.includes('sem-3') || lowerText.includes('sem 3') || lowerText.includes('2nd year')) detectedSemester = 3;
          else if (lowerText.includes('2nd sem') || lowerText.includes('sem-2') || lowerText.includes('sem 2') || lowerText.includes('math-2') || lowerText.includes('math 2')) detectedSemester = 2;
          else if (lowerText.includes('1st') || lowerText.includes('sem-1') || lowerText.includes('sem 1') || lowerText.includes('math-1')) detectedSemester = 1;

          // Detect Resource Type
          let resourceType = 'Notes';
          if (lowerText.includes('quantum')) resourceType = 'Quantum';
          else if (lowerText.includes('pyq') || lowerText.includes('question paper')) resourceType = 'PYQ';
          else if (lowerText.includes('short note') || lowerText.includes('formula')) resourceType = 'Short Notes';
          else if (lowerText.includes('syllabus')) resourceType = 'Syllabus';

          // Detect Branch
          let branch = 'ALL';
          if (lowerText.includes('cse') || lowerText.includes('computer science')) branch = 'CSE';
          else if (lowerText.includes('it') || lowerText.includes('information technology')) branch = 'IT';
          else if (lowerText.includes('ece') || lowerText.includes('electronics')) branch = 'ECE';
          else if (lowerText.includes('eee') || lowerText.includes('electrical')) branch = 'EEE';
          else if (lowerText.includes('me') || lowerText.includes('mechanical')) branch = 'ME';
          else if (lowerText.includes('ce') || lowerText.includes('civil')) branch = 'CE';
          else if (lowerText.includes('ai') || lowerText.includes('aiml')) branch = 'AI/ML';

          // Exclude non-B.Tech courses
          if (
            lowerText.includes('pharm') ||
            lowerText.includes('mba') ||
            lowerText.includes('mca') ||
            lowerText.includes('bca') ||
            lowerText.includes('bba') ||
            lowerText.includes('m.tech')
          ) {
            continue;
          }

          seenUrls.add(href);
          discovered.push({
            title: text.replace(/\s+/g, ' ').trim(),
            subject: text.split('-')[0].trim() || 'Engineering Subject',
            subjectCode: '',
            semester: detectedSemester,
            unit: 'Full Syllabus',
            course: 'B.Tech',
            resourceType,
            branches: [branch],
            years: [getYearForSemester(detectedSemester)],
            sourceUrl: href,
            storageType: 'external',
            description: `Imported resource discovered from ${urlToFetch}`,
            teacherName: 'NotesGallery Source',
            sourceId: generateResourceHash(href, text, text, detectedSemester),
            needsReview: branch === 'ALL' && detectedSemester > 2,
            confidence: 'DISCOVERED',
          });
        }
      }
    }
  } catch (err) {
    console.warn('Live page scrape notice (using verified catalog):', err.message);
  }

  // Check duplicate status against existing DB notes
  const existingSet = new Set(
    existingNotes.map((n) => {
      const src = (n.sourceUrl || n.externalUrl || '').trim();
      const hash = generateResourceHash(src, n.title, n.subject, n.semester);
      return hash;
    })
  );

  return discovered.map((item) => {
    const hash = item.sourceId || generateResourceHash(item.sourceUrl, item.title, item.subject, item.semester);
    const isDuplicate = existingSet.has(hash);
    return {
      ...item,
      sourceId: hash,
      isDuplicate,
    };
  });
}

module.exports = {
  CANONICAL_BRANCHES,
  normalizeBranch,
  getSemestersForYear,
  getYearForSemester,
  isSafeExternalUrl,
  resolvePdfUrls,
  generateResourceHash,
  VERIFIED_AKTU_CATALOG,
  discoverNotesFromSource,
};
