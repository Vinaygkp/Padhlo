import React, { useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  TextInput,
  Alert,
  RefreshControl 
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { 
  ChevronDown, 
  ChevronUp, 
  Search, 
  Plus,
  FileText,
  ExternalLink,
  Download,
  Trash2,
  Sparkles
} from 'lucide-react-native';
import { THEME } from '@/constants/theme';
import { Card } from '@/components/Card';
import { Header } from '@/components/Header';
import { Badge } from '@/components/Badge';
import { EmptyState } from '@/components/EmptyState';
import { useStudyHub } from '@/store/StudyHubContext';
import { downloadPdfFile } from '@/services/fileDownloadService';

export default function SyllabusScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ subject?: string }>();
  const { 
    syllabusList, 
    isAdmin, 
    userBranch, 
    userYear, 
    isContentAccessible,
    deleteSyllabus,
    refreshSyllabus 
  } = useStudyHub();

  const [searchQuery, setSearchQuery] = useState(params.subject || '');
  const [prevParamSubject, setPrevParamSubject] = useState(params.subject);

  if (params.subject !== prevParamSubject) {
    setPrevParamSubject(params.subject);
    setSearchQuery(params.subject || '');
  }

  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await refreshSyllabus();
    } finally {
      setRefreshing(false);
    }
  };

  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [expandedUnits, setExpandedUnits] = useState<{ [unitId: string]: boolean }>({
    u1: true,
    u4: true,
  });

  const toggleUnit = (unitId: string) => {
    setExpandedUnits((prev) => ({ ...prev, [unitId]: !prev[unitId] }));
  };

  // Filter syllabus for student branch/year (Admins see all)
  const accessibleSyllabus = syllabusList.filter((s) => {
    if (!isAdmin && !s.isPublished) return false;
    if (!isContentAccessible(s.branches, s.years)) return false;
    return true;
  });

  const handleDownloadSyllabusPdf = async (courseCode: string, pdfUrl: string, fileName?: string) => {
    try {
      setDownloadingId(courseCode);
      const safeName = fileName || `${courseCode}_Syllabus.pdf`;
      await downloadPdfFile(pdfUrl, safeName);
      setDownloadingId(null);
      Alert.alert('Saved Offline', `"${safeName}" has been downloaded for offline reference.`);
    } catch (err: any) {
      setDownloadingId(null);
      Alert.alert('Download Error', err.message || 'Could not download syllabus PDF.');
    }
  };

  const handleDeleteCourse = (item: any) => {
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
        title="Important Syllabus"
        subtitle={`AKTU B.Tech • ${userBranch} • ${userYear}`}
        rightAction={
          isAdmin ? (
            <TouchableOpacity 
              activeOpacity={0.8}
              onPress={() => router.push('/admin/manage-syllabus')}
              style={styles.adminManageBtn}
            >
              <Plus size={14} color={THEME.white} />
              <Text style={styles.adminManageBtnText}>Manage</Text>
            </TouchableOpacity>
          ) : undefined
        }
      />

      {/* Search Input */}
      <View style={styles.searchContainer}>
        <Search size={16} color={THEME.textTertiary} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search topics, algorithms, or theories..."
          placeholderTextColor={THEME.textTertiary}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      <ScrollView 
        contentContainerStyle={styles.scrollContent} 
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl 
            refreshing={refreshing} 
            onRefresh={onRefresh} 
            tintColor={THEME.cyan} 
            colors={[THEME.cyan]} 
          />
        }
      >
        {accessibleSyllabus.length === 0 ? (
          <EmptyState
            title="No Syllabus Content Published"
            description={`No syllabus published for ${userBranch} (${userYear}) yet.`}
            actionTitle={isAdmin ? "Upload Syllabus" : undefined}
            onAction={isAdmin ? () => router.push('/admin/manage-syllabus') : undefined}
          />
        ) : (
          accessibleSyllabus.map((subjectItem) => {
            const hasPdf = Boolean(subjectItem.pdfUrl);
            const unitsCount = subjectItem.units ? subjectItem.units.length : 0;

            return (
              <View key={subjectItem.id} style={styles.subjectContainer}>
                {/* Subject Header */}
                <View style={styles.subjectHeaderRow}>
                  <View style={styles.subjectTitleGroup}>
                    <Badge label={subjectItem.courseCode} variant="purple" size="sm" />
                    {subjectItem.semester ? (
                      <Badge label={`SEM ${subjectItem.semester}`} variant="cyan" size="sm" />
                    ) : null}
                    <Text style={styles.subjectTitle}>{subjectItem.subject}</Text>
                  </View>

                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Text style={styles.unitCountText}>{unitsCount} Units</Text>

                    {isAdmin && (
                      <TouchableOpacity
                        onPress={() => handleDeleteCourse(subjectItem)}
                        style={styles.adminDeleteIcon}
                        activeOpacity={0.7}
                      >
                        <Trash2 size={16} color={THEME.red} />
                      </TouchableOpacity>
                    )}
                  </View>
                </View>

                {subjectItem.description ? (
                  <Text style={styles.subjectDesc}>{subjectItem.description}</Text>
                ) : null}

                {/* Cross-App Linking: Study Notes, PYQ & Vinay AI */}
                <View style={styles.crossStudyRow}>
                  <TouchableOpacity
                    onPress={() => {
                      router.push({
                        pathname: '/(tabs)/notes',
                        params: {
                          subject: subjectItem.subject,
                        },
                      });
                    }}
                    style={styles.crossStudyBtn}
                    activeOpacity={0.75}
                  >
                    <FileText size={12} color={THEME.cyan} />
                    <Text style={styles.crossStudyBtnText}>Find Notes</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => {
                      router.push({
                        pathname: '/(tabs)/notes',
                        params: {
                          subject: subjectItem.subject,
                          type: 'PYQ',
                        },
                      });
                    }}
                    style={styles.crossStudyBtn}
                    activeOpacity={0.75}
                  >
                    <FileText size={12} color={THEME.blue} />
                    <Text style={[styles.crossStudyBtnText, { color: THEME.blue }]}>PYQ Exams</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => {
                      router.push({
                        pathname: '/(tabs)/ai-assistant',
                        params: {
                          initialPrompt: `Explain syllabus breakdown and high-yield 7-mark topics for ${subjectItem.subject}`,
                        },
                      });
                    }}
                    style={[styles.crossStudyBtn, styles.crossAiBtn]}
                    activeOpacity={0.75}
                  >
                    <Sparkles size={12} color={THEME.purple} />
                    <Text style={[styles.crossStudyBtnText, { color: THEME.purple }]}>Ask AI</Text>
                  </TouchableOpacity>
                </View>

                {/* ==================================================== */}
                {/* OPTION 1: OFFICIAL PDF SYLLABUS CARD (IF ATTACHED) */}
                {/* ==================================================== */}
                {hasPdf && (
                  <Card style={styles.pdfSyllabusCard} variant="elevated">
                    <View style={styles.pdfCardHeader}>
                      <View style={styles.pdfIconBadge}>
                        <FileText size={20} color={THEME.cyan} />
                      </View>
                      <View style={{ flex: 1, marginLeft: 10 }}>
                        <Text style={styles.pdfCardTitle}>Official Syllabus (PDF)</Text>
                        <Text style={styles.pdfCardFileName} numberOfLines={1}>
                          {subjectItem.fileName || `${subjectItem.courseCode}_Syllabus.pdf`}
                        </Text>
                        <Text style={styles.pdfCardMeta}>
                          {subjectItem.fileSizeFormatted || 'University Document'} • AKTU Verified
                        </Text>
                      </View>
                    </View>

                    <View style={styles.pdfCardActionsRow}>
                      <TouchableOpacity
                        onPress={() => {
                          router.push({
                            pathname: '/pdf-viewer',
                            params: {
                              fileUrl: subjectItem.pdfUrl,
                              title: `${subjectItem.subject} Syllabus`,
                              fileName: subjectItem.fileName || `${subjectItem.courseCode}_Syllabus.pdf`,
                              subject: subjectItem.subject,
                              subjectCode: subjectItem.courseCode,
                            },
                          });
                        }}
                        style={styles.previewBtn}
                        activeOpacity={0.8}
                      >
                        <ExternalLink size={13} color={THEME.cyan} />
                        <Text style={styles.previewBtnText}>Open Syllabus PDF</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        onPress={() => handleDownloadSyllabusPdf(subjectItem.courseCode, subjectItem.pdfUrl!, subjectItem.fileName)}
                        style={[styles.downloadBtn, downloadingId === subjectItem.courseCode && { opacity: 0.5 }]}
                        activeOpacity={0.8}
                      >
                        <Download size={13} color={THEME.purple} />
                        <Text style={styles.downloadBtnText}>Save Offline</Text>
                      </TouchableOpacity>
                    </View>
                  </Card>
                )}

                {/* ==================================================== */}
                {/* OPTION 2: UNITS & TOPICS LIST */}
                {/* ==================================================== */}
                {subjectItem.units && subjectItem.units.map((unit) => {
                  const isExpanded = !!expandedUnits[unit.id];

                  // Filter topics if search query is active
                  const filteredTopics = (unit.topics || []).filter((t) =>
                    t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    (t.description && t.description.toLowerCase().includes(searchQuery.toLowerCase()))
                  );

                  if (searchQuery.trim() && filteredTopics.length === 0) return null;

                  return (
                    <Card key={unit.id} style={styles.unitCard} variant="elevated">
                      <TouchableOpacity
                        activeOpacity={0.8}
                        onPress={() => toggleUnit(unit.id)}
                        style={styles.unitHeader}
                      >
                        <View style={{ flex: 1 }}>
                          <Text style={styles.unitNumber}>UNIT {unit.unitNumber}</Text>
                          <Text style={styles.unitTitle}>{unit.unitTitle}</Text>
                        </View>

                        {isExpanded ? (
                          <ChevronUp size={20} color={THEME.textSecondary} />
                        ) : (
                          <ChevronDown size={20} color={THEME.textSecondary} />
                        )}
                      </TouchableOpacity>

                      {isExpanded && (
                        <View style={styles.topicsList}>
                          {filteredTopics.map((topic) => (
                            <View key={topic.id} style={styles.topicItem}>
                              <View style={styles.topicHeader}>
                                <Text style={styles.topicTitle}>{topic.title}</Text>
                                {topic.isExamImportant && (
                                  <Badge label="★ Exam Critical" variant="gold" size="sm" />
                                )}
                              </View>

                              {topic.description ? (
                                <Text style={styles.topicDesc}>{topic.description}</Text>
                              ) : null}
                            </View>
                          ))}
                        </View>
                      )}
                    </Card>
                  );
                })}
              </View>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.background,
  },
  adminManageBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: THEME.purple,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  adminManageBtnText: {
    color: THEME.white,
    fontSize: 12,
    fontWeight: '700',
  },
  adminDeleteIcon: {
    padding: 4,
    backgroundColor: THEME.redMuted,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: THEME.red + '40',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.surfaceCard,
    marginHorizontal: 20,
    marginBottom: 12,
    borderRadius: 12,
    borderWidth: 1.2,
    borderColor: THEME.surfaceBorder,
    paddingHorizontal: 12,
    height: 42,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    color: THEME.textPrimary,
    fontSize: 13,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 110,
  },
  subjectContainer: {
    marginBottom: 22,
  },
  subjectHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  subjectTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
    flexWrap: 'wrap',
  },
  subjectTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: THEME.textPrimary,
  },
  unitCountText: {
    fontSize: 11,
    color: THEME.textTertiary,
    fontWeight: '600',
  },
  subjectDesc: {
    fontSize: 12,
    color: THEME.textSecondary,
    marginBottom: 8,
    lineHeight: 16,
  },
  crossStudyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  crossStudyBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: THEME.surfaceCard,
    paddingVertical: 7,
    paddingHorizontal: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: THEME.surfaceBorder,
  },
  crossStudyBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: THEME.cyan,
  },
  crossAiBtn: {
    backgroundColor: THEME.purpleMuted,
    borderColor: THEME.purple + '40',
  },
  pdfSyllabusCard: {
    padding: 12,
    marginBottom: 10,
    borderColor: THEME.cyan + '40',
    backgroundColor: THEME.surfaceCard,
  },
  pdfCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  pdfIconBadge: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: THEME.cyanMuted,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: THEME.cyan + '40',
  },
  pdfCardTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: THEME.textPrimary,
  },
  pdfCardFileName: {
    fontSize: 11,
    fontWeight: '600',
    color: THEME.cyan,
    marginTop: 1,
  },
  pdfCardMeta: {
    fontSize: 10,
    color: THEME.textTertiary,
    marginTop: 2,
  },
  pdfCardActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 10,
    borderTopWidth: 1,
    borderTopColor: THEME.surfaceBorder,
    paddingTop: 8,
  },
  previewBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    backgroundColor: THEME.cyanMuted,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: THEME.cyan + '40',
  },
  previewBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: THEME.cyan,
  },
  downloadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: THEME.purpleMuted,
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: THEME.purple + '40',
  },
  downloadBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: THEME.purple,
  },
  unitCard: {
    padding: 14,
    marginBottom: 8,
  },
  unitHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  unitNumber: {
    fontSize: 11,
    fontWeight: '800',
    color: THEME.pink,
    letterSpacing: 0.8,
  },
  unitTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: THEME.textPrimary,
    marginTop: 2,
  },
  topicsList: {
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: THEME.surfaceBorder,
    paddingTop: 10,
    gap: 8,
  },
  topicItem: {
    backgroundColor: THEME.surfaceCard,
    borderRadius: 8,
    padding: 8,
  },
  topicHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 6,
  },
  topicTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: THEME.textPrimary,
    flex: 1,
  },
  topicDesc: {
    fontSize: 11,
    color: THEME.textSecondary,
    marginTop: 3,
    lineHeight: 15,
  },
});
