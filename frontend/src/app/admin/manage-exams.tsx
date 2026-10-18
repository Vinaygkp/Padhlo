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
import { 
  ArrowLeft, 
  Plus, 
  Calendar, 
  Clock, 
  MapPin, 
  Trash2, 
  Ban,
  GraduationCap
} from 'lucide-react-native';
import { THEME } from '@/constants/theme';
import { Card } from '@/components/Card';
import { Header } from '@/components/Header';
import { Input } from '@/components/Input';
import { Button } from '@/components/Button';
import { Badge } from '@/components/Badge';
import { useStudyHub } from '@/store/StudyHubContext';
import { ExamItem, BRANCHES, BranchCode, ACADEMIC_YEARS, AcademicYear } from '@/types';

export default function ManageExamsScreen() {
  const router = useRouter();
  const { exams, addExam, deleteExam, cancelExam } = useStudyHub();

  const [modalVisible, setModalVisible] = useState(false);

  // Form states
  const [subject, setSubject] = useState('');
  const [title, setTitle] = useState('');
  const [selectedBranches, setSelectedBranches] = useState<BranchCode[]>(['ALL']);
  const [selectedYears, setSelectedYears] = useState<AcademicYear[]>(['ALL']);
  const [examDate, setExamDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [room, setRoom] = useState('');
  const [instructions, setInstructions] = useState('');

  // Admin filter state
  const [adminBranchFilter, setAdminBranchFilter] = useState<BranchCode | 'ALL'>('ALL');

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

  const handleCreateExam = async () => {
    if (!subject.trim() || !title.trim() || !examDate.trim()) {
      Alert.alert('Missing Details', 'Please enter the subject, exam title, and exam date.');
      return;
    }

    await addExam({
      subject: subject.trim(),
      title: title.trim(),
      branches: selectedBranches,
      years: selectedYears,
      examDate: examDate.trim(),
      startTime: startTime.trim() || 'TBD',
      endTime: endTime.trim() || 'TBD',
      room: room.trim() || undefined,
      instructions: instructions.trim() || undefined,
      isPublished: true,
      isCancelled: false,
    });

    setSubject('');
    setTitle('');
    setSelectedBranches(['ALL']);
    setSelectedYears(['ALL']);
    setExamDate('');
    setStartTime('');
    setEndTime('');
    setRoom('');
    setInstructions('');
    setModalVisible(false);
  };

  const handleCancelConfirm = (exam: ExamItem) => {
    Alert.alert(
      'Cancel Exam',
      `Mark "${exam.subject} - ${exam.title}" as cancelled for students?`,
      [
        { text: 'Back', style: 'cancel' },
        { text: 'Mark Cancelled', style: 'destructive', onPress: () => cancelExam(exam.id) },
      ]
    );
  };

  const handleDeleteConfirm = (exam: ExamItem) => {
    Alert.alert(
      'Delete Exam',
      `Permanently remove this exam from schedule?`,
      [
        { text: 'Back', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => deleteExam(exam.id) },
      ]
    );
  };

  const filteredExams = exams.filter((e) => {
    if (adminBranchFilter === 'ALL') return true;
    return e.branches && (e.branches.includes('ALL') || e.branches.includes(adminBranchFilter));
  });

  return (
    <SafeAreaView style={styles.container}>
      <Header
        title="Exam Scheduler"
        subtitle="Publish & manage branch-specific tests in student timetables"
        rightAction={
          <TouchableOpacity 
            activeOpacity={0.8}
            onPress={() => setModalVisible(true)}
            style={styles.addBtn}
          >
            <Plus size={18} color={THEME.white} />
            <Text style={styles.addBtnText}>New Exam</Text>
          </TouchableOpacity>
        }
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
        <Text style={styles.backText}>Back to Dashboard</Text>
      </TouchableOpacity>

      {/* Admin Quick Branch Filter Bar */}
      <View style={styles.branchFilterContainer}>
        <Text style={styles.branchFilterLabel}>View by Branch:</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterPillsScroll}>
          <TouchableOpacity
            onPress={() => setAdminBranchFilter('ALL')}
            style={[styles.filterChip, adminBranchFilter === 'ALL' && styles.filterChipActive]}
          >
            <Text style={[styles.filterChipText, adminBranchFilter === 'ALL' && styles.filterChipTextActive]}>
              All Branches ({exams.length})
            </Text>
          </TouchableOpacity>
          {BRANCHES.map((b) => {
            const count = exams.filter((e) => e.branches?.includes('ALL') || e.branches?.includes(b.code)).length;
            return (
              <TouchableOpacity
                key={b.code}
                onPress={() => setAdminBranchFilter(b.code)}
                style={[styles.filterChip, adminBranchFilter === b.code && styles.filterChipActive]}
              >
                <Text style={[styles.filterChipText, adminBranchFilter === b.code && styles.filterChipTextActive]}>
                  {b.code} ({count})
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {filteredExams.length === 0 ? (
          <View style={styles.emptyContainer}>
            <GraduationCap size={44} color={THEME.textTertiary} />
            <Text style={styles.emptyTitle}>No Exams Scheduled</Text>
            <Text style={styles.emptySubtitle}>
              {adminBranchFilter === 'ALL' 
                ? 'No tests or assessments are currently published.' 
                : `No exams scheduled for ${adminBranchFilter} branch yet.`}
            </Text>
            <TouchableOpacity 
              style={styles.emptyAddBtn}
              onPress={() => {
                if (adminBranchFilter !== 'ALL') {
                  setSelectedBranches([adminBranchFilter]);
                }
                setModalVisible(true);
              }}
            >
              <Plus size={16} color={THEME.white} />
              <Text style={styles.emptyAddBtnText}>Schedule Exam</Text>
            </TouchableOpacity>
          </View>
        ) : (
          filteredExams.map((exam) => {
            const branchText = exam.branches && exam.branches.includes('ALL')
              ? 'All Branches'
              : (exam.branches && exam.branches.length > 0 ? exam.branches.join(', ') : 'Common');
            const yearText = exam.years && !exam.years.includes('ALL')
              ? exam.years.join(', ')
              : null;

            return (
              <Card key={exam.id} style={styles.examCard} variant="elevated">
                <View style={styles.cardHeader}>
                  <View style={{ flex: 1 }}>
                    <View style={styles.badgeRow}>
                      <Badge label={exam.subject} variant="cyan" size="sm" />
                      <Badge label={`Branch: ${branchText}`} variant="purple" size="sm" />
                      {yearText ? <Badge label={yearText} variant="gold" size="sm" /> : null}
                      {exam.isCancelled ? (
                        <Badge label="Cancelled" variant="red" size="sm" />
                      ) : (
                        <Badge label="Active" variant="green" size="sm" />
                      )}
                    </View>
                    <Text style={styles.examTitle}>{exam.title}</Text>
                  </View>
                </View>

                <View style={styles.metaRow}>
                  <View style={styles.metaItem}>
                    <Calendar size={13} color={THEME.cyan} />
                    <Text style={styles.metaText}>{exam.examDate}</Text>
                  </View>
                  <View style={styles.metaItem}>
                    <Clock size={13} color={THEME.cyan} />
                    <Text style={styles.metaText}>{exam.startTime} - {exam.endTime}</Text>
                  </View>
                  {exam.room ? (
                    <View style={styles.metaItem}>
                      <MapPin size={13} color={THEME.pink} />
                      <Text style={styles.metaText}>{exam.room}</Text>
                    </View>
                  ) : null}
                </View>

                {exam.instructions ? (
                  <Text style={styles.instructionsText}>Note: {exam.instructions}</Text>
                ) : null}

                <View style={styles.actionsFooter}>
                  {!exam.isCancelled && (
                    <TouchableOpacity 
                      onPress={() => handleCancelConfirm(exam)}
                      style={styles.actionBtn}
                    >
                      <Ban size={14} color={THEME.gold} />
                      <Text style={[styles.actionBtnText, { color: THEME.gold }]}>Cancel Exam</Text>
                    </TouchableOpacity>
                  )}

                  <TouchableOpacity 
                    onPress={() => handleDeleteConfirm(exam)}
                    style={styles.actionBtn}
                  >
                    <Trash2 size={14} color={THEME.red} />
                    <Text style={[styles.actionBtnText, { color: THEME.red }]}>Delete</Text>
                  </TouchableOpacity>
                </View>
              </Card>
            );
          })
        )}
      </ScrollView>

      {/* New Exam Modal */}
      <Modal visible={modalVisible} animationType="slide" transparent onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <Text style={styles.modalHeading}>Schedule New Examination</Text>

            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <Input
                label="Subject Name *"
                value={subject}
                onChangeText={setSubject}
                placeholder="e.g. Compiler Design"
              />

              <Input
                label="Exam Title / Type *"
                value={title}
                onChangeText={setTitle}
                placeholder="e.g. End-Semester Written Assessment"
              />

              {/* BRANCH AUTHORIZATION SELECTOR */}
              <View style={styles.formSection}>
                <Text style={styles.sectionHeaderTitle}>Target Branch Authorization *</Text>
                <Text style={styles.sectionHeaderDesc}>
                  Select which branch will see this subject exam in their timetable
                </Text>
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
              </View>

              {/* ACADEMIC YEAR AUTHORIZATION SELECTOR */}
              <View style={styles.formSection}>
                <Text style={styles.sectionHeaderTitle}>Target Academic Year *</Text>
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
              </View>

              <Input
                label="Exam Date (YYYY-MM-DD) *"
                value={examDate}
                onChangeText={setExamDate}
                placeholder="YYYY-MM-DD"
              />

              <View style={styles.timeRow}>
                <View style={{ flex: 1 }}>
                  <Input
                    label="Start Time"
                    value={startTime}
                    onChangeText={setStartTime}
                    placeholder="e.g. 10:00 AM"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Input
                    label="End Time"
                    value={endTime}
                    onChangeText={setEndTime}
                    placeholder="e.g. 01:00 PM"
                  />
                </View>
              </View>

              <Input
                label="Room / Exam Hall Location"
                value={room}
                onChangeText={setRoom}
                placeholder="e.g. Hall C-102"
              />

              <Input
                label="Instructions for Students"
                value={instructions}
                onChangeText={setInstructions}
                placeholder="Permitted stationery, calculators, arrival time..."
                multiline
                numberOfLines={3}
              />

              <View style={styles.modalActions}>
                <Button
                  title="Cancel"
                  variant="outline"
                  onPress={() => setModalVisible(false)}
                  style={{ flex: 1, marginRight: 8 }}
                />
                <Button
                  title="Publish Exam"
                  onPress={handleCreateExam}
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
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: THEME.blue,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
  },
  addBtnText: {
    color: THEME.black,
    fontWeight: '800',
    fontSize: 13,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  backText: {
    color: THEME.textSecondary,
    fontSize: 13,
    fontWeight: '600',
  },
  branchFilterContainer: {
    paddingHorizontal: 16,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: THEME.surfaceBorder,
  },
  branchFilterLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: THEME.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  filterPillsScroll: {
    gap: 6,
    paddingRight: 16,
  },
  filterChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: THEME.surfaceCard,
    borderWidth: 1,
    borderColor: THEME.surfaceBorder,
  },
  filterChipActive: {
    backgroundColor: THEME.purple,
    borderColor: THEME.purple,
  },
  filterChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: THEME.textSecondary,
  },
  filterChipTextActive: {
    color: THEME.white,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    paddingHorizontal: 24,
    gap: 10,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: THEME.textPrimary,
  },
  emptySubtitle: {
    fontSize: 13,
    color: THEME.textSecondary,
    textAlign: 'center',
    lineHeight: 19,
    maxWidth: 280,
  },
  emptyAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
    backgroundColor: THEME.purple,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 10,
  },
  emptyAddBtnText: {
    color: THEME.white,
    fontWeight: '700',
    fontSize: 13,
  },
  examCard: {
    padding: 16,
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 6,
  },
  examTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: THEME.textPrimary,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
    marginVertical: 8,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontSize: 12,
    color: THEME.textSecondary,
    fontWeight: '500',
  },
  instructionsText: {
    fontSize: 12,
    color: THEME.textTertiary,
    marginTop: 4,
  },
  actionsFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 16,
    borderTopWidth: 1,
    borderTopColor: THEME.surfaceBorder,
    marginTop: 10,
    paddingTop: 8,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    padding: 4,
  },
  actionBtnText: {
    fontSize: 12,
    fontWeight: '700',
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
    padding: 24,
    maxHeight: '92%',
  },
  modalHeading: {
    fontSize: 18,
    fontWeight: '900',
    color: THEME.textPrimary,
    marginBottom: 14,
  },
  formSection: {
    marginBottom: 14,
  },
  sectionHeaderTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: THEME.textSecondary,
    marginBottom: 4,
  },
  sectionHeaderDesc: {
    fontSize: 11,
    color: THEME.textTertiary,
    marginBottom: 8,
  },
  pillsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  filterPill: {
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: THEME.surfaceCard,
    borderWidth: 1,
    borderColor: THEME.surfaceBorder,
  },
  filterPillActive: {
    backgroundColor: THEME.purple,
    borderColor: THEME.purple,
  },
  filterPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: THEME.textSecondary,
  },
  filterPillTextActive: {
    color: THEME.white,
  },
  timeRow: {
    flexDirection: 'row',
    gap: 12,
  },
  modalActions: {
    flexDirection: 'row',
    marginTop: 16,
    marginBottom: 20,
  },
});
