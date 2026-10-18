import React from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity 
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { 
  ShieldCheck, 
  Upload, 
  CalendarPlus, 
  BookPlus, 
  BellPlus, 
  ArrowLeft, 
  Image as ImageIcon,
  ChevronRight,
  BarChart3,
  DownloadCloud
} from 'lucide-react-native';
import { THEME } from '@/constants/theme';
import { Card } from '@/components/Card';
import { Header } from '@/components/Header';
import { Badge } from '@/components/Badge';
import { useStudyHub } from '@/store/StudyHubContext';

export default function AdminDashboardScreen() {
  const router = useRouter();
  const { notes, shortNotes, exams, currentUser } = useStudyHub();

  const totalPdfs = notes.length;
  const totalShortNotes = shortNotes.length;
  const upcomingExams = exams.filter((e) => !e.isCancelled).length;

  return (
    <SafeAreaView style={styles.container}>
      <Header
        title="Admin Control Center"
        subtitle="Manage branch materials, exams & image notes"
      />

      <TouchableOpacity 
        onPress={() => {
          if (router.canGoBack()) {
            router.back();
          } else {
            router.replace('/(tabs)');
          }
        }} 
        style={styles.backBtn}
      >
        <ArrowLeft size={18} color={THEME.textSecondary} />
        <Text style={styles.backText}>Back to Student View</Text>
      </TouchableOpacity>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Admin Credentials Banner */}
        <Card style={styles.adminHeroCard} variant="glowPurple">
          <View style={styles.adminHeroRow}>
            <View style={styles.shieldIconWrap}>
              <ShieldCheck size={26} color={THEME.purple} />
            </View>
            <View style={{ flex: 1 }}>
              <View style={styles.adminNameWrap}>
                <Text style={styles.adminName}>{currentUser?.name || 'vinay kumar'}</Text>
              </View>
              <Text style={styles.adminEmail}>{currentUser?.email}</Text>
              <Badge label="AUTHENTICATED COLLEGE ADMIN" variant="purple" size="sm" />
            </View>
          </View>
        </Card>

        {/* Quick KPI Overview */}
        <View style={styles.statsRow}>
          <Card style={styles.statCard} variant="elevated">
            <Text style={styles.statNumber}>{totalPdfs}</Text>
            <Text style={styles.statLabel}>PDFs</Text>
            <Text style={styles.statSub}>Lectures</Text>
          </Card>

          <Card style={styles.statCard} variant="elevated">
            <Text style={[styles.statNumber, { color: THEME.pink }]}>{totalShortNotes}</Text>
            <Text style={styles.statLabel}>Short Notes</Text>
            <Text style={styles.statSub}>Image sheets</Text>
          </Card>

          <Card style={styles.statCard} variant="elevated">
            <Text style={[styles.statNumber, { color: THEME.blue }]}>{upcomingExams}</Text>
            <Text style={styles.statLabel}>Exams</Text>
            <Text style={styles.statSub}>Timetables</Text>
          </Card>
        </View>

        {/* Action Modules */}
        <Text style={styles.sectionTitle}>Branch-Wise Publishing Operations</Text>

        {/* 0. AKTU Notes Importer */}
        <TouchableOpacity 
          activeOpacity={0.8}
          onPress={() => router.push('/admin/notes-importer')}
          style={styles.moduleWrapper}
        >
          <Card style={styles.moduleCard} variant="glowPurple">
            <View style={[styles.moduleIconBox, { backgroundColor: THEME.purpleMuted }]}>
              <DownloadCloud size={22} color={THEME.purple} />
            </View>
            <View style={styles.moduleInfo}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={styles.moduleTitle}>AKTU B.Tech Notes Importer</Text>
                <Badge label="1–8 SEM" variant="cyan" size="sm" />
              </View>
              <Text style={styles.moduleDesc}>Inspect NotesGallery & bulk-sync verified AKTU materials</Text>
            </View>
            <ChevronRight size={18} color={THEME.textTertiary} />
          </Card>
        </TouchableOpacity>

        {/* 1. Upload PDF Notes */}
        <TouchableOpacity 
          activeOpacity={0.8}
          onPress={() => router.push('/admin/upload-notes')}
          style={styles.moduleWrapper}
        >
          <Card style={styles.moduleCard} variant="elevated">
            <View style={[styles.moduleIconBox, { backgroundColor: THEME.purpleMuted }]}>
              <Upload size={22} color={THEME.purple} />
            </View>
            <View style={styles.moduleInfo}>
              <Text style={styles.moduleTitle}>Upload Lecture Notes & PDFs</Text>
              <Text style={styles.moduleDesc}>Select PDF, assign branch access & mark high-yield</Text>
            </View>
            <ChevronRight size={18} color={THEME.textTertiary} />
          </Card>
        </TouchableOpacity>

        {/* 2. Upload Image Short Notes */}
        <TouchableOpacity 
          activeOpacity={0.8}
          onPress={() => router.push('/admin/upload-short-notes')}
          style={styles.moduleWrapper}
        >
          <Card style={styles.moduleCard} variant="elevated">
            <View style={[styles.moduleIconBox, { backgroundColor: THEME.pinkMuted }]}>
              <ImageIcon size={22} color={THEME.pink} />
            </View>
            <View style={styles.moduleInfo}>
              <Text style={styles.moduleTitle}>Upload Image Short Notes</Text>
              <Text style={styles.moduleDesc}>Publish formula sheets, hand-drawn diagrams & slides</Text>
            </View>
            <ChevronRight size={18} color={THEME.textTertiary} />
          </Card>
        </TouchableOpacity>

        {/* 3. Schedule Examinations */}
        <TouchableOpacity 
          activeOpacity={0.8}
          onPress={() => router.push('/admin/manage-exams')}
          style={styles.moduleWrapper}
        >
          <Card style={styles.moduleCard} variant="elevated">
            <View style={[styles.moduleIconBox, { backgroundColor: THEME.blueMuted }]}>
              <CalendarPlus size={22} color={THEME.blue} />
            </View>
            <View style={styles.moduleInfo}>
              <Text style={styles.moduleTitle}>Schedule Examinations</Text>
              <Text style={styles.moduleDesc}>Set branch dates, start/end timings, halls & instructions</Text>
            </View>
            <ChevronRight size={18} color={THEME.textTertiary} />
          </Card>
        </TouchableOpacity>

        {/* 4. Manage Syllabus */}
        <TouchableOpacity 
          activeOpacity={0.8}
          onPress={() => router.push('/admin/manage-syllabus')}
          style={styles.moduleWrapper}
        >
          <Card style={styles.moduleCard} variant="elevated">
            <View style={[styles.moduleIconBox, { backgroundColor: THEME.cyanMuted }]}>
              <BookPlus size={22} color={THEME.cyan} />
            </View>
            <View style={styles.moduleInfo}>
              <Text style={styles.moduleTitle}>Manage Syllabus & Units</Text>
              <Text style={styles.moduleDesc}>Publish branch units, highlight exam critical topics</Text>
            </View>
            <ChevronRight size={18} color={THEME.textTertiary} />
          </Card>
        </TouchableOpacity>

        {/* 5. Announcements */}
        <TouchableOpacity 
          activeOpacity={0.8}
          onPress={() => router.push('/admin/announcements')}
          style={styles.moduleWrapper}
        >
          <Card style={styles.moduleCard} variant="elevated">
            <View style={[styles.moduleIconBox, { backgroundColor: THEME.goldMuted }]}>
              <BellPlus size={22} color={THEME.gold} />
            </View>
            <View style={styles.moduleInfo}>
              <Text style={styles.moduleTitle}>Publish Announcements</Text>
              <Text style={styles.moduleDesc}>Broadcast campus notices and pin alerts to student home</Text>
            </View>
            <ChevronRight size={18} color={THEME.textTertiary} />
          </Card>
        </TouchableOpacity>

        {/* 6. Admin Analytics & Monitoring */}
        <TouchableOpacity 
          activeOpacity={0.8}
          onPress={() => router.push('/admin/analytics')}
          style={styles.moduleWrapper}
        >
          <Card style={styles.moduleCard} variant="glowPurple">
            <View style={[styles.moduleIconBox, { backgroundColor: THEME.purpleMuted }]}>
              <BarChart3 size={22} color={THEME.purple} />
            </View>
            <View style={styles.moduleInfo}>
              <Text style={styles.moduleTitle}>Admin Analytics & Monitoring</Text>
              <Text style={styles.moduleDesc}>Real student counts, branch breakdown & audit logs</Text>
            </View>
            <ChevronRight size={18} color={THEME.purple} />
          </Card>
        </TouchableOpacity>

        {/* Developer Credit */}
        <View style={styles.adminFooterLink}>
          <Text style={styles.adminFooterText}>
            Engineering System by <Text style={styles.adminFooterAuthor}>vinay kumar</Text>
          </Text>
        </View>
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
  adminHeroCard: {
    padding: 18,
    marginBottom: 16,
  },
  adminHeroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  shieldIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: THEME.surfaceCard,
    borderWidth: 1.5,
    borderColor: THEME.purple,
    alignItems: 'center',
    justifyContent: 'center',
  },
  adminName: {
    fontSize: 16,
    fontWeight: '800',
    color: THEME.textPrimary,
  },
  adminEmail: {
    fontSize: 12,
    color: THEME.textSecondary,
    marginTop: 2,
    marginBottom: 6,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20,
  },
  statCard: {
    flex: 1,
    padding: 12,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 22,
    fontWeight: '900',
    color: THEME.purple,
  },
  statLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: THEME.textPrimary,
    marginTop: 2,
  },
  statSub: {
    fontSize: 10,
    color: THEME.textTertiary,
    marginTop: 2,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: THEME.textSecondary,
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  moduleWrapper: {
    marginBottom: 12,
  },
  moduleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  moduleIconBox: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  moduleInfo: {
    flex: 1,
  },
  moduleTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: THEME.textPrimary,
  },
  moduleDesc: {
    fontSize: 12,
    color: THEME.textSecondary,
    marginTop: 3,
  },
  adminNameWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  portfolioBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(6, 182, 212, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(6, 182, 212, 0.4)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  portfolioBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: THEME.cyan,
  },
  adminFooterLink: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
    marginTop: 10,
    marginBottom: 20,
    gap: 6,
  },
  adminFooterText: {
    fontSize: 12,
    color: THEME.textTertiary,
    fontWeight: '500',
  },
  adminFooterAuthor: {
    color: THEME.purple,
    fontWeight: '800',
    textDecorationLine: 'underline',
  },
  adminFooterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(6, 182, 212, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(6, 182, 212, 0.25)',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 16,
  },
  adminFooterPillText: {
    fontSize: 11,
    color: THEME.cyan,
    fontWeight: '600',
  },
});
