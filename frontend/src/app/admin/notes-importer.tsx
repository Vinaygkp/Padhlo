import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
  ArrowLeft,
  Search,
  DownloadCloud,
  CheckSquare,
  Square,
  ExternalLink,
  Upload,
  CheckCircle,
  RefreshCw,
  BookOpen,
} from 'lucide-react-native';
import { THEME } from '@/constants/theme';
import { Card } from '@/components/Card';
import { Header } from '@/components/Header';
import { Badge } from '@/components/Badge';
import { Button } from '@/components/Button';
import { useStudyHub } from '@/store/StudyHubContext';
import { DiscoveredResource } from '@/types';

const RESOURCE_TYPES = ['Notes', 'Short Notes', 'PYQ', 'Question Bank', 'Practical File', 'Syllabus', 'Quantum'] as const;
const SEMESTERS = [1, 2, 3, 4, 5, 6, 7, 8] as const;

export default function AdminNotesImporterScreen() {
  const router = useRouter();
  const { isAdmin, inspectNotesSource, bulkImportNotes, refreshNotes } = useStudyHub();

  const [sourceUrl, setSourceUrl] = useState('https://notesgallery.com/aktu-notes/');
  const [inspecting, setInspecting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [items, setItems] = useState<DiscoveredResource[]>([]);
  const [overwriteDuplicates, setOverwriteDuplicates] = useState(false);

  // Filters
  const [filterSemester, setFilterSemester] = useState<number | 'All'>('All');
  const [filterType, setFilterType] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState('');

  // Results state
  const [lastResult, setLastResult] = useState<{
    importedCount: number;
    skippedCount: number;
    failedCount: number;
  } | null>(null);

  const handleInspect = useCallback(async () => {
    if (!sourceUrl.trim()) {
      Alert.alert('Source URL Required', 'Please enter a valid notes reference URL.');
      return;
    }

    try {
      setInspecting(true);
      setLastResult(null);
      const res = await inspectNotesSource(sourceUrl.trim());
      setInspecting(false);

      if (res.success && Array.isArray(res.resources)) {
        // By default, select items that are not already duplicates
        const formatted: DiscoveredResource[] = res.resources.map((r: any) => ({
          ...r,
          course: 'B.Tech',
          selected: !r.isDuplicate,
        }));
        setItems(formatted);
      } else {
        Alert.alert('Inspection Failed', res.message || 'Could not fetch resources from source.');
      }
    } catch (err: any) {
      setInspecting(false);
      Alert.alert('Inspection Error', err.message || 'Unable to reach backend.');
    }
  }, [sourceUrl, inspectNotesSource]);



  const toggleSelectAll = () => {
    const allSelected = displayedItems.every((it) => it.selected);
    const updated = items.map((it) => {
      if (displayedItems.some((d) => d.sourceId === it.sourceId || (d.sourceUrl === it.sourceUrl && d.title === it.title))) {
        return { ...it, selected: !allSelected };
      }
      return it;
    });
    setItems(updated);
  };

  const toggleItemSelect = (index: number) => {
    const target = displayedItems[index];
    const updated = items.map((it) => {
      if (it.sourceId === target.sourceId && it.sourceUrl === target.sourceUrl) {
        return { ...it, selected: !it.selected };
      }
      return it;
    });
    setItems(updated);
  };

  const updateItemField = (index: number, field: keyof DiscoveredResource, value: any) => {
    const target = displayedItems[index];
    const updated = items.map((it) => {
      if (it.sourceId === target.sourceId && it.sourceUrl === target.sourceUrl) {
        return { ...it, [field]: value };
      }
      return it;
    });
    setItems(updated);
  };

  const handleBulkImport = async () => {
    const selectedItems = items.filter((it) => it.selected);
    if (selectedItems.length === 0) {
      Alert.alert('No Items Selected', 'Please check at least one resource to import.');
      return;
    }

    Alert.alert(
      'Confirm Bulk Import',
      `Import ${selectedItems.length} selected B.Tech note(s) into the Padhlo AKTU Library?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Import Now',
          onPress: async () => {
            try {
              setImporting(true);
              const result = await bulkImportNotes(selectedItems, overwriteDuplicates);
              setImporting(false);

              if (result.success) {
                setLastResult({
                  importedCount: result.importedCount,
                  skippedCount: result.skippedCount,
                  failedCount: result.failedCount,
                });
                await refreshNotes();
                Alert.alert(
                  'Bulk Import Complete 🎉',
                  `Successfully imported: ${result.importedCount}\nSkipped (Duplicates): ${result.skippedCount}\nFailed: ${result.failedCount}`
                );
                // Refresh list with duplicate flags updated
                handleInspect();
              } else {
                Alert.alert('Import Failed', result.message || 'Could not complete import.');
              }
            } catch (err: any) {
              setImporting(false);
              Alert.alert('Import Error', err.message || 'Operation failed.');
            }
          },
        },
      ]
    );
  };

  // Filtered display items
  const displayedItems = items.filter((it) => {
    const matchesSemester = filterSemester === 'All' || it.semester === filterSemester;
    const matchesType = filterType === 'All' || it.resourceType === filterType;
    const matchesSearch =
      !searchQuery.trim() ||
      it.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      it.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (it.branches && it.branches.join(' ').toLowerCase().includes(searchQuery.toLowerCase()));

    return matchesSemester && matchesType && matchesSearch;
  });

  const selectedCount = items.filter((it) => it.selected).length;

  if (!isAdmin) {
    return (
      <SafeAreaView style={styles.container}>
        <Header title="Access Restricted" subtitle="Admin credentials required" />
        <View style={styles.unauthBox}>
          <Text style={styles.unauthText}>You must be logged in as an administrator to use the Notes Importer.</Text>
          <Button 
            title="Back to Dashboard" 
            onPress={() => {
              if (router.canGoBack()) {
                router.back();
              } else {
                router.replace('/admin/dashboard');
              }
            }} 
            variant="purple" 
            style={{ marginTop: 16 }} 
          />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Header
        title="AKTU B.Tech Importer"
        subtitle="Discover, review & bulk-import verified B.Tech notes"
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
        <Text style={styles.backText}>Back to Admin Center</Text>
      </TouchableOpacity>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Source Configuration Card */}
        <Card style={styles.sourceCard} variant="glowPurple">
          <View style={styles.sourceHeaderRow}>
            <View style={styles.sourceIconBox}>
              <DownloadCloud size={20} color={THEME.purple} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.sourceCardTitle}>Reference Source URL</Text>
              <Text style={styles.sourceCardSub}>Fixed Course: B.Tech (AKTU Curriculum 1–8 Sem)</Text>
            </View>
            <Badge label="B.TECH ONLY" variant="purple" size="sm" />
          </View>

          <View style={styles.inputWrap}>
            <TextInput
              style={styles.urlInput}
              value={sourceUrl}
              onChangeText={setSourceUrl}
              placeholder="https://notesgallery.com/aktu-notes/"
              placeholderTextColor={THEME.textTertiary}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          <View style={styles.sourceActionsRow}>
            <Button
              title={inspecting ? 'Inspecting Source...' : 'Inspect & Discover Notes'}
              onPress={handleInspect}
              variant="purple"
              loading={inspecting}
              icon={<RefreshCw size={16} color={THEME.white} />}
              style={{ flex: 1 }}
            />
            <Button
              title="Manual Upload"
              onPress={() => router.push('/admin/upload-notes')}
              variant="outline"
              icon={<Upload size={16} color={THEME.cyan} />}
            />
          </View>
        </Card>

        {/* Results Banner if lastResult */}
        {lastResult && (
          <Card style={styles.resultBanner} variant="elevated">
            <View style={styles.resultRow}>
              <CheckCircle size={18} color={THEME.green} />
              <Text style={styles.resultText}>
                Last Import: <Text style={{ color: THEME.green, fontWeight: '800' }}>{lastResult.importedCount} Imported</Text> •{' '}
                <Text style={{ color: THEME.gold, fontWeight: '700' }}>{lastResult.skippedCount} Skipped</Text> •{' '}
                <Text style={{ color: THEME.red, fontWeight: '700' }}>{lastResult.failedCount} Failed</Text>
              </Text>
            </View>
          </Card>
        )}

        {/* Search & Filters */}
        <View style={styles.filterSection}>
          <View style={styles.searchBar}>
            <Search size={16} color={THEME.textTertiary} />
            <TextInput
              style={styles.searchInput}
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search by title, subject or branch..."
              placeholderTextColor={THEME.textTertiary}
            />
          </View>

          {/* Semester Filter Pills */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pillRow}>
            <TouchableOpacity
              onPress={() => setFilterSemester('All')}
              style={[styles.filterPill, filterSemester === 'All' && styles.filterPillActive]}
            >
              <Text style={[styles.filterPillText, filterSemester === 'All' && styles.filterPillTextActive]}>
                All Semesters
              </Text>
            </TouchableOpacity>
            {SEMESTERS.map((sem) => (
              <TouchableOpacity
                key={sem}
                onPress={() => setFilterSemester(sem)}
                style={[styles.filterPill, filterSemester === sem && styles.filterPillActive]}
              >
                <Text style={[styles.filterPillText, filterSemester === sem && styles.filterPillTextActive]}>
                  Sem {sem}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Resource Type Filter Pills */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pillRow}>
            <TouchableOpacity
              onPress={() => setFilterType('All')}
              style={[styles.filterPill, filterType === 'All' && styles.filterPillActiveCyan]}
            >
              <Text style={[styles.filterPillText, filterType === 'All' && styles.filterPillTextActive]}>
                All Types
              </Text>
            </TouchableOpacity>
            {RESOURCE_TYPES.map((t) => (
              <TouchableOpacity
                key={t}
                onPress={() => setFilterType(t)}
                style={[styles.filterPill, filterType === t && styles.filterPillActiveCyan]}
              >
                <Text style={[styles.filterPillText, filterType === t && styles.filterPillTextActive]}>
                  {t}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Selection & Batch Action Toolbar */}
        <View style={styles.selectionToolbar}>
          <TouchableOpacity onPress={toggleSelectAll} style={styles.selectAllBtn} activeOpacity={0.7}>
            {displayedItems.length > 0 && displayedItems.every((it) => it.selected) ? (
              <CheckSquare size={18} color={THEME.purple} />
            ) : (
              <Square size={18} color={THEME.textTertiary} />
            )}
            <Text style={styles.selectAllText}>
              Select All ({selectedCount}/{items.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setOverwriteDuplicates(!overwriteDuplicates)}
            style={styles.overwriteBtn}
            activeOpacity={0.7}
          >
            {overwriteDuplicates ? (
              <CheckSquare size={16} color={THEME.cyan} />
            ) : (
              <Square size={16} color={THEME.textTertiary} />
            )}
            <Text style={styles.overwriteText}>Overwrite Duplicates</Text>
          </TouchableOpacity>
        </View>

        {/* Discovered Items List */}
        {inspecting ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color={THEME.purple} />
            <Text style={styles.loadingText}>Inspecting source & verifying B.Tech curriculum...</Text>
          </View>
        ) : displayedItems.length === 0 ? (
          <Card style={styles.emptyCard} variant="elevated">
            <BookOpen size={36} color={THEME.textTertiary} />
            <Text style={styles.emptyTitle}>No Resources Discovered</Text>
            <Text style={styles.emptySub}>
              {searchQuery || filterSemester !== 'All' || filterType !== 'All'
                ? 'No items matched your current filters. Try resetting search.'
                : 'Click "Inspect & Discover Notes" to discover AKTU B.Tech materials.'}
            </Text>
          </Card>
        ) : (
          displayedItems.map((item, index) => (
            <Card key={`${item.sourceId || index}_${item.title}`} style={styles.itemCard} variant="elevated">
              <View style={styles.itemTopRow}>
                <TouchableOpacity
                  onPress={() => toggleItemSelect(index)}
                  style={styles.checkboxTouch}
                  activeOpacity={0.7}
                >
                  {item.selected ? (
                    <CheckSquare size={20} color={THEME.purple} />
                  ) : (
                    <Square size={20} color={THEME.textTertiary} />
                  )}
                </TouchableOpacity>

                <View style={{ flex: 1 }}>
                  <TextInput
                    style={styles.itemTitleInput}
                    value={item.title}
                    onChangeText={(val) => updateItemField(index, 'title', val)}
                    placeholder="Resource Title"
                    placeholderTextColor={THEME.textTertiary}
                  />
                  <TextInput
                    style={styles.itemSubjectInput}
                    value={item.subject}
                    onChangeText={(val) => updateItemField(index, 'subject', val)}
                    placeholder="Subject Name"
                    placeholderTextColor={THEME.textTertiary}
                  />
                </View>
              </View>

              {/* Badges & Meta Row */}
              <View style={styles.metaBadgeRow}>
                <Badge label={`SEM ${item.semester}`} variant="cyan" size="sm" />
                <Badge label={item.resourceType} variant="purple" size="sm" />
                <Badge
                  label={item.branches && item.branches.length > 0 ? item.branches.join(', ') : 'ALL'}
                  variant="blue"
                  size="sm"
                />
                {item.isDuplicate ? (
                  <Badge label="IN LIBRARY" variant="gold" size="sm" />
                ) : (
                  <Badge label="NEW" variant="green" size="sm" />
                )}
                {item.needsReview && (
                  <Badge label="⚠️ REVIEW" variant="red" size="sm" />
                )}
              </View>

              {/* Config Row (Semester Picker & Branch Selector) */}
              <View style={styles.editRow}>
                <View style={styles.editField}>
                  <Text style={styles.fieldLabel}>Semester</Text>
                  <View style={styles.semPickerRow}>
                    {SEMESTERS.map((s) => (
                      <TouchableOpacity
                        key={s}
                        onPress={() => updateItemField(index, 'semester', s)}
                        style={[
                          styles.semBtn,
                          item.semester === s && styles.semBtnActive,
                        ]}
                      >
                        <Text
                          style={[
                            styles.semBtnText,
                            item.semester === s && styles.semBtnTextActive,
                          ]}
                        >
                          {s}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                {/* Test Link Button */}
                <TouchableOpacity
                  onPress={() => {
                    if (item.sourceUrl) {
                      Linking.openURL(item.sourceUrl).catch(() => {
                        Alert.alert('Link Error', 'Unable to open source link on this device.');
                      });
                    }
                  }}
                  style={styles.testLinkBtn}
                  activeOpacity={0.7}
                >
                  <ExternalLink size={13} color={THEME.cyan} />
                  <Text style={styles.testLinkText}>Test Link ↗</Text>
                </TouchableOpacity>
              </View>
            </Card>
          ))
        )}

        {/* Bottom Import Action Button */}
        {displayedItems.length > 0 && (
          <View style={styles.bottomActionBar}>
            <Button
              title={
                importing
                  ? 'Importing Selected Items...'
                  : `Import ${selectedCount} Selected Note(s)`
              }
              onPress={handleBulkImport}
              variant="purple"
              loading={importing}
              icon={<DownloadCloud size={18} color={THEME.white} />}
            />
          </View>
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
  scrollContent: {
    paddingHorizontal: 18,
    paddingTop: 8,
    paddingBottom: 110,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 18,
    paddingVertical: 8,
  },
  backText: {
    fontSize: 13,
    color: THEME.textSecondary,
    fontWeight: '600',
  },
  sourceCard: {
    padding: 16,
    borderRadius: 16,
    marginBottom: 14,
  },
  sourceHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  sourceIconBox: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: THEME.purpleMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sourceCardTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: THEME.textPrimary,
  },
  sourceCardSub: {
    fontSize: 11,
    color: THEME.textTertiary,
    marginTop: 2,
  },
  inputWrap: {
    marginBottom: 12,
  },
  urlInput: {
    backgroundColor: THEME.surfaceElevated,
    borderWidth: 1,
    borderColor: THEME.surfaceBorder,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 13,
    color: THEME.textPrimary,
  },
  sourceActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  resultBanner: {
    padding: 12,
    borderRadius: 12,
    marginBottom: 14,
    backgroundColor: THEME.surfaceElevated,
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  resultText: {
    fontSize: 12,
    color: THEME.textPrimary,
    flex: 1,
  },
  filterSection: {
    marginBottom: 14,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.surfaceCard,
    borderWidth: 1,
    borderColor: THEME.surfaceBorder,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
    marginBottom: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: THEME.textPrimary,
    padding: 0,
  },
  pillRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  filterPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: THEME.surfaceCard,
    borderWidth: 1,
    borderColor: THEME.surfaceBorder,
    marginRight: 8,
  },
  filterPillActive: {
    backgroundColor: THEME.purpleMuted,
    borderColor: THEME.purple,
  },
  filterPillActiveCyan: {
    backgroundColor: THEME.cyanMuted,
    borderColor: THEME.cyan,
  },
  filterPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: THEME.textSecondary,
  },
  filterPillTextActive: {
    color: THEME.white,
  },
  selectionToolbar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    marginBottom: 10,
  },
  selectAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  selectAllText: {
    fontSize: 12,
    fontWeight: '700',
    color: THEME.textPrimary,
  },
  overwriteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  overwriteText: {
    fontSize: 11,
    color: THEME.textSecondary,
    fontWeight: '600',
  },
  loadingBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    gap: 12,
  },
  loadingText: {
    fontSize: 12,
    color: THEME.textSecondary,
  },
  emptyCard: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 30,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: THEME.textPrimary,
  },
  emptySub: {
    fontSize: 12,
    color: THEME.textTertiary,
    textAlign: 'center',
  },
  itemCard: {
    padding: 14,
    borderRadius: 14,
    marginBottom: 10,
  },
  itemTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  checkboxTouch: {
    paddingTop: 4,
  },
  itemTitleInput: {
    fontSize: 14,
    fontWeight: '800',
    color: THEME.textPrimary,
    padding: 0,
    marginBottom: 4,
  },
  itemSubjectInput: {
    fontSize: 12,
    color: THEME.cyan,
    fontWeight: '600',
    padding: 0,
  },
  metaBadgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
    marginBottom: 10,
  },
  editRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: THEME.surfaceBorder,
  },
  editField: {
    flex: 1,
  },
  fieldLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: THEME.textTertiary,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  semPickerRow: {
    flexDirection: 'row',
    gap: 4,
  },
  semBtn: {
    width: 24,
    height: 24,
    borderRadius: 6,
    backgroundColor: THEME.surfaceElevated,
    borderWidth: 1,
    borderColor: THEME.surfaceBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  semBtnActive: {
    backgroundColor: THEME.purple,
    borderColor: THEME.purple,
  },
  semBtnText: {
    fontSize: 10,
    fontWeight: '700',
    color: THEME.textSecondary,
  },
  semBtnTextActive: {
    color: THEME.white,
  },
  testLinkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: THEME.cyanMuted,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: THEME.cyan + '40',
  },
  testLinkText: {
    fontSize: 11,
    fontWeight: '700',
    color: THEME.cyan,
  },
  bottomActionBar: {
    marginTop: 14,
  },
  unauthBox: {
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unauthText: {
    fontSize: 14,
    color: THEME.textSecondary,
    textAlign: 'center',
  },
});
