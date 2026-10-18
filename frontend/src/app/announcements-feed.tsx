import React, { useState, useMemo } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  Modal,
  TextInput,
  RefreshControl
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { 
  ArrowLeft, 
  Pin, 
  CheckCheck, 
  X, 
  Search, 
  Calendar,
  Layers
} from 'lucide-react-native';
import { THEME } from '@/constants/theme';
import { Card } from '@/components/Card';
import { Header } from '@/components/Header';
import { Badge } from '@/components/Badge';
import { EmptyState } from '@/components/EmptyState';
import { useStudyHub } from '@/store/StudyHubContext';
import { AnnouncementItem } from '@/types';

type CategoryFilter = 'ALL' | 'Important' | 'Exams' | 'Academic' | 'General';

export default function AnnouncementsFeedScreen() {
  const router = useRouter();
  const { announcements, userBranch, userYear, markAnnouncementAsRead, isContentAccessible, refreshAnnouncements } = useStudyHub();

  const [activeCategory, setActiveCategory] = useState<CategoryFilter>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAnnouncement, setSelectedAnnouncement] = useState<AnnouncementItem | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await refreshAnnouncements();
    } catch {}
    setRefreshing(false);
  };

  // Filter announcements for this student's branch & year
  const accessibleAnnouncements = useMemo(() => {
    return announcements
      .filter((a) => isContentAccessible(a.branches, a.years))
      .sort((a, b) => {
        // Pinned notices first, then newest
        if (a.isPinned && !b.isPinned) return -1;
        if (!a.isPinned && b.isPinned) return 1;
        return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime();
      });
  }, [announcements, isContentAccessible]);

  // Compute counts for filter pills
  const counts = useMemo(() => {
    return {
      ALL: accessibleAnnouncements.length,
      Important: accessibleAnnouncements.filter(a => a.priority === 'Urgent' || a.priority === 'High' || a.category === 'Important').length,
      Exams: accessibleAnnouncements.filter(a => a.category === 'Exams').length,
      Academic: accessibleAnnouncements.filter(a => a.category === 'Academic').length,
      General: accessibleAnnouncements.filter(a => a.category === 'General').length,
    };
  }, [accessibleAnnouncements]);

  const unreadCount = useMemo(() => {
    return accessibleAnnouncements.filter(a => !a.isRead).length;
  }, [accessibleAnnouncements]);

  // Filter by category & search query
  const filtered = useMemo(() => {
    return accessibleAnnouncements.filter((a) => {
      // Category filter
      let matchesCat = true;
      if (activeCategory === 'Important') {
        matchesCat = a.priority === 'Urgent' || a.priority === 'High' || a.category === 'Important';
      } else if (activeCategory !== 'ALL') {
        matchesCat = a.category === activeCategory;
      }

      // Search query filter
      if (!matchesCat) return false;
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        a.title.toLowerCase().includes(q) ||
        a.description.toLowerCase().includes(q) ||
        (a.category && a.category.toLowerCase().includes(q))
      );
    });
  }, [accessibleAnnouncements, activeCategory, searchQuery]);

  const handleOpenAnnouncement = async (item: AnnouncementItem) => {
    setSelectedAnnouncement(item);
    if (!item.isRead) {
      await markAnnouncementAsRead(item.id);
    }
  };

  const handleMarkAllRead = async () => {
    const unread = accessibleAnnouncements.filter(a => !a.isRead);
    for (const item of unread) {
      await markAnnouncementAsRead(item.id);
    }
  };

  const getPriorityBadge = (priority?: string) => {
    if (priority === 'Urgent') return <Badge label="URGENT" variant="red" size="sm" />;
    if (priority === 'High') return <Badge label="IMPORTANT" variant="gold" size="sm" />;
    return <Badge label="NOTICE" variant="purple" size="sm" />;
  };

  return (
    <SafeAreaView style={styles.container}>
      <Header
        title="Campus Notices"
        subtitle={`Official updates for ${userBranch} • ${userYear}`}
      />

      {/* Top Navigation Row: Back button & Unread count / Mark All Read */}
      <View style={styles.topBarRow}>
        <TouchableOpacity 
          activeOpacity={0.7}
          onPress={() => {
            if (router.canGoBack()) {
              router.back();
            } else {
              router.replace('/(tabs)');
            }
          }} 
          style={styles.backBtn}
        >
          <ArrowLeft size={16} color={THEME.textSecondary} />
          <Text style={styles.backText}>Back to Home</Text>
        </TouchableOpacity>

        {unreadCount > 0 && (
          <TouchableOpacity 
            activeOpacity={0.7}
            onPress={handleMarkAllRead}
            style={styles.markAllBtn}
          >
            <CheckCheck size={14} color={THEME.cyan} />
            <Text style={styles.markAllText}>Mark all read ({unreadCount})</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Search Input */}
      <View style={styles.searchBoxWrap}>
        <View style={styles.searchContainer}>
          <Search size={16} color={THEME.textTertiary} />
          <TextInput
            style={styles.searchInput}
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search notices, exams, updates..."
            placeholderTextColor={THEME.textTertiary}
            clearButtonMode="while-editing"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <X size={16} color={THEME.textTertiary} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Fixed-Height Horizontal Filter Tabs */}
      <View style={styles.filterSection}>
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false} 
          contentContainerStyle={styles.filterScroll}
        >
          {[
            { key: 'ALL', label: `All (${counts.ALL})` },
            { key: 'Important', label: `⭐ Important (${counts.Important})` },
            { key: 'Exams', label: `📝 Exams (${counts.Exams})` },
            { key: 'Academic', label: `🎓 Academic (${counts.Academic})` },
            { key: 'General', label: `📌 General (${counts.General})` },
          ].map((f) => {
            const isActive = activeCategory === f.key;
            return (
              <TouchableOpacity
                key={f.key}
                activeOpacity={0.8}
                onPress={() => setActiveCategory(f.key as CategoryFilter)}
                style={[
                  styles.filterPill,
                  isActive && styles.filterPillActive,
                ]}
              >
                <Text
                  style={[
                    styles.filterPillText,
                    isActive && styles.filterPillTextActive,
                  ]}
                >
                  {f.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Notices List */}
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
        {filtered.length === 0 ? (
          <EmptyState
            title="No notices found"
            description={
              searchQuery.trim()
                ? `No announcements match "${searchQuery}". Try different keywords.`
                : `There are no notices for ${userBranch} (${userYear}) in this category.`
            }
          />
        ) : (
          filtered.map((item) => (
            <Card
              key={item.id}
              style={[
                styles.annCard,
                item.isPinned && styles.pinnedCard,
                !item.isRead && styles.unreadCard,
              ]}
              variant="elevated"
            >
              <TouchableOpacity
                activeOpacity={0.75}
                onPress={() => handleOpenAnnouncement(item)}
              >
                {/* Card Top Row: Badges & Published Date */}
                <View style={styles.cardTopRow}>
                  <View style={styles.badgeWrap}>
                    {getPriorityBadge(item.priority)}
                    {item.isPinned && (
                      <View style={styles.pinBadge}>
                        <Pin size={11} color={THEME.cyan} />
                        <Text style={styles.pinText}>PINNED</Text>
                      </View>
                    )}
                    {!item.isRead && (
                      <View style={styles.newBadge}>
                        <Text style={styles.newBadgeText}>NEW</Text>
                      </View>
                    )}
                  </View>

                  <Text style={styles.dateText}>
                    {new Date(item.publishedAt).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </Text>
                </View>

                {/* Notice Title */}
                <Text style={styles.annTitle}>{item.title}</Text>

                {/* Description Snippet */}
                <Text style={styles.annSnippet} numberOfLines={3}>
                  {item.description}
                </Text>

                {/* Target Audience Tag Row */}
                <View style={styles.metaRow}>
                  <View style={styles.branchYearTag}>
                    <Layers size={11} color={THEME.textTertiary} />
                    <Text style={styles.branchYearText}>
                      {item.branches?.includes('ALL') ? 'All Departments' : item.branches?.join(', ')} • {item.years?.includes('ALL') ? 'All Years' : item.years?.join(', ')}
                    </Text>
                  </View>
                </View>

                {/* Bottom Read Footer */}
                <View style={styles.cardFooter}>
                  <Text style={styles.readMoreText}>Tap to read full notice →</Text>
                  {item.isRead ? (
                    <View style={styles.readCheck}>
                      <CheckCheck size={14} color={THEME.textTertiary} />
                      <Text style={styles.readCheckText}>Read</Text>
                    </View>
                  ) : (
                    <View style={styles.unreadIndicatorRow}>
                      <View style={styles.unreadDot} />
                      <Text style={styles.unreadIndicatorText}>Unread</Text>
                    </View>
                  )}
                </View>
              </TouchableOpacity>
            </Card>
          ))
        )}
      </ScrollView>

      {/* Full Notice Details Modal */}
      <Modal
        visible={!!selectedAnnouncement}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedAnnouncement(null)}
      >
        <View style={styles.modalOverlay}>
          <Card style={styles.modalCard} variant="elevated">
            <View style={styles.modalHeader}>
              <View style={styles.badgeWrap}>
                {getPriorityBadge(selectedAnnouncement?.priority)}
                <Badge label={selectedAnnouncement?.category || 'General'} variant="cyan" size="sm" />
                {selectedAnnouncement?.isPinned && (
                  <View style={styles.pinBadge}>
                    <Pin size={11} color={THEME.cyan} />
                    <Text style={styles.pinText}>PINNED</Text>
                  </View>
                )}
              </View>
              <TouchableOpacity 
                onPress={() => setSelectedAnnouncement(null)} 
                style={styles.closeBtn}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <X size={20} color={THEME.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={styles.modalBody}>
              <Text style={styles.modalTitle}>{selectedAnnouncement?.title}</Text>
              
              <View style={styles.modalMetaRow}>
                <View style={styles.modalMetaItem}>
                  <Calendar size={13} color={THEME.textTertiary} />
                  <Text style={styles.modalDate}>
                    {selectedAnnouncement 
                      ? new Date(selectedAnnouncement.publishedAt).toLocaleDateString('en-US', {
                          weekday: 'short',
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                        })
                      : ''}
                  </Text>
                </View>

                <View style={styles.modalMetaItem}>
                  <Layers size={13} color={THEME.textTertiary} />
                  <Text style={styles.modalAudience}>
                    {selectedAnnouncement?.branches?.includes('ALL') 
                      ? 'All Students' 
                      : selectedAnnouncement?.branches?.join(', ')}
                  </Text>
                </View>
              </View>

              <View style={styles.modalDivider} />

              <Text style={styles.modalDescription}>
                {selectedAnnouncement?.description}
              </Text>
            </ScrollView>

            {/* Quick Cross-Screen Links */}
            <View style={styles.modalQuickLinks}>
              <TouchableOpacity
                onPress={() => {
                  setSelectedAnnouncement(null);
                  router.push('/(tabs)/notes');
                }}
                style={styles.modalQuickLinkBtn}
              >
                <Text style={styles.modalQuickLinkText}>Go to Notes →</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => {
                  setSelectedAnnouncement(null);
                  router.push('/(tabs)/exams');
                }}
                style={styles.modalQuickLinkBtn}
              >
                <Text style={styles.modalQuickLinkText}>Exam Timetable →</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => {
                  setSelectedAnnouncement(null);
                  router.push('/(tabs)/ai-assistant');
                }}
                style={[styles.modalQuickLinkBtn, { borderColor: THEME.purple + '50' }]}
              >
                <Text style={[styles.modalQuickLinkText, { color: THEME.purple }]}>Vinay AI →</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => setSelectedAnnouncement(null)}
              style={styles.dismissBtn}
            >
              <Text style={styles.dismissBtnText}>Close Notice</Text>
            </TouchableOpacity>
          </Card>
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
  topBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 4,
  },
  backText: {
    fontSize: 13,
    color: THEME.textSecondary,
    fontWeight: '600',
  },
  markAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: THEME.cyanMuted,
  },
  markAllText: {
    fontSize: 12,
    color: THEME.cyan,
    fontWeight: '700',
  },
  searchBoxWrap: {
    paddingHorizontal: 20,
    marginBottom: 8,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.surfaceCard,
    borderWidth: 1,
    borderColor: THEME.surfaceBorder,
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 42,
    gap: 10,
  },
  searchInput: {
    flex: 1,
    color: THEME.textPrimary,
    fontSize: 13,
    padding: 0,
  },
  filterSection: {
    height: 44,
    marginBottom: 10,
  },
  filterScroll: {
    paddingHorizontal: 20,
    alignItems: 'center',
    gap: 8,
  },
  filterPill: {
    height: 34,
    paddingHorizontal: 14,
    borderRadius: 17,
    backgroundColor: THEME.surfaceCard,
    borderWidth: 1,
    borderColor: THEME.surfaceBorder,
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterPillActive: {
    backgroundColor: THEME.purpleMuted,
    borderColor: THEME.purple,
  },
  filterPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: THEME.textSecondary,
  },
  filterPillTextActive: {
    color: THEME.purple,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 48,
    gap: 12,
  },
  annCard: {
    padding: 16,
    borderRadius: 16,
  },
  pinnedCard: {
    borderLeftWidth: 3,
    borderLeftColor: THEME.cyan,
  },
  unreadCard: {
    borderTopWidth: 1.5,
    borderTopColor: THEME.purple,
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  badgeWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  pinBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: THEME.cyanMuted,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  pinText: {
    fontSize: 9,
    fontWeight: '900',
    color: THEME.cyan,
  },
  newBadge: {
    backgroundColor: THEME.purple,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  newBadgeText: {
    fontSize: 9,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  dateText: {
    fontSize: 11,
    color: THEME.textTertiary,
  },
  annTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: THEME.textPrimary,
    lineHeight: 22,
    marginBottom: 6,
  },
  annSnippet: {
    fontSize: 13,
    color: THEME.textSecondary,
    lineHeight: 19,
    marginBottom: 10,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  branchYearTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: THEME.surfaceBorder + '50',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  branchYearText: {
    fontSize: 11,
    color: THEME.textTertiary,
    fontWeight: '500',
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: THEME.surfaceBorder + '40',
    paddingTop: 10,
  },
  readMoreText: {
    fontSize: 12,
    color: THEME.purple,
    fontWeight: '700',
  },
  readCheck: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  readCheckText: {
    fontSize: 11,
    color: THEME.textTertiary,
  },
  unreadIndicatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  unreadDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: THEME.purple,
  },
  unreadIndicatorText: {
    fontSize: 11,
    color: THEME.purple,
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: {
    backgroundColor: THEME.surfaceCard,
    borderRadius: 20,
    padding: 20,
    maxHeight: '82%',
    borderWidth: 1.5,
    borderColor: THEME.purple,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  closeBtn: {
    padding: 4,
  },
  modalBody: {
    marginVertical: 4,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: THEME.textPrimary,
    lineHeight: 25,
    marginBottom: 8,
  },
  modalMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginBottom: 12,
  },
  modalMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  modalDate: {
    fontSize: 12,
    color: THEME.textTertiary,
  },
  modalAudience: {
    fontSize: 12,
    color: THEME.textTertiary,
  },
  modalDivider: {
    height: 1,
    backgroundColor: THEME.surfaceBorder,
    marginBottom: 14,
  },
  modalDescription: {
    fontSize: 14,
    color: THEME.textSecondary,
    lineHeight: 22,
  },
  modalQuickLinks: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 14,
  },
  modalQuickLinkBtn: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderRadius: 8,
    backgroundColor: THEME.surfaceElevated,
    borderWidth: 1,
    borderColor: THEME.surfaceBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalQuickLinkText: {
    fontSize: 11,
    fontWeight: '700',
    color: THEME.cyan,
  },
  dismissBtn: {
    backgroundColor: THEME.purple,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 16,
  },
  dismissBtnText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 14,
  },
});
