import React, { useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  TextInput,
  Alert 
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { 
  ArrowLeft, 
  Bookmark, 
  FileText, 
  Image as ImageIcon, 
  CalendarCheck2, 
  BookOpen, 
  Trash2, 
  Search,
  Sparkles
} from 'lucide-react-native';
import { THEME } from '@/constants/theme';
import { Card } from '@/components/Card';
import { Header } from '@/components/Header';
import { Badge } from '@/components/Badge';
import { EmptyState } from '@/components/EmptyState';
import { useStudyHub } from '@/store/StudyHubContext';
import { BookmarkItem } from '@/types';

type FilterType = 'ALL' | 'NOTE' | 'SHORT_NOTE' | 'SYLLABUS' | 'EXAM';

export default function BookmarksScreen() {
  const router = useRouter();
  const { bookmarks, removeBookmark } = useStudyHub();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<FilterType>('ALL');

  const filteredBookmarks = bookmarks.filter((b) => {
    const matchesFilter = activeFilter === 'ALL' || b.resourceType === activeFilter;
    const matchesSearch = 
      b.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (b.subject && b.subject.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesFilter && matchesSearch;
  });

  const handleOpenResource = async (item: BookmarkItem) => {
    if (item.resourceType === 'NOTE') {
      router.push({
        pathname: '/pdf-viewer',
        params: {
          id: item.resourceId,
          fileUrl: item.metadata?.fileUrl || '',
          title: item.title,
          fileName: item.metadata?.fileName || `${item.title}.pdf`,
          subject: item.subject || 'Engineering Subject',
        },
      });
    } else if (item.resourceType === 'SHORT_NOTE') {
      router.push('/(tabs)/notes');
    } else if (item.resourceType === 'SYLLABUS') {
      router.push('/(tabs)/syllabus');
    } else if (item.resourceType === 'EXAM') {
      router.push('/(tabs)/exams');
    }
  };

  const handleRemove = async (resourceId: string, title: string) => {
    Alert.alert('Remove Bookmark', `Remove "${title}" from your saved materials?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          await removeBookmark(resourceId);
        },
      },
    ]);
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'NOTE':
        return <FileText size={18} color={THEME.purple} />;
      case 'SHORT_NOTE':
        return <ImageIcon size={18} color={THEME.cyan} />;
      case 'SYLLABUS':
        return <BookOpen size={18} color={THEME.blue} />;
      case 'EXAM':
        return <CalendarCheck2 size={18} color={THEME.gold} />;
      default:
        return <Bookmark size={18} color={THEME.purple} />;
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'NOTE':
        return 'PDF Note';
      case 'SHORT_NOTE':
        return 'Visual Sheet';
      case 'SYLLABUS':
        return 'Syllabus';
      case 'EXAM':
        return 'Exam Schedule';
      default:
        return 'Saved';
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <Header
        title="Saved Materials"
        subtitle="Bookmarked lecture notes, sheets & syllabus"
      />

      <TouchableOpacity 
        onPress={() => {
          if (router.canGoBack()) {
            router.back();
          } else {
            router.replace('/(tabs)/profile');
          }
        }} 
        style={styles.backBtn}
      >
        <ArrowLeft size={18} color={THEME.textSecondary} />
        <Text style={styles.backText}>Back to Profile</Text>
      </TouchableOpacity>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <Search size={18} color={THEME.textTertiary} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search saved resources..."
          placeholderTextColor={THEME.textTertiary}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      {/* Filter Tabs */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
        {[
          { key: 'ALL', label: 'All Items' },
          { key: 'NOTE', label: 'PDF Notes' },
          { key: 'SHORT_NOTE', label: 'Short Notes' },
          { key: 'SYLLABUS', label: 'Syllabus' },
          { key: 'EXAM', label: 'Exams' },
        ].map((f) => (
          <TouchableOpacity
            key={f.key}
            onPress={() => setActiveFilter(f.key as FilterType)}
            style={[
              styles.filterPill,
              activeFilter === f.key && styles.filterPillActive,
            ]}
          >
            <Text
              style={[
                styles.filterPillText,
                activeFilter === f.key && styles.filterPillTextActive,
              ]}
            >
              {f.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Bookmarks List */}
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {filteredBookmarks.length === 0 ? (
          <EmptyState
            title="Nothing saved yet"
            description={
              searchQuery
                ? 'No saved materials match your search.'
                : 'Bookmark any note, formula sheet, or syllabus topic to find it quickly here.'
            }
          />
        ) : (
          filteredBookmarks.map((item) => (
            <Card key={item.id} style={styles.bookmarkCard} variant="elevated">
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => handleOpenResource(item)}
                style={styles.cardMain}
              >
                <View style={styles.iconCircle}>
                  {getTypeIcon(item.resourceType)}
                </View>

                <View style={styles.cardDetails}>
                  <View style={styles.badgeRow}>
                    <Badge label={getTypeLabel(item.resourceType)} variant="purple" size="sm" />
                    {item.subject ? (
                      <Text style={styles.subjectText} numberOfLines={1}>
                        {item.subject}
                      </Text>
                    ) : null}
                  </View>
                  <Text style={styles.cardTitle} numberOfLines={2}>
                    {item.title}
                  </Text>
                  <Text style={styles.dateSavedText}>
                    Saved {new Date(item.savedAt).toLocaleDateString()}
                  </Text>
                </View>
              </TouchableOpacity>

              <View style={styles.cardRightActions}>
                {item.resourceType === 'NOTE' && (
                  <TouchableOpacity
                    onPress={() => {
                      router.push({
                        pathname: '/(tabs)/ai-assistant',
                        params: {
                          noteId: item.resourceId,
                          noteTitle: item.title,
                          initialPrompt: 'make 7 question proper',
                        },
                      });
                    }}
                    style={styles.aiBookmarkBtn}
                    activeOpacity={0.7}
                  >
                    <Sparkles size={16} color={THEME.purple} />
                  </TouchableOpacity>
                )}

                <TouchableOpacity
                  onPress={() => handleRemove(item.resourceId, item.title)}
                  style={styles.removeBtn}
                  activeOpacity={0.7}
                >
                  <Trash2 size={17} color={THEME.red} />
                </TouchableOpacity>
              </View>
            </Card>
          ))
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
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  backText: {
    fontSize: 13,
    color: THEME.textSecondary,
    fontWeight: '700',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.surfaceCard,
    borderRadius: 14,
    marginHorizontal: 20,
    marginTop: 4,
    marginBottom: 12,
    paddingHorizontal: 14,
    height: 48,
    borderWidth: 1,
    borderColor: THEME.surfaceBorder,
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    color: THEME.textPrimary,
    fontSize: 14,
    fontWeight: '600',
  },
  filterScroll: {
    paddingHorizontal: 20,
    paddingBottom: 14,
    gap: 8,
  },
  filterPill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: THEME.surfaceCard,
    borderWidth: 1,
    borderColor: THEME.surfaceBorder,
    marginRight: 8,
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
    paddingBottom: 40,
    gap: 12,
  },
  bookmarkCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 16,
    marginBottom: 8,
  },
  cardMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: THEME.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: THEME.surfaceBorder,
  },
  cardDetails: {
    flex: 1,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  subjectText: {
    fontSize: 11,
    color: THEME.textTertiary,
    fontWeight: '600',
    flex: 1,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: THEME.textPrimary,
    lineHeight: 18,
  },
  dateSavedText: {
    fontSize: 10,
    color: THEME.textTertiary,
    marginTop: 4,
  },
  cardRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginLeft: 6,
  },
  aiBookmarkBtn: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: THEME.purpleMuted,
    borderWidth: 1,
    borderColor: THEME.purple + '40',
  },
  removeBtn: {
    padding: 8,
  },
});
