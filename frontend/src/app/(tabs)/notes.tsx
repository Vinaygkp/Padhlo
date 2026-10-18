import React, { useState, useMemo, useCallback } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  TextInput,
  Image as RNImage,
  Modal,
  Alert,
  ActivityIndicator,
  Platform,
  Linking
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { WebView } from 'react-native-webview';
import { 
  Search, 
  FileText, 
  Image as ImageIcon,
  ArrowUpRight, 
  Plus,
  Download,
  Share2,
  Bookmark,
  BookmarkCheck,
  Trash2,
  Layers,
  X,
  ExternalLink,
  BookOpen,
  RotateCcw,
  AlertTriangle,
  Sparkles
} from 'lucide-react-native';
import { THEME } from '@/constants/theme';
import { Card } from '@/components/Card';
import { Header } from '@/components/Header';
import { Badge } from '@/components/Badge';
import { EmptyState } from '@/components/EmptyState';
import { useStudyHub } from '@/store/StudyHubContext';
import { NoteItem, ShortNoteItem } from '@/types';
import { downloadPdfFile, sharePdfFile, downloadImageFile, shareImageFile } from '@/services/fileDownloadService';
import { openPdfInExternalViewer } from '@/services/externalPdfViewerService';
import { resolvePdfLinks, buildPdfViewerHtml, loadPdfBase64 } from '@/services/pdfLinkResolver';
import { storage } from '@/services/storage';

const UNITS = ['All', 'Unit 1', 'Unit 2', 'Unit 3', 'Unit 4', 'Unit 5', 'Full Syllabus'] as const;

