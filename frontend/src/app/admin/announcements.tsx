import React, { useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  Switch, 
  Alert 
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { 
  ArrowLeft, 
  Trash2 
} from 'lucide-react-native';
import { THEME } from '@/constants/theme';
import { Card } from '@/components/Card';
import { Header } from '@/components/Header';
import { Input } from '@/components/Input';
import { Button } from '@/components/Button';
import { Badge } from '@/components/Badge';
import { useStudyHub } from '@/store/StudyHubContext';

export default function AnnouncementsScreen() {
  const router = useRouter();
  const { announcements, addAnnouncement, deleteAnnouncement } = useStudyHub();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<'Important' | 'General' | 'Exams' | 'Academic' | 'Events'>('Important');
  const [priority, setPriority] = useState<'Normal' | 'High' | 'Urgent'>('High');
  const [isPinned, setIsPinned] = useState(true);

  const handlePublish = async () => {
    if (!title.trim() || !description.trim()) {
      Alert.alert('Missing Details', 'Please enter a notice title and description.');
      return;
    }

    await addAnnouncement({
      title: title.trim(),
      description: description.trim(),
      category,
      priority,
      branches: ['ALL'],
      years: ['ALL'],
      isPinned,
    });

    setTitle('');
    setDescription('');
    Alert.alert('Notice Published', 'Your official notice is now broadcast to all enrolled students.');
  };

  return (
    <SafeAreaView style={styles.container}>
      <Header
        title="Campus Announcements"
        subtitle="Broadcast important notices to students"
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

      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        {/* Create Card */}
        <Card style={styles.createCard} variant="glowBlue">
          <Text style={styles.createHeading}>Publish Notice</Text>

          <Input
            label="Notice Title *"
            value={title}
            onChangeText={setTitle}
            placeholder="e.g. Schedule Revision for Mid-Semester Exam"
          />

          <Input
            label="Notice Details *"
            value={description}
            onChangeText={setDescription}
            placeholder="Important guidelines, classroom changes, or deadlines..."
            multiline
            numberOfLines={4}
          />

          {/* Category Selector */}
          <Text style={styles.selectorLabel}>Notice Category</Text>
          <View style={styles.pillRow}>
            {(['Important', 'Exams', 'Academic', 'General', 'Events'] as const).map((cat) => (
              <TouchableOpacity
                key={cat}
                onPress={() => setCategory(cat)}
                style={[styles.catPill, category === cat && styles.catPillActive]}
              >
                <Text style={[styles.catPillText, category === cat && styles.catPillTextActive]}>
                  {cat}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Priority Selector */}
          <Text style={styles.selectorLabel}>Notice Priority</Text>
          <View style={styles.pillRow}>
            {(['Normal', 'High', 'Urgent'] as const).map((p) => (
              <TouchableOpacity
                key={p}
                onPress={() => setPriority(p)}
                style={[styles.catPill, priority === p && styles.catPillActive]}
              >
                <Text style={[styles.catPillText, priority === p && styles.catPillTextActive]}>
                  {p}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.switchRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.switchTitle}>Pin to Student Home</Text>
              <Text style={styles.switchSub}>Displays prominently at the top of the Home Screen</Text>
            </View>
            <Switch
              value={isPinned}
              onValueChange={setIsPinned}
              trackColor={{ false: THEME.surfaceBorder, true: THEME.blue }}
              thumbColor={THEME.white}
            />
          </View>

          <Button
            title="Broadcast Notice"
            onPress={handlePublish}
            variant="blue"
            size="lg"
            style={styles.publishBtn}
          />
        </Card>

        {/* Existing Announcements */}
        <Text style={styles.listHeading}>Published Announcements ({announcements.length})</Text>

        {announcements.map((ann) => (
          <Card key={ann.id} style={styles.annCard} variant="elevated">
            <View style={styles.annTopRow}>
              <View style={{ flex: 1 }}>
                <View style={styles.annBadgeRow}>
                  {ann.isPinned && <Badge label="PINNED ON HOME" variant="blue" size="sm" />}
                  <Text style={styles.annDate}>
                    {new Date(ann.publishedAt).toLocaleDateString()}
                  </Text>
                </View>
                <Text style={styles.annTitle}>{ann.title}</Text>
              </View>

              <TouchableOpacity 
                onPress={() => deleteAnnouncement(ann.id)}
                style={styles.deleteBtn}
              >
                <Trash2 size={16} color={THEME.red} />
              </TouchableOpacity>
            </View>

            <Text style={styles.annDesc}>{ann.description}</Text>
          </Card>
        ))}
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
  createCard: {
    padding: 20,
    marginBottom: 24,
  },
  createHeading: {
    fontSize: 18,
    fontWeight: '900',
    color: THEME.textPrimary,
    marginBottom: 16,
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 12,
  },
  switchTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: THEME.textPrimary,
  },
  switchSub: {
    fontSize: 11,
    color: THEME.textSecondary,
    marginTop: 2,
  },
  publishBtn: {
    marginTop: 10,
    width: '100%',
  },
  listHeading: {
    fontSize: 14,
    fontWeight: '800',
    color: THEME.textSecondary,
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  annCard: {
    padding: 16,
    marginBottom: 12,
  },
  annTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  annBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  annDate: {
    fontSize: 11,
    color: THEME.textTertiary,
  },
  annTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: THEME.textPrimary,
  },
  annDesc: {
    fontSize: 12,
    color: THEME.textSecondary,
    lineHeight: 18,
  },
  deleteBtn: {
    padding: 6,
  },
  selectorLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: THEME.textSecondary,
    marginBottom: 8,
    marginTop: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  catPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: THEME.surfaceCard,
    borderWidth: 1,
    borderColor: THEME.surfaceBorder,
  },
  catPillActive: {
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    borderColor: THEME.blue,
  },
  catPillText: {
    fontSize: 12,
    fontWeight: '600',
    color: THEME.textSecondary,
  },
  catPillTextActive: {
    color: THEME.blue,
    fontWeight: '800',
  },
});
