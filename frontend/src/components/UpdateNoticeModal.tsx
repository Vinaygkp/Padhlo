import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Linking,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { ArrowDownCircle, Sparkles, AlertCircle } from 'lucide-react-native';
import { THEME } from '@/constants/theme';
import { AppVersionManifest } from '@/services/appVersionService';

interface UpdateNoticeModalProps {
  visible: boolean;
  manifest: AppVersionManifest | null;
  currentVersion: string;
  isMandatory: boolean;
  onDismiss: () => void;
}

export const UpdateNoticeModal: React.FC<UpdateNoticeModalProps> = ({
  visible,
  manifest,
  currentVersion,
  isMandatory,
  onDismiss,
}) => {
  const [downloading, setDownloading] = useState(false);

  if (!visible || !manifest) {
    return null;
  }

  const handleDownload = async () => {
    const rawUrl = manifest.apkUrl?.trim();

    if (!rawUrl || (!rawUrl.startsWith('https://') && !rawUrl.startsWith('http://'))) {
      Alert.alert(
        'Invalid Download Link',
        'The update server provided an invalid download address. Please try again later or contact your college administrator.'
      );
      return;
    }

    try {
      setDownloading(true);
      const supported = await Linking.canOpenURL(rawUrl);

      if (!supported) {
        setDownloading(false);
        Alert.alert(
          'Cannot Open Browser',
          'Unable to launch a browser or download manager to download the APK. Please check your device settings.'
        );
        return;
      }

      await Linking.openURL(rawUrl);
      setDownloading(false);

      if (!isMandatory) {
        onDismiss();
      }
    } catch (err: any) {
      setDownloading(false);
      Alert.alert(
        'Download Error',
        err.message || 'Could not start the APK download. Please verify your internet connection.'
      );
    }
  };

  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      onRequestClose={() => {
        if (!isMandatory) {
          onDismiss();
        }
      }}
    >
      <View style={styles.overlay}>
        <View style={styles.card}>
          {/* Accent Header Icon */}
          <View style={styles.iconCircle}>
            <ArrowDownCircle size={32} color={THEME.cyan} />
          </View>

          {/* Heading */}
          <Text style={styles.title}>New Update Available</Text>

          {/* Version badge */}
          <View style={styles.versionBadge}>
            <Sparkles size={13} color={THEME.purple} />
            <Text style={styles.versionText}>
              v{currentVersion} ➔ v{manifest.latestVersion}
            </Text>
            {isMandatory && (
              <View style={styles.mandatoryPill}>
                <Text style={styles.mandatoryPillText}>Required</Text>
              </View>
            )}
          </View>

          {/* Required User-Facing Message */}
          <Text style={styles.message}>
            We’ve improved your study experience. Update Padhlo to get the latest features and fixes.
          </Text>

          {/* Release Notes if provided */}
          {manifest.releaseNotes ? (
            <View style={styles.notesBox}>
              <Text style={styles.notesTitle}>What’s New:</Text>
              <Text style={styles.notesText}>{manifest.releaseNotes}</Text>
            </View>
          ) : null}

          {/* Android Installation Explanation */}
          <View style={styles.infoBox}>
            <AlertCircle size={15} color={THEME.cyan} style={{ marginTop: 2 }} />
            <Text style={styles.infoText}>
              Android will prompt you to confirm downloading and installing the APK. Tap <Text style={styles.boldText}>Install</Text> when the download completes.
            </Text>
          </View>

          {/* Action Buttons */}
          <View style={styles.actions}>
            <TouchableOpacity
              activeOpacity={0.85}
              style={styles.downloadBtn}
              onPress={handleDownload}
              disabled={downloading}
            >
              {downloading ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.downloadBtnText}>Download Update</Text>
              )}
            </TouchableOpacity>

            {!isMandatory && (
              <TouchableOpacity
                activeOpacity={0.7}
                style={styles.laterBtn}
                onPress={onDismiss}
                disabled={downloading}
              >
                <Text style={styles.laterBtnText}>Later</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.82)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: THEME.surfaceCard,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: THEME.surfaceBorder,
    padding: 24,
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: THEME.purple,
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.35,
        shadowRadius: 16,
      },
      android: {
        elevation: 12,
      },
    }),
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: THEME.cyanMuted,
    borderWidth: 1,
    borderColor: THEME.cyan + '40',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: THEME.textPrimary,
    letterSpacing: -0.5,
    textAlign: 'center',
  },
  versionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: THEME.surfaceElevated,
    borderWidth: 1,
    borderColor: THEME.borderHighlight,
    borderRadius: 12,
    paddingVertical: 5,
    paddingHorizontal: 12,
    marginTop: 10,
    marginBottom: 12,
  },
  versionText: {
    fontSize: 12,
    color: THEME.purple,
    fontWeight: '700',
  },
  mandatoryPill: {
    backgroundColor: THEME.redMuted,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginLeft: 4,
  },
  mandatoryPillText: {
    fontSize: 10,
    color: THEME.red,
    fontWeight: '700',
  },
  message: {
    fontSize: 14,
    lineHeight: 20,
    color: THEME.textSecondary,
    textAlign: 'center',
    marginBottom: 16,
  },
  notesBox: {
    width: '100%',
    backgroundColor: THEME.surfaceElevated,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: THEME.surfaceBorder,
    marginBottom: 14,
  },
  notesTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: THEME.cyan,
    marginBottom: 4,
  },
  notesText: {
    fontSize: 12,
    lineHeight: 17,
    color: THEME.textSecondary,
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: 'rgba(34, 211, 238, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(34, 211, 238, 0.25)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 20,
    width: '100%',
  },
  infoText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 17,
    color: THEME.textSecondary,
  },
  boldText: {
    fontWeight: '700',
    color: THEME.textPrimary,
  },
  actions: {
    width: '100%',
    gap: 10,
  },
  downloadBtn: {
    width: '100%',
    backgroundColor: THEME.purple,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  downloadBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  laterBtn: {
    width: '100%',
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  laterBtnText: {
    color: THEME.textTertiary,
    fontSize: 14,
    fontWeight: '600',
  },
});
