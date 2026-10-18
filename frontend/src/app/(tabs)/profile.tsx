import React, { useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  Image as RNImage,
  ActivityIndicator, 
  Alert 
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { 
  ShieldCheck, 
  LogOut, 
  GraduationCap, 
  ChevronRight,
  BookOpen,
  Camera,
  Lock,
  Calendar,
  Bookmark,
  Download,
  Send,
  Trash2,
  Megaphone,
} from 'lucide-react-native';
import { THEME } from '@/constants/theme';
import { Card } from '@/components/Card';
import { Header } from '@/components/Header';
import { Badge } from '@/components/Badge';
import { Input } from '@/components/Input';
import { Button } from '@/components/Button';
import { useStudyHub } from '@/store/StudyHubContext';
import { openPortfolio } from '@/constants/portfolio';

export default function ProfileScreen() {
  const router = useRouter();
  const { 
    currentUser, 
    isAdmin, 
    userBranch, 
    userYear, 
    uploadProfilePicture, 
    logout,
    bookmarks,
    downloadRecords,
    announcements,
    addAnnouncement,
    deleteAnnouncement,
  } = useStudyHub();
  const [uploading, setUploading] = useState(false);

  // Admin Notice Creation States
  const [noticeTitle, setNoticeTitle] = useState('');
  const [noticeDesc, setNoticeDesc] = useState('');
  const [noticePriority, setNoticePriority] = useState<'Normal' | 'High' | 'Urgent'>('High');
  const [broadcasting, setBroadcasting] = useState(false);

  const handlePickImage = async () => {
    if (!isAdmin) {
      Alert.alert(
        'Profile Picture Locked',
        'Profile pictures are managed by college administrators and cannot be changed by students.'
      );
      return;
    }

    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permissionResult.granted) {
        Alert.alert(
          'Permission Required',
          'Please allow access to your media library to choose a profile picture.'
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const selectedAsset = result.assets[0];
        setUploading(true);
        const success = await uploadProfilePicture(selectedAsset.uri);
        setUploading(false);
        if (success) {
          Alert.alert('Profile Picture Updated', 'Your profile picture has been saved successfully.');
        } else {
          Alert.alert('Upload Failed', 'Unable to update profile picture. Please try again.');
        }
      }
    } catch (err: any) {
      setUploading(false);
      Alert.alert('Error', err.message || 'Could not pick image.');
    }
  };

  const handleLogout = () => {
    Alert.alert('Sign Out', 'Are you sure you want to log out of Padhlo?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          await logout();
          router.replace('/auth/login');
        },
      },
    ]);
  };

  const handleBroadcastNotice = async () => {
    if (!noticeTitle.trim() || !noticeDesc.trim()) {
      Alert.alert('Missing Details', 'Please enter both a title and message for the notice.');
      return;
    }

    try {
      setBroadcasting(true);
      await addAnnouncement({
        title: noticeTitle.trim(),
        description: noticeDesc.trim(),
        category: 'Important',
        priority: noticePriority,
        branches: ['ALL'],
        years: ['ALL'],
        isPinned: true,
      });
      setNoticeTitle('');
      setNoticeDesc('');
      setBroadcasting(false);
      Alert.alert(
        'Notice Broadcasted! 📢',
        'Your notice has been sent to all enrolled students and pinned to the Home screen.'
      );
    } catch (err: any) {
      setBroadcasting(false);
      Alert.alert('Broadcast Error', err.message || 'Could not send notice.');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <Header
        title={isAdmin ? "Admin Profile" : "Student Profile"}
        subtitle={isAdmin ? "College administrator control & identity" : "Identity & academic details"}
      />

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* User Card with Profile Picture Picker */}
        <Card style={styles.profileCard} variant="glowPurple">
          <View style={styles.profileHeader}>
            <TouchableOpacity 
              activeOpacity={isAdmin ? 0.8 : 1} 
              onPress={isAdmin ? handlePickImage : () => {
                Alert.alert(
                  'Profile Picture Locked',
                  'Profile pictures are managed by college administrators and cannot be changed by students.'
                );
              }} 
              style={styles.avatarWrapper}
            >
              {currentUser?.profilePicture ? (
                <RNImage 
                  source={{ uri: currentUser.profilePicture }} 
                  style={styles.avatarImage} 
                />
              ) : (
                <View style={styles.avatarLarge}>
                  <Text style={styles.avatarText}>{currentUser?.avatar || 'ST'}</Text>
                </View>
              )}
              
              {isAdmin && (
                <View style={styles.cameraBadge}>
                  {uploading ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Camera size={13} color="#FFFFFF" />
                  )}
                </View>
              )}
            </TouchableOpacity>

            <View style={styles.profileDetails}>
              <TouchableOpacity 
                onPress={openPortfolio} 
                activeOpacity={0.7}
              >
                <Text style={styles.profileName} numberOfLines={1}>
                  {currentUser?.name || 'Student'} ↗
                </Text>
              </TouchableOpacity>
              <Text style={styles.profileEmail} numberOfLines={1}>{currentUser?.email}</Text>
              {currentUser?.mobile ? (
                <Text style={styles.profileSubMobile}>📱 {currentUser.mobile}</Text>
              ) : null}
              <View style={styles.badgeRow}>
                <Badge
                  label={currentUser?.role === 'ADMIN' ? 'COLLEGE ADMINISTRATOR' : `${userBranch} • ${userYear}`}
                  variant={currentUser?.role === 'ADMIN' ? 'purple' : 'cyan'}
                  size="sm"
                />
              </View>
              <TouchableOpacity onPress={handlePickImage} style={styles.changePhotoBtn}>
                <Text style={styles.changePhotoText}>Tap photo to change</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Card>

        {/* STUDY ACTIVITY & SAVED MATERIALS */}
        <Text style={styles.sectionHeading}>My Study Activity</Text>

        {/* Clean 2-Card Study Stats: Bookmarks & Offline Downloads */}
        <View style={styles.dashActionGrid}>
          <TouchableOpacity 
            activeOpacity={0.8} 
            onPress={() => router.push('/bookmarks')}
            style={styles.dashActionCol}
          >
            <Card style={styles.dashActionCard} variant="elevated">
              <View style={[styles.dashIconCircle, { backgroundColor: THEME.purpleMuted }]}>
                <Bookmark size={20} color={THEME.purple} />
              </View>
              <Text style={styles.dashActionValue}>{bookmarks.length}</Text>
              <Text style={styles.dashActionLabel}>Saved Notes</Text>
            </Card>
          </TouchableOpacity>

          <TouchableOpacity 
            activeOpacity={0.8} 
            onPress={() => router.push('/downloads')}
            style={styles.dashActionCol}
          >
            <Card style={styles.dashActionCard} variant="elevated">
              <View style={[styles.dashIconCircle, { backgroundColor: THEME.cyanMuted }]}>
                <Download size={20} color={THEME.cyan} />
              </View>
              <Text style={styles.dashActionValue}>{downloadRecords.length}</Text>
              <Text style={styles.dashActionLabel}>Offline Downloads</Text>
            </Card>
          </TouchableOpacity>
        </View>

        {/* Academic Enrollment (for Students) vs Administrative Privileges (for Admin) */}
        {!isAdmin ? (
          <>
            <Text style={styles.sectionHeading}>Academic Enrollment</Text>
            <Card style={styles.infoCard} variant="elevated">
              <View style={styles.lockedField}>
                <View style={styles.lockedFieldLeft}>
                  <GraduationCap size={18} color={THEME.purple} />
                  <View style={styles.lockedFieldTextCol}>
                    <Text style={styles.lockedFieldLabel}>Department / Branch</Text>
                    <Text style={styles.lockedFieldValue}>{userBranch}</Text>
                  </View>
                </View>
                <View style={styles.lockBadge}>
                  <Lock size={12} color={THEME.purple} />
                  <Text style={styles.lockBadgeText}>LOCKED</Text>
                </View>
              </View>

              <View style={styles.divider} />

              <View style={styles.lockedField}>
                <View style={styles.lockedFieldLeft}>
                  <Calendar size={18} color={THEME.cyan} />
                  <View style={styles.lockedFieldTextCol}>
                    <Text style={styles.lockedFieldLabel}>Academic Year</Text>
                    <Text style={styles.lockedFieldValue}>{userYear}</Text>
                  </View>
                </View>
                <View style={styles.lockBadge}>
                  <Lock size={12} color={THEME.cyan} />
                  <Text style={[styles.lockBadgeText, { color: THEME.cyan }]}>LOCKED</Text>
                </View>
              </View>

              <View style={styles.lockNoticeBox}>
                <Lock size={13} color={THEME.textTertiary} />
                <Text style={styles.lockNoticeText}>
                  Your branch and academic year were locked at registration and cannot be modified.
                </Text>
              </View>
            </Card>
          </>
        ) : (
          <>
            <Text style={styles.sectionHeading}>System Privileges</Text>
            <Card style={styles.infoCard} variant="elevated">
              <View style={styles.lockedField}>
                <View style={styles.lockedFieldLeft}>
                  <ShieldCheck size={18} color={THEME.purple} />
                  <View style={styles.lockedFieldTextCol}>
                    <Text style={styles.lockedFieldLabel}>Authority Level</Text>
                    <Text style={styles.lockedFieldValue}>Full College Administrator</Text>
                  </View>
                </View>
                <View style={styles.badgeWrapper}>
                  <Badge label="ACTIVE" variant="purple" size="sm" />
                </View>
              </View>

              <View style={styles.divider} />

              <View style={styles.lockedField}>
                <View style={styles.lockedFieldLeft}>
                  <BookOpen size={18} color={THEME.cyan} />
                  <View style={styles.lockedFieldTextCol}>
                    <Text style={styles.lockedFieldLabel}>Publishing Access</Text>
                    <Text style={styles.lockedFieldValue}>All Departments & All Years</Text>
                  </View>
                </View>
                <View style={styles.badgeWrapper}>
                  <Badge label="UNRESTRICTED" variant="cyan" size="sm" />
                </View>
              </View>
            </Card>
          </>
        )}

        {/* Admin Campus Notice Broadcasting */}
        {isAdmin && (
          <>
            <Text style={styles.sectionHeading}>Campus Notice Broadcaster</Text>
            <Card style={styles.noticeBroadcastCard} variant="glowPurple">
              <View style={styles.noticeBroadcastHeader}>
                <View style={styles.noticeIconCircle}>
                  <Megaphone size={20} color={THEME.purple} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.noticeBroadcastTitle}>Send Notice to All Students</Text>
                  <Text style={styles.noticeBroadcastSub}>
                    Broadcast official news pinned directly to student Home page
                  </Text>
                </View>
              </View>

              <Input
                label="Notice Title *"
                value={noticeTitle}
                onChangeText={setNoticeTitle}
                placeholder="e.g. Schedule Revision for ST 1 Examination"
              />

              <Input
                label="Notice Message *"
                value={noticeDesc}
                onChangeText={setNoticeDesc}
                placeholder="Important instructions, holiday notice, venue update..."
                multiline
                numberOfLines={3}
              />

              {/* Priority Selector */}
              <Text style={styles.priorityLabel}>Urgency Level</Text>
              <View style={styles.priorityRow}>
                {(['High', 'Urgent', 'Normal'] as const).map((p) => (
                  <TouchableOpacity
                    key={p}
                    onPress={() => setNoticePriority(p)}
                    style={[
                      styles.priorityPill,
                      noticePriority === p && styles.priorityPillActive,
                      noticePriority === p && p === 'Urgent' && styles.priorityPillUrgentActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.priorityPillText,
                        noticePriority === p && styles.priorityPillTextActive,
                      ]}
                    >
                      {p === 'Urgent' ? '🚨 Urgent' : p === 'High' ? '⭐ Important' : '📌 General'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Button
                title={broadcasting ? 'Broadcasting Notice...' : 'Send Notice to Everyone'}
                onPress={handleBroadcastNotice}
                variant="purple"
                loading={broadcasting}
                icon={<Send size={16} color={THEME.white} />}
                style={{ marginTop: 8 }}
              />
            </Card>

            {/* Active Notices List for Admin with Delete Action */}
            <Text style={styles.sectionHeading}>Currently Live Notices ({announcements.length})</Text>
            {announcements.length === 0 ? (
              <Card style={styles.noNoticesCard}>
                <Text style={styles.noNoticesText}>No active notices published yet.</Text>
              </Card>
            ) : (
              announcements.map((ann) => (
                <Card key={ann.id} style={styles.activeNoticeCard} variant="elevated">
                  <View style={styles.activeNoticeTopRow}>
                    <View style={styles.activeNoticeTagRow}>
                      <Badge
                        label={ann.priority || 'Important'}
                        variant={ann.priority === 'Urgent' ? 'red' : 'gold'}
                        size="sm"
                      />
                      <Text style={styles.activeNoticeDate}>
                        {new Date(ann.publishedAt).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                        })}
                      </Text>
                    </View>

                    <TouchableOpacity
                      onPress={() => {
                        Alert.alert(
                          'Delete Notice?',
                          `Are you sure you want to delete "${ann.title}"?`,
                          [
                            { text: 'Cancel', style: 'cancel' },
                            {
                              text: 'Delete Notice',
                              style: 'destructive',
                              onPress: async () => {
                                await deleteAnnouncement(ann.id);
                                Alert.alert('Deleted', 'Notice removed from all student feeds.');
                              },
                            },
                          ]
                        );
                      }}
                      style={styles.deleteNoticeBtn}
                      activeOpacity={0.7}
                    >
                      <Trash2 size={16} color={THEME.red} />
                    </TouchableOpacity>
                  </View>

                  <Text style={styles.activeNoticeTitle}>{ann.title}</Text>
                  <Text style={styles.activeNoticeDesc}>{ann.description}</Text>
                </Card>
              ))
            )}
          </>
        )}

        {/* Admin Shortcut if Admin */}
        {isAdmin && (
          <>
            <Text style={styles.sectionHeading}>Administration</Text>
            <TouchableOpacity 
              activeOpacity={0.8}
              onPress={() => router.push('/admin/dashboard')}
              style={styles.adminCardWrap}
            >
              <Card style={styles.adminCard} variant="glowBlue">
                <View style={styles.adminCardLeft}>
                  <ShieldCheck size={22} color={THEME.blue} />
                  <View>
                    <Text style={styles.adminCardTitle}>Admin Control Panel</Text>
                    <Text style={styles.adminCardSub}>Upload PDFs, short notes & manage exams</Text>
                  </View>
                </View>
                <ChevronRight size={18} color={THEME.blue} />
              </Card>
            </TouchableOpacity>
          </>
        )}

        {/* Session Logout */}
        <Text style={styles.sectionHeading}>Account</Text>
        <Card style={styles.infoCard} variant="elevated">
          <TouchableOpacity 
            style={styles.logoutRow}
            onPress={handleLogout}
            activeOpacity={0.8}
          >
            <LogOut size={18} color={THEME.red} />
            <Text style={styles.logoutText}>Sign Out from Padhlo</Text>
          </TouchableOpacity>
        </Card>

        <TouchableOpacity onPress={openPortfolio} activeOpacity={0.7} style={styles.footerNoteWrap}>
          <Text style={styles.footerNote}>Padhlo Android Edition • Designed & Built by <Text style={{ color: THEME.cyan, fontWeight: '700' }}>Vinay ↗</Text></Text>
        </TouchableOpacity>
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
  noticeBroadcastCard: {
    padding: 18,
    marginBottom: 20,
    borderRadius: 18,
  },
  noticeBroadcastHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 14,
  },
  noticeIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: THEME.purpleMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noticeBroadcastTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: THEME.textPrimary,
  },
  noticeBroadcastSub: {
    fontSize: 12,
    color: THEME.textSecondary,
    marginTop: 2,
    lineHeight: 16,
  },
  priorityLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: THEME.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
    marginTop: 4,
  },
  priorityRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  priorityPill: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: THEME.surfaceCard,
    borderWidth: 1,
    borderColor: THEME.surfaceBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  priorityPillActive: {
    backgroundColor: THEME.purpleMuted,
    borderColor: THEME.purple,
  },
  priorityPillUrgentActive: {
    backgroundColor: THEME.redMuted,
    borderColor: THEME.red,
  },
  priorityPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: THEME.textSecondary,
  },
  priorityPillTextActive: {
    color: THEME.white,
  },
  noNoticesCard: {
    padding: 16,
    alignItems: 'center',
    marginBottom: 16,
  },
  noNoticesText: {
    fontSize: 12,
    color: THEME.textSecondary,
  },
  activeNoticeCard: {
    padding: 16,
    marginBottom: 12,
    borderRadius: 16,
  },
  activeNoticeTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  activeNoticeTagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  activeNoticeDate: {
    fontSize: 11,
    color: THEME.textTertiary,
    fontWeight: '600',
  },
  deleteNoticeBtn: {
    padding: 6,
    backgroundColor: THEME.redMuted,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: THEME.red + '40',
  },
  activeNoticeTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: THEME.textPrimary,
    marginBottom: 4,
  },
  activeNoticeDesc: {
    fontSize: 12,
    color: THEME.textSecondary,
    lineHeight: 18,
  },
  profileCard: {
    padding: 20,
    marginBottom: 20,
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  avatarLarge: {
    width: 64,
    height: 64,
    borderRadius: 24,
    backgroundColor: THEME.surfaceElevated,
    borderWidth: 2,
    borderColor: THEME.purple,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 22,
    fontWeight: '900',
    color: THEME.textPrimary,
  },
  profileDetails: {
    flex: 1,
  },
  profileName: {
    fontSize: 18,
    fontWeight: '900',
    color: THEME.textPrimary,
  },
  profileEmail: {
    fontSize: 12,
    color: THEME.textSecondary,
    marginTop: 2,
    marginBottom: 4,
  },
  profileSubMobile: {
    fontSize: 11,
    color: THEME.cyan,
    marginBottom: 6,
    fontWeight: '600',
  },
  badgeRow: {
    flexDirection: 'row',
  },
  adminCardWrap: {
    marginBottom: 20,
  },
  adminCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  adminCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  adminCardTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: THEME.textPrimary,
  },
  adminCardSub: {
    fontSize: 11,
    color: THEME.textSecondary,
    marginTop: 2,
  },
  sectionHeading: {
    fontSize: 13,
    fontWeight: '800',
    color: THEME.textSecondary,
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  infoCard: {
    padding: 16,
    marginBottom: 20,
  },
  avatarWrapper: {
    position: 'relative',
  },
  avatarImage: {
    width: 68,
    height: 68,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: THEME.purple,
    backgroundColor: THEME.surfaceElevated,
  },
  cameraBadge: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    backgroundColor: THEME.purple,
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: THEME.background,
    shadowColor: THEME.purple,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 4,
    elevation: 4,
  },
  changePhotoBtn: {
    marginTop: 6,
  },
  changePhotoText: {
    fontSize: 11,
    color: THEME.purple,
    fontWeight: '700',
  },
  lockedField: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    gap: 10,
    flexWrap: 'wrap',
  },
  lockedFieldLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
    minWidth: 160,
  },
  lockedFieldTextCol: {
    flex: 1,
  },
  lockedFieldLabel: {
    fontSize: 11,
    color: THEME.textTertiary,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  lockedFieldValue: {
    fontSize: 13,
    fontWeight: '800',
    color: THEME.textPrimary,
    marginTop: 2,
  },
  badgeWrapper: {
    flexShrink: 0,
    alignSelf: 'center',
  },
  lockBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: THEME.surfaceElevated,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: THEME.surfaceBorder,
  },
  lockBadgeText: {
    fontSize: 10,
    fontWeight: '900',
    color: THEME.purple,
    letterSpacing: 0.5,
  },
  lockNoticeBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: THEME.surfaceElevated,
    padding: 10,
    borderRadius: 8,
    marginTop: 8,
    borderWidth: 1,
    borderColor: THEME.surfaceBorder,
  },
  lockNoticeText: {
    flex: 1,
    fontSize: 11,
    color: THEME.textTertiary,
    lineHeight: 16,
  },
  navRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
  },
  navRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  navRowText: {
    fontSize: 14,
    fontWeight: '700',
    color: THEME.textPrimary,
  },
  divider: {
    height: 1,
    backgroundColor: THEME.surfaceBorder,
    marginVertical: 4,
  },
  logoutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 4,
  },
  logoutText: {
    fontSize: 14,
    fontWeight: '800',
    color: THEME.red,
  },
  continueCard: {
    padding: 16,
    borderRadius: 16,
    marginBottom: 14,
  },
  continueHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  continueTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  continueTagText: {
    fontSize: 10,
    fontWeight: '900',
    color: THEME.purple,
    letterSpacing: 0.8,
  },
  continuePage: {
    fontSize: 11,
    color: THEME.cyan,
    fontWeight: '700',
  },
  continueTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: THEME.textPrimary,
    marginBottom: 4,
  },
  continueSub: {
    fontSize: 11,
    color: THEME.textSecondary,
    marginBottom: 12,
  },
  resumeBtn: {
    backgroundColor: THEME.purple,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 10,
    alignSelf: 'flex-start',
  },
  resumeBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  dashboardSummaryCard: {
    padding: 16,
    borderRadius: 16,
    marginBottom: 14,
  },
  dashPromptRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  dashPromptTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: THEME.textPrimary,
  },
  dashPromptSub: {
    fontSize: 11,
    color: THEME.textTertiary,
    marginTop: 2,
    lineHeight: 16,
  },
  dashActionGrid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  dashActionCol: {
    flex: 1,
  },
  dashActionCard: {
    padding: 16,
    borderRadius: 14,
    alignItems: 'center',
  },
  dashIconCircle: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  dashActionValue: {
    fontSize: 18,
    fontWeight: '900',
    color: THEME.textPrimary,
  },
  dashActionLabel: {
    fontSize: 11,
    color: THEME.textTertiary,
    marginTop: 2,
    fontWeight: '700',
  },
  portfolioBadgeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: THEME.cyanMuted,
    borderWidth: 1,
    borderColor: THEME.cyan + '60',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    marginTop: 6,
    alignSelf: 'flex-start',
  },
  portfolioBadgeText: {
    fontSize: 11,
    color: THEME.cyan,
    fontWeight: '800',
  },
  portfolioRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
  },
  portfolioRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  portfolioIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: THEME.cyanMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  portfolioRowTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: THEME.textPrimary,
  },
  portfolioRowSub: {
    fontSize: 11,
    color: THEME.cyan,
    fontWeight: '600',
    marginTop: 1,
  },
  footerNoteWrap: {
    marginTop: 10,
    alignItems: 'center',
  },
  footerNote: {
    textAlign: 'center',
    fontSize: 12,
    color: THEME.textTertiary,
  },
});
