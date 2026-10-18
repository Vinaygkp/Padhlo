import React, { useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  Switch, 
  Alert,
  Image as RNImage 
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { 
  ArrowLeft, 
  Plus, 
  Trash2, 
  Image as ImageIcon 
} from 'lucide-react-native';
import { THEME } from '@/constants/theme';
import { Card } from '@/components/Card';
import { Header } from '@/components/Header';
import { Input } from '@/components/Input';
import { Button } from '@/components/Button';
import { useStudyHub } from '@/store/StudyHubContext';
import { BRANCHES, BranchCode, ACADEMIC_YEARS, AcademicYear } from '@/types';
import { storage } from '@/services/storage';
import { API_BASE_URL } from '@/constants/api';

export default function UploadShortNotesScreen() {
  const router = useRouter();
  const { addShortNote } = useStudyHub();

  const [title, setTitle] = useState('');
  const [subject, setSubject] = useState('');
  const [chapter, setChapter] = useState('');
  const [description, setDescription] = useState('');
  const [selectedBranches, setSelectedBranches] = useState<BranchCode[]>(['ALL']);
  const [selectedYears, setSelectedYears] = useState<AcademicYear[]>(['ALL']);
  const [isImportant, setIsImportant] = useState(false);
  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);

  const toggleBranch = (code: BranchCode) => {
    if (code === 'ALL') {
      setSelectedBranches(['ALL']);
      return;
    }

    let updated: BranchCode[] = selectedBranches.filter((b) => b !== 'ALL');
    if (updated.includes(code)) {
      updated = updated.filter((b) => b !== code);
      if (updated.length === 0) updated = ['ALL'];
    } else {
      updated.push(code);
    }
    setSelectedBranches(updated);
  };

  const toggleYear = (code: AcademicYear) => {
    if (code === 'ALL') {
      setSelectedYears(['ALL']);
      return;
    }

    let updated: AcademicYear[] = selectedYears.filter((y) => y !== 'ALL');
    if (updated.includes(code)) {
      updated = updated.filter((y) => y !== code);
      if (updated.length === 0) updated = ['ALL'];
    } else {
      updated.push(code);
    }
    setSelectedYears(updated);
  };

  const handlePickImages = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: true,
        quality: 0.9,
      });

      if (!result.canceled && result.assets) {
        const uris = result.assets.map((a) => a.uri);
        setSelectedImages((prev) => [...prev, ...uris]);
      }
    } catch (err: any) {
      Alert.alert('Error picking images', err.message);
    }
  };

  const removeImage = (index: number) => {
    setSelectedImages((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handlePublish = async () => {
    if (!title.trim() || !subject.trim()) {
      Alert.alert('Missing Details', 'Please enter a title and subject.');
      return;
    }

    if (selectedImages.length === 0) {
      Alert.alert('No Images Selected', 'Please choose at least one image or diagram.');
      return;
    }

    setUploading(true);

    try {
      const token = await storage.getToken();
      const uploadedImageUrls: string[] = [];
      const uploadedStorageKeys: string[] = [];
      const uploadedFileIds: string[] = [];

      for (const uri of selectedImages) {
        if (uri.startsWith('file://') || uri.startsWith('content://')) {
          const formData = new FormData();
          const cleanName = uri.split('/').pop() || `slide_${Date.now()}.jpg`;
          const ext = cleanName.split('.').pop()?.toLowerCase() || 'jpg';
          const mimeType = ext === 'png' ? 'image/png' : (ext === 'webp' ? 'image/webp' : 'image/jpeg');

          formData.append('image', {
            uri,
            name: cleanName,
            type: mimeType,
          } as any);

          const uploadRes = await fetch(`${API_BASE_URL}/api/short-notes/upload-image`, {
            method: 'POST',
            headers: {
              Authorization: token ? `Bearer ${token}` : '',
            },
            body: formData,
          });

          const uploadData = await uploadRes.json();
          if (uploadData.success && uploadData.imageUrl) {
            uploadedImageUrls.push(uploadData.imageUrl);
            if (uploadData.storageKey) uploadedStorageKeys.push(uploadData.storageKey);
            if (uploadData.fileId) uploadedFileIds.push(uploadData.fileId);
          } else {
            throw new Error(uploadData.message || 'Image upload to storage failed.');
          }
        } else {
          uploadedImageUrls.push(uri);
        }
      }

      await addShortNote({
        title: title.trim(),
        subject: subject.trim(),
        chapter: chapter.trim() || undefined,
        description: description.trim() || undefined,
        imageUrls: uploadedImageUrls,
        storageKeys: uploadedStorageKeys,
        fileIds: uploadedFileIds,
        branches: selectedBranches,
        years: selectedYears,
        isImportant,
        isPublished: true,
      });

      setUploading(false);
      Alert.alert('Published 🎉', 'Your revision sheets have been uploaded to cloud storage and published.', [
        { 
          text: 'Done', 
          onPress: () => {
            if (router.canGoBack()) {
              router.back();
            } else {
              router.replace('/admin/dashboard');
            }
          } 
        },
      ]);
    } catch (err: any) {
      setUploading(false);
      Alert.alert('Upload Failed', err.message || 'Unable to store images in cloud storage.');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <Header
        title="Upload Image Notes"
        subtitle="Handwritten summaries, formulas & diagrams"
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
        {/* Images Picker Strip */}
        <Card style={styles.pickerCard} variant="elevated">
          <View style={styles.pickerHeader}>
            <View>
              <Text style={styles.pickerTitle}>Note Pages / Diagrams ({selectedImages.length})</Text>
              <Text style={styles.pickerSub}>Select high-resolution JPG or PNG revision sheets</Text>
            </View>

            <TouchableOpacity 
              activeOpacity={0.8}
              onPress={handlePickImages}
              style={styles.addImagesBtn}
            >
              <Plus size={16} color={THEME.white} />
              <Text style={styles.addImagesBtnText}>Add Images</Text>
            </TouchableOpacity>
          </View>

          {selectedImages.length === 0 ? (
            <TouchableOpacity 
              activeOpacity={0.7} 
              onPress={handlePickImages}
              style={styles.emptyPickerArea}
            >
              <ImageIcon size={32} color={THEME.pink} />
              <Text style={styles.emptyPickerText}>Tap to pick image notes from gallery</Text>
            </TouchableOpacity>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.imagesRow}>
              {selectedImages.map((uri, idx) => (
                <View key={idx} style={styles.imageThumbnailWrap}>
                  <RNImage source={{ uri }} style={styles.thumbnail} />
                  <TouchableOpacity 
                    onPress={() => removeImage(idx)}
                    style={styles.removeImageBtn}
                  >
                    <Trash2 size={12} color={THEME.white} />
                  </TouchableOpacity>
                  <View style={styles.pageNumberBadge}>
                    <Text style={styles.pageNumberText}>P.{idx + 1}</Text>
                  </View>
                </View>
              ))}
            </ScrollView>
          )}
        </Card>

        {/* Form Details */}
        <Card style={styles.formCard} variant="elevated">
          <Input
            label="Note Title *"
            value={title}
            onChangeText={setTitle}
            placeholder="e.g. TLB Hit vs Miss & Page Fault Sequence"
          />

          <Input
            label="Subject *"
            value={subject}
            onChangeText={setSubject}
            placeholder="e.g. Operating Systems"
          />

          <Input
            label="Chapter / Unit (Optional)"
            value={chapter}
            onChangeText={setChapter}
            placeholder="e.g. Unit 3: Virtual Memory"
          />

          {/* Branch Target Selector */}
          <Text style={styles.branchSectionTitle}>Available For (Target Audience) *</Text>
          <View style={styles.branchesWrap}>
            <TouchableOpacity
              onPress={() => toggleBranch('ALL')}
              style={[
                styles.branchPill,
                selectedBranches.includes('ALL') && styles.branchPillActive,
              ]}
            >
              <Text style={[styles.branchPillText, selectedBranches.includes('ALL') && styles.branchPillTextActive]}>
                All Branches (Common)
              </Text>
            </TouchableOpacity>

            {BRANCHES.map((b) => {
              const isSelected = selectedBranches.includes(b.code);
              return (
                <TouchableOpacity
                  key={b.code}
                  onPress={() => toggleBranch(b.code)}
                  style={[styles.branchPill, isSelected && styles.branchPillActive]}
                >
                  <Text style={[styles.branchPillText, isSelected && styles.branchPillTextActive]}>
                    {b.code}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Academic Year Target Selector */}
          <Text style={[styles.branchSectionTitle, { marginTop: 14 }]}>Available For (Academic Year) *</Text>
          <View style={styles.branchesWrap}>
            <TouchableOpacity
              onPress={() => toggleYear('ALL')}
              style={[
                styles.branchPill,
                selectedYears.includes('ALL') && styles.branchPillActive,
              ]}
            >
              <Text style={[styles.branchPillText, selectedYears.includes('ALL') && styles.branchPillTextActive]}>
                All Years (Common)
              </Text>
            </TouchableOpacity>

            {ACADEMIC_YEARS.map((y) => {
              const isSelected = selectedYears.includes(y.code);
              return (
                <TouchableOpacity
                  key={y.code}
                  onPress={() => toggleYear(y.code)}
                  style={[styles.branchPill, isSelected && styles.branchPillActive]}
                >
                  <Text style={[styles.branchPillText, isSelected && styles.branchPillTextActive]}>
                    {y.shortName}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Input
            label="Description / Context (Optional)"
            value={description}
            onChangeText={setDescription}
            placeholder="What does this diagram summarize?"
            multiline
            numberOfLines={3}
          />

          <View style={styles.switchRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.switchTitle}>Exam High-Yield Star</Text>
              <Text style={styles.switchSub}>Displays golden priority star on cards</Text>
            </View>
            <Switch
              value={isImportant}
              onValueChange={setIsImportant}
              trackColor={{ false: THEME.surfaceBorder, true: THEME.gold }}
              thumbColor={THEME.white}
            />
          </View>

          <Button
            title={uploading ? "Publishing Images..." : "Publish Image Notes"}
            onPress={handlePublish}
            loading={uploading}
            disabled={uploading}
            variant="pink"
            size="lg"
            style={styles.submitBtn}
          />
        </Card>
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
  pickerCard: {
    padding: 16,
    marginBottom: 16,
  },
  pickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  pickerTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: THEME.textPrimary,
  },
  pickerSub: {
    fontSize: 11,
    color: THEME.textSecondary,
    marginTop: 2,
  },
  addImagesBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: THEME.pink,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
  },
  addImagesBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: THEME.white,
  },
  emptyPickerArea: {
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: THEME.pink + '60',
    borderRadius: 14,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  emptyPickerText: {
    fontSize: 13,
    color: THEME.textSecondary,
    fontWeight: '600',
  },
  imagesRow: {
    gap: 12,
    paddingVertical: 6,
  },
  imageThumbnailWrap: {
    width: 100,
    height: 120,
    borderRadius: 10,
    overflow: 'hidden',
    position: 'relative',
    borderWidth: 1,
    borderColor: THEME.surfaceBorder,
  },
  thumbnail: {
    width: '100%',
    height: '100%',
  },
  removeImageBtn: {
    position: 'absolute',
    top: 6,
    right: 6,
    backgroundColor: THEME.red,
    borderRadius: 10,
    padding: 4,
  },
  pageNumberBadge: {
    position: 'absolute',
    bottom: 6,
    left: 6,
    backgroundColor: '#000000B0',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  pageNumberText: {
    fontSize: 10,
    color: THEME.white,
    fontWeight: '700',
  },
  formCard: {
    padding: 20,
  },
  branchSectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: THEME.textSecondary,
    marginBottom: 8,
  },
  branchesWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  branchPill: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: THEME.surfaceCard,
    borderWidth: 1,
    borderColor: THEME.surfaceBorder,
  },
  branchPillActive: {
    backgroundColor: THEME.cyan,
    borderColor: THEME.cyan,
  },
  branchPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: THEME.textSecondary,
  },
  branchPillTextActive: {
    color: THEME.black,
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 10,
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
  submitBtn: {
    marginTop: 18,
    width: '100%',
  },
});