export default function StudentNotesScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ 
    tab?: string; 
    subject?: string; 
    type?: string; 
    autoPreviewId?: string;
  }>();

  const { 
    notes, 
    shortNotes,
    isAdmin, 
    userBranch, 
    userYear,
    isContentAccessible,
    isBookmarked,
    addBookmark,
    removeBookmark,
    deleteNote,
    deleteShortNote,
    recordStudyActivity
  } = useStudyHub();

  // Helper to get allowed semesters based on student's registered year (or all 1-8 for Admin)
  const getSemestersForUser = (year: string, admin: boolean): number[] => {
    if (admin) return [1, 2, 3, 4, 5, 6, 7, 8];
    if (year === '1st Year') return [1, 2];
    if (year === '2nd Year') return [3, 4];
    if (year === '3rd Year') return [5, 6];
    if (year === '4th Year') return [7, 8];
    return [1, 2, 3, 4, 5, 6, 7, 8];
  };

  const availableSemesters = getSemestersForUser(userYear, isAdmin);

  // Helper to distinguish PYQ materials from standard lecture notes
  const isPyqNote = (note: NoteItem) => {
    return (
      Boolean(note.isPyq) ||
      note.type === 'PYQ' ||
      note.type === 'PYQ Solved' ||
      Boolean(note.pyqYear) ||
      note.title.toLowerCase().includes('pyq') ||
      (note.description && note.description.toLowerCase().includes('previous year'))
    );
  };

  // Active section tab: 'pdf' (Lecture Notes), 'short' (Visual Short Notes), or 'pyq' (Previous Year Questions)
  const initialTab = params.tab === 'short' || params.type === 'SHORT'
    ? 'short'
    : (params.tab === 'pyq' || params.type === 'PYQ' ? 'pyq' : 'pdf');
  const [activeTab, setActiveTab] = useState<'pdf' | 'short' | 'pyq'>(initialTab);

  // Hierarchy Filters (Semester, Subject, Unit, Exam Year)
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSemester, setSelectedSemester] = useState<number | 'All'>('All');
  const [selectedSubject, setSelectedSubject] = useState<string>(params.subject || 'All');
  const [selectedUnit, setSelectedUnit] = useState<string>('All');
  const [selectedPyqYear, setSelectedPyqYear] = useState<string>('All');

  // Track navigation parameters across renders without triggering effect cascading renders
  const [prevParams, setPrevParams] = useState({
    tab: params.tab,
    type: params.type,
    subject: params.subject,
  });

  if (
    params.tab !== prevParams.tab ||
    params.type !== prevParams.type ||
    params.subject !== prevParams.subject
  ) {
    setPrevParams({
      tab: params.tab,
      type: params.type,
      subject: params.subject,
    });
    if (params.tab === 'short' || params.type === 'SHORT') {
      setActiveTab('short');
    } else if (params.tab === 'pyq' || params.type === 'PYQ') {
      setActiveTab('pyq');
    } else if (params.tab === 'pdf') {
      setActiveTab('pdf');
    }
    if (params.subject) {
      setSelectedSubject(params.subject);
    }
  }

  // Preview Modal State (Inspired by Just-in-Time notes modal)
  const [previewNote, setPreviewNote] = useState<NoteItem | null>(null);
  const [previewWebViewKey, setPreviewWebViewKey] = useState<number>(0);
  const [previewLoading, setPreviewLoading] = useState<boolean>(true);
  const [previewError, setPreviewError] = useState<boolean>(false);
  const [previewPdfBase64, setPreviewPdfBase64] = useState<string | null>(null);
  const [previewPdfBase64Loading, setPreviewPdfBase64Loading] = useState<boolean>(false);
  const [authToken, setAuthToken] = useState<string>('');

  React.useEffect(() => {
    storage.getToken().then((tok) => {
      if (tok) setAuthToken(tok);
    });
  }, []);

  // Opens the in-app PDF preview modal (Declared before effects that reference it)
  const handleSelectNoteForPreview = useCallback(async (note: NoteItem) => {
    setPreviewNote(note);
    setPreviewLoading(true);
    setPreviewError(false);
    setPreviewPdfBase64(null);
    setPreviewWebViewKey((prev) => prev + 1);

    storage.getToken().then((tok) => {
      if (tok) setAuthToken(tok);
    });

    const resolved = resolvePdfLinks(note.fileUrl, note.externalUrl);
    if (resolved.isDirectPdf) {
      setPreviewPdfBase64Loading(true);
      try {
        const b64 = await loadPdfBase64(resolved.previewUrl || note.fileUrl, note.fileName);
        if (b64) {
          setPreviewPdfBase64(b64);
        }
      } catch (err) {
        console.warn('Could not load base64 for PDF preview:', err);
      } finally {
        setPreviewPdfBase64Loading(false);
      }
    }

    recordStudyActivity({
      resourceId: note.id,
      resourceType: 'NOTE',
      title: note.title,
      subject: note.subject,
      lastPage: 1,
      totalPages: 10,
      metadata: { fileUrl: note.fileUrl, fileName: note.fileName },
    });
  }, [recordStudyActivity]);

  // Handle auto-preview deep navigation links
  React.useEffect(() => {
    if (params.autoPreviewId) {
      const match = notes.find((n) => n.id === params.autoPreviewId);
      if (match) {
        const timer = setTimeout(() => {
          handleSelectNoteForPreview(match);
        }, 0);
        return () => clearTimeout(timer);
      }
    }
  }, [params.autoPreviewId, notes, handleSelectNoteForPreview]);

  // Downloading states
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  // Fullscreen image viewer state for Short Notes
  const [activeViewerNote, setActiveViewerNote] = useState<ShortNoteItem | null>(null);
  const [activeImageIndex, setActiveImageIndex] = useState(0);

  // --- PDF LECTURE NOTES FILTERING (Memoized for silky-smooth 60fps scrolling) ---
  const branchAccessiblePdfNotes = useMemo(() => {
    return notes.filter((note) => {
      if (!isAdmin && !note.isPublished) return false;
      if (!isContentAccessible(note.branches, note.years)) return false;
      return !isPyqNote(note);
    });
  }, [notes, isAdmin, isContentAccessible]);

  const pdfSubjects = useMemo(() => {
    return ['All', ...Array.from(new Set(branchAccessiblePdfNotes.map((n) => n.subject)))];
  }, [branchAccessiblePdfNotes]);

  const filteredPdfNotes = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return branchAccessiblePdfNotes.filter((note) => {
      const matchesSearch = !q ||
        note.title.toLowerCase().includes(q) ||
        note.subject.toLowerCase().includes(q) ||
        (note.subjectCode && note.subjectCode.toLowerCase().includes(q)) ||
        (note.provider && note.provider.toLowerCase().includes(q)) ||
        (note.teacherName && note.teacherName.toLowerCase().includes(q)) ||
        (note.description && note.description.toLowerCase().includes(q));

      const matchesSemester = selectedSemester === 'All' || note.semester === selectedSemester;
      const matchesSubject = selectedSubject === 'All' || note.subject === selectedSubject;
      const matchesUnit = selectedUnit === 'All' || note.unit === selectedUnit;

      return matchesSearch && matchesSemester && matchesSubject && matchesUnit;
    });
  }, [branchAccessiblePdfNotes, searchQuery, selectedSemester, selectedSubject, selectedUnit]);

  // --- SHORT NOTES FILTERING (Memoized) ---
  const branchAccessibleShortNotes = useMemo(() => {
    return shortNotes.filter((note) => {
      if (!isAdmin && !note.isPublished) return false;
      return isContentAccessible(note.branches, note.years);
    });
  }, [shortNotes, isAdmin, isContentAccessible]);

  const shortSubjects = useMemo(() => {
    return ['All', ...Array.from(new Set(branchAccessibleShortNotes.map((n) => n.subject)))];
  }, [branchAccessibleShortNotes]);

  const filteredShortNotes = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return branchAccessibleShortNotes.filter((note) => {
      const matchesSearch = !q ||
        note.title.toLowerCase().includes(q) ||
        note.subject.toLowerCase().includes(q) ||
        (note.chapter && note.chapter.toLowerCase().includes(q)) ||
        (note.description && note.description.toLowerCase().includes(q));

      const matchesSubject = selectedSubject === 'All' || note.subject === selectedSubject;

      return matchesSearch && matchesSubject;
    });
  }, [branchAccessibleShortNotes, searchQuery, selectedSubject]);

  // --- PYQ PAPERS FILTERING (Memoized) ---
  const branchAccessiblePyqNotes = useMemo(() => {
    return notes.filter((note) => {
      if (!isAdmin && !note.isPublished) return false;
      if (!isContentAccessible(note.branches, note.years)) return false;
      return isPyqNote(note);
    });
  }, [notes, isAdmin, isContentAccessible]);

  const pyqSubjects = useMemo(() => {
    return ['All', ...Array.from(new Set(branchAccessiblePyqNotes.map((n) => n.subject)))];
  }, [branchAccessiblePyqNotes]);
  const pyqYearsList = ['All', '2025', '2024', '2023', '2022', '2021', '2020'];

  const filteredPyqNotes = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return branchAccessiblePyqNotes.filter((note) => {
      const matchesSearch = !q ||
        note.title.toLowerCase().includes(q) ||
        note.subject.toLowerCase().includes(q) ||
        (note.subjectCode && note.subjectCode.toLowerCase().includes(q)) ||
        (note.pyqYear && note.pyqYear.toLowerCase().includes(q)) ||
        (note.teacherName && note.teacherName.toLowerCase().includes(q)) ||
        (note.description && note.description.toLowerCase().includes(q));

      const matchesSemester = selectedSemester === 'All' || note.semester === selectedSemester;
      const matchesSubject = selectedSubject === 'All' || note.subject === selectedSubject;
      const matchesYear = selectedPyqYear === 'All' || note.pyqYear === selectedPyqYear || (note.title.includes(selectedPyqYear));

      return matchesSearch && matchesSemester && matchesSubject && matchesYear;
    });
  }, [branchAccessiblePyqNotes, searchQuery, selectedSemester, selectedSubject, selectedPyqYear]);


  // Open the external destination (Google Drive, Android PDF Reader, or web resource)
  // Opening the external link does NOT replace or dismiss the in-app preview!
  const handleOpenExternalDestination = async (note: NoteItem) => {
    const resolved = resolvePdfLinks(note.fileUrl, note.externalUrl);
    const targetUrl = resolved.externalUrl || note.fileUrl;
    if (!targetUrl) {
      Alert.alert('No External Link', 'No external link is configured for this note.');
      return;
    }

    // Direct PDFs and local files MUST be launched via external viewer / FileProvider (prevent FileUriExposedException)
    if (targetUrl.startsWith('file://') || targetUrl.startsWith('content://') || resolved.isDirectPdf) {
      await handleOpenInAndroidReader(note);
      return;
    }

    try {
      await Linking.openURL(targetUrl);
    } catch (err: any) {
      Alert.alert('Error Opening Link', err.message || 'Could not launch external destination.');
    }
  };

  // Open in Android standalone PDF reader app (Adobe, Foxit, WPS)
  const handleOpenInAndroidReader = async (note: NoteItem) => {
    try {
      await openPdfInExternalViewer({
        fileUrl: note.fileUrl,
        fileName: note.fileName,
        title: note.title,
        showDriveNotice: true,
      });
    } catch (err: any) {
      Alert.alert('Unable to Launch PDF Reader', err.message || 'An error occurred.');
    }
  };

  const handleDirectDownload = async (note: NoteItem) => {
    try {
      setDownloadingId(note.id);
      const resolved = resolvePdfLinks(note.fileUrl, note.externalUrl);
      const downloadTarget = resolved.downloadUrl || note.fileUrl;
      await downloadPdfFile(downloadTarget, note.fileName);
      setDownloadingId(null);
      Alert.alert('Saved Offline', `"${note.fileName}" has been downloaded for offline study.`);
    } catch (err: any) {
      setDownloadingId(null);
      Alert.alert('Download Error', err.message || 'Could not download note.');
    }
  };

  const handleDirectShare = async (note: NoteItem) => {
    try {
      const resolved = resolvePdfLinks(note.fileUrl, note.externalUrl);
      const shareTarget = resolved.externalUrl || note.fileUrl;
      await sharePdfFile(shareTarget, note.fileName, note.title);
    } catch (err: any) {
      Alert.alert('Share Error', err.message || 'Could not share note.');
    }
  };

  // Handlers for Visual Short Notes
  const openViewer = (note: ShortNoteItem) => {
    setActiveViewerNote(note);
    setActiveImageIndex(0);
  };

  const handleShareCurrentImage = async () => {
    if (!activeViewerNote) return;
    const currentUrl = activeViewerNote.imageUrls[activeImageIndex];
    const imgName = `${activeViewerNote.title}_page_${activeImageIndex + 1}`;
    try {
      await shareImageFile(currentUrl, imgName);
    } catch (err: any) {
      Alert.alert('Share Failed', err.message || 'Unable to share this slide.');
    }
  };

  const handleDownloadCurrentImage = async () => {
    if (!activeViewerNote) return;
    const currentUrl = activeViewerNote.imageUrls[activeImageIndex];
    const imgName = `${activeViewerNote.title}_page_${activeImageIndex + 1}`;
    try {
      await downloadImageFile(currentUrl, imgName);
      Alert.alert('Saved to Device', `Page ${activeImageIndex + 1} saved for offline revision.`);
    } catch (err: any) {
      Alert.alert('Download Failed', err.message || 'Unable to save image.');
    }
  };

  const activeResolved = previewNote 
    ? resolvePdfLinks(previewNote.fileUrl, previewNote.externalUrl)
    : null;

  return (
    <SafeAreaView style={styles.container}>
      <Header
        title="Notes & Materials"
        subtitle={`AKTU B.Tech • ${userBranch} • ${userYear}`}
        rightAction={
          isAdmin ? (
            <TouchableOpacity 
              activeOpacity={0.8}
              onPress={() => {
                if (activeTab === 'pyq') {
                  router.push('/admin/upload-notes?defaultType=PYQ');
                } else if (activeTab === 'pdf') {
                  router.push('/admin/upload-notes');
                } else {
                  router.push('/admin/upload-short-notes');
                }
              }}
              style={styles.adminUploadBtn}
            >
              <Plus size={14} color={THEME.white} />
              <Text style={styles.adminUploadBtnText}>Upload</Text>
            </TouchableOpacity>
          ) : undefined
        }
      />

      {/* Primary Segmented Tab Bar */}
      <View style={styles.tabsContainer}>
        <View style={styles.tabTrack}>
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => {
              setActiveTab('pdf');
              setSelectedSubject('All');
            }}
            style={[styles.tabButton, activeTab === 'pdf' && styles.tabButtonActive]}
          >
            <FileText size={14} color={activeTab === 'pdf' ? THEME.white : THEME.textSecondary} />
            <Text style={[styles.tabText, activeTab === 'pdf' && styles.tabTextActive]} numberOfLines={1}>
              Notes ({branchAccessiblePdfNotes.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => {
              setActiveTab('short');
              setSelectedSubject('All');
            }}
            style={[styles.tabButton, activeTab === 'short' && styles.tabButtonActive]}
          >
            <ImageIcon size={14} color={activeTab === 'short' ? THEME.white : THEME.textSecondary} />
            <Text style={[styles.tabText, activeTab === 'short' && styles.tabTextActive]} numberOfLines={1}>
              Images ({branchAccessibleShortNotes.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => {
              setActiveTab('pyq');
              setSelectedSubject('All');
            }}
            style={[styles.tabButton, activeTab === 'pyq' && styles.tabButtonActive]}
          >
            <BookOpen size={14} color={activeTab === 'pyq' ? THEME.white : THEME.textSecondary} />
            <Text style={[styles.tabText, activeTab === 'pyq' && styles.tabTextActive]} numberOfLines={1}>
              PYQs ({branchAccessiblePyqNotes.length})
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* AKTU B.Tech Academic Banner */}
        <View style={styles.aktuBanner}>
          <View style={styles.aktuBannerInfo}>
            <Text style={styles.aktuBannerTitle}>AKTU B.Tech Library</Text>
            <Text style={styles.aktuBannerSub}>
              Branch: <Text style={styles.aktuBannerHighlight}>{userBranch}</Text> • Year: <Text style={styles.aktuBannerHighlight}>{userYear}</Text>
            </Text>
          </View>
          <View style={styles.aktuCourseBadge}>
            <Text style={styles.aktuCourseBadgeText}>B.Tech Only</Text>
          </View>
        </View>

        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <Search size={18} color={THEME.textSecondary} />
          <TextInput
            style={styles.searchInput}
            placeholder={
              activeTab === 'pyq' 
                ? "Search PYQs, year, subject..." 
                : (activeTab === 'pdf' ? "Search notes, subject, teacher..." : "Search short notes...")
            }
            placeholderTextColor={THEME.textTertiary}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <X size={16} color={THEME.textTertiary} />
            </TouchableOpacity>
          )}
        </View>

        {/* Semester Filter Carousel (For PDF and PYQ tabs) */}
        {(activeTab === 'pdf' || activeTab === 'pyq') && (
          <View style={styles.semesterFilterSection}>
            <View style={styles.filterGroupHeader}>
              <Text style={styles.filterGroupTitle}>Semester</Text>
              {selectedSemester !== 'All' && (
                <TouchableOpacity onPress={() => setSelectedSemester('All')}>
                  <Text style={styles.filterResetText}>All Semesters</Text>
                </TouchableOpacity>
              )}
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterPillScroll}>
              <TouchableOpacity
                onPress={() => setSelectedSemester('All')}
                style={[
                  styles.filterPill,
                  selectedSemester === 'All' && styles.filterPillActivePurple
                ]}
              >
                <Text style={[
                  styles.filterPillText,
                  selectedSemester === 'All' && styles.filterPillTextActive
                ]}>
                  All Semesters
                </Text>
              </TouchableOpacity>
              {availableSemesters.map((sem) => (
                <TouchableOpacity
                  key={sem}
                  onPress={() => setSelectedSemester(sem)}
                  style={[
                    styles.filterPill,
                    selectedSemester === sem && styles.filterPillActivePurple
                  ]}
                >
                  <Text style={[
                    styles.filterPillText,
                    selectedSemester === sem && styles.filterPillTextActive
                  ]}>
                    Sem {sem}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {/* PDF Mode: Subject and Unit Filters (Clean Horizontal Carousels) */}
        {activeTab === 'pdf' && (
          <View style={styles.filtersSection}>
            {/* 1. Subjects Filter */}
            <View style={styles.filterGroup}>
              <View style={styles.filterGroupHeader}>
                <Text style={styles.filterGroupTitle}>Subject</Text>
                {selectedSubject !== 'All' && (
                  <TouchableOpacity onPress={() => setSelectedSubject('All')}>
                    <Text style={styles.filterResetText}>Reset</Text>
                  </TouchableOpacity>
                )}
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterPillScroll}>
                {pdfSubjects.map((sub) => (
                  <TouchableOpacity
                    key={sub}
                    onPress={() => setSelectedSubject(sub)}
                    style={[
                      styles.filterPill,
                      selectedSubject === sub && styles.filterPillActiveCyan
                    ]}
                  >
                    <Text style={[
                      styles.filterPillText,
                      selectedSubject === sub && styles.filterPillTextActive
                    ]}>
                      {sub}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            {/* 2. Units Filter */}
            <View style={styles.filterGroup}>
              <View style={styles.filterGroupHeader}>
                <Text style={styles.filterGroupTitle}>Unit</Text>
                {selectedUnit !== 'All' && (
                  <TouchableOpacity onPress={() => setSelectedUnit('All')}>
                    <Text style={styles.filterResetText}>Reset</Text>
                  </TouchableOpacity>
                )}
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterPillScroll}>
                {UNITS.map((u) => (
                  <TouchableOpacity
                    key={u}
                    onPress={() => setSelectedUnit(u)}
                    style={[
                      styles.filterPill,
                      selectedUnit === u && styles.filterPillActiveGold
                    ]}
                  >
                    <Text style={[
                      styles.filterPillText,
                      selectedUnit === u && styles.filterPillTextActive
                    ]}>
                      {u === 'All' ? 'All Units' : u}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </View>
        )}

        {/* Short Notes Mode: Subject Filter */}
        {activeTab === 'short' && (
          <View style={styles.filtersSection}>
            <View style={styles.filterGroup}>
              <View style={styles.filterGroupHeader}>
                <Text style={styles.filterGroupTitle}>Subject</Text>
                {selectedSubject !== 'All' && (
                  <TouchableOpacity onPress={() => setSelectedSubject('All')}>
                    <Text style={styles.filterResetText}>Reset</Text>
                  </TouchableOpacity>
                )}
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterPillScroll}>
                {shortSubjects.map((sub) => (
                  <TouchableOpacity
                    key={sub}
                    onPress={() => setSelectedSubject(sub)}
                    style={[
                      styles.filterPill,
                      selectedSubject === sub && styles.filterPillActive
                    ]}
                  >
                    <Text style={[
                      styles.filterPillText,
                      selectedSubject === sub && styles.filterPillTextActive
                    ]}>
                      {sub}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </View>
        )}

        {/* PYQ Mode: Subject and Exam Year Filters */}
        {activeTab === 'pyq' && (
          <View style={styles.filtersSection}>
            {/* 1. Subjects Filter */}
            <View style={styles.filterGroup}>
              <View style={styles.filterGroupHeader}>
                <Text style={styles.filterGroupTitle}>Subject</Text>
                {selectedSubject !== 'All' && (
                  <TouchableOpacity onPress={() => setSelectedSubject('All')}>
                    <Text style={styles.filterResetText}>Reset</Text>
                  </TouchableOpacity>
                )}
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterPillScroll}>
                {pyqSubjects.map((sub) => (
                  <TouchableOpacity
                    key={sub}
                    onPress={() => setSelectedSubject(sub)}
                    style={[
                      styles.filterPill,
                      selectedSubject === sub && styles.filterPillActiveCyan
                    ]}
                  >
                    <Text style={[
                      styles.filterPillText,
                      selectedSubject === sub && styles.filterPillTextActive
                    ]}>
                      {sub}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            {/* 2. Exam Year Filter */}
            <View style={styles.filterGroup}>
              <View style={styles.filterGroupHeader}>
                <Text style={styles.filterGroupTitle}>Exam Year</Text>
                {selectedPyqYear !== 'All' && (
                  <TouchableOpacity onPress={() => setSelectedPyqYear('All')}>
                    <Text style={styles.filterResetText}>Reset</Text>
                  </TouchableOpacity>
                )}
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterPillScroll}>
                {pyqYearsList.map((yr) => (
                  <TouchableOpacity
                    key={yr}
                    onPress={() => setSelectedPyqYear(yr)}
                    style={[
                      styles.filterPill,
                      selectedPyqYear === yr && styles.filterPillActiveGold
                    ]}
                  >
                    <Text style={[
                      styles.filterPillText,
                      selectedPyqYear === yr && styles.filterPillTextActive
                    ]}>
                      {yr === 'All' ? 'All Years' : `${yr} Exam`}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </View>
        )}

        {/* SECTION 1: PDF NOTES LIST */}
        {activeTab === 'pdf' ? (
          filteredPdfNotes.length === 0 ? (
            <EmptyState
              title="No materials match your filters"
              description={`Try selecting a different subject or unit for ${userBranch}.`}
              actionTitle={isAdmin ? "Upload Notes" : undefined}
              onAction={isAdmin ? () => router.push('/admin/upload-notes') : undefined}
            />
          ) : (
            filteredPdfNotes.map((note) => (
              <Card key={note.id} style={styles.noteCard} variant="elevated">
                  {/* Card Header: Subject Code, Provider, Unit */}
                  <TouchableOpacity 
                    activeOpacity={0.8}
                    onPress={() => handleSelectNoteForPreview(note)}
                    style={styles.cardHeaderRow}
                  >
                    <View style={styles.pdfIconBadge}>
                      <Text style={styles.pdfIconText}>PDF</Text>
                    </View>

                    <View style={styles.headerInfo}>
                      <View style={styles.tagWrapRow}>
                        <View style={styles.btechBadge}>
                          <Text style={styles.btechBadgeText}>B.Tech</Text>
                        </View>

                        {note.semester ? (
                          <View style={styles.semBadge}>
                            <Text style={styles.semBadgeText}>SEM {note.semester}</Text>
                          </View>
                        ) : null}

                        {note.resourceType && note.resourceType !== 'Notes' ? (
                          <View style={styles.typeTagBadge}>
                            <Text style={styles.typeTagBadgeText}>{note.resourceType}</Text>
                          </View>
                        ) : null}

                        {note.subjectCode ? (
                          <View style={styles.codeBadge}>
                            <Text style={styles.codeBadgeText}>{note.subjectCode}</Text>
                          </View>
                        ) : null}

                        <Badge label={note.subject} variant="cyan" size="sm" />

                        {note.unit ? (
                          <Badge label={note.unit} variant="purple" size="sm" />
                        ) : null}

                        {note.isImportant && (
                          <Badge label="High-Yield" variant="gold" size="sm" />
                        )}
                      </View>

                      <Text style={styles.noteTitle} numberOfLines={2}>
                        {note.title}
                      </Text>

                      {/* Provider & Teacher */}
                      <View style={styles.providerRow}>
                        {note.teacherName ? (
                          <Text style={styles.providerText}>
                            Teacher: <Text style={styles.providerBold}>{note.teacherName}</Text> ({note.provider || 'Gateway Classes'})
                          </Text>
                        ) : (
                          <Text style={styles.providerText}>
                            Provider: <Text style={styles.providerBold}>{note.provider || 'College Faculty'}</Text>
                          </Text>
                        )}
                        {note.type ? (
                          <View style={styles.typeBadge}>
                            <Text style={styles.typeBadgeText}>{note.type}</Text>
                          </View>
                        ) : null}
                      </View>
                    </View>

                    <View style={styles.arrowIconWrap}>
                      <ArrowUpRight size={18} color={THEME.cyan} />
                    </View>
                  </TouchableOpacity>

                  {note.description ? (
                    <Text style={styles.noteDesc} numberOfLines={2}>{note.description}</Text>
                  ) : null}

                  <View style={styles.metaDivider} />

                  {/* Card Actions Row */}
                  <View style={styles.actionRowContainer}>
                    <View style={styles.leftActionGroup}>
                      <TouchableOpacity 
                        onPress={async () => {
                          if (isBookmarked(note.id)) {
                            await removeBookmark(note.id);
                          } else {
                            await addBookmark({
                              resourceId: note.id,
                              resourceType: 'NOTE',
                              title: note.title,
                              subject: note.subject,
                              metadata: { fileUrl: note.fileUrl, fileName: note.fileName },
                            });
                            Alert.alert('Bookmark Saved', 'Note added to your Saved Materials.');
                          }
                        }}
                        style={styles.actionIconBtn}
                        activeOpacity={0.7}
                      >
                        {isBookmarked(note.id) ? (
                          <BookmarkCheck size={16} color={THEME.purple} />
                        ) : (
                          <Bookmark size={16} color={THEME.textSecondary} />
                        )}
                      </TouchableOpacity>

                      <TouchableOpacity 
                        onPress={() => handleDirectShare(note)}
                        style={styles.actionIconBtn}
                        activeOpacity={0.7}
                      >
                        <Share2 size={16} color={THEME.cyan} />
                      </TouchableOpacity>

                      <TouchableOpacity 
                        onPress={() => handleDirectDownload(note)}
                        style={[styles.actionIconBtn, downloadingId === note.id && { opacity: 0.5 }]}
                        activeOpacity={0.7}
                      >
                        <Download size={16} color={THEME.purple} />
                      </TouchableOpacity>

                      {isAdmin && (
                        <TouchableOpacity
                          onPress={() => {
                            Alert.alert(
                              'Permanently Delete PDF?',
                              `Are you sure you want to permanently delete "${note.title}"?`,
                              [
                                { text: 'Cancel', style: 'cancel' },
                                {
                                  text: 'Permanently Delete',
                                  style: 'destructive',
                                  onPress: async () => {
                                    try {
                                      await deleteNote(note.id);
                                      Alert.alert('Deleted', `"${note.title}" was permanently removed.`);
                                    } catch (err: any) {
                                      Alert.alert('Deletion Error', err.message || 'Failed to delete PDF.');
                                    }
                                  },
                                },
                              ]
                            );
                          }}
                          style={[styles.actionIconBtn, { backgroundColor: THEME.redMuted, borderColor: THEME.red + '40' }]}
                          activeOpacity={0.7}
                        >
                          <Trash2 size={16} color={THEME.red} />
                        </TouchableOpacity>
                      )}
                    </View>

                    {/* Right Action: Ask AI + Preview Button */}
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <TouchableOpacity 
                        onPress={() => {
                          router.push({
                            pathname: '/(tabs)/ai-assistant',
                            params: {
                              noteId: note.id,
                              noteTitle: note.title,
                              initialPrompt: 'make 7 question proper',
                            },
                          });
                        }}
                        style={styles.aiStudyChip}
                        activeOpacity={0.8}
                      >
                        <Sparkles size={12} color={THEME.purple} />
                        <Text style={styles.aiStudyChipText}>Ask AI</Text>
                      </TouchableOpacity>

                      <TouchableOpacity 
                        onPress={() => handleSelectNoteForPreview(note)}
                        style={styles.readButton}
                        activeOpacity={0.8}
                      >
                        <Text style={styles.readButtonText}>Preview</Text>
                        <ArrowUpRight size={13} color={THEME.cyan} />
                      </TouchableOpacity>
                    </View>
                  </View>
                </Card>
              ))
          )
        ) : activeTab === 'short' ? (
          /* SECTION 2: VISUAL SHORT NOTES */
          filteredShortNotes.length === 0 ? (
            <EmptyState
              title="No image notes available yet"
              description={`Visual summary slides have not been published for ${userBranch} yet.`}
              actionTitle={isAdmin ? "Upload Image Slides" : undefined}
              onAction={isAdmin ? () => router.push('/admin/upload-short-notes') : undefined}
            />
          ) : (
            filteredShortNotes.map((note) => {
              const coverUri = note.imageUrls && note.imageUrls.length > 0 ? note.imageUrls[0] : '';
              return (
                <Card key={note.id} style={styles.shortNoteCard} variant="elevated">
                  <TouchableOpacity activeOpacity={0.85} onPress={() => openViewer(note)}>
                    <View style={styles.coverImageContainer}>
                      {coverUri ? (
                        <RNImage source={{ uri: coverUri }} style={styles.coverImage} resizeMode="cover" />
                      ) : (
                        <View style={styles.coverPlaceholder}>
                          <ImageIcon size={32} color={THEME.purple} />
                        </View>
                      )}
                      <View style={styles.pageCountBadge}>
                        <Layers size={12} color={THEME.white} />
                        <Text style={styles.pageCountText}>{note.imageUrls.length} Slides</Text>
                      </View>
                    </View>

                    <View style={styles.shortNoteContent}>
                      <View style={styles.tagWrapRow}>
                        <Badge label={note.subject} variant="cyan" size="sm" />
                        {note.chapter ? <Badge label={note.chapter} variant="purple" size="sm" /> : null}
                      </View>
                      <Text style={styles.noteTitle} numberOfLines={2}>{note.title}</Text>
                      {note.description ? (
                        <Text style={styles.noteDesc} numberOfLines={2}>{note.description}</Text>
                      ) : null}
                    </View>
                  </TouchableOpacity>

                  {/* Admin Delete Action for Image Notes */}
                  {isAdmin && (
                    <View style={styles.shortNoteAdminRow}>
                      <TouchableOpacity
                        activeOpacity={0.8}
                        onPress={() => {
                          Alert.alert(
                            'Delete Image Note?',
                            `Are you sure you want to permanently delete "${note.title}"?`,
                            [
                              { text: 'Cancel', style: 'cancel' },
                              {
                                text: 'Delete Note',
                                style: 'destructive',
                                onPress: async () => {
                                  try {
                                    await deleteShortNote(note.id);
                                    Alert.alert('Deleted', `"${note.title}" was permanently removed.`);
                                  } catch (err: any) {
                                    Alert.alert('Error', err.message || 'Could not delete image note.');
                                  }
                                },
                              },
                            ]
                          );
                        }}
                        style={styles.adminDeleteBtn}
                      >
                        <Trash2 size={14} color={THEME.red} />
                        <Text style={styles.adminDeleteBtnText}>Delete Image Note</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </Card>
              );
            })
          )
        ) : (
          /* SECTION 3: PREVIOUS YEAR QUESTIONS (PYQ) */
          filteredPyqNotes.length === 0 ? (
            <EmptyState
              title="No PYQ papers found"
              description={`No previous year question papers found for ${userBranch} matching your filters.`}
              actionTitle={isAdmin ? "Upload PYQ Paper" : undefined}
              onAction={isAdmin ? () => router.push('/admin/upload-notes?defaultType=PYQ') : undefined}
            />
          ) : (
            filteredPyqNotes.map((note) => (
              <Card key={note.id} style={styles.noteCard} variant="elevated">
                {/* Card Header: PYQ Badge, Subject Code, Subject, Year */}
                <TouchableOpacity 
                  activeOpacity={0.8}
                  onPress={() => handleSelectNoteForPreview(note)}
                  style={styles.cardHeaderRow}
                >
                  <View style={[styles.pdfIconBadge, { backgroundColor: THEME.goldMuted, borderColor: THEME.gold + '40' }]}>
                    <Text style={[styles.pdfIconText, { color: THEME.gold }]}>PYQ</Text>
                  </View>

                  <View style={styles.headerInfo}>
                    <View style={styles.tagWrapRow}>
                      <View style={styles.btechBadge}>
                        <Text style={styles.btechBadgeText}>B.Tech</Text>
                      </View>

                      {note.semester ? (
                        <View style={styles.semBadge}>
                          <Text style={styles.semBadgeText}>SEM {note.semester}</Text>
                        </View>
                      ) : null}

                      {note.subjectCode ? (
                        <View style={styles.codeBadge}>
                          <Text style={styles.codeBadgeText}>{note.subjectCode}</Text>
                        </View>
                      ) : null}

                      <Badge label={note.subject} variant="cyan" size="sm" />

                      <Badge 
                        label={note.pyqYear ? `${note.pyqYear} PYQ` : 'PYQ Paper'} 
                        variant="purple" 
                        size="sm" 
                      />

                      {note.unit ? (
                        <Badge label={note.unit} variant="cyan" size="sm" />
                      ) : null}
                    </View>

                    <Text style={styles.noteTitle} numberOfLines={2}>
                      {note.title}
                    </Text>

                    <View style={styles.providerRow}>
                      <Text style={styles.providerText}>
                        Exam: <Text style={styles.providerBold}>{note.pyqYear ? `${note.pyqYear} Paper` : 'PYQ Exam'}</Text> • {note.fileSizeFormatted || 'PDF Document'}
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>

                {/* Description if present */}
                {note.description ? (
                  <Text style={styles.noteDesc} numberOfLines={2}>
                    {note.description}
                  </Text>
                ) : null}

                <View style={styles.metaDivider} />

                {/* Action Bar */}
                <View style={styles.actionRowContainer}>
                  <View style={styles.leftActionGroup}>
                    <TouchableOpacity 
                      onPress={async () => {
                        if (isBookmarked(note.id)) {
                          await removeBookmark(note.id);
                        } else {
                          await addBookmark({
                            resourceId: note.id,
                            resourceType: 'NOTE',
                            title: note.title,
                            subject: note.subject,
                            metadata: { fileUrl: note.fileUrl, fileName: note.fileName },
                          });
                          Alert.alert('Bookmark Saved', 'PYQ paper saved to your bookmarks.');
                        }
                      }}
                      style={styles.actionIconBtn}
                      activeOpacity={0.7}
                    >
                      {isBookmarked(note.id) ? (
                        <BookmarkCheck size={16} color={THEME.cyan} />
                      ) : (
                        <Bookmark size={16} color={THEME.textSecondary} />
                      )}
                    </TouchableOpacity>

                    <TouchableOpacity 
                      onPress={() => handleDirectShare(note)}
                      style={styles.actionIconBtn}
                      activeOpacity={0.7}
                    >
                      <Share2 size={16} color={THEME.cyan} />
                    </TouchableOpacity>

                    <TouchableOpacity 
                      onPress={() => handleDirectDownload(note)}
                      style={[styles.actionIconBtn, downloadingId === note.id && { opacity: 0.5 }]}
                      activeOpacity={0.7}
                    >
                      <Download size={16} color={THEME.purple} />
                    </TouchableOpacity>

                    {isAdmin && (
                      <TouchableOpacity
                        onPress={() => {
                          Alert.alert(
                            'Permanently Delete PYQ?',
                            `Are you sure you want to permanently delete "${note.title}"?`,
                            [
                              { text: 'Cancel', style: 'cancel' },
                              {
                                text: 'Permanently Delete',
                                style: 'destructive',
                                onPress: async () => {
                                  try {
                                    await deleteNote(note.id);
                                    Alert.alert('Deleted', `"${note.title}" was permanently removed.`);
                                  } catch (err: any) {
                                    Alert.alert('Deletion Error', err.message || 'Failed to delete PYQ.');
                                  }
                                },
                              },
                            ]
                          );
                        }}
                        style={[styles.actionIconBtn, { backgroundColor: THEME.redMuted, borderColor: THEME.red + '40' }]}
                        activeOpacity={0.7}
                      >
                        <Trash2 size={16} color={THEME.red} />
                      </TouchableOpacity>
                    )}
                  </View>

                  {/* Right Action: Ask AI + Preview / Open PYQ Button */}
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <TouchableOpacity 
                      onPress={() => {
                        router.push({
                          pathname: '/(tabs)/ai-assistant',
                          params: {
                            noteId: note.id,
                            noteTitle: note.title,
                            initialPrompt: `Solve this ${note.title} with 7-mark model solutions`,
                          },
                        });
                      }}
                      style={styles.aiStudyChip}
                      activeOpacity={0.8}
                    >
                      <Sparkles size={12} color={THEME.purple} />
                      <Text style={styles.aiStudyChipText}>Ask AI</Text>
                    </TouchableOpacity>

                    <TouchableOpacity 
                      onPress={() => handleSelectNoteForPreview(note)}
                      style={styles.readButton}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.readButtonText}>Open PYQ</Text>
                      <ArrowUpRight size={14} color={THEME.cyan} />
                    </TouchableOpacity>
                  </View>
                </View>
              </Card>
            ))
          )
        )}
      </ScrollView>

      {/* ========================================================= */}
      {/* IN-APP PDF PREVIEW MODAL (Inspired by Just-in-Time notes) */}
      {/* ========================================================= */}
      {previewNote && activeResolved && (
        <Modal
          visible={Boolean(previewNote)}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setPreviewNote(null)}
        >
          <View style={styles.previewModalBackdrop}>
            <View style={styles.previewModalCard}>
              {/* Modal Top Header */}
              <View style={styles.previewModalHeader}>
                <View style={{ flex: 1, marginRight: 10 }}>
                  <View style={styles.tagWrapRow}>
                    {previewNote.subjectCode ? (
                      <View style={styles.codeBadge}>
                        <Text style={styles.codeBadgeText}>{previewNote.subjectCode}</Text>
                      </View>
                    ) : null}
                    <Text style={styles.previewModalSubject} numberOfLines={1}>
                      {previewNote.subject}
                    </Text>
                  </View>
                  <Text style={styles.previewModalTitle} numberOfLines={1}>
                    {previewNote.title}
                  </Text>
                </View>

                <TouchableOpacity 
                  onPress={() => setPreviewNote(null)} 
                  style={styles.previewCloseBtn}
                  activeOpacity={0.7}
                >
                  <X size={20} color={THEME.textSecondary} />
                </TouchableOpacity>
              </View>

              {/* Modal Metadata Ribbon */}
              <View style={styles.previewRibbon}>
                <Text style={styles.previewRibbonText} numberOfLines={1}>
                  {previewNote.teacherName ? `Teacher: ${previewNote.teacherName} • ` : ''}
                  {previewNote.provider || 'Gateway Classes'} • {previewNote.unit || 'Unit 1'}
                </Text>
              </View>

              {/* In-App PDF Preview Container (WebView) */}
              <View style={styles.previewWebViewContainer}>
                {activeResolved.previewUrl ? (
                  activeResolved.isDirectPdf ? (
                    previewPdfBase64Loading ? (
                      <View style={styles.previewLoadingOverlay}>
                        <ActivityIndicator size="large" color={THEME.cyan} />
                        <Text style={styles.previewLoadingText}>Reading Document Pages...</Text>
                      </View>
                    ) : (
                      <WebView
                        key={previewWebViewKey}
                        source={{ html: buildPdfViewerHtml(activeResolved.previewUrl, authToken, previewPdfBase64 || undefined) }}
                        style={styles.webView}
                        javaScriptEnabled={true}
                        domStorageEnabled={true}
                        startInLoadingState={true}
                        scalesPageToFit={true}
                        originWhitelist={['*']}
                        mixedContentMode="always"
                        allowFileAccess={true}
                        onLoadStart={() => {
                          setPreviewLoading(true);
                          setPreviewError(false);
                        }}
                        onLoadEnd={() => {
                          setPreviewLoading(false);
                        }}
                        onError={() => {
                          setPreviewLoading(false);
                          setPreviewError(true);
                        }}
                      />
                    )
                  ) : (
                    <WebView
                      key={previewWebViewKey}
                      source={{ uri: activeResolved.previewUrl }}
                      style={styles.webView}
                      javaScriptEnabled={true}
                      domStorageEnabled={true}
                      startInLoadingState={true}
                      scalesPageToFit={true}
                      originWhitelist={['*']}
                      mixedContentMode="always"
                      allowFileAccess={true}
                      onLoadStart={() => {
                        setPreviewLoading(true);
                        setPreviewError(false);
                      }}
                      onLoadEnd={() => {
                        setPreviewLoading(false);
                      }}
                      onError={() => {
                        setPreviewLoading(false);
                        setPreviewError(true);
                      }}
                    />
                  )
                ) : (
                  <View style={styles.previewErrorBox}>
                    <FileText size={36} color={THEME.textTertiary} />
                    <Text style={styles.previewErrorTitle}>Preview Unavailable</Text>
                    <Text style={styles.previewErrorDesc}>
                      No embedded preview URL available. Use the external link button below.
                    </Text>
                  </View>
                )}

                {/* Loading Spinner Overlay */}
                {previewLoading && (
                  <View style={styles.previewLoadingOverlay}>
                    <ActivityIndicator size="large" color={THEME.cyan} />
                    <Text style={styles.previewLoadingText}>
                      {activeResolved.isDrive ? 'Loading Google Drive Preview...' : 'Loading PDF Preview...'}
                    </Text>
                  </View>
                )}

                {/* Error Banner with Retry */}
                {previewError && (
                  <View style={styles.previewErrorOverlay}>
                    <AlertTriangle size={32} color={THEME.gold} />
                    <Text style={styles.previewErrorTitle}>In-App Preview Unavailable</Text>
                    <Text style={styles.previewErrorDesc}>
                      The embedded preview could not be loaded. You can still open and view this PDF using the buttons below.
                    </Text>
                    <TouchableOpacity 
                      style={styles.retryBtn}
                      onPress={() => {
                        setPreviewError(false);
                        setPreviewWebViewKey(k => k + 1);
                      }}
                    >
                      <RotateCcw size={14} color={THEME.white} />
                      <Text style={styles.retryBtnText}>Retry Preview</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>

              {/* CLEARLY VISIBLE EXTERNAL LINK BUTTON & ACTIONS (BELOW PREVIEW) */}
              <View style={styles.previewModalFooter}>
                {/* 1. Large, Clearly Visible External Destination Button */}
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={() => handleOpenExternalDestination(previewNote)}
                  style={[
                    styles.prominentExternalBtn,
                    activeResolved.isDrive ? styles.prominentDriveBtn : styles.prominentGenericBtn
                  ]}
                >
                  <ExternalLink size={17} color={THEME.white} />
                  <Text style={styles.prominentExternalBtnText} numberOfLines={1}>
                    {activeResolved.displayLabel}
                  </Text>
                </TouchableOpacity>

                {/* 2. Sub-Actions: External Android Reader, Save Offline, Full Study Screen */}
                <View style={styles.previewSubActionsRow}>
                  <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={() => handleOpenInAndroidReader(previewNote)}
                    style={styles.previewSubActionBtn}
                  >
                    <BookOpen size={13} color={THEME.cyan} />
                    <Text style={styles.previewSubActionText} numberOfLines={1}>External App</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={() => handleDirectDownload(previewNote)}
                    style={styles.previewSubActionBtn}
                  >
                    <Download size={13} color={THEME.purple} />
                    <Text style={styles.previewSubActionText} numberOfLines={1}>Save Offline</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={() => {
                      const noteToOpen = previewNote;
                      setPreviewNote(null);
                      router.push({
                        pathname: '/(tabs)/ai-assistant',
                        params: {
                          noteId: noteToOpen.id,
                          noteTitle: noteToOpen.title,
                          initialPrompt: 'make 7 question proper',
                        },
                      });
                    }}
                    style={[styles.previewSubActionBtn, styles.aiStudyModalBtn]}
                  >
                    <Sparkles size={13} color={THEME.purple} />
                    <Text style={[styles.previewSubActionText, { color: THEME.purple }]} numberOfLines={1}>Ask AI</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={() => {
                      const noteToOpen = previewNote;
                      setPreviewNote(null);
                      router.push({
                        pathname: '/pdf-viewer',
                        params: {
                          id: noteToOpen.id,
                          fileUrl: noteToOpen.fileUrl,
                          externalUrl: noteToOpen.externalUrl || '',
                          title: noteToOpen.title,
                          fileName: noteToOpen.fileName,
                          subject: noteToOpen.subject,
                          subjectCode: noteToOpen.subjectCode || '',
                          unit: noteToOpen.unit || '',
                          semester: String(noteToOpen.semester || 1),
                          provider: noteToOpen.provider || '',
                          teacherName: noteToOpen.teacherName || '',
                        }
                      });
                    }}
                    style={[styles.previewSubActionBtn, styles.fullStudyBtn]}
                  >
                    <ArrowUpRight size={13} color={THEME.white} />
                    <Text style={[styles.previewSubActionText, { color: THEME.white }]} numberOfLines={1}>Full Study</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </View>
        </Modal>
      )}

      {/* Fullscreen Image Slide Viewer for Short Notes */}
      {activeViewerNote && (
        <Modal
          visible={Boolean(activeViewerNote)}
          animationType="fade"
          transparent={false}
          onRequestClose={() => setActiveViewerNote(null)}
        >
          <SafeAreaView style={styles.fullViewerContainer}>
            <View style={styles.fullViewerHeader}>
              <TouchableOpacity onPress={() => setActiveViewerNote(null)} style={styles.fullViewerCloseBtn}>
                <X size={22} color={THEME.white} />
              </TouchableOpacity>
              <View style={{ flex: 1, paddingHorizontal: 10 }}>
                <Text style={styles.fullViewerTitle} numberOfLines={1}>{activeViewerNote.title}</Text>
                <Text style={styles.fullViewerSubtitle}>
                  Slide {activeImageIndex + 1} of {activeViewerNote.imageUrls.length}
                </Text>
              </View>
              <TouchableOpacity onPress={handleShareCurrentImage} style={styles.fullViewerActionBtn}>
                <Share2 size={18} color={THEME.cyan} />
              </TouchableOpacity>
              <TouchableOpacity onPress={handleDownloadCurrentImage} style={styles.fullViewerActionBtn}>
                <Download size={18} color={THEME.purple} />
              </TouchableOpacity>
              {isAdmin && (
                <TouchableOpacity
                  onPress={() => {
                    Alert.alert(
                      'Delete Image Note?',
                      `Are you sure you want to permanently delete "${activeViewerNote.title}"?`,
                      [
                        { text: 'Cancel', style: 'cancel' },
                        {
                          text: 'Delete',
                          style: 'destructive',
                          onPress: async () => {
                            const idToDelete = activeViewerNote.id;
                            setActiveViewerNote(null);
                            await deleteShortNote(idToDelete);
                            Alert.alert('Deleted', 'Image note was removed.');
                          },
                        },
                      ]
                    );
                  }}
                  style={[styles.fullViewerActionBtn, { backgroundColor: THEME.redMuted, borderColor: THEME.red + '50' }]}
                >
                  <Trash2 size={18} color={THEME.red} />
                </TouchableOpacity>
              )}
            </View>

            <View style={styles.fullImageArea}>
              <RNImage
                source={{ uri: activeViewerNote.imageUrls[activeImageIndex] }}
                style={styles.fullImage}
                resizeMode="contain"
              />
            </View>

            {/* Pagination Thumbnails */}
            <View style={styles.thumbnailBar}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.thumbnailScroll}>
                {activeViewerNote.imageUrls.map((url, idx) => (
                  <TouchableOpacity
                    key={idx}
                    onPress={() => setActiveImageIndex(idx)}
                    style={[
                      styles.thumbItem,
                      activeImageIndex === idx && styles.thumbItemActive,
                    ]}
                  >
                    <RNImage source={{ uri: url }} style={styles.thumbImage} resizeMode="cover" />
                    <Text style={[styles.thumbNumber, activeImageIndex === idx && styles.thumbNumberActive]}>
                      {idx + 1}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </SafeAreaView>
        </Modal>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.background,
  },
  adminUploadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: THEME.purple,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
  },
  adminUploadBtnText: {
    color: THEME.white,
    fontSize: 12,
    fontWeight: '700',
  },
  tabsContainer: {
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  tabTrack: {
    flexDirection: 'row',
    backgroundColor: THEME.surfaceCard,
    padding: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: THEME.surfaceBorder,
    gap: 4,
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 9,
    paddingHorizontal: 4,
    borderRadius: 9,
    gap: 5,
  },
  tabButtonActive: {
    backgroundColor: THEME.purple,
  },
  tabText: {
    fontSize: 11,
    fontWeight: '700',
    color: THEME.textSecondary,
    flexShrink: 1,
  },
  tabTextActive: {
    color: THEME.white,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 110,
  },
  aktuBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: THEME.surfaceCard,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: THEME.surfaceBorder,
    marginBottom: 6,
  },
  aktuBannerInfo: {
    flex: 1,
  },
  aktuBannerTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: THEME.textPrimary,
    letterSpacing: 0.2,
  },
  aktuBannerSub: {
    fontSize: 11,
    color: THEME.textTertiary,
    marginTop: 2,
  },
  aktuBannerHighlight: {
    color: THEME.cyan,
    fontWeight: '700',
  },
  aktuCourseBadge: {
    backgroundColor: THEME.purpleMuted,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: THEME.purple + '50',
  },
  aktuCourseBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: THEME.purple,
  },
  semesterFilterSection: {
    marginBottom: 10,
    gap: 6,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.surfaceCard,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginVertical: 10,
    borderWidth: 1,
    borderColor: THEME.surfaceBorder,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    color: THEME.textPrimary,
    fontSize: 13,
  },
  filtersSection: {
    marginBottom: 14,
    gap: 12,
  },
  filterGroup: {
    gap: 6,
  },
  filterGroupHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 2,
  },
  filterGroupTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: THEME.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  filterResetText: {
    fontSize: 11,
    fontWeight: '700',
    color: THEME.cyan,
  },
  filterPillScroll: {
    gap: 8,
    paddingVertical: 2,
  },
  subjectsScroll: {
    gap: 8,
    paddingBottom: 6,
  },
  filterPill: {
    paddingHorizontal: 13,
    paddingVertical: 7,
    borderRadius: 9,
    backgroundColor: THEME.surfaceCard,
    borderWidth: 1,
    borderColor: THEME.surfaceBorder,
  },
  filterPillActive: {
    backgroundColor: THEME.purple,
    borderColor: THEME.purple,
  },
  filterPillActivePurple: {
    backgroundColor: THEME.purple,
    borderColor: THEME.purple,
  },
  filterPillActiveCyan: {
    backgroundColor: THEME.cyan,
    borderColor: THEME.cyan,
  },
  filterPillActiveGold: {
    backgroundColor: THEME.gold,
    borderColor: THEME.gold,
  },
  filterPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: THEME.textSecondary,
  },
  filterPillTextActive: {
    color: THEME.white,
  },
  noteCard: {
    padding: 16,
    marginBottom: 14,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  pdfIconBadge: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: THEME.cyanMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    borderWidth: 1,
    borderColor: THEME.cyan + '40',
  },
  pdfIconText: {
    fontSize: 11,
    fontWeight: '900',
    color: THEME.cyan,
  },
  headerInfo: {
    flex: 1,
  },
  tagWrapRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 6,
  },
  btechBadge: {
    backgroundColor: THEME.purpleMuted,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: THEME.purple + '40',
  },
  btechBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: THEME.purple,
  },
  semBadge: {
    backgroundColor: THEME.surfaceElevated,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: THEME.surfaceBorder,
  },
  semBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: THEME.textPrimary,
  },
  typeTagBadge: {
    backgroundColor: THEME.goldMuted,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: THEME.gold + '40',
  },
  typeTagBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: THEME.gold,
  },
  codeBadge: {
    backgroundColor: THEME.cyanMuted,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: THEME.cyan + '40',
  },
  codeBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: THEME.cyan,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  unitBadge: {
    backgroundColor: THEME.surfaceElevated,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: THEME.surfaceBorder,
  },
  unitBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: THEME.purple,
  },
  noteTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: THEME.textPrimary,
    lineHeight: 20,
    marginBottom: 4,
  },
  providerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 2,
  },
  providerText: {
    fontSize: 11,
    color: THEME.textTertiary,
    lineHeight: 16,
  },
  providerBold: {
    color: THEME.white,
    fontWeight: '700',
  },
  typeBadge: {
    backgroundColor: THEME.cyanMuted,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  typeBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: THEME.cyan,
  },
  arrowIconWrap: {
    padding: 4,
  },
  noteDesc: {
    fontSize: 12,
    color: THEME.textSecondary,
    lineHeight: 17,
    marginTop: 8,
  },
  metaDivider: {
    height: 1,
    backgroundColor: THEME.surfaceBorder,
    marginVertical: 12,
  },
  actionRowContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  leftActionGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  actionIconBtn: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: THEME.surfaceElevated,
    borderWidth: 1,
    borderColor: THEME.surfaceBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  readButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.cyanMuted,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: THEME.cyan + '40',
    gap: 4,
  },
  readButtonText: {
    color: THEME.cyan,
    fontSize: 12,
    fontWeight: '700',
  },
  aiStudyChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: THEME.purpleMuted,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: THEME.purple + '50',
  },
  aiStudyChipText: {
    color: THEME.purple,
    fontSize: 12,
    fontWeight: '700',
  },
  shortNoteCard: {
    padding: 0,
    marginBottom: 14,
    overflow: 'hidden',
  },
  coverImageContainer: {
    height: 180,
    backgroundColor: THEME.surfaceElevated,
    position: 'relative',
  },
  coverImage: {
    width: '100%',
    height: '100%',
  },
  coverPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pageCountBadge: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  pageCountText: {
    color: THEME.white,
    fontSize: 11,
    fontWeight: '700',
  },
  shortNoteContent: {
    padding: 14,
  },
  shortNoteAdminRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: 14,
    paddingBottom: 12,
    borderTopWidth: 1,
    borderTopColor: THEME.surfaceBorder,
    paddingTop: 8,
  },
  adminDeleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: THEME.redMuted,
    borderWidth: 1,
    borderColor: THEME.red + '40',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  adminDeleteBtnText: {
    color: THEME.red,
    fontSize: 12,
    fontWeight: '700',
  },

  /* Preview Modal Styles */
  previewModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'center',
    padding: 14,
  },
  previewModalCard: {
    backgroundColor: THEME.background,
    borderRadius: 20,
    height: '88%',
    borderWidth: 1,
    borderColor: THEME.surfaceBorder,
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
  },
  previewModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: THEME.surfaceCard,
    borderBottomWidth: 1,
    borderBottomColor: THEME.surfaceBorder,
  },
  previewModalSubject: {
    fontSize: 11,
    fontWeight: '700',
    color: THEME.textSecondary,
  },
  previewModalTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: THEME.textPrimary,
  },
  previewCloseBtn: {
    padding: 6,
  },
  previewRibbon: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    backgroundColor: THEME.surfaceElevated,
    borderBottomWidth: 1,
    borderBottomColor: THEME.surfaceBorder,
  },
  previewRibbonText: {
    fontSize: 11,
    fontWeight: '600',
    color: THEME.cyan,
  },
  previewWebViewContainer: {
    flex: 1,
    backgroundColor: '#1E222D',
    position: 'relative',
  },
  webView: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  previewLoadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(11, 12, 16, 0.85)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  previewLoadingText: {
    color: THEME.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  previewErrorOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: THEME.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 8,
  },
  previewErrorBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 8,
  },
  previewErrorTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: THEME.textPrimary,
  },
  previewErrorDesc: {
    fontSize: 12,
    color: THEME.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
    maxWidth: 280,
  },
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: THEME.purple,
    borderRadius: 8,
  },
  retryBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: THEME.white,
  },
  previewModalFooter: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 16,
    backgroundColor: THEME.surfaceCard,
    borderTopWidth: 1,
    borderTopColor: THEME.surfaceBorder,
    gap: 8,
  },
  prominentExternalBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 4,
  },
  prominentDriveBtn: {
    backgroundColor: '#2563EB', // Blue 600 like justintime Drive button
  },
  prominentGenericBtn: {
    backgroundColor: THEME.purple,
  },
  prominentExternalBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: THEME.white,
    letterSpacing: 0.3,
  },
  previewSubActionsRow: {
    flexDirection: 'row',
    gap: 6,
    width: '100%',
  },
  previewSubActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 9,
    paddingHorizontal: 4,
    backgroundColor: THEME.surfaceElevated,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: THEME.surfaceBorder,
    minWidth: 0,
  },
  fullStudyBtn: {
    backgroundColor: THEME.purple,
    borderColor: THEME.purple,
  },
  aiStudyModalBtn: {
    backgroundColor: THEME.purpleMuted,
    borderColor: THEME.purple + '50',
  },
  previewSubActionText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: THEME.textSecondary,
    flexShrink: 1,
  },

  /* Full Screen Slide Viewer */
  fullViewerContainer: {
    flex: 1,
    backgroundColor: '#000000',
  },
  fullViewerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: 'rgba(0,0,0,0.8)',
  },
  fullViewerCloseBtn: {
    padding: 6,
  },
  fullViewerTitle: {
    color: THEME.white,
    fontSize: 13,
    fontWeight: '700',
  },
  fullViewerSubtitle: {
    color: THEME.textTertiary,
    fontSize: 11,
  },
  fullViewerActionBtn: {
    padding: 8,
  },
  fullImageArea: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullImage: {
    width: '100%',
    height: '100%',
  },
  thumbnailBar: {
    height: 80,
    backgroundColor: 'rgba(0,0,0,0.85)',
    paddingVertical: 8,
  },
  thumbnailScroll: {
    paddingHorizontal: 16,
    gap: 8,
  },
  thumbItem: {
    width: 50,
    height: 64,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: 'transparent',
    overflow: 'hidden',
    position: 'relative',
  },
  thumbItemActive: {
    borderColor: THEME.cyan,
  },
  thumbImage: {
    width: '100%',
    height: '100%',
  },
  thumbNumber: {
    position: 'absolute',
    bottom: 2,
    right: 3,
    fontSize: 9,
    fontWeight: '900',
    color: THEME.white,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 3,
    borderRadius: 3,
  },
  thumbNumberActive: {
    color: THEME.cyan,
  },
});
