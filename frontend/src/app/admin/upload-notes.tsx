import React, { useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  Switch, 
  Alert 
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import { 
  ArrowLeft, 
  Upload, 
  FileCheck,
  Link2,
  CheckCircle2
} from 'lucide-react-native';
import { THEME } from '@/constants/theme';
import { Card } from '@/components/Card';
import { Header } from '@/components/Header';
import { Input } from '@/components/Input';
import { Button } from '@/components/Button';
import * as FileSystem from 'expo-file-system/legacy';
import { sanitizePdfFileName } from '@/services/externalPdfViewerService';
import { useStudyHub } from '@/store/StudyHubContext';
import { BRANCHES, BranchCode, ACADEMIC_YEARS, AcademicYear } from '@/types';

const SEMESTERS = [1, 2, 3, 4, 5, 6, 7, 8];
const UNITS = ['Unit 1', 'Unit 2', 'Unit 3', 'Unit 4', 'Unit 5', 'Full Syllabus'];
const NOTE_TYPES = ['PYQ Solved', 'Handwritten Notes', 'Quantum Revision', 'Lecture Notes', 'One-Shot Revision'];
const COMMON_PROVIDERS = ['Gateway Classes', 'Multi Atoms', 'College Faculty', 'Bitwise Classes', 'Other'];
const PYQ_YEARS = ['2025', '2024', '2023', '2022', '2021', '2020'];

export default function UploadNotesScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ defaultType?: string }>();
  const isInitialPyq = params.defaultType === 'PYQ';

  const { addNote } = useStudyHub();

  // Mode: 'file' (upload local PDF) or 'external' (Google Drive / Web PDF link)
  const [sourceMode, setSourceMode] = useState<'file' | 'external'>('file');

  const [title, setTitle] = useState('');
  const [subject, setSubject] = useState('');
  const [subjectCode, setSubjectCode] = useState('');
  const [semester, setSemester] = useState<number>(1);
  const [unit, setUnit] = useState<string>('Unit 1');
  const [provider, setProvider] = useState<string>('Gateway Classes');
  const [teacherName, setTeacherName] = useState('');
  const [noteType, setNoteType] = useState<string>(isInitialPyq ? 'PYQ Solved' : 'Handwritten Notes');
  const [isPyq, setIsPyq] = useState<boolean>(isInitialPyq);
  const [pyqYear, setPyqYear] = useState<string>('2024');
  const [description, setDescription] = useState('');
  const [externalUrl, setExternalUrl] = useState('');

  const [selectedBranches, setSelectedBranches] = useState<BranchCode[]>(['ALL']);
  const [selectedYears, setSelectedYears] = useState<AcademicYear[]>(['ALL']);
  const [isImportant, setIsImportant] = useState(false);
  const [isPublished] = useState(true);

  const [selectedFile, setSelectedFile] = useState<{
    name: string;
    size?: number;
    uri: string;
    mimeType?: string;
  } | null>(null);

  const [uploading, setUploading] = useState(false);

  // Check if external URL is a Google Drive link
  const isDriveLink = /(?:drive\.google\.com|docs\.google\.com)/.test(externalUrl);

  const toggleBranch = (code: BranchCode) => {
    if (code === 'ALL') {
      setSelectedBranches(['ALL']);
      return;
    }

    let updated: BranchCode[] = selectedBranches.filter((b) => b !== 'ALL');
    if (updated.includes(code)) {
      updated = updated.filter((b) => b !== code);
      if (updated.length === 0) updated = ['ALL'];
    } else {
      updated.push(code);
    }
    setSelectedBranches(updated);
  };

  const toggleYear = (code: AcademicYear) => {
    if (code === 'ALL') {
      setSelectedYears(['ALL']);
      return;
    }

    let updated: AcademicYear[] = selectedYears.filter((y) => y !== 'ALL');
    if (updated.includes(code)) {
      updated = updated.filter((y) => y !== code);
      if (updated.length === 0) updated = ['ALL'];
    } else {
      updated.push(code);
    }
    setSelectedYears(updated);
  };

  const handlePickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf'],
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const file = result.assets[0];
        
        if (file.size && file.size > 50 * 1024 * 1024) {
          Alert.alert('File Too Large', 'Please select a PDF smaller than 50 MB.');
          return;
        }

        // Persist immediately into app documentDirectory to avoid scoped cache permission issues
        let safeUri = file.uri;
        try {
          const targetDir = `${FileSystem.documentDirectory}studyhub_notes/`;
          const dirInfo = await FileSystem.getInfoAsync(targetDir);
          if (!dirInfo.exists) {
            await FileSystem.makeDirectoryAsync(targetDir, { intermediates: true });
          }
          const safeName = sanitizePdfFileName(file.name || 'document.pdf');
          const targetPath = `${targetDir}${Date.now()}_${safeName}`;

          try {
            await FileSystem.copyAsync({ from: file.uri, to: targetPath });
            safeUri = targetPath;
          } catch {
            // DocumentPicker sandbox restriction in Expo Go fallback
            const resp = await fetch(file.uri);
            const blob = await resp.blob();
            const reader = new FileReader();
            const b64Promise = new Promise<string>((resolve, reject) => {
              reader.onloadend = () => {
                const res = (reader.result as string) || '';
                const parts = res.split(',');
                resolve(parts[1] || res);
              };
              reader.onerror = reject;
            });
            reader.readAsDataURL(blob);
            const b64 = await b64Promise;
            await FileSystem.writeAsStringAsync(targetPath, b64, { encoding: FileSystem.EncodingType.Base64 });
            safeUri = targetPath;
          }
        } catch (copyErr) {
          console.warn('Could not copy to persistent storage, using original uri:', copyErr);
        }

        setSelectedFile({
          name: file.name,
          size: file.size,
          uri: safeUri,
          mimeType: file.mimeType || 'application/pdf',
        });

        if (!title.trim()) {
          const cleanName = file.name.replace(/\.pdf$/i, '').replace(/_/g, ' ');
          setTitle(cleanName);
        }
      }
    } catch (err: any) {
      Alert.alert('Error picking document', err.message);
    }
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes || bytes <= 0) return 'PDF Document';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const handleUploadSubmit = async () => {
    if (!title.trim() || !subject.trim()) {
      Alert.alert('Missing Information', 'Please enter a title and course subject.');
      return;
    }

    if (sourceMode === 'file' && !selectedFile) {
      Alert.alert('No File Selected', 'Please choose a PDF file to upload.');
      return;
    }

    if (sourceMode === 'external') {
      if (!externalUrl.trim()) {
        Alert.alert('Missing External Link', 'Please enter the Google Drive or PDF link.');
        return;
      }
      if (!externalUrl.trim().startsWith('http://') && !externalUrl.trim().startsWith('https://')) {
        Alert.alert('Invalid URL', 'Please enter a valid URL starting with https://');
        return;
      }
    }

    setUploading(true);

    try {
      if (sourceMode === 'external') {
        const cleanUrl = externalUrl.trim();
        await addNote({
          title: title.trim(),
          subject: subject.trim(),
          subjectCode: subjectCode.trim() || undefined,
          semester,
          unit,
          provider: provider.trim() || 'External Provider',
          teacherName: teacherName.trim() || undefined,
          type: noteType,
          description: description.trim() || undefined,
          fileName: `${title.trim().replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf`,
          fileUrl: cleanUrl,
          externalUrl: cleanUrl,
          isExternal: true,
          fileSizeFormatted: isDriveLink ? 'Google Drive PDF' : 'Online Document',
          branches: selectedBranches,
          years: selectedYears,
          isImportant,
          isPublished,
          isPyq: isPyq || noteType.includes('PYQ'),
          pyqYear: (isPyq || noteType.includes('PYQ')) ? pyqYear : undefined,
        });
      } else {
        await addNote({
          title: title.trim(),
          subject: subject.trim(),
          subjectCode: subjectCode.trim() || undefined,
          semester,
          unit,
          provider: provider.trim() || 'College Faculty',
          teacherName: teacherName.trim() || undefined,
          type: noteType,
          description: description.trim() || undefined,
          fileName: selectedFile!.name,
          fileUrl: selectedFile!.uri,
          isExternal: false,
          fileSizeFormatted: formatFileSize(selectedFile!.size),
          branches: selectedBranches,
          years: selectedYears,
          isImportant,
          isPublished,
          isPyq: isPyq || noteType.includes('PYQ'),
          pyqYear: (isPyq || noteType.includes('PYQ')) ? pyqYear : undefined,
        });
      }

      setUploading(false);
      Alert.alert('Note Added Successfully', `"${title}" has been published to student library.`, [
        { 
          text: 'OK', 
          onPress: () => {
            if (router.canGoBack()) {
              router.back();
            } else {
              router.replace('/admin/dashboard');
            }
          } 
        },
      ]);
    } catch (err: any) {
      setUploading(false);
      Alert.alert('Publish Error', err.message || 'Failed to publish note.');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <Header
        title={isInitialPyq ? "Upload PYQ Paper (PDF)" : "Admin PDF Management"}
        subtitle={isInitialPyq ? "Upload previous year question papers with answer schemes" : "Publish branch & semester study materials"}
      />

      <TouchableOpacity 
        onPress={() => {
          if (router.canGoBack()) {
            router.back();
          } else {
            router.replace('/admin/dashboard');
          }
        }} 
        style={styles.backBtn}
      >
        <ArrowLeft size={18} color={THEME.textSecondary} />
        <Text style={styles.backText}>Back to Notes Library</Text>
      </TouchableOpacity>

      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        {/* Source Mode Toggle: Upload File vs Register External Link */}
        <View style={styles.sourceToggleCard}>
          <Text style={styles.toggleSectionLabel}>CHOOSE MATERIAL SOURCE:</Text>
          <View style={styles.segmentedRow}>
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => setSourceMode('file')}
              style={[styles.segmentBtn, sourceMode === 'file' && styles.segmentBtnActive]}
            >
              <Upload size={16} color={sourceMode === 'file' ? THEME.white : THEME.textSecondary} />
              <Text style={[styles.segmentBtnText, sourceMode === 'file' && styles.segmentBtnTextActive]}>
                Upload PDF File
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => setSourceMode('external')}
              style={[styles.segmentBtn, sourceMode === 'external' && styles.segmentBtnActiveCyan]}
            >
              <Link2 size={16} color={sourceMode === 'external' ? THEME.white : THEME.textSecondary} />
              <Text style={[styles.segmentBtnText, sourceMode === 'external' && styles.segmentBtnTextActive]}>
                External / Drive Link
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Mode A: Local PDF File Picker */}
        {sourceMode === 'file' ? (
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={handlePickDocument}
            style={styles.pickerBox}
          >
            {selectedFile ? (
              <View style={styles.fileSelectedRow}>
                <View style={styles.pdfIconCircle}>
                  <FileCheck size={28} color={THEME.green} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.selectedFileName} numberOfLines={1}>{selectedFile.name}</Text>
                  <Text style={styles.selectedFileSize}>{formatFileSize(selectedFile.size)} • PDF Ready</Text>
                </View>
                <Text style={styles.changeFileText}>Change</Text>
              </View>
            ) : (
              <View style={styles.pickerPlaceholder}>
                <View style={styles.uploadIconCircle}>
                  <Upload size={28} color={THEME.purple} />
                </View>
                <Text style={styles.pickerTitle}>Tap to Select PDF Document</Text>
                <Text style={styles.pickerSub}>Supports PDF files up to 50 MB (saved permanently to R2/local)</Text>
              </View>
            )}
          </TouchableOpacity>
        ) : (
          /* Mode B: External Link Input */
          <Card style={styles.externalCard} variant="elevated">
            <Input
              label="External PDF or Google Drive Link *"
              value={externalUrl}
              onChangeText={setExternalUrl}
              placeholder="e.g. https://drive.google.com/file/d/.../view or direct PDF URL"
              autoCapitalize="none"
              autoCorrect={false}
            />
            {isDriveLink ? (
              <View style={styles.driveNoticeBox}>
                <CheckCircle2 size={16} color={THEME.green} />
                <Text style={styles.driveNoticeText}>
                  ✨ Google Drive link detected! Students will have an in-app preview and a direct &quot;Open in Google Drive&quot; button.
                </Text>
              </View>
            ) : externalUrl.trim().length > 0 ? (
              <View style={styles.driveNoticeBoxGeneric}>
                <Link2 size={16} color={THEME.cyan} />
                <Text style={styles.driveNoticeTextGeneric}>
                  Web PDF URL registered. In-app viewer and external link launcher will be configured automatically.
                </Text>
              </View>
            ) : null}
          </Card>
        )}

        {/* Academic Hierarchy & Metadata Card */}
        <Card style={styles.metaCard} variant="elevated">
          <Input
            label="Material Title *"
            value={title}
            onChangeText={setTitle}
            placeholder="e.g. Mathematics - I: Unit 1 - Matrices (One-Shot Revision)"
          />

          <View style={styles.rowTwoInputs}>
            <View style={{ flex: 1.4 }}>
              <Input
                label="Course / Subject *"
                value={subject}
                onChangeText={setSubject}
                placeholder="e.g. Mathematics - I"
              />
            </View>
            <View style={{ flex: 1 }}>
              <Input
                label="Subject Code"
                value={subjectCode}
                onChangeText={setSubjectCode}
                placeholder="e.g. BAS103"
                autoCapitalize="characters"
              />
            </View>
          </View>

          {/* Semester Selector */}
          <Text style={styles.sectionHeaderTitle}>Semester *</Text>
          <View style={styles.pillsWrap}>
            {SEMESTERS.map((sem) => (
              <TouchableOpacity
                key={sem}
                onPress={() => setSemester(sem)}
                style={[styles.filterPill, semester === sem && styles.filterPillActive]}
              >
                <Text style={[styles.filterPillText, semester === sem && styles.filterPillTextActive]}>
                  Sem {sem}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Unit Selector */}
          <Text style={[styles.sectionHeaderTitle, { marginTop: 14 }]}>Curriculum Unit *</Text>
          <View style={styles.pillsWrap}>
            {UNITS.map((u) => (
              <TouchableOpacity
                key={u}
                onPress={() => setUnit(u)}
                style={[styles.filterPill, unit === u && styles.filterPillActive]}
              >
                <Text style={[styles.filterPillText, unit === u && styles.filterPillTextActive]}>
                  {u}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Provider / Channel Source */}
          <Text style={[styles.sectionHeaderTitle, { marginTop: 14 }]}>Provider / Channel</Text>
          <View style={styles.pillsWrap}>
            {COMMON_PROVIDERS.map((p) => (
              <TouchableOpacity
                key={p}
                onPress={() => setProvider(p)}
                style={[styles.filterPill, provider === p && styles.filterPillActiveCyan]}
              >
                <Text style={[styles.filterPillText, provider === p && styles.filterPillTextActive]}>
                  {p}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.rowTwoInputs}>
            <View style={{ flex: 1 }}>
              <Input
                label="Teacher Name (Optional)"
                value={teacherName}
                onChangeText={setTeacherName}
                placeholder="e.g. Gulshan Sir"
              />
            </View>
          </View>

          {/* Note Type Selector */}
          <Text style={[styles.sectionHeaderTitle, { marginTop: 8 }]}>Material Type *</Text>
          <View style={styles.pillsWrap}>
            {NOTE_TYPES.map((nt) => {
              const isActive = noteType === nt;
              return (
                <TouchableOpacity
                  key={nt}
                  onPress={() => {
                    setNoteType(nt);
                    if (nt.includes('PYQ')) {
                      setIsPyq(true);
                    }
                  }}
                  style={[styles.filterPill, isActive && styles.filterPillActive]}
                >
                  <Text style={[styles.filterPillText, isActive && styles.filterPillTextActive]}>
                    {nt}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* PYQ Exam Year Selector (shown if PYQ is active) */}
          {(isPyq || noteType.includes('PYQ')) && (
            <View style={{ marginTop: 12 }}>
              <Text style={styles.sectionHeaderTitle}>PYQ Exam Year *</Text>
              <View style={styles.pillsWrap}>
                {PYQ_YEARS.map((yr) => (
                  <TouchableOpacity
                    key={yr}
                    onPress={() => setPyqYear(yr)}
                    style={[styles.filterPill, pyqYear === yr && styles.filterPillActive]}
                  >
                    <Text style={[styles.filterPillText, pyqYear === yr && styles.filterPillTextActive]}>
                      {yr} Exam
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {/* Branch Target Selector */}
          <Text style={[styles.sectionHeaderTitle, { marginTop: 16 }]}>Branch Authorization *</Text>
          <View style={styles.pillsWrap}>
            <TouchableOpacity
              onPress={() => toggleBranch('ALL')}
              style={[
                styles.filterPill,
                selectedBranches.includes('ALL') && styles.filterPillActive,
              ]}
            >
              <Text style={[styles.filterPillText, selectedBranches.includes('ALL') && styles.filterPillTextActive]}>
                All Branches (Common)
              </Text>
            </TouchableOpacity>

            {BRANCHES.map((b) => {
              const isSelected = selectedBranches.includes(b.code);
              return (
                <TouchableOpacity
                  key={b.code}
                  onPress={() => toggleBranch(b.code)}
                  style={[styles.filterPill, isSelected && styles.filterPillActive]}
                >
                  <Text style={[styles.filterPillText, isSelected && styles.filterPillTextActive]}>
                    {b.code}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Academic Year Target Selector */}
          <Text style={[styles.sectionHeaderTitle, { marginTop: 14 }]}>Academic Year Authorization *</Text>
          <View style={styles.pillsWrap}>
            <TouchableOpacity
              onPress={() => toggleYear('ALL')}
              style={[
                styles.filterPill,
                selectedYears.includes('ALL') && styles.filterPillActive,
              ]}
            >
              <Text style={[styles.filterPillText, selectedYears.includes('ALL') && styles.filterPillTextActive]}>
                All Years (Common)
              </Text>
            </TouchableOpacity>

            {ACADEMIC_YEARS.map((y) => {
              const isSelected = selectedYears.includes(y.code);
              return (
                <TouchableOpacity
                  key={y.code}
                  onPress={() => toggleYear(y.code)}
                  style={[styles.filterPill, isSelected && styles.filterPillActive]}
                >
                  <Text style={[styles.filterPillText, isSelected && styles.filterPillTextActive]}>
                    {y.shortName}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Input
            label="Description (Optional)"
            value={description}
            onChangeText={setDescription}
            placeholder="Important derivation steps, solved PYQs, and revision tips..."
            multiline
            numberOfLines={2}
          />

          <View style={styles.toggleRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.toggleTitle}>Mark as High-Yield Exam Guide</Text>
              <Text style={styles.toggleDesc}>Highlights note with a gold star badge in student feeds</Text>
            </View>
            <Switch
              value={isImportant}
              onValueChange={setIsImportant}
              trackColor={{ false: THEME.surfaceBorder, true: THEME.gold }}
              thumbColor={THEME.white}
            />
          </View>

          <Button
            title={uploading ? "Publishing Material..." : sourceMode === 'file' ? "Upload & Publish PDF" : "Register & Publish Link"}
            onPress={handleUploadSubmit}
            loading={uploading}
            disabled={uploading}
            size="lg"
            variant="purple"
            style={styles.submitBtn}
          />
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.background,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 12,
    gap: 6,
  },
  backText: {
    color: THEME.textSecondary,
    fontSize: 13,
    fontWeight: '600',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  sourceToggleCard: {
    backgroundColor: THEME.surfaceCard,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: THEME.surfaceBorder,
    marginBottom: 14,
  },
  toggleSectionLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: THEME.textTertiary,
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  segmentedRow: {
    flexDirection: 'row',
    backgroundColor: THEME.surfaceElevated,
    padding: 4,
    borderRadius: 12,
    gap: 6,
  },
  segmentBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 9,
    gap: 6,
  },
  segmentBtnActive: {
    backgroundColor: THEME.purple,
  },
  segmentBtnActiveCyan: {
    backgroundColor: THEME.cyan,
  },
  segmentBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: THEME.textSecondary,
  },
  segmentBtnTextActive: {
    color: THEME.white,
  },
  pickerBox: {
    backgroundColor: THEME.surfaceCard,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: THEME.purple + '80',
    borderRadius: 18,
    padding: 20,
    marginBottom: 14,
  },
  pickerPlaceholder: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  uploadIconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: THEME.purpleMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  pickerTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: THEME.textPrimary,
  },
  pickerSub: {
    fontSize: 11,
    color: THEME.textSecondary,
    marginTop: 3,
    textAlign: 'center',
  },
  fileSelectedRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  pdfIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: THEME.greenMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  selectedFileName: {
    fontSize: 13,
    fontWeight: '800',
    color: THEME.textPrimary,
  },
  selectedFileSize: {
    fontSize: 11,
    color: THEME.textSecondary,
    marginTop: 2,
  },
  changeFileText: {
    color: THEME.cyan,
    fontSize: 12,
    fontWeight: '800',
  },
  externalCard: {
    padding: 16,
    marginBottom: 14,
  },
  driveNoticeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: THEME.greenMuted,
    padding: 10,
    borderRadius: 10,
    marginTop: 4,
    borderWidth: 1,
    borderColor: THEME.green + '30',
  },
  driveNoticeText: {
    flex: 1,
    fontSize: 12,
    color: THEME.green,
    fontWeight: '600',
  },
  driveNoticeBoxGeneric: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: THEME.cyanMuted,
    padding: 10,
    borderRadius: 10,
    marginTop: 4,
    borderWidth: 1,
    borderColor: THEME.cyan + '30',
  },
  driveNoticeTextGeneric: {
    flex: 1,
    fontSize: 12,
    color: THEME.cyan,
    fontWeight: '600',
  },
  metaCard: {
    padding: 20,
  },
  rowTwoInputs: {
    flexDirection: 'row',
    gap: 12,
  },
  sectionHeaderTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: THEME.textSecondary,
    marginBottom: 8,
    letterSpacing: 0.3,
  },
  pillsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
    marginBottom: 12,
  },
  filterPill: {
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: THEME.surfaceCard,
    borderWidth: 1,
    borderColor: THEME.surfaceBorder,
  },
  filterPillActive: {
    backgroundColor: THEME.purple,
    borderColor: THEME.purple,
  },
  filterPillActiveCyan: {
    backgroundColor: THEME.cyan,
    borderColor: THEME.cyan,
  },
  filterPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: THEME.textSecondary,
  },
  filterPillTextActive: {
    color: THEME.white,
  },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 10,
  },
  toggleTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: THEME.textPrimary,
  },
  toggleDesc: {
    fontSize: 11,
    color: THEME.textSecondary,
    marginTop: 2,
  },
  submitBtn: {
    marginTop: 18,
    width: '100%',
  },
});
