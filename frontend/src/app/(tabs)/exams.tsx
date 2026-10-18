import React, { useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  RefreshControl,
  Modal,
  Alert 
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { 
  Calendar, 
  Clock, 
  MapPin, 
  Plus,
  Bell,
  BellRing,
  Bookmark,
  BookmarkCheck,
  Edit3,
  X,
  Trash2,
  FileText,
  Sparkles,
  Layers
} from 'lucide-react-native';
import { THEME } from '@/constants/theme';
import { Card } from '@/components/Card';
import { Header } from '@/components/Header';
import { Badge } from '@/components/Badge';
import { Input } from '@/components/Input';
import { Button } from '@/components/Button';
import { EmptyState } from '@/components/EmptyState';
import { useStudyHub } from '@/store/StudyHubContext';
import { ExamItem, BRANCHES, BranchCode, ACADEMIC_YEARS, AcademicYear } from '@/types';

export default function ExamScheduleScreen() {
  const router = useRouter();
  const { 
    exams, 
    isAdmin, 
    userBranch, 
    isContentAccessible,
    toggleExamReminder,
    isExamReminderSet,
    addBookmark,
    removeBookmark,
    isBookmarked,
    updateExam,
    updateExamGroupTitle,
    deleteExam,
    refreshExams,
  } = useStudyHub();

  const [refreshing, setRefreshing] = useState(false);

  // Admin edit exam modal states
  const [editingExam, setEditingExam] = useState<ExamItem | null>(null);
  const [editSubject, setEditSubject] = useState('');
  const [editTitle, setEditTitle] = useState('');
  const [editBranches, setEditBranches] = useState<BranchCode[]>(['ALL']);
  const [editYears, setEditYears] = useState<AcademicYear[]>(['ALL']);
  const [editDate, setEditDate] = useState('');
  const [editStartTime, setEditStartTime] = useState('');
  const [editEndTime, setEditEndTime] = useState('');
  const [editRoom, setEditRoom] = useState('');
  const [editInstructions, setEditInstructions] = useState('');

  const toggleEditBranch = (code: BranchCode) => {
    if (code === 'ALL') {
      setEditBranches(['ALL']);
      return;
    }

    let updated: BranchCode[] = editBranches.filter((b) => b !== 'ALL');
    if (updated.includes(code)) {
      updated = updated.filter((b) => b !== code);
      if (updated.length === 0) updated = ['ALL'];
    } else {
      updated.push(code);
    }
    setEditBranches(updated);
  };

  const toggleEditYear = (code: AcademicYear) => {
    if (code === 'ALL') {
      setEditYears(['ALL']);
      return;
    }

    let updated: AcademicYear[] = editYears.filter((y) => y !== 'ALL');
    if (updated.includes(code)) {
      updated = updated.filter((y) => y !== code);
      if (updated.length === 0) updated = ['ALL'];
    } else {
      updated.push(code);
    }
    setEditYears(updated);
  };

  // Admin group renaming modal states
  const [renamingGroupTitle, setRenamingGroupTitle] = useState<string | null>(null);
  const [newGroupTitleText, setNewGroupTitleText] = useState('');

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await refreshExams();
    } catch {}
    setRefreshing(false);
  };

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Filter exams strictly by student's branch and academic year + common exams
  const branchAccessibleExams = exams.filter((e) => {
    if (!isAdmin && !e.isPublished) return false;
    return isContentAccessible(e.branches, e.years);
  });

  // Show active & upcoming exams
  const scheduledExams = branchAccessibleExams
    .filter((e) => !e.isCancelled)
    .sort((a, b) => new Date(a.examDate).getTime() - new Date(b.examDate).getTime());

  const getDaysCountdown = (dateStr: string) => {
    const target = new Date(dateStr);
    target.setHours(0, 0, 0, 0);
    const diffTime = target.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    if (diffDays < 0) return 'CONCLUDED';
    if (diffDays === 0) return 'TODAY';
    if (diffDays === 1) return 'TOMORROW';
    return `${diffDays} DAYS LEFT`;
  };

  const openAdminEdit = (exam: ExamItem) => {
    setEditingExam(exam);
    setEditSubject(exam.subject);
    setEditTitle(exam.title || 'Mid-Semester Examination (ST 1)');
    setEditBranches(exam.branches && exam.branches.length > 0 ? exam.branches : ['ALL']);
    setEditYears(exam.years && exam.years.length > 0 ? exam.years : ['ALL']);
    setEditDate(exam.examDate);
    setEditStartTime(exam.startTime);
    setEditEndTime(exam.endTime);
    setEditRoom(exam.room || '');
    setEditInstructions(exam.instructions || '');
  };

  const saveAdminEdit = async () => {
    if (!editingExam) return;
    if (!editDate.trim()) {
      Alert.alert('Missing Date', 'Please enter a valid exam date.');
      return;
    }

    try {
      await updateExam(editingExam.id, {
        subject: editSubject.trim() || editingExam.subject,
        title: editTitle.trim() || editingExam.title,
        branches: editBranches,
        years: editYears,
        examDate: editDate.trim(),
        startTime: editStartTime.trim() || 'TBD',
        endTime: editEndTime.trim() || 'TBD',
        room: editRoom.trim(),
        instructions: editInstructions.trim(),
      });
      setEditingExam(null);
      Alert.alert('Schedule Updated', 'Exam details, branch assignment, date, timing, and venue have been saved.');
    } catch (err: any) {
      Alert.alert('Update Failed', err.message || 'Could not update exam schedule.');
    }
  };

  const handleSaveGroupTitle = async () => {
    if (!renamingGroupTitle || !newGroupTitleText.trim()) return;
    try {
      await updateExamGroupTitle(renamingGroupTitle, newGroupTitleText.trim());
      const updatedTitle = newGroupTitleText.trim();
      setRenamingGroupTitle(null);
      Alert.alert('Examination Renamed', `Examination title updated to "${updatedTitle}".`);
    } catch (err: any) {
      Alert.alert('Update Failed', err.message || 'Could not rename examination.');
    }
  };

  const handleDeleteGroup = (groupTitle: string) => {
    Alert.alert(
      'Delete Entire Examination?',
      `Are you sure you want to delete all papers under "${groupTitle}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete All Papers',
          style: 'destructive',
          onPress: async () => {
            const examsInGroup = groupedExams[groupTitle] || [];
            for (const ex of examsInGroup) {
              await deleteExam(ex.id);
            }
            Alert.alert('Deleted', `All papers under "${groupTitle}" have been removed.`);
          },
        },
      ]
    );
  };

  // Normalize and group exams by Exam Type (e.g. Mid-Semester Examination (ST 1))
  const cleanScheduledExams = scheduledExams.map((exam) => {
    // If exam has legacy title like "Universal Common Assessment" or "Mid-Semester Theory Examination", normalize it
    if (!exam.title || exam.title.includes('Universal') || exam.title.includes('Theory')) {
      return { ...exam, title: 'Mid-Semester Examination (ST 1)' };
    }
    return exam;
  });

  const groupedExams = cleanScheduledExams.reduce<{ [type: string]: ExamItem[] }>((acc, exam) => {
    const groupName = exam.title || 'Mid-Semester Examination (ST 1)';
    if (!acc[groupName]) {
      acc[groupName] = [];
    }
    acc[groupName].push(exam);
    return acc;
  }, {});

  const examGroups = Object.keys(groupedExams);

  return (
    <SafeAreaView style={styles.container}>
      <Header
        title="Exam Timetable"
        subtitle={`Official examination schedule for ${userBranch}`}
        rightAction={
          isAdmin ? (
            <TouchableOpacity 
              activeOpacity={0.8}
              onPress={() => router.push('/admin/manage-exams')}
              style={styles.adminAddBtn}
            >
              <Plus size={18} color={THEME.white} />
              <Text style={styles.adminAddBtnText}>Add Exam</Text>
            </TouchableOpacity>
          ) : undefined
        }
      />

      <ScrollView 
        contentContainerStyle={styles.scrollContent} 
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={THEME.purple} />}
      >
        {examGroups.length === 0 ? (
          <EmptyState
            title="No exams scheduled"
            description="No exams scheduled for your class right now."
            actionTitle={isAdmin ? "Schedule an Exam" : undefined}
            onAction={isAdmin ? () => router.push('/admin/manage-exams') : undefined}
          />
        ) : (
          examGroups.map((groupTitle) => {
            const groupList = groupedExams[groupTitle];

            return (
              <View key={groupTitle} style={styles.examGroupSection}>
                {/* 1. TOP HEADING FOR THE EXAM */}
                <View style={styles.groupHeaderRow}>
                  <View style={styles.groupIndicatorDot} />
                  <Text style={styles.groupHeadingText}>{groupTitle}</Text>
                  <View style={styles.groupCountBadge}>
                    <Text style={styles.groupCountText}>{groupList.length} Papers</Text>
                  </View>
                  {isAdmin && (
                    <View style={styles.groupAdminActions}>
                      <TouchableOpacity
                        activeOpacity={0.7}
                        onPress={() => {
                          setRenamingGroupTitle(groupTitle);
                          setNewGroupTitleText(groupTitle);
                        }}
                        style={styles.groupEditBtn}
                      >
                        <Edit3 size={11} color={THEME.cyan} />
                        <Text style={styles.groupEditBtnText}>Rename</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        activeOpacity={0.7}
                        onPress={() => handleDeleteGroup(groupTitle)}
                        style={styles.groupDeleteBtn}
                      >
                        <Trash2 size={12} color={THEME.red} />
                      </TouchableOpacity>
                    </View>
                  )}
                </View>

                {/* 2. SUBJECT TIMETABLE CARDS UNDER THE HEADING */}
                {groupList.map((exam, idx) => {
                  const isFirst = idx === 0;
                  const isCommon = exam.branches?.includes('ALL');

                  return (
                    <Card
                      key={exam.id}
                      style={styles.examCard}
                      variant={isFirst ? 'glowPurple' : 'elevated'}
                    >
                      {/* Top Row: Subject Name & Status Badges */}
                      <View style={styles.examCardHeader}>
                        <View style={styles.headerLeftCol}>
                          <Text style={styles.subjectText}>{exam.subject}</Text>
                          
                          <View style={styles.badgeWrapRow}>
                            <Badge 
                              label={isCommon ? "All Branches" : (exam.branches?.join(', ') || userBranch)} 
                              variant={isCommon ? "cyan" : "pink"} 
                              size="sm" 
                            />
                            {exam.isCancelled && <Badge label="CANCELLED" variant="red" size="sm" />}
                          </View>
                        </View>

                        <View style={styles.headerRightCol}>
                          {!exam.isCancelled && (
                            <View style={styles.countdownPillWrap}>
                              <Badge label={getDaysCountdown(exam.examDate)} variant="gold" size="md" />
                            </View>
                          )}

                          {/* Admin-only quick edit & delete triggers */}
                          {isAdmin && (
                            <View style={styles.adminActionBtnRow}>
                              <TouchableOpacity
                                activeOpacity={0.7}
                                onPress={() => openAdminEdit(exam)}
                                style={styles.adminEditPill}
                              >
                                <Edit3 size={12} color={THEME.cyan} />
                                <Text style={styles.adminEditText}>Edit</Text>
                              </TouchableOpacity>

                              <TouchableOpacity
                                activeOpacity={0.7}
                                onPress={() => {
                                  Alert.alert(
                                    'Delete Exam Paper?',
                                    `Are you sure you want to delete "${exam.subject}" from the schedule?`,
                                    [
                                      { text: 'Cancel', style: 'cancel' },
                                      {
                                        text: 'Delete Exam',
                                        style: 'destructive',
                                        onPress: async () => {
                                          await deleteExam(exam.id);
                                          Alert.alert('Deleted', `"${exam.subject}" has been deleted.`);
                                        },
                                      },
                                    ]
                                  );
                                }}
                                style={styles.adminDeletePill}
                              >
                                <Trash2 size={13} color={THEME.red} />
                              </TouchableOpacity>
                            </View>
                          )}
                        </View>
                      </View>

                      {/* Clean Non-Overlapping Timetable Details */}
                      <View style={styles.timetableTable}>
                        <View style={styles.timetableRow}>
                          <View style={styles.timetableCell}>
                            <Calendar size={15} color={THEME.cyan} />
                            <View style={{ flex: 1 }}>
                              <Text style={styles.infoLabel}>EXAM DATE</Text>
                              <Text style={styles.infoText}>{exam.examDate}</Text>
                            </View>
                          </View>

                          <View style={styles.timetableCell}>
                            <Clock size={15} color={THEME.blue} />
                            <View style={{ flex: 1 }}>
                              <Text style={styles.infoLabel}>TIMING</Text>
                              <Text style={styles.infoText}>{exam.startTime} - {exam.endTime}</Text>
                            </View>
                          </View>
                        </View>

                        {exam.room ? (
                          <View style={[styles.timetableRow, styles.timetableRowBorder]}>
                            <View style={styles.timetableCellFull}>
                              <MapPin size={15} color={THEME.pink} />
                              <View style={{ flex: 1 }}>
                                <Text style={styles.infoLabel}>VENUE / EXAMINATION HALL</Text>
                                <Text style={styles.infoText}>{exam.room}</Text>
                              </View>
                            </View>
                          </View>
                        ) : null}
                      </View>

                      {/* Cross-App Linking: Study Notes, PYQ Papers & Ask Vinay AI */}
                      <View style={styles.examStudyRow}>
                        <TouchableOpacity
                          activeOpacity={0.75}
                          onPress={() => {
                            router.push({
                              pathname: '/(tabs)/notes',
                              params: {
                                subject: exam.subject,
                              },
                            });
                          }}
                          style={styles.examStudyBtn}
                        >
                          <FileText size={12} color={THEME.cyan} />
                          <Text style={styles.examStudyBtnText}>Study Notes</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          activeOpacity={0.75}
                          onPress={() => {
                            router.push({
                              pathname: '/(tabs)/notes',
                              params: {
                                subject: exam.subject,
                                type: 'PYQ',
                              },
                            });
                          }}
                          style={styles.examStudyBtn}
                        >
                          <Layers size={12} color={THEME.blue} />
                          <Text style={[styles.examStudyBtnText, { color: THEME.blue }]}>PYQ Papers</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          activeOpacity={0.75}
                          onPress={() => {
                            router.push({
                              pathname: '/(tabs)/ai-assistant',
                              params: {
                                initialPrompt: `make 7 question proper for ${exam.subject}`,
                              },
                            });
                          }}
                          style={[styles.examStudyBtn, styles.examAiBtn]}
                        >
                          <Sparkles size={12} color={THEME.purple} />
                          <Text style={[styles.examStudyBtnText, { color: THEME.purple }]}>Ask AI</Text>
                        </TouchableOpacity>
                      </View>

                      {/* Reminder & Bookmark Action Strip */}
                      {!exam.isCancelled && (
                        <View style={styles.actionStrip}>
                          <TouchableOpacity
                            activeOpacity={0.75}
                            onPress={async () => {
                              const isNowSet = await toggleExamReminder(exam.id, '1_DAY_BEFORE');
                              Alert.alert(
                                isNowSet ? '🔔 Reminder Set!' : '🔕 Reminder Cancelled',
                                isNowSet
                                  ? `You will receive an alert for ${exam.subject} 1 day before the exam.`
                                  : `Reminder removed for ${exam.subject}.`
                              );
                            }}
                            style={[
                              styles.reminderBtn,
                              isExamReminderSet(exam.id) && styles.reminderBtnActive,
                            ]}
                          >
                            {isExamReminderSet(exam.id) ? (
                              <BellRing size={15} color={THEME.white} />
                            ) : (
                              <Bell size={15} color={THEME.purple} />
                            )}
                            <Text
                              style={[
                                styles.reminderBtnText,
                                isExamReminderSet(exam.id) && styles.reminderBtnTextActive,
                              ]}
                            >
                              {isExamReminderSet(exam.id) ? 'Reminder Active' : 'Set Reminder'}
                            </Text>
                          </TouchableOpacity>

                          <TouchableOpacity
                            activeOpacity={0.75}
                            onPress={async () => {
                              if (isBookmarked(exam.id)) {
                                await removeBookmark(exam.id);
                                Alert.alert('Bookmark Removed', `${exam.subject} timetable removed from saved.`);
                              } else {
                                await addBookmark({
                                  resourceId: exam.id,
                                  resourceType: 'EXAM',
                                  title: `${groupTitle} - ${exam.subject}`,
                                  subject: exam.subject,
                                  metadata: { examDate: exam.examDate, room: exam.room },
                                });
                                Alert.alert('Saved to Bookmarks', `${exam.subject} exam timetable saved.`);
                              }
                            }}
                            style={[styles.bmIconBtn, isBookmarked(exam.id) && styles.bmIconBtnActive]}
                          >
                            {isBookmarked(exam.id) ? (
                              <BookmarkCheck size={17} color={THEME.cyan} />
                            ) : (
                              <Bookmark size={17} color={THEME.textSecondary} />
                            )}
                          </TouchableOpacity>
                        </View>
                      )}

                      {/* Instructions */}
                      {exam.instructions ? (
                        <View style={styles.instructionsBox}>
                          <Text style={styles.instructionHeading}>Official Exam Instructions:</Text>
                          <Text style={styles.instructionBody}>{exam.instructions}</Text>
                        </View>
                      ) : null}
                    </Card>
                  );
                })}
              </View>
            );
          })
        )}
      </ScrollView>

      {/* Admin-Only Edit Exam Date & Time Modal */}
      {isAdmin && (
        <Modal
          visible={!!editingExam}
          animationType="slide"
          transparent
          onRequestClose={() => setEditingExam(null)}
        >
          <View style={styles.modalBackdrop}>
            <View style={styles.modalCard}>
              <View style={styles.modalHeader}>
                <View>
                  <Text style={styles.modalTitle}>Update Exam Schedule</Text>
                  <Text style={styles.modalSub}>{editingExam?.title} • {editingExam?.subject}</Text>
                </View>
                <TouchableOpacity 
                  onPress={() => setEditingExam(null)}
                  style={styles.modalCloseBtn}
                >
                  <X size={18} color={THEME.textSecondary} />
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
                <Input
                  label="Subject Name *"
                  value={editSubject}
                  onChangeText={setEditSubject}
                  placeholder="e.g. Operating Systems"
                />

                <Input
                  label="Examination Category / Term *"
                  value={editTitle}
                  onChangeText={setEditTitle}
                  placeholder="e.g. Mid-Semester Examination (ST 1)"
                />

                {/* Target Branch Selector */}
                <View style={styles.formSection}>
                  <Text style={styles.sectionHeaderTitle}>Target Branch Authorization *</Text>
                  <View style={styles.pillsWrap}>
                    <TouchableOpacity
                      onPress={() => toggleEditBranch('ALL')}
                      style={[
                        styles.filterPill,
                        editBranches.includes('ALL') && styles.filterPillActive,
                      ]}
                    >
                      <Text style={[styles.filterPillText, editBranches.includes('ALL') && styles.filterPillTextActive]}>
                        All Branches (Common)
                      </Text>
                    </TouchableOpacity>

                    {BRANCHES.map((b) => {
                      const isSelected = editBranches.includes(b.code);
                      return (
                        <TouchableOpacity
                          key={b.code}
                          onPress={() => toggleEditBranch(b.code)}
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

                {/* Target Academic Year Selector */}
                <View style={styles.formSection}>
                  <Text style={styles.sectionHeaderTitle}>Target Academic Year *</Text>
                  <View style={styles.pillsWrap}>
                    <TouchableOpacity
                      onPress={() => toggleEditYear('ALL')}
                      style={[
                        styles.filterPill,
                        editYears.includes('ALL') && styles.filterPillActive,
                      ]}
                    >
                      <Text style={[styles.filterPillText, editYears.includes('ALL') && styles.filterPillTextActive]}>
                        All Years (Common)
                      </Text>
                    </TouchableOpacity>

                    {ACADEMIC_YEARS.map((y) => {
                      const isSelected = editYears.includes(y.code);
                      return (
                        <TouchableOpacity
                          key={y.code}
                          onPress={() => toggleEditYear(y.code)}
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
                  value={editDate}
                  onChangeText={setEditDate}
                  placeholder="e.g. 2026-10-24"
                />

                <View style={styles.modalRow}>
                  <View style={{ flex: 1, marginRight: 8 }}>
                    <Input
                      label="Start Time *"
                      value={editStartTime}
                      onChangeText={setEditStartTime}
                      placeholder="e.g. 10:00 AM"
                    />
                  </View>
                  <View style={{ flex: 1, marginLeft: 8 }}>
                    <Input
                      label="End Time *"
                      value={editEndTime}
                      onChangeText={setEditEndTime}
                      placeholder="e.g. 01:00 PM"
                    />
                  </View>
                </View>

                <Input
                  label="Room / Hall"
                  value={editRoom}
                  onChangeText={setEditRoom}
                  placeholder="e.g. Academic Hall B-204"
                />

                <Input
                  label="Instructions / Guidelines"
                  value={editInstructions}
                  onChangeText={setEditInstructions}
                  placeholder="e.g. Calculators allowed. Hall tickets mandatory."
                  multiline
                  numberOfLines={3}
                />

                <View style={styles.modalActions}>
                  <Button
                    title="Cancel"
                    onPress={() => setEditingExam(null)}
                    variant="ghost"
                    style={{ flex: 1, marginRight: 8 }}
                  />
                  <Button
                    title="Save Changes"
                    onPress={saveAdminEdit}
                    variant="purple"
                    style={{ flex: 1, marginLeft: 8 }}
                  />
                </View>

                {/* Delete Exam Option Inside Modal */}
                <TouchableOpacity
                  onPress={() => {
                    Alert.alert(
                      'Delete Exam Paper?',
                      `Are you sure you want to delete "${editingExam?.subject}"?`,
                      [
                        { text: 'Cancel', style: 'cancel' },
                        {
                          text: 'Delete Exam',
                          style: 'destructive',
                          onPress: async () => {
                            if (editingExam) {
                              const id = editingExam.id;
                              setEditingExam(null);
                              await deleteExam(id);
                              Alert.alert('Deleted', 'Exam paper has been removed.');
                            }
                          },
                        },
                      ]
                    );
                  }}
                  style={styles.modalDeleteBtn}
                >
                  <Trash2 size={16} color={THEME.red} />
                  <Text style={styles.modalDeleteBtnText}>Delete This Exam Paper</Text>
                </TouchableOpacity>
              </ScrollView>
            </View>
          </View>
        </Modal>
      )}

      {/* Admin-Only Rename Examination Group Modal */}
      {isAdmin && (
        <Modal
          visible={!!renamingGroupTitle}
          animationType="fade"
          transparent
          onRequestClose={() => setRenamingGroupTitle(null)}
        >
          <View style={styles.modalBackdrop}>
            <View style={styles.modalCard}>
              <View style={styles.modalHeader}>
                <View>
                  <Text style={styles.modalTitle}>Rename Examination</Text>
                  <Text style={styles.modalSub}>Update the name of this examination term</Text>
                </View>
                <TouchableOpacity 
                  onPress={() => setRenamingGroupTitle(null)}
                  style={styles.modalCloseBtn}
                >
                  <X size={18} color={THEME.textSecondary} />
                </TouchableOpacity>
              </View>

              <View style={styles.modalBody}>
                <Input
                  label="Examination Name / Term *"
                  value={newGroupTitleText}
                  onChangeText={setNewGroupTitleText}
                  placeholder="e.g. End-Semester Examination 2026"
                />

                <View style={styles.modalActions}>
                  <Button
                    title="Cancel"
                    onPress={() => setRenamingGroupTitle(null)}
                    variant="ghost"
                    style={{ flex: 1, marginRight: 8 }}
                  />
                  <Button
                    title="Update Name"
                    onPress={handleSaveGroupTitle}
                    variant="purple"
                    style={{ flex: 1, marginLeft: 8 }}
                  />
                </View>
              </View>
            </View>
          </View>
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
  adminAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: THEME.purple,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
  },
  adminAddBtnText: {
    color: THEME.white,
    fontSize: 12,
    fontWeight: '800',
  },
  examGroupSection: {
    marginBottom: 24,
  },
  groupHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
    flexWrap: 'wrap',
  },
  groupIndicatorDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: THEME.purple,
  },
  groupHeadingText: {
    fontSize: 15,
    fontWeight: '900',
    color: THEME.textPrimary,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  groupCountBadge: {
    backgroundColor: THEME.purpleMuted,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: THEME.purple + '40',
  },
  groupCountText: {
    fontSize: 11,
    fontWeight: '700',
    color: THEME.purple,
  },
  groupAdminActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginLeft: 'auto',
  },
  groupEditBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(34, 211, 238, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(34, 211, 238, 0.3)',
  },
  groupEditBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: THEME.cyan,
  },
  groupDeleteBtn: {
    backgroundColor: THEME.redMuted,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: THEME.red + '40',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 110,
  },
  examCard: {
    padding: 16,
    marginBottom: 14,
    borderRadius: 16,
  },
  examCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 14,
  },
  headerLeftCol: {
    flex: 1,
    paddingRight: 6,
  },
  subjectText: {
    fontSize: 17,
    fontWeight: '900',
    color: THEME.textPrimary,
    lineHeight: 23,
    marginBottom: 6,
  },
  badgeWrapRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  headerRightCol: {
    alignItems: 'flex-end',
    gap: 8,
  },
  countdownPillWrap: {
    alignSelf: 'flex-end',
  },
  adminActionBtnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  adminEditPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(34, 211, 238, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(34, 211, 238, 0.3)',
  },
  adminEditText: {
    fontSize: 11,
    fontWeight: '700',
    color: THEME.cyan,
  },
  adminDeletePill: {
    backgroundColor: THEME.redMuted,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: THEME.red + '40',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalDeleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: THEME.redMuted,
    borderWidth: 1,
    borderColor: THEME.red + '40',
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 14,
    marginBottom: 8,
  },
  modalDeleteBtnText: {
    color: THEME.red,
    fontSize: 13,
    fontWeight: '800',
  },
  timetableTable: {
    backgroundColor: THEME.surfaceCard,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: THEME.surfaceBorder,
    marginBottom: 12,
    overflow: 'hidden',
  },
  timetableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    flexWrap: 'wrap',
    gap: 8,
  },
  timetableRowBorder: {
    borderTopWidth: 1,
    borderTopColor: THEME.surfaceBorder,
  },
  timetableCell: {
    flex: 1,
    minWidth: 125,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  timetableCellFull: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  infoLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: THEME.textTertiary,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  infoText: {
    fontSize: 12,
    color: THEME.textPrimary,
    fontWeight: '700',
    flexShrink: 1,
  },
  instructionsBox: {
    backgroundColor: THEME.surfaceCard,
    borderRadius: 10,
    padding: 10,
    borderLeftWidth: 3,
    borderLeftColor: THEME.cyan,
  },
  instructionHeading: {
    fontSize: 11,
    fontWeight: '800',
    color: THEME.cyan,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  instructionBody: {
    fontSize: 12,
    color: THEME.textSecondary,
    lineHeight: 17,
  },
  examStudyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: THEME.surfaceBorder + '80',
  },
  examStudyBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    backgroundColor: THEME.surfaceElevated,
    paddingVertical: 7,
    paddingHorizontal: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: THEME.surfaceBorder,
  },
  examStudyBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: THEME.cyan,
  },
  examAiBtn: {
    backgroundColor: THEME.purpleMuted,
    borderColor: THEME.purple + '40',
  },
  actionStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: THEME.surfaceBorder,
    marginTop: 6,
  },
  reminderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: THEME.surfaceElevated,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: THEME.surfaceBorder,
  },
  reminderBtnActive: {
    backgroundColor: THEME.purple,
    borderColor: THEME.purple,
  },
  reminderBtnText: {
    fontSize: 12,
    color: THEME.textSecondary,
    fontWeight: '700',
  },
  reminderBtnTextActive: {
    color: THEME.white,
    fontWeight: '800',
  },
  bmIconBtn: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: THEME.surfaceElevated,
    borderWidth: 1,
    borderColor: THEME.surfaceBorder,
  },
  bmIconBtnActive: {
    borderColor: THEME.cyan + '60',
    backgroundColor: 'rgba(34, 211, 238, 0.1)',
  },
  // Modal styles
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: THEME.surfaceElevated,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    maxHeight: '85%',
    borderWidth: 1,
    borderColor: THEME.surfaceBorder,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: THEME.surfaceBorder,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: THEME.textPrimary,
  },
  modalSub: {
    fontSize: 12,
    color: THEME.cyan,
    fontWeight: '600',
    marginTop: 2,
  },
  modalCloseBtn: {
    padding: 6,
    backgroundColor: THEME.surfaceCard,
    borderRadius: 20,
  },
  modalBody: {
    marginBottom: 10,
  },
  modalRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  modalActions: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 14,
    marginBottom: 16,
  },
  formSection: {
    marginBottom: 14,
  },
  sectionHeaderTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: THEME.textSecondary,
    marginBottom: 6,
  },
  pillsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  filterPill: {
    paddingHorizontal: 10,
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
  filterPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: THEME.textSecondary,
  },
  filterPillTextActive: {
    color: THEME.white,
  },
});
