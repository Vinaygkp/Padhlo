import React, { useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity,
  Image as RNImage,
  Linking,
  Alert,
  RefreshControl 
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { 
  FileText, 
  Calendar, 
  Bookmark, 
  ChevronRight, 
  Sparkles, 
  ShieldCheck, 
  Clock, 
  MessageCircle,
  Heart,
  Bell
} from 'lucide-react-native';
import { THEME } from '@/constants/theme';
import { Card } from '@/components/Card';
import { Badge } from '@/components/Badge';
import { StudentIllustration } from '@/components/StudentIllustration';
import { ThoughtOfTheDay } from '@/components/ThoughtOfTheDay';
import { useStudyHub } from '@/store/StudyHubContext';
import { openPortfolio } from '@/constants/portfolio';

export default function StudentHomeScreen() {
  const router = useRouter();
  const { 
    currentUser, 
    isAdmin, 
    userBranch, 
    userYear, 
    exams, 
    announcements, 
    isContentAccessible,
    refreshNotes,
    refreshExams,
    refreshAnnouncements 
  } = useStudyHub();

  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        refreshNotes().catch(() => {}),
        refreshExams().catch(() => {}),
        refreshAnnouncements().catch(() => {}),
      ]);
    } finally {
      setRefreshing(false);
    }
  };

  // Dynamic Day & Date calculation
  const now = new Date();
  const dynamicDateStr = now.toLocaleDateString('en-US', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  // Filter exams by branch and academic year
  const branchExams = exams
    .filter((e) => e.isPublished && !e.isCancelled && isContentAccessible(e.branches, e.years))
    .sort((a, b) => new Date(a.examDate).getTime() - new Date(b.examDate).getTime());

  const nextExam = branchExams[0];

  const calculateDaysLeft = (dateStr: string) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const target = new Date(dateStr);
    target.setHours(0, 0, 0, 0);
    const diffTime = target.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    if (diffDays < 0) return 'Concluded';
    if (diffDays === 0) return 'Today!';
    if (diffDays === 1) return 'Tomorrow';
    return `${diffDays} days left`;
  };

  // Filter announcements for this student's branch & year
  const accessibleAnnouncements = (announcements || []).filter((a) => {
    return isContentAccessible(a.branches, a.years);
  });
  const unreadAnnouncementsCount = accessibleAnnouncements.filter((a) => !a.isRead).length;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView 
        contentContainerStyle={styles.scrollContent} 
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={THEME.purple}
            colors={[THEME.purple]}
          />
        }
      >
        {/* A. Header: Greeting, Date, Branch Badge & Avatar */}
        <View style={styles.topHeader}>
          <View style={{ flex: 1, marginRight: 8 }}>
            <View style={styles.brandRow}>
              <Text style={styles.brandPadh}>Padh</Text>
              <Text style={styles.brandLo}>lo</Text>
              <View style={styles.branchPill}>
                <Text style={styles.branchPillText}>{userBranch}</Text>
              </View>
              <View style={[styles.branchPill, { backgroundColor: THEME.blueMuted, borderColor: THEME.blue + '40', marginLeft: 6 }]}>
                <Text style={[styles.branchPillText, { color: THEME.blue }]}>{userYear}</Text>
              </View>
            </View>

            <View>
              <Text style={styles.greetingText}>
                Hello, <Text style={styles.studentNameHighlight}>{currentUser?.name?.split(' ')[0] || 'Student'}</Text>
              </Text>
            </View>
            <Text style={styles.dateText}>{dynamicDateStr}</Text>
          </View>

          <View style={styles.headerRightActions}>
            <TouchableOpacity 
              activeOpacity={0.8}
              onPress={() => router.push('/announcements-feed')}
              style={styles.bellBtn}
              accessibilityLabel="Campus notices"
            >
              <Bell size={20} color={THEME.textPrimary} />
              {unreadAnnouncementsCount > 0 && (
                <View style={styles.unreadBadge}>
                  <Text style={styles.unreadBadgeText}>
                    {unreadAnnouncementsCount > 9 ? '9+' : unreadAnnouncementsCount}
                  </Text>
                </View>
              )}
            </TouchableOpacity>

            <TouchableOpacity 
              activeOpacity={0.8}
              onPress={() => router.push('/(tabs)/profile')}
              style={styles.avatarCircle}
            >
              {currentUser?.profilePicture ? (
                <RNImage 
                  source={{ uri: currentUser.profilePicture }} 
                  style={styles.avatarImg} 
                />
              ) : (
                <Text style={styles.avatarText}>{currentUser?.avatar || 'ST'}</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Admin Bar Shortcut if logged in as Admin */}
        {isAdmin && (
          <TouchableOpacity 
            activeOpacity={0.8}
            onPress={() => router.push('/admin/dashboard')}
            style={styles.adminBanner}
          >
            <View style={styles.adminBannerLeft}>
              <ShieldCheck size={20} color={THEME.purple} />
              <View>
                <Text style={styles.adminBannerTitle}>ADMINISTRATOR CONTROL PANEL</Text>
                <Text style={styles.adminBannerSub}>Upload PDFs, short notes & manage exams</Text>
              </View>
            </View>
            <ChevronRight size={18} color={THEME.purple} />
          </TouchableOpacity>
        )}

        {/* B. Thought of the Day Card — Directly on Home Screen */}
        <ThoughtOfTheDay />

        {/* C. Main Illustration Hero Card */}
        <Card style={styles.heroCard} variant="glowPurple">
          <View style={styles.heroContentRow}>
            <View style={styles.heroTextSection}>
              <View style={styles.spaceTagWrap}>
                <Sparkles size={13} color={THEME.cyan} />
                <Text style={styles.spaceTag}>LEARNING SPACE</Text>
              </View>
              <Text style={styles.heroHeading}>Your Learning Space</Text>
              <Text style={styles.heroSubText}>
                Your notes, exams and important topics — all in one place.
              </Text>
            </View>

            {/* Original Cartoon Student Studying Illustration */}
            <View style={styles.illustrationWrap}>
              <StudentIllustration width={130} height={130} />
            </View>
          </View>
        </Card>

        {/* C. Four Main Feature Cards */}
        <View style={styles.gridRow}>
          {/* 1. Notes (PDF) */}
          <TouchableOpacity 
            style={[styles.featureCard, { borderColor: THEME.purple + '60' }]}
            onPress={() => router.push('/(tabs)/notes')}
            activeOpacity={0.8}
          >
            <View style={[styles.iconCircle, { backgroundColor: THEME.purpleMuted }]}>
              <FileText size={22} color={THEME.purple} />
            </View>
            <Text style={styles.featureTitle}>Notes</Text>
            <Text style={styles.featureSub}>PDF lectures & labs</Text>
          </TouchableOpacity>

          {/* 2. Vinay AI (AI Study Assistant) */}
          <TouchableOpacity 
            style={[styles.featureCard, { borderColor: THEME.purple + '80' }]}
            onPress={() => router.push('/(tabs)/ai-assistant')}
            activeOpacity={0.8}
          >
            <View style={[styles.iconCircle, { backgroundColor: THEME.purpleMuted }]}>
              <Sparkles size={22} color={THEME.purple} />
            </View>
            <Text style={styles.featureTitle}>Vinay AI</Text>
            <Text style={styles.featureSub}>2 & 7 Marks Exam Q&A</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.gridRow}>
          {/* 3. Exam Schedule */}
          <TouchableOpacity 
            style={[styles.featureCard, { borderColor: THEME.blue + '60' }]}
            onPress={() => router.push('/(tabs)/exams')}
            activeOpacity={0.8}
          >
            <View style={[styles.iconCircle, { backgroundColor: THEME.blueMuted }]}>
              <Calendar size={22} color={THEME.blue} />
            </View>
            <Text style={styles.featureTitle}>Exam Schedule</Text>
            <Text style={styles.featureSub}>Dates & countdowns</Text>
          </TouchableOpacity>

          {/* 4. Syllabus */}
          <TouchableOpacity 
            style={[styles.featureCard, { borderColor: THEME.cyan + '60' }]}
            onPress={() => router.push('/(tabs)/syllabus')}
            activeOpacity={0.8}
          >
            <View style={[styles.iconCircle, { backgroundColor: THEME.cyanMuted }]}>
              <Bookmark size={22} color={THEME.cyan} />
            </View>
            <Text style={styles.featureTitle}>Syllabus</Text>
            <Text style={styles.featureSub}>Units & high-yield</Text>
          </TouchableOpacity>
        </View>

        {/* D. Upcoming Exam Preview */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Upcoming Exam</Text>
          <TouchableOpacity onPress={() => router.push('/(tabs)/exams')}>
            <Text style={styles.viewAllLink}>View All</Text>
          </TouchableOpacity>
        </View>

        {nextExam ? (
          <Card style={styles.compactExamCard} variant="elevated">
            <View style={styles.examTopRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.examSubject}>{nextExam.subject}</Text>
                <Text style={styles.examType}>{nextExam.title}</Text>
              </View>
              <Badge label={calculateDaysLeft(nextExam.examDate)} variant="gold" size="sm" />
            </View>

            <View style={styles.examMetaRow}>
              <View style={styles.metaItem}>
                <Calendar size={13} color={THEME.cyan} />
                <Text style={styles.metaText}>{nextExam.examDate}</Text>
              </View>
              <View style={styles.metaItem}>
                <Clock size={13} color={THEME.cyan} />
                <Text style={styles.metaText}>{nextExam.startTime} - {nextExam.endTime}</Text>
              </View>
            </View>
          </Card>
        ) : (
          <Card style={styles.noExamCard}>
            <Text style={styles.noExamText}>No upcoming exams scheduled right now.</Text>
          </Card>
        )}

        {/* E. Contact Me WhatsApp Section - Hidden for Admin because Vinay is the creator/admin himself */}
        {!isAdmin && (
          <>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>Get in Touch</Text>
            </View>

            <Card style={styles.whatsappCard} variant="elevated">
              <View style={styles.whatsappContent}>
                <View style={styles.whatsappIconCircle}>
                  <MessageCircle size={24} color="#25D366" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.whatsappTitle}>Contact Me on WhatsApp</Text>
                  <Text style={styles.whatsappSub}>Need study notes, guidance or have queries?</Text>
                </View>
              </View>

              <TouchableOpacity
                style={styles.whatsappButton}
                onPress={() => {
                  const url = 'https://wa.me/918601317580?text=Hello%20Vinay,%20I%20am%20using%20Padhlo%20and%20need%20assistance.';
                  Linking.openURL(url).catch(() => {
                    Alert.alert('Unable to open WhatsApp', 'Please message directly to +91 8601317580.');
                  });
                }}
                activeOpacity={0.8}
              >
                <MessageCircle size={18} color={THEME.white} />
                <Text style={styles.whatsappButtonText}>Chat on WhatsApp</Text>
              </TouchableOpacity>
            </Card>
          </>
        )}

        {/* F. Footer: Made by Vinay */}
        <View style={styles.footerContainer}>
          <TouchableOpacity 
            style={styles.footerBadge}
            onPress={openPortfolio}
            activeOpacity={0.8}
            accessibilityRole="link"
            accessibilityLabel="Open Vinay's portfolio"
          >
            <Heart size={14} color={THEME.pink} fill={THEME.pink} />
            <Text style={styles.footerText}>
              Made with passion by <Text style={[styles.footerAuthor, styles.footerAuthorLink]}>Vinay ↗</Text>
            </Text>
          </TouchableOpacity>
          <Text style={styles.footerSubText}>Padhlo • Padho. Seekho. Aage Badho.</Text>
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
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 110,
  },
  topHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    gap: 12,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 4,
  },
  brandPadh: {
    fontSize: 22,
    fontWeight: '900',
    color: THEME.purple,
  },
  brandLo: {
    fontSize: 22,
    fontWeight: '900',
    color: THEME.cyan,
  },
  branchPill: {
    backgroundColor: THEME.purpleMuted,
    borderWidth: 1,
    borderColor: THEME.purple + '60',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  branchPillText: {
    fontSize: 10,
    color: THEME.purple,
    fontWeight: '800',
  },
  greetingText: {
    fontSize: 16,
    color: THEME.textSecondary,
    fontWeight: '600',
  },
  studentNameHighlight: {
    color: THEME.textPrimary,
    fontWeight: '800',
  },
  dateText: {
    fontSize: 12,
    color: THEME.textTertiary,
    marginTop: 2,
    fontWeight: '500',
  },
  headerRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flexShrink: 0,
  },
  bellBtn: {
    width: 44,
    height: 44,
    borderRadius: 16,
    backgroundColor: THEME.surfaceCard,
    borderWidth: 1,
    borderColor: THEME.surfaceBorder,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  unreadBadge: {
    position: 'absolute',
    top: -3,
    right: -3,
    backgroundColor: THEME.red,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    borderWidth: 1.5,
    borderColor: THEME.background,
  },
  unreadBadgeText: {
    color: THEME.white,
    fontSize: 10,
    fontWeight: '900',
  },
  avatarCircle: {
    width: 44,
    height: 44,
    borderRadius: 16,
    backgroundColor: THEME.surfaceCard,
    borderWidth: 1.5,
    borderColor: THEME.purple,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    overflow: 'hidden',
  },
  avatarImg: {
    width: 44,
    height: 44,
    borderRadius: 16,
  },
  avatarText: {
    color: THEME.textPrimary,
    fontWeight: '800',
    fontSize: 15,
  },
  noticeBannerTouchable: {
    marginBottom: 16,
  },
  noticeBannerCard: {
    padding: 16,
    borderRadius: 18,
  },
  noticeBannerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
    gap: 8,
  },
  noticeBannerBadgeWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
    flexWrap: 'wrap',
  },
  noticeBellIconCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  noticeBannerTag: {
    fontSize: 11,
    fontWeight: '900',
    color: THEME.cyan,
    letterSpacing: 0.5,
  },
  noticeViewAllRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  noticeViewAllText: {
    fontSize: 11,
    fontWeight: '700',
    color: THEME.blue,
  },
  noticeBannerTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: THEME.textPrimary,
    marginBottom: 4,
    lineHeight: 20,
  },
  noticeBannerSnippet: {
    fontSize: 12,
    color: THEME.textSecondary,
    lineHeight: 18,
    marginBottom: 10,
  },
  noticeBannerBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.06)',
  },
  noticeBannerDate: {
    fontSize: 11,
    color: THEME.textTertiary,
    fontWeight: '500',
  },
  noticeReadMoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  noticeReadMoreText: {
    fontSize: 12,
    fontWeight: '700',
    color: THEME.blue,
  },
  adminBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: THEME.purpleMuted,
    borderWidth: 1.2,
    borderColor: THEME.purple,
    borderRadius: 14,
    padding: 12,
    marginBottom: 16,
  },
  adminBannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  adminBannerTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: THEME.purple,
    letterSpacing: 0.5,
  },
  adminBannerSub: {
    fontSize: 12,
    color: THEME.textPrimary,
    marginTop: 1,
  },
  heroCard: {
    padding: 18,
    marginBottom: 20,
    borderRadius: 20,
  },
  heroContentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  heroTextSection: {
    flex: 1,
    paddingRight: 8,
  },
  spaceTagWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  spaceTag: {
    fontSize: 10,
    fontWeight: '800',
    color: THEME.cyan,
    letterSpacing: 0.8,
  },
  heroHeading: {
    fontSize: 20,
    fontWeight: '900',
    color: THEME.textPrimary,
    letterSpacing: -0.4,
  },
  heroSubText: {
    fontSize: 12,
    color: THEME.textSecondary,
    lineHeight: 18,
    marginTop: 6,
  },
  illustrationWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  gridRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  featureCard: {
    flex: 1,
    backgroundColor: THEME.surfaceCard,
    borderWidth: 1.2,
    borderRadius: 16,
    padding: 14,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  featureTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: THEME.textPrimary,
  },
  featureSub: {
    fontSize: 11,
    color: THEME.textSecondary,
    marginTop: 2,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: THEME.textPrimary,
    letterSpacing: -0.2,
  },
  viewAllLink: {
    fontSize: 12,
    color: THEME.cyan,
    fontWeight: '700',
  },
  compactExamCard: {
    padding: 14,
    marginBottom: 16,
  },
  examTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  examSubject: {
    fontSize: 16,
    fontWeight: '800',
    color: THEME.textPrimary,
  },
  examType: {
    fontSize: 12,
    color: THEME.textSecondary,
    marginTop: 1,
  },
  examMetaRow: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 4,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  metaText: {
    fontSize: 12,
    color: THEME.textTertiary,
    fontWeight: '600',
  },
  noExamCard: {
    padding: 16,
    alignItems: 'center',
    marginBottom: 16,
  },
  noExamText: {
    fontSize: 12,
    color: THEME.textSecondary,
    textAlign: 'center',
  },
  whatsappCard: {
    padding: 16,
    marginBottom: 20,
    backgroundColor: '#0A1A12',
    borderColor: '#1B4D2E',
    borderWidth: 1.2,
    borderRadius: 18,
  },
  whatsappContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 14,
  },
  whatsappIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#25D36620',
    borderWidth: 1.5,
    borderColor: '#25D36650',
    alignItems: 'center',
    justifyContent: 'center',
  },
  whatsappTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: THEME.textPrimary,
  },
  whatsappSub: {
    fontSize: 12,
    color: THEME.textSecondary,
    marginTop: 2,
    lineHeight: 16,
  },
  whatsappNumber: {
    fontSize: 14,
    fontWeight: '800',
    color: '#25D366',
    marginTop: 4,
    letterSpacing: 0.5,
  },
  whatsappButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#25D366',
    paddingVertical: 12,
    borderRadius: 12,
  },
  whatsappButtonText: {
    color: THEME.white,
    fontSize: 14,
    fontWeight: '800',
  },
  footerContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 8,
    paddingBottom: 24,
  },
  footerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: THEME.surfaceCard,
    borderWidth: 1,
    borderColor: THEME.surfaceBorder,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    marginBottom: 6,
  },
  footerText: {
    fontSize: 12,
    fontWeight: '600',
    color: THEME.textSecondary,
  },
  footerAuthor: {
    color: THEME.cyan,
    fontWeight: '900',
  },
  footerAuthorLink: {
    textDecorationLine: 'underline',
  },
  portfolioLinkWrap: {
    paddingVertical: 2,
    marginBottom: 4,
  },
  portfolioLinkText: {
    fontSize: 11,
    color: THEME.cyan,
    fontWeight: '700',
    opacity: 0.9,
  },
  portfolioIndicator: {
    color: THEME.cyan,
    fontWeight: '900',
    fontSize: 14,
  },
  footerSubText: {
    fontSize: 11,
    color: THEME.textTertiary,
    fontWeight: '500',
  },
});
