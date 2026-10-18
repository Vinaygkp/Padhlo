import React, { useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  Modal, 
  Alert
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import { 
  ArrowLeft, 
  Plus, 
  Trash2, 
  FileText, 
  Upload, 
  ExternalLink, 
  X,
  Layers,
  Sparkles
} from 'lucide-react-native';
import { THEME } from '@/constants/theme';
import { Card } from '@/components/Card';
import { Header } from '@/components/Header';
import { Input } from '@/components/Input';
import { Button } from '@/components/Button';
import { Badge } from '@/components/Badge';
import * as FileSystem from 'expo-file-system/legacy';
import { sanitizePdfFileName } from '@/services/externalPdfViewerService';
import { useStudyHub } from '@/store/StudyHubContext';
import { SyllabusUnit, SyllabusItem } from '@/types';

export default function ManageSyllabusScreen() {
  const router = useRouter();
  const { syllabusList, isAdmin, addSyllabus, uploadSyllabusPdf, deleteSyllabus } = useStudyHub();

  // Mode: 'none' | 'upload_pdf' | 'add_unit'
  const [activeModal, setActiveModal] = useState<'none' | 'upload_pdf' | 'add_unit'>('none');

  // --- PDF UPLOAD STATE ---
  const [pdfSubject, setPdfSubject] = useState('');
  const [pdfCourseCode, setPdfCourseCode] = useState('');
  const [pdfSemester, setPdfSemester] = useState('3');
  const [pdfDescription, setPdfDescription] = useState('');
  const [pdfExternalUrl, setPdfExternalUrl] = useState('');
  const [selectedPdfFile, setSelectedPdfFile] = useState<{
    name: string;
    size?: number;
    uri: string;
    mimeType?: string;
  } | null>(null);
  const [pdfUploading, setPdfUploading] = useState(false);

  // --- TOPICS & UNIT STATE ---
  const [unitSubject, setUnitSubject] = useState('');
  const [unitCourseCode, setUnitCourseCode] = useState('');
  const [unitSemester, setUnitSemester] = useState('3');
  const [unitNumber, setUnitNumber] = useState('1');
  const [unitTitle, setUnitTitle] = useState('');
  const [topicInputs, setTopicInputs] = useState<{ title: string; isExamImportant: boolean }[]>([
    { title: '', isExamImportant: true },
    { title: '', isExamImportant: false },
  ]);
  const [unitSubmitting, setUnitSubmitting] = useState(false);

  if (!isAdmin) {
    return (
      <SafeAreaView style={styles.container}>
        <Header title="Access Denied" subtitle="Administrator privileges required." />
        <View style={styles.deniedContainer}>
          <Text style={styles.deniedText}>Only academic administrators can manage the syllabus library.</Text>
          <Button 
            title="Go Back" 
            onPress={() => {
              if (router.canGoBack()) {
                router.back();
              } else {
                router.replace('/(tabs)');
              }
            }} 
            style={{ marginTop: 16 }} 
          />
        </View>
      </SafeAreaView>
    );
  }

  // Pick PDF File using expo-document-picker
  const handlePickPdf = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf'],
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const file = result.assets[0];
        if (file.size && file.size > 50 * 1024 * 1024) {
          Alert.alert('File Too Large', 'Please select a PDF file smaller than 50 MB.');
          return;
        }

        // Persist immediately into app documentDirectory
        let safeUri = file.uri;
        try {
          const targetDir = `${FileSystem.documentDirectory}studyhub_notes/`;
          const dirInfo = await FileSystem.getInfoAsync(targetDir);
          if (!dirInfo.exists) {
            await FileSystem.makeDirectoryAsync(targetDir, { intermediates: true });
          }
          const safeName = sanitizePdfFileName(file.name || 'syllabus.pdf');
          const targetPath = `${targetDir}${Date.now()}_${safeName}`;

          try {
            await FileSystem.copyAsync({ from: file.uri, to: targetPath });
            safeUri = targetPath;
          } catch {
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
          console.warn('Could not copy syllabus PDF to persistent storage:', copyErr);
        }

        setSelectedPdfFile({
          name: file.name,
          size: file.size,
          uri: safeUri,
          mimeType: file.mimeType || 'application/pdf',
        });

        // Auto-fill course title if empty
        if (!pdfSubject.trim()) {
          const autoName = file.name.replace(/\.pdf$/i, '').replace(/_/g, ' ');
          setPdfSubject(autoName);
        }
      }
    } catch (err: any) {
      Alert.alert('Picker Error', err.message || 'Could not access document picker.');
    }
  };

  // Submit PDF Syllabus
  const handleSubmitPdfSyllabus = async () => {
    if (!pdfSubject.trim() || !pdfCourseCode.trim()) {
      Alert.alert('Required Fields', 'Please enter both the Subject Name and Course Code (e.g. KCS-301).');
      return;
    }

    if (!selectedPdfFile && !pdfExternalUrl.trim()) {
      Alert.alert('No Document Selected', 'Please select a PDF file from your device or provide a valid PDF link.');
      return;
    }

    try {
      setPdfUploading(true);

      if (selectedPdfFile) {
        await uploadSyllabusPdf({
          subject: pdfSubject.trim(),
          courseCode: pdfCourseCode.trim().toUpperCase(),
          description: pdfDescription.trim() || undefined,
          semester: Number(pdfSemester) || 1,
          branches: ['ALL'],
          years: ['ALL'],
          fileUri: selectedPdfFile.uri,
          fileName: selectedPdfFile.name,
          mimeType: selectedPdfFile.mimeType,
        });
      } else {
        // External PDF link
        await addSyllabus({
          subject: pdfSubject.trim(),
          courseCode: pdfCourseCode.trim().toUpperCase(),
          description: pdfDescription.trim() || undefined,
          semester: Number(pdfSemester) || 1,
          branches: ['ALL'],
          years: ['ALL'],
          pdfUrl: pdfExternalUrl.trim(),
          fileName: `${pdfCourseCode.trim().toUpperCase()}_Syllabus.pdf`,
          fileSizeFormatted: 'Online PDF',
          units: [],
          isPublished: true,
        });
      }

      setPdfUploading(false);
      Alert.alert('Success', `Syllabus PDF for ${pdfCourseCode.trim().toUpperCase()} has been uploaded and published.`);
      setPdfSubject('');
      setPdfCourseCode('');
      setPdfDescription('');
      setPdfExternalUrl('');
      setSelectedPdfFile(null);
      setActiveModal('none');
    } catch (err: any) {
      setPdfUploading(false);
      Alert.alert('Upload Error', err.message || 'Failed to upload syllabus PDF.');
    }
  };

  // Add / Remove Topic inputs dynamically
  const handleAddTopicField = () => {
    if (topicInputs.length >= 10) return;
    setTopicInputs((prev) => [...prev, { title: '', isExamImportant: false }]);
  };

  const handleUpdateTopicTitle = (index: number, text: string) => {
    setTopicInputs((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], title: text };
      return copy;
    });
  };

  const handleToggleTopicImportant = (index: number) => {
    setTopicInputs((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], isExamImportant: !copy[index].isExamImportant };
      return copy;
    });
  };

  const handleRemoveTopicField = (index: number) => {
    if (topicInputs.length <= 1) return;
    setTopicInputs((prev) => prev.filter((_, i) => i !== index));
  };

  // Submit Unit & Topics
  const handleSubmitUnitAndTopics = async () => {
    if (!unitSubject.trim() || !unitCourseCode.trim() || !unitTitle.trim()) {
      Alert.alert('Missing Details', 'Please enter Course Name, Course Code, and Unit Title.');
      return;
    }

    const validTopics = topicInputs
      .filter((t) => t.title.trim().length > 0)
      .map((t, idx) => ({
        id: `topic_${Date.now()}_${idx}`,
        title: t.title.trim(),
        isExamImportant: t.isExamImportant,
      }));

    if (validTopics.length === 0) {
      Alert.alert('Topics Required', 'Please enter at least one topic for this unit.');
      return;
    }

    try {
      setUnitSubmitting(true);
      const newUnit: SyllabusUnit = {
        id: `unit_${Date.now()}`,
        unitNumber: Number(unitNumber) || 1,
        unitTitle: unitTitle.trim(),
        topics: validTopics,
      };

      await addSyllabus({
        subject: unitSubject.trim(),
        courseCode: unitCourseCode.trim().toUpperCase(),
        semester: Number(unitSemester) || 1,
        branches: ['ALL'],
        years: ['ALL'],
        units: [newUnit],
        isPublished: true,
      });

      setUnitSubmitting(false);
      Alert.alert('Published', `Unit ${unitNumber} added to ${unitCourseCode.trim().toUpperCase()} syllabus.`);
      setUnitSubject('');
      setUnitCourseCode('');
      setUnitTitle('');
      setTopicInputs([
        { title: '', isExamImportant: true },
        { title: '', isExamImportant: false },
      ]);
      setActiveModal('none');
    } catch (err: any) {
      setUnitSubmitting(false);
      Alert.alert('Error', err.message || 'Failed to save unit & topics.');
    }
  };

  const handleDeleteCourse = (item: SyllabusItem) => {
    Alert.alert(
      'Delete Syllabus Course?',
      `Are you sure you want to permanently delete syllabus for "${item.courseCode} - ${item.subject}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Permanently',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteSyllabus(item.id);
              Alert.alert('Deleted', 'Syllabus course has been removed.');
            } catch (err: any) {
              Alert.alert('Error', err.message || 'Failed to delete syllabus.');
            }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <Header
        title="Syllabus Management"
        subtitle="Upload PDF syllabus or configure units & topics"
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
        activeOpacity={0.7}
      >
        <ArrowLeft size={18} color={THEME.textSecondary} />
        <Text style={styles.backText}>Back to Dashboard</Text>
      </TouchableOpacity>

      {/* ADMIN CONTROLS: TWO PROMINENT BUTTONS */}
      <View style={styles.actionButtonGroup}>
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => setActiveModal('upload_pdf')}
          style={[styles.primaryActionBtn, { backgroundColor: THEME.cyan }]}
        >
          <FileText size={18} color={THEME.background} />
          <View>
            <Text style={[styles.primaryActionBtnTitle, { color: THEME.background }]}>Upload PDF Syllabus</Text>
            <Text style={[styles.primaryActionBtnSub, { color: THEME.background + 'B0' }]}>Attach official university PDF</Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => setActiveModal('add_unit')}
          style={[styles.primaryActionBtn, { backgroundColor: THEME.purple }]}
        >
          <Layers size={18} color={THEME.white} />
          <View>
            <Text style={[styles.primaryActionBtnTitle, { color: THEME.white }]}>Add Unit & Topics</Text>
            <Text style={[styles.primaryActionBtnSub, { color: THEME.white + 'B0' }]}>Units, modules & critical topics</Text>
          </View>
        </TouchableOpacity>
      </View>

      {/* EXISTING COURSES LIST */}
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Published Syllabus Courses ({syllabusList.length})</Text>
        </View>

        {syllabusList.length === 0 ? (
          <View style={styles.emptyCard}>
            <FileText size={42} color={THEME.textTertiary} />
            <Text style={styles.emptyTitle}>No Syllabus Published Yet</Text>
            <Text style={styles.emptyDesc}>Use the buttons above to upload a syllabus PDF or publish course units.</Text>
          </View>
        ) : (
          syllabusList.map((item) => (
            <Card key={item.id} style={styles.sylCard} variant="elevated">
              <View style={styles.cardHeader}>
                <View style={{ flex: 1 }}>
                  <View style={styles.codeRow}>
                    <Badge label={item.courseCode} variant="purple" size="sm" />
                    {item.semester ? (
                      <Badge label={`SEM ${item.semester}`} variant="cyan" size="sm" />
                    ) : null}
                    {item.pdfUrl ? (
                      <Badge label="PDF Attached" variant="gold" size="sm" />
                    ) : null}
                  </View>
                  <Text style={styles.subjectTitle}>{item.subject}</Text>
                  {item.description ? (
                    <Text style={styles.descText} numberOfLines={2}>{item.description}</Text>
                  ) : null}
                </View>

                <TouchableOpacity 
                  onPress={() => handleDeleteCourse(item)}
                  style={styles.deleteBtn}
                  activeOpacity={0.7}
                >
                  <Trash2 size={18} color={THEME.red} />
                </TouchableOpacity>
              </View>

              {/* PDF Document Banner if attached */}
              {item.pdfUrl ? (
                <View style={styles.pdfBannerContainer}>
                  <View style={styles.pdfBannerInfo}>
                    <FileText size={18} color={THEME.cyan} />
                    <View style={{ flex: 1, marginLeft: 8 }}>
                      <Text style={styles.pdfBannerFileName} numberOfLines={1}>
                        {item.fileName || `${item.courseCode}_Syllabus.pdf`}
                      </Text>
                      <Text style={styles.pdfBannerFileSize}>
                        {item.fileSizeFormatted || 'PDF Document'} • Appwrite Storage
                      </Text>
                    </View>
                  </View>

                  <TouchableOpacity
                    onPress={() => {
                      router.push({
                        pathname: '/pdf-viewer',
                        params: {
                          fileUrl: item.pdfUrl,
                          title: `${item.subject} Syllabus`,
                          fileName: item.fileName || `${item.courseCode}_Syllabus.pdf`,
                          subject: item.subject,
                          subjectCode: item.courseCode,
                        },
                      });
                    }}
                    style={styles.previewPdfBtn}
                    activeOpacity={0.8}
                  >
                    <ExternalLink size={13} color={THEME.cyan} />
                    <Text style={styles.previewPdfBtnText}>Preview PDF</Text>
                  </TouchableOpacity>
                </View>
              ) : null}

              {/* Units Overview */}
              {item.units && item.units.length > 0 ? (
                <View style={styles.unitsSection}>
                  <Text style={styles.unitsHeading}>Course Units ({item.units.length}):</Text>
                  {item.units.map((u) => (
                    <View key={u.id} style={styles.unitPill}>
                      <Text style={styles.unitPillText}>
                        Unit {u.unitNumber}: {u.unitTitle} ({u.topics ? u.topics.length : 0} topics)
                      </Text>
                    </View>
                  ))}
                </View>
              ) : (
                <Text style={styles.noUnitsNote}>No units/topics added yet. You can add units using the &apos;Add Unit &amp; Topics&apos; button above.</Text>
              )}
            </Card>
          ))
        )}
      </ScrollView>

      {/* ==================================================== */}
      {/* MODAL 1: UPLOAD SYLLABUS PDF */}
      {/* ==================================================== */}
      <Modal visible={activeModal === 'upload_pdf'} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeaderRow}>
              <View>
                <Text style={styles.modalHeading}>Upload Syllabus PDF</Text>
                <Text style={styles.modalSubheading}>Stored permanently in Appwrite Cloud Storage</Text>
              </View>
              <TouchableOpacity onPress={() => setActiveModal('none')} style={styles.modalCloseBtn}>
                <X size={20} color={THEME.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Input
                label="Course / Subject Name *"
                value={pdfSubject}
                onChangeText={setPdfSubject}
                placeholder="e.g. Operating Systems"
              />

              <Input
                label="Course Code *"
                value={pdfCourseCode}
                onChangeText={setPdfCourseCode}
                placeholder="e.g. KCS-401"
              />

              <Input
                label="Semester (1 - 8)"
                value={pdfSemester}
                onChangeText={setPdfSemester}
                placeholder="e.g. 4"
                keyboardType="numeric"
              />

              <Input
                label="Description / Syllabus Scope (Optional)"
                value={pdfDescription}
                onChangeText={setPdfDescription}
                placeholder="Official AKTU syllabus approved for academic year..."
              />

              {/* Document Picker Box */}
              <Text style={styles.fieldLabel}>Select Syllabus PDF *</Text>
              <TouchableOpacity
                onPress={handlePickPdf}
                activeOpacity={0.8}
                style={[styles.docPickerBox, selectedPdfFile && styles.docPickerBoxSelected]}
              >
                <Upload size={24} color={selectedPdfFile ? THEME.cyan : THEME.textTertiary} />
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={styles.docPickerTitle}>
                    {selectedPdfFile ? selectedPdfFile.name : 'Choose PDF File from Device'}
                  </Text>
                  <Text style={styles.docPickerSub}>
                    {selectedPdfFile 
                      ? `${(selectedPdfFile.size ? (selectedPdfFile.size / (1024 * 1024)).toFixed(2) : '1.0')} MB • Ready to upload`
                      : 'Max file size: 50 MB'}
                  </Text>
                </View>
              </TouchableOpacity>

              <Text style={styles.orDividerText}>— OR ENTER PUBLIC PDF LINK —</Text>

              <Input
                label="Public PDF URL / Google Drive Link"
                value={pdfExternalUrl}
                onChangeText={setPdfExternalUrl}
                placeholder="https://drive.google.com/file/d/... or direct PDF URL"
              />

              <View style={styles.modalActions}>
                <Button
                  title="Cancel"
                  variant="outline"
                  onPress={() => setActiveModal('none')}
                  style={{ flex: 1, marginRight: 8 }}
                />
                <Button
                  title={pdfUploading ? "Uploading..." : "Upload & Publish"}
                  onPress={handleSubmitPdfSyllabus}
                  disabled={pdfUploading}
                  style={{ flex: 1, marginLeft: 8 }}
                />
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ==================================================== */}
      {/* MODAL 2: ADD UNIT & TOPICS */}
      {/* ==================================================== */}
      <Modal visible={activeModal === 'add_unit'} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeaderRow}>
              <View>
                <Text style={styles.modalHeading}>Add Unit & Topics</Text>
                <Text style={styles.modalSubheading}>Configure exam-important topics and modules</Text>
              </View>
              <TouchableOpacity onPress={() => setActiveModal('none')} style={styles.modalCloseBtn}>
                <X size={20} color={THEME.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Input
                label="Course / Subject Name *"
                value={unitSubject}
                onChangeText={setUnitSubject}
                placeholder="e.g. Database Management Systems"
              />

              <Input
                label="Course Code *"
                value={unitCourseCode}
                onChangeText={setUnitCourseCode}
                placeholder="e.g. KCS-501"
              />

              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Input
                    label="Semester (1 - 8)"
                    value={unitSemester}
                    onChangeText={setUnitSemester}
                    placeholder="e.g. 5"
                    keyboardType="numeric"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Input
                    label="Unit Number *"
                    value={unitNumber}
                    onChangeText={setUnitNumber}
                    placeholder="e.g. 1"
                    keyboardType="numeric"
                  />
                </View>
              </View>

              <Input
                label="Unit Title *"
                value={unitTitle}
                onChangeText={setUnitTitle}
                placeholder="e.g. Relational Data Model & ER Diagrams"
              />

              {/* Topics Dynamic List */}
              <View style={styles.topicsSectionHeader}>
                <Text style={styles.fieldLabel}>Unit Topics & Exam Importance</Text>
                <TouchableOpacity onPress={handleAddTopicField} style={styles.addTopicInlineBtn}>
                  <Plus size={14} color={THEME.cyan} />
                  <Text style={styles.addTopicInlineText}>Add Topic</Text>
                </TouchableOpacity>
              </View>

              {topicInputs.map((t, idx) => (
                <View key={idx} style={styles.topicRowCard}>
                  <View style={{ flex: 1 }}>
                    <Input
                      label={`Topic ${idx + 1} *`}
                      value={t.title}
                      onChangeText={(txt) => handleUpdateTopicTitle(idx, txt)}
                      placeholder="e.g. Normalization (1NF, 2NF, 3NF, BCNF)"
                    />
                  </View>

                  <View style={styles.topicRowActions}>
                    <TouchableOpacity
                      onPress={() => handleToggleTopicImportant(idx)}
                      style={[
                        styles.importantToggleBtn,
                        t.isExamImportant && styles.importantToggleBtnActive,
                      ]}
                      activeOpacity={0.7}
                    >
                      <Sparkles size={12} color={t.isExamImportant ? THEME.gold : THEME.textTertiary} />
                      <Text style={[
                        styles.importantToggleText,
                        t.isExamImportant && { color: THEME.gold },
                      ]}>
                        {t.isExamImportant ? 'Critical ★' : 'Standard'}
                      </Text>
                    </TouchableOpacity>

                    {topicInputs.length > 1 && (
                      <TouchableOpacity
                        onPress={() => handleRemoveTopicField(idx)}
                        style={styles.topicRemoveBtn}
                      >
                        <Trash2 size={16} color={THEME.red} />
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              ))}

              <View style={styles.modalActions}>
                <Button
                  title="Cancel"
                  variant="outline"
                  onPress={() => setActiveModal('none')}
                  style={{ flex: 1, marginRight: 8 }}
                />
                <Button
                  title={unitSubmitting ? "Publishing..." : "Publish Unit"}
                  onPress={handleSubmitUnitAndTopics}
                  disabled={unitSubmitting}
                  style={{ flex: 1, marginLeft: 8 }}
                />
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.background,
  },
  deniedContainer: {
    padding: 24,
    alignItems: 'center',
  },
  deniedText: {
    color: THEME.red,
    fontSize: 14,
    textAlign: 'center',
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
  actionButtonGroup: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    gap: 10,
    marginBottom: 14,
  },
  primaryActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    gap: 10,
  },
  primaryActionBtnTitle: {
    fontSize: 12,
    fontWeight: '800',
  },
  primaryActionBtnSub: {
    fontSize: 10,
    fontWeight: '600',
    marginTop: 2,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  sectionHeaderRow: {
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: THEME.textPrimary,
  },
  emptyCard: {
    backgroundColor: THEME.surfaceCard,
    padding: 30,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: THEME.surfaceBorder,
    marginTop: 10,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: THEME.textPrimary,
    marginTop: 12,
  },
  emptyDesc: {
    fontSize: 12,
    color: THEME.textSecondary,
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 18,
  },
  sylCard: {
    padding: 16,
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  codeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  subjectTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: THEME.textPrimary,
  },
  descText: {
    fontSize: 12,
    color: THEME.textSecondary,
    marginTop: 4,
    lineHeight: 16,
  },
  deleteBtn: {
    padding: 6,
    backgroundColor: THEME.redMuted,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: THEME.red + '40',
  },
  pdfBannerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: THEME.surfaceCard,
    padding: 10,
    borderRadius: 10,
    marginTop: 12,
    borderWidth: 1,
    borderColor: THEME.cyan + '40',
  },
  pdfBannerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
  },
  pdfBannerFileName: {
    fontSize: 12,
    fontWeight: '700',
    color: THEME.textPrimary,
  },
  pdfBannerFileSize: {
    fontSize: 10,
    color: THEME.textTertiary,
    marginTop: 2,
  },
  previewPdfBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: THEME.cyanMuted,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: THEME.cyan + '50',
  },
  previewPdfBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: THEME.cyan,
  },
  unitsSection: {
    marginTop: 12,
    gap: 6,
  },
  unitsHeading: {
    fontSize: 12,
    fontWeight: '700',
    color: THEME.textSecondary,
    marginBottom: 2,
  },
  unitPill: {
    backgroundColor: THEME.surfaceCard,
    padding: 8,
    borderRadius: 8,
  },
  unitPillText: {
    fontSize: 12,
    color: THEME.textPrimary,
    fontWeight: '600',
  },
  noUnitsNote: {
    fontSize: 11,
    color: THEME.textTertiary,
    fontStyle: 'italic',
    marginTop: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: '#000000B5',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: THEME.surfaceElevated,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    maxHeight: '92%',
  },
  modalHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  modalHeading: {
    fontSize: 18,
    fontWeight: '900',
    color: THEME.textPrimary,
  },
  modalSubheading: {
    fontSize: 11,
    color: THEME.textTertiary,
    marginTop: 2,
  },
  modalCloseBtn: {
    padding: 4,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: THEME.textSecondary,
    marginBottom: 6,
    marginTop: 4,
  },
  docPickerBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.surfaceCard,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: THEME.surfaceBorder,
    borderRadius: 12,
    padding: 16,
    marginBottom: 14,
  },
  docPickerBoxSelected: {
    borderColor: THEME.cyan,
    backgroundColor: THEME.cyanMuted + '20',
  },
  docPickerTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: THEME.textPrimary,
  },
  docPickerSub: {
    fontSize: 11,
    color: THEME.textTertiary,
    marginTop: 2,
  },
  orDividerText: {
    fontSize: 10,
    fontWeight: '800',
    color: THEME.textTertiary,
    textAlign: 'center',
    marginVertical: 10,
    letterSpacing: 1,
  },
  topicsSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 6,
  },
  addTopicInlineBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  addTopicInlineText: {
    fontSize: 12,
    fontWeight: '700',
    color: THEME.cyan,
  },
  topicRowCard: {
    backgroundColor: THEME.surfaceCard,
    padding: 10,
    borderRadius: 10,
    marginBottom: 10,
  },
  topicRowActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  importantToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: THEME.surfaceElevated,
    borderWidth: 1,
    borderColor: THEME.surfaceBorder,
  },
  importantToggleBtnActive: {
    backgroundColor: THEME.goldMuted,
    borderColor: THEME.gold + '50',
  },
  importantToggleText: {
    fontSize: 11,
    fontWeight: '700',
    color: THEME.textTertiary,
  },
  topicRemoveBtn: {
    padding: 4,
  },
  modalActions: {
    flexDirection: 'row',
    marginTop: 14,
    marginBottom: 20,
  },
});
