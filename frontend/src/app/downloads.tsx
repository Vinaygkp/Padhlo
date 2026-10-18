import React from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  Alert 
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { 
  ArrowLeft, 
  HardDrive, 
  FileText, 
  Image as ImageIcon, 
  Trash2, 
  Share2 
} from 'lucide-react-native';
import { THEME } from '@/constants/theme';
import { Card } from '@/components/Card';
import { Header } from '@/components/Header';
import { Badge } from '@/components/Badge';
import { EmptyState } from '@/components/EmptyState';
import { useStudyHub } from '@/store/StudyHubContext';
import { DownloadRecord } from '@/types';
import { sharePdfFile } from '@/services/fileDownloadService';

export default function DownloadsScreen() {
  const router = useRouter();
  const { downloadRecords, removeDownloadRecord } = useStudyHub();

  const handleOpenOffline = async (record: DownloadRecord) => {
    if (record.resourceType === 'NOTE') {
      router.push({
        pathname: '/pdf-viewer',
        params: {
          id: record.resourceId,
          fileUrl: record.localUri,
          title: record.title,
          fileName: record.fileName,
          subject: (record as any).subject || 'Offline Course Material',
        },
      });
    } else {
      Alert.alert(
        'Offline Resource',
        `"${record.title}" is saved locally on device storage at ${record.localUri}`
      );
    }
  };

  const handleShare = async (record: DownloadRecord) => {
    try {
      await sharePdfFile(record.localUri, record.fileName, record.title);
    } catch (err: any) {
      Alert.alert('Share Error', err.message || 'Unable to share downloaded file.');
    }
  };

  const handleDelete = (resourceId: string, title: string) => {
    Alert.alert(
      'Remove Local Download',
      `Delete "${title}" from offline storage? (Original document remains on Padhlo servers)`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await removeDownloadRecord(resourceId);
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <Header
        title="Offline Downloads"
        subtitle="Saved PDFs and materials available without internet"
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

      {/* Offline Status Card */}
      <View style={styles.bannerWrap}>
        <Card style={styles.storageCard} variant="glowBlue">
          <View style={styles.storageRow}>
            <View style={styles.storageIconWrap}>
              <HardDrive size={22} color={THEME.blue} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.storageTitle}>Offline Storage Ready</Text>
              <Text style={styles.storageSub}>
                {downloadRecords.length} {downloadRecords.length === 1 ? 'file' : 'files'} saved • Accessible in airplane mode
              </Text>
            </View>
            <Badge label="OFFLINE" variant="cyan" size="sm" />
          </View>
        </Card>
      </View>

      {/* Downloads List */}
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {downloadRecords.length === 0 ? (
          <EmptyState
            title="No downloaded files"
            description="Download PDF notes or revision sheets from the Notes tab to study offline without internet."
          />
        ) : (
          downloadRecords.map((item) => (
            <Card key={item.id} style={styles.itemCard} variant="elevated">
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => handleOpenOffline(item)}
                style={styles.itemMain}
              >
                <View style={styles.itemIconCircle}>
                  {item.resourceType === 'NOTE' ? (
                    <FileText size={20} color={THEME.purple} />
                  ) : (
                    <ImageIcon size={20} color={THEME.cyan} />
                  )}
                </View>

                <View style={styles.itemDetails}>
                  <View style={styles.metaRow}>
                    <Badge label="AVAILABLE OFFLINE" variant="cyan" size="sm" />
                    <Text style={styles.sizeText}>{item.fileSizeFormatted}</Text>
                  </View>
                  <Text style={styles.itemTitle} numberOfLines={2}>
                    {item.title}
                  </Text>
                  <Text style={styles.fileNameText} numberOfLines={1}>
                    {item.fileName} • {new Date(item.downloadedAt).toLocaleDateString()}
                  </Text>
                </View>
              </TouchableOpacity>

              <View style={styles.actionsRow}>
                <TouchableOpacity onPress={() => handleShare(item)} style={styles.actionBtn}>
                  <Share2 size={16} color={THEME.cyan} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => handleDelete(item.resourceId, item.title)} style={styles.actionBtn}>
                  <Trash2 size={16} color={THEME.red} />
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
  bannerWrap: {
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  storageCard: {
    padding: 16,
    borderRadius: 16,
  },
  storageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  storageIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: THEME.blueMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  storageTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: THEME.textPrimary,
  },
  storageSub: {
    fontSize: 11,
    color: THEME.textSecondary,
    marginTop: 2,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
    gap: 12,
  },
  itemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 16,
    marginBottom: 8,
  },
  itemMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  itemIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: THEME.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: THEME.surfaceBorder,
  },
  itemDetails: {
    flex: 1,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  sizeText: {
    fontSize: 11,
    color: THEME.textTertiary,
    fontWeight: '600',
  },
  itemTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: THEME.textPrimary,
    lineHeight: 18,
  },
  fileNameText: {
    fontSize: 11,
    color: THEME.textTertiary,
    marginTop: 3,
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginLeft: 6,
  },
  actionBtn: {
    padding: 8,
  },
});
