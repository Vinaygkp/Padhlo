import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  ActivityIndicator, 
  Alert 
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { 
  ArrowLeft, 
  Users, 
  FileText, 
  Download, 
  ShieldCheck, 
  RefreshCw, 
  Layers, 
  Calendar, 
  Bell, 
  History 
} from 'lucide-react-native';
import { THEME } from '@/constants/theme';
import { Card } from '@/components/Card';
import { Header } from '@/components/Header';
import { Badge } from '@/components/Badge';
import { useStudyHub } from '@/store/StudyHubContext';
import { storage } from '@/services/storage';
import { API_BASE_URL } from '@/constants/api';
import { AdminAnalyticsData } from '@/types';

export default function AdminAnalyticsScreen() {
  const router = useRouter();
  const { notes, shortNotes, exams, announcements } = useStudyHub();

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<AdminAnalyticsData | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  useEffect(() => {
    let ignore = false;

    async function load() {
      try {
        const token = await storage.getToken();
        const res = await fetch(`${API_BASE_URL}/api/admin/analytics`, {
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        });
        const json = await res.json();
        if (!ignore) {
          if (json.success && json.metrics) {
            setData({
              ...json.metrics,
              auditLogs: json.auditLogs || [],
            });
          } else {
            // Honest zero-state calculations from active records
            setData({
              totalStudents: 0,
              verifiedStudents: 0,
              studentsByBranch: [],
              studentsByYear: [],
              totalPdfs: notes.length,
              totalShortNotes: shortNotes.length,
              totalExams: exams.length,
              totalAnnouncements: announcements.length,
              totalDownloads: 0,
              topDownloads: [],
              auditLogs: [],
            });
          }
        }
      } catch {
        // Offline honest zero-state
        if (!ignore) {
          setData({
            totalStudents: 0,
            verifiedStudents: 0,
            studentsByBranch: [],
            studentsByYear: [],
            totalPdfs: notes.length,
            totalShortNotes: shortNotes.length,
            totalExams: exams.length,
            totalAnnouncements: announcements.length,
            totalDownloads: 0,
            topDownloads: [],
            auditLogs: [],
          });
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    }

    load();

    return () => {
      ignore = true;
    };
  }, [announcements.length, exams.length, notes.length, refreshTrigger, shortNotes.length]);

  const handleManualRefresh = () => {
    setLoading(true);
    setRefreshTrigger(prev => prev + 1);
  };

  const handleExportCsv = async () => {
    try {
      const token = await storage.getToken();
      const res = await fetch(`${API_BASE_URL}/api/admin/analytics/export-csv`, {
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      const text = await res.text();
      Alert.alert(
        'CSV Export Generated',
        `Summary Report:\n\n${text.slice(0, 200)}...`
      );
    } catch (err: any) {
      Alert.alert('Export Failed', err.message || 'Could not generate report.');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <Header
        title="Admin Monitoring & Analytics"
        subtitle="Real database metrics, student counts & audit logs"
      />

      <View style={styles.topActionsRow}>
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
          <Text style={styles.backText}>Admin Control</Text>
        </TouchableOpacity>

        <View style={styles.rightBtns}>
          <TouchableOpacity onPress={handleExportCsv} style={styles.csvBtn}>
            <Text style={styles.csvBtnText}>Export CSV</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={handleManualRefresh} style={styles.refreshBtn}>
            <RefreshCw size={16} color={THEME.cyan} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color={THEME.purple} />
            <Text style={styles.loadingText}>Compiling database analytics...</Text>
          </View>
        ) : (
          <>
            {/* Student Accounts Stat Card */}
            <Text style={styles.sectionHeading}>Student Enrollment & Verification</Text>
            <View style={styles.kpiRow}>
              <Card style={styles.kpiCard} variant="glowPurple">
                <Users size={20} color={THEME.purple} />
                <Text style={styles.kpiValue}>{data?.totalStudents || 0}</Text>
                <Text style={styles.kpiLabel}>Total Registered Students</Text>
              </Card>

              <Card style={styles.kpiCard} variant="glowBlue">
                <ShieldCheck size={20} color={THEME.cyan} />
                <Text style={styles.kpiValue}>{data?.verifiedStudents || 0}</Text>
                <Text style={styles.kpiLabel}>Verified via OTP</Text>
              </Card>
            </View>

            {/* Department Breakdown */}
            <Text style={styles.sectionHeading}>Students by Department</Text>
            <Card style={styles.breakdownCard} variant="elevated">
              {data?.studentsByBranch && data.studentsByBranch.length > 0 ? (
                data.studentsByBranch.map((item, idx) => (
                  <View key={idx} style={styles.breakdownRow}>
                    <View style={styles.breakdownLabelGroup}>
                      <Badge label={item._id || 'CSE'} variant="purple" size="sm" />
                      <Text style={styles.breakdownName}>{item._id} Department</Text>
                    </View>
                    <Text style={styles.breakdownCount}>{item.count} students</Text>
                  </View>
                ))
              ) : (
                <Text style={styles.emptyNote}>No registered student breakdown available.</Text>
              )}
            </Card>

            {/* Content & Resource Stats */}
            <Text style={styles.sectionHeading}>Published Academic Resources</Text>
            <View style={styles.gridQuad}>
              <Card style={styles.quadCard} variant="elevated">
                <FileText size={18} color={THEME.purple} />
                <Text style={styles.quadVal}>{data?.totalPdfs || notes.length}</Text>
                <Text style={styles.quadLbl}>Lecture PDFs</Text>
              </Card>

              <Card style={styles.quadCard} variant="elevated">
                <Layers size={18} color={THEME.cyan} />
                <Text style={styles.quadVal}>{data?.totalShortNotes || shortNotes.length}</Text>
                <Text style={styles.quadLbl}>Visual Sheets</Text>
              </Card>

              <Card style={styles.quadCard} variant="elevated">
                <Calendar size={18} color={THEME.gold} />
                <Text style={styles.quadVal}>{data?.totalExams || exams.length}</Text>
                <Text style={styles.quadLbl}>Exam Schedules</Text>
              </Card>

              <Card style={styles.quadCard} variant="elevated">
                <Bell size={18} color={THEME.pink} />
                <Text style={styles.quadVal}>{data?.totalAnnouncements || announcements.length}</Text>
                <Text style={styles.quadLbl}>Campus Notices</Text>
              </Card>
            </View>

            {/* Downloads Activity Stat */}
            <Text style={styles.sectionHeading}>Offline Downloads & Engagement</Text>
            <Card style={styles.downloadStatCard} variant="glowBlue">
              <View style={styles.downloadStatRow}>
                <Download size={24} color={THEME.cyan} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.downloadStatTitle}>
                    {data?.totalDownloads || 0} Total Material Downloads
                  </Text>
                  <Text style={styles.downloadStatSub}>
                    Verified offline caching events recorded on mobile devices
                  </Text>
                </View>
              </View>
            </Card>

            {/* Admin Audit Trail */}
            <Text style={styles.sectionHeading}>Recent Administrator Audit Trail</Text>
            <Card style={styles.auditCard} variant="elevated">
              {data?.auditLogs && data.auditLogs.length > 0 ? (
                data.auditLogs.map((log, index) => (
                  <View key={index} style={styles.auditRow}>
                    <History size={16} color={THEME.purple} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.auditAction}>{log.action}</Text>
                      <Text style={styles.auditDetails}>{log.details}</Text>
                      <Text style={styles.auditTime}>
                        {new Date(log.timestamp).toLocaleString()} by {log.adminName}
                      </Text>
                    </View>
                  </View>
                ))
              ) : (
                <View style={styles.auditEmpty}>
                  <ShieldCheck size={20} color={THEME.textTertiary} />
                  <Text style={styles.auditEmptyText}>
                    Administrative actions are logged here whenever new materials, exams, or notices are modified.
                  </Text>
                </View>
              )}
            </Card>
          </>
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
  topActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  backText: {
    fontSize: 13,
    color: THEME.textSecondary,
    fontWeight: '700',
  },
  rightBtns: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  csvBtn: {
    backgroundColor: THEME.surfaceElevated,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: THEME.surfaceBorder,
  },
  csvBtnText: {
    fontSize: 11,
    color: THEME.purple,
    fontWeight: '800',
  },
  refreshBtn: {
    padding: 6,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
    gap: 14,
  },
  loadingWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    gap: 12,
  },
  loadingText: {
    fontSize: 13,
    color: THEME.textSecondary,
    fontWeight: '600',
  },
  sectionHeading: {
    fontSize: 12,
    fontWeight: '800',
    color: THEME.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 6,
    marginBottom: 4,
  },
  kpiRow: {
    flexDirection: 'row',
    gap: 12,
  },
  kpiCard: {
    flex: 1,
    padding: 16,
    borderRadius: 16,
    gap: 6,
  },
  kpiValue: {
    fontSize: 26,
    fontWeight: '900',
    color: THEME.textPrimary,
  },
  kpiLabel: {
    fontSize: 11,
    color: THEME.textSecondary,
    fontWeight: '600',
  },
  breakdownCard: {
    padding: 16,
    borderRadius: 16,
    gap: 10,
  },
  breakdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  breakdownLabelGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  breakdownName: {
    fontSize: 13,
    fontWeight: '700',
    color: THEME.textPrimary,
  },
  breakdownCount: {
    fontSize: 13,
    fontWeight: '800',
    color: THEME.cyan,
  },
  emptyNote: {
    fontSize: 12,
    color: THEME.textTertiary,
  },
  gridQuad: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  quadCard: {
    width: '48%',
    padding: 14,
    borderRadius: 14,
    gap: 4,
  },
  quadVal: {
    fontSize: 20,
    fontWeight: '900',
    color: THEME.textPrimary,
  },
  quadLbl: {
    fontSize: 11,
    color: THEME.textSecondary,
  },
  downloadStatCard: {
    padding: 16,
    borderRadius: 16,
  },
  downloadStatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  downloadStatTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: THEME.textPrimary,
  },
  downloadStatSub: {
    fontSize: 11,
    color: THEME.textSecondary,
    marginTop: 2,
  },
  auditCard: {
    padding: 16,
    borderRadius: 16,
    gap: 12,
  },
  auditRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: THEME.surfaceBorder,
  },
  auditAction: {
    fontSize: 13,
    fontWeight: '800',
    color: THEME.textPrimary,
  },
  auditDetails: {
    fontSize: 11,
    color: THEME.textSecondary,
    marginTop: 2,
  },
  auditTime: {
    fontSize: 10,
    color: THEME.textTertiary,
    marginTop: 4,
  },
  auditEmpty: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
  },
  auditEmptyText: {
    flex: 1,
    fontSize: 12,
    color: THEME.textTertiary,
    lineHeight: 16,
  },
});
