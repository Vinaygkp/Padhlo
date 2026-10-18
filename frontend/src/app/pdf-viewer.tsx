import React, { useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  ActivityIndicator, 
  Alert,
  TextInput,
  Modal,
  ScrollView,
  Platform,
  Linking
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { WebView } from 'react-native-webview';
import { 
  ArrowLeft, 
  Download, 
  Share2, 
  Sparkles, 
  Bookmark, 
  BookmarkCheck, 
  Send, 
  X, 
  ExternalLink,
  BookOpen,
  RotateCcw,
  AlertTriangle,
  FileText
} from 'lucide-react-native';
import { THEME } from '@/constants/theme';
import { useStudyHub } from '@/store/StudyHubContext';
import { downloadPdfFile, sharePdfFile, isPdfSavedLocally } from '@/services/fileDownloadService';
import { openPdfInExternalViewer } from '@/services/externalPdfViewerService';
import { resolvePdfLinks, buildPdfViewerHtml, loadPdfBase64 } from '@/services/pdfLinkResolver';
import { storage } from '@/services/storage';

export default function PdfViewerScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ 
    id?: string;
    fileUrl?: string; 
    title?: string; 
    fileName?: string; 
    externalUrl?: string;
    previewUrl?: string;
    subject?: string;
    subjectCode?: string;
    unit?: string;
    semester?: string;
    provider?: string;
    teacherName?: string;
    documentId?: string;
  }>();

  const { 
    notes,
    isBookmarked, 
    addBookmark, 
    removeBookmark, 
    recordStudyActivity, 
    askDocument 
  } = useStudyHub();

  // Find note from context if ID passed
  const currentNote = params.id ? notes.find(n => n.id === params.id) : null;

  const fileTitle = currentNote?.title || params.title || 'Course Lecture Notes';
  const fileName = currentNote?.fileName || params.fileName || 'Padhlo_Document.pdf';
  const rawFileUrl = currentNote?.fileUrl || params.fileUrl || '';
  const rawExternalUrl = currentNote?.externalUrl || params.externalUrl || '';
  const subjectName = currentNote?.subject || params.subject || 'Engineering Curriculum';
  const subjectCode = currentNote?.subjectCode || params.subjectCode || '';
  const unitName = currentNote?.unit || params.unit || 'Unit 1';
  const providerName = currentNote?.provider || params.provider || 'College Faculty';
  const teacher = currentNote?.teacherName || params.teacherName || '';
  const documentId = currentNote?.id || params.documentId || params.id || fileName;

  // Resolve preview and external link destinations
  const resolved = resolvePdfLinks(rawFileUrl, rawExternalUrl);

  const [downloadCompleted, setDownloadCompleted] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [webViewKey, setWebViewKey] = useState(0);
  const [webViewLoading, setWebViewLoading] = useState(true);
  const [webViewError, setWebViewError] = useState(false);
  const [openingExternalApp, setOpeningExternalApp] = useState(false);
  const [authToken, setAuthToken] = useState<string>('');
  const [pdfBase64, setPdfBase64] = useState<string | null>(null);
  const [pdfBase64Loading, setPdfBase64Loading] = useState<boolean>(() => Boolean(resolved.isDirectPdf));

  React.useEffect(() => {
    storage.getToken().then((tok) => {
      if (tok) setAuthToken(tok);
    });
  }, []);

  React.useEffect(() => {
    if (resolved.isDirectPdf) {
      loadPdfBase64(resolved.previewUrl || rawFileUrl, fileName)
        .then((b64) => {
          if (b64) setPdfBase64(b64);
        })
        .catch((err) => console.warn('Could not load base64 in pdf-viewer:', err))
        .finally(() => setPdfBase64Loading(false));
    }
  }, [resolved.isDirectPdf, resolved.previewUrl, rawFileUrl, fileName]);

  // Ask This PDF / Vinay AI Modal state
  const [askModalVisible, setAskModalVisible] = useState(false);
  const [askQuestion, setAskQuestion] = useState('');
  const [askLoading, setAskLoading] = useState(false);
  const [chatResponses, setChatResponses] = useState<{ q: string; a: string; citation?: string }[]>([]);

  const bookmarked = isBookmarked(documentId);

  const activityRecordedRef = React.useRef(false);

  React.useEffect(() => {
    let isMounted = true;
    isPdfSavedLocally(fileName).then((saved) => {
      if (isMounted && saved) setDownloadCompleted(true);
    });

    if (!activityRecordedRef.current && documentId) {
      activityRecordedRef.current = true;
      recordStudyActivity({
        resourceId: documentId,
        resourceType: 'NOTE',
        title: fileTitle,
        subject: subjectName,
        lastPage: 1,
        totalPages: 10,
        metadata: { fileUrl: rawFileUrl, fileName, externalUrl: rawExternalUrl },
      });
    }

    return () => {
      isMounted = false;
    };
  }, [documentId, fileName, fileTitle, subjectName, rawFileUrl, rawExternalUrl, recordStudyActivity]);

  const handleToggleBookmark = async () => {
    if (bookmarked) {
      await removeBookmark(documentId);
    } else {
      await addBookmark({
        resourceId: documentId,
        resourceType: 'NOTE',
        title: fileTitle,
        subject: subjectName,
        metadata: { fileUrl: rawFileUrl, fileName, externalUrl: rawExternalUrl },
      });
      Alert.alert('Bookmark Saved', 'Added to your Saved Materials.');
    }
  };

  const handleShare = async () => {
    try {
      const shareTarget = resolved.externalUrl || rawFileUrl;
      await sharePdfFile(shareTarget, fileName, fileTitle);
    } catch (err: any) {
      Alert.alert('Share Error', err.message || 'Unable to share document.');
    }
  };

  // Open the external destination (e.g. Google Drive app/web or external destination)
  // Keeps the in-app preview intact when switching back!
  const handleOpenExternalDestination = async () => {
    const targetUrl = resolved.externalUrl || rawFileUrl;
    if (!targetUrl) {
      Alert.alert('No External Link', 'No external link is configured for this material.');
      return;
    }

    // Direct PDFs and local files MUST be launched via external viewer / FileProvider (prevent FileUriExposedException)
    if (targetUrl.startsWith('file://') || targetUrl.startsWith('content://') || resolved.isDirectPdf) {
      await handleOpenInAndroidReader();
      return;
    }

    try {
      await Linking.openURL(targetUrl);
    } catch (err: any) {
      Alert.alert('Error Opening Link', err.message || 'Could not launch the external destination.');
    }
  };

  // Open in Android third-party PDF reader app (Adobe, Foxit, WPS)
  const handleOpenInAndroidReader = async () => {
    try {
      setOpeningExternalApp(true);
      await openPdfInExternalViewer({
        fileUrl: rawFileUrl || resolved.externalUrl,
        fileName,
        title: fileTitle,
        showDriveNotice: true,
      });
    } catch (err: any) {
      Alert.alert('Unable to Launch PDF Reader', err.message || 'An error occurred.');
    } finally {
      setOpeningExternalApp(false);
    }
  };

  const handleDownload = async () => {
    try {
      setDownloading(true);
      const downloadTarget = resolved.downloadUrl || rawFileUrl;
      await downloadPdfFile(downloadTarget, fileName);
      setDownloadCompleted(true);
      setDownloading(false);
      Alert.alert('Saved Offline', `"${fileName}" has been downloaded for offline revision.`);
    } catch (err: any) {
      setDownloading(false);
      Alert.alert('Download Failed', err.message || 'Unable to download file.');
    }
  };

  const handleAskDocument = async () => {
    if (!askQuestion.trim() || askLoading) return;
    const q = askQuestion.trim();
    setAskQuestion('');
    setAskLoading(true);

    try {
      const res = await askDocument(documentId, fileTitle, q);
      setChatResponses((prev) => [
        ...prev,
        { q, a: res.answer, citation: res.citation },
      ]);
    } catch (err: any) {
      Alert.alert('AI Assistant Error', err.message || 'Failed to query AI.');
    } finally {
      setAskLoading(false);
    }
  };

  const handleSafeBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)/notes');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header Bar */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleSafeBack} style={styles.headerBtn} activeOpacity={0.7}>
          <ArrowLeft size={20} color={THEME.white} />
        </TouchableOpacity>

        <View style={styles.titleContainer}>
          <View style={styles.subjectRow}>
            {subjectCode ? (
              <View style={styles.codeBadge}>
                <Text style={styles.codeBadgeText}>{subjectCode}</Text>
              </View>
            ) : null}
            <Text style={styles.subjectText} numberOfLines={1}>
              {subjectName}
            </Text>
          </View>
          <Text style={styles.fileTitleText} numberOfLines={1}>
            {fileTitle}
          </Text>
        </View>

        <View style={styles.headerRightActions}>
          <TouchableOpacity onPress={handleToggleBookmark} style={styles.iconBtn}>
            {bookmarked ? (
              <BookmarkCheck size={18} color={THEME.purple} />
            ) : (
              <Bookmark size={18} color={THEME.textSecondary} />
            )}
          </TouchableOpacity>

          <TouchableOpacity onPress={handleShare} style={styles.iconBtn}>
            <Share2 size={18} color={THEME.cyan} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Subheader Metadata Row */}
      <View style={styles.metaSubheader}>
        <View style={styles.metaRow}>
          {teacher ? (
            <Text style={styles.metaTeacherText}>
              Teacher: <Text style={{ color: THEME.white, fontWeight: '700' }}>{teacher}</Text> ({providerName})
            </Text>
          ) : (
            <Text style={styles.metaTeacherText}>{providerName}</Text>
          )}
          <Text style={styles.metaDot}>•</Text>
          <Text style={styles.metaPillText}>{unitName}</Text>
        </View>
      </View>

      {/* Embedded In-App PDF Preview Container */}
      <View style={styles.previewContainer}>
        {resolved.previewUrl ? (
          resolved.isDirectPdf ? (
            pdfBase64Loading ? (
              <View style={styles.loadingOverlay}>
                <ActivityIndicator size="large" color={THEME.cyan} />
                <Text style={styles.loadingOverlayText}>Reading Document Pages...</Text>
              </View>
            ) : (
              <WebView
                key={webViewKey}
                source={{ html: buildPdfViewerHtml(resolved.previewUrl, authToken, pdfBase64 || undefined) }}
                style={styles.webView}
                javaScriptEnabled={true}
                domStorageEnabled={true}
                startInLoadingState={true}
                scalesPageToFit={true}
                originWhitelist={['*']}
                mixedContentMode="always"
                allowFileAccess={true}
                onLoadStart={() => {
                  setWebViewLoading(true);
                  setWebViewError(false);
                }}
                onLoadEnd={() => {
                  setWebViewLoading(false);
                }}
                onError={() => {
                  setWebViewLoading(false);
                  setWebViewError(true);
                }}
              />
            )
          ) : (
            <WebView
              key={webViewKey}
              source={{ uri: resolved.previewUrl }}
              style={styles.webView}
              javaScriptEnabled={true}
              domStorageEnabled={true}
              startInLoadingState={true}
              scalesPageToFit={true}
              originWhitelist={['*']}
              mixedContentMode="always"
              allowFileAccess={true}
              onLoadStart={() => {
                setWebViewLoading(true);
                setWebViewError(false);
              }}
              onLoadEnd={() => {
                setWebViewLoading(false);
              }}
              onError={() => {
                setWebViewLoading(false);
                setWebViewError(true);
              }}
            />
          )
        ) : (
          <View style={styles.errorContainer}>
            <FileText size={40} color={THEME.textTertiary} />
            <Text style={styles.errorTitle}>Preview Not Available</Text>
            <Text style={styles.errorDesc}>
              This document does not have an in-app preview URL configured.
            </Text>
          </View>
        )}

        {/* Loading Overlay */}
        {webViewLoading && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color={THEME.cyan} />
            <Text style={styles.loadingOverlayText}>
              {resolved.isDrive ? 'Loading Google Drive Preview...' : 'Loading PDF Preview...'}
            </Text>
          </View>
        )}

        {/* Error Fallback Box */}
        {webViewError && (
          <View style={styles.errorOverlay}>
            <AlertTriangle size={36} color={THEME.gold} />
            <Text style={styles.errorTitle}>In-App Preview Unavailable</Text>
            <Text style={styles.errorDesc}>
              The embedded preview could not be displayed directly. You can open the document in your device PDF reader or external browser below.
            </Text>
            <TouchableOpacity 
              style={styles.retryBtn}
              onPress={() => {
                setWebViewError(false);
                setWebViewKey(prev => prev + 1);
              }}
            >
              <RotateCcw size={14} color={THEME.white} />
              <Text style={styles.retryBtnText}>Retry Preview</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Clearly Visible Prominent External Link Section (Below Preview) */}
      <View style={styles.bottomSection}>
        {/* Prominent Open External Link Button */}
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={handleOpenExternalDestination}
          style={[
            styles.openExternalBtn,
            resolved.isDrive ? styles.openDriveBtn : styles.openGenericBtn
          ]}
        >
          <ExternalLink size={17} color={THEME.white} />
          <Text style={styles.openExternalBtnText} numberOfLines={1}>
            {resolved.displayLabel}
          </Text>
        </TouchableOpacity>

        {/* Secondary Actions Row */}
        <View style={styles.secondaryActionsRow}>
          <TouchableOpacity 
            activeOpacity={0.7}
            onPress={handleOpenInAndroidReader}
            disabled={openingExternalApp}
            style={styles.secondaryBtn}
          >
            {openingExternalApp ? (
              <ActivityIndicator size="small" color={THEME.cyan} />
            ) : (
              <BookOpen size={14} color={THEME.cyan} />
            )}
            <Text style={styles.secondaryBtnText} numberOfLines={1}>External App</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            activeOpacity={0.7}
            onPress={handleDownload}
            disabled={downloading}
            style={styles.secondaryBtn}
          >
            {downloading ? (
              <ActivityIndicator size="small" color={THEME.purple} />
            ) : (
              <Download size={14} color={downloadCompleted ? THEME.green : THEME.purple} />
            )}
            <Text style={styles.secondaryBtnText} numberOfLines={1}>
              {downloadCompleted ? 'Saved' : 'Save Offline'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity 
            activeOpacity={0.7}
            onPress={() => setAskModalVisible(true)}
            style={[styles.secondaryBtn, styles.aiBtn]}
          >
            <Sparkles size={14} color={THEME.white} />
            <Text style={[styles.secondaryBtnText, { color: THEME.white }]} numberOfLines={1}>Ask AI</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Ask This PDF / Vinay AI Modal */}
      <Modal
        visible={askModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setAskModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View style={styles.aiIconBadge}>
                  <Sparkles size={16} color={THEME.purple} />
                </View>
                <View>
                  <Text style={styles.modalTitle}>Vinay AI • Ask Document</Text>
                  <Text style={styles.modalSubtitle} numberOfLines={1}>{fileTitle}</Text>
                </View>
              </View>
              <TouchableOpacity onPress={() => setAskModalVisible(false)} style={styles.closeBtn}>
                <X size={18} color={THEME.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* Launch Full Vinay AI Tutor Tab */}
            <TouchableOpacity
              activeOpacity={0.75}
              onPress={() => {
                setAskModalVisible(false);
                router.push({
                  pathname: '/(tabs)/ai-assistant',
                  params: {
                    noteId: documentId,
                    noteTitle: fileTitle,
                    initialPrompt: 'make 7 question proper',
                  },
                });
              }}
              style={styles.fullAiLaunchBar}
            >
              <Sparkles size={13} color={THEME.purple} />
              <Text style={styles.fullAiLaunchText}>Open in Vinay AI for 7-Mark Exam Solutions ↗</Text>
            </TouchableOpacity>

            <ScrollView style={styles.chatScroll} showsVerticalScrollIndicator={false}>
              {chatResponses.length === 0 ? (
                <View style={styles.emptyAiBox}>
                  <Text style={styles.emptyAiTitle}>Ask any concept from this material</Text>
                  <Text style={styles.emptyAiDesc}>
                    Generate high-yield 2-mark definitions, 7-mark university exam questions, or step-by-step explanations.
                  </Text>
                  <View style={styles.quickPromptRow}>
                    <TouchableOpacity
                      onPress={() => setAskQuestion("Generate 2 Marks Questions with Answers")}
                      style={styles.quickPill}
                    >
                      <Text style={styles.quickPillText}>2 Marks Q&A</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => setAskQuestion("Generate 7 Marks Questions with Detailed Answers")}
                      style={styles.quickPill}
                    >
                      <Text style={styles.quickPillText}>7 Marks Q&A</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                chatResponses.map((item, idx) => (
                  <View key={idx} style={styles.qaBox}>
                    <Text style={styles.qText}>Q: {item.q}</Text>
                    <Text style={styles.aText}>{item.a}</Text>
                    {item.citation ? (
                      <Text style={styles.citationText}>📎 {item.citation}</Text>
                    ) : null}
                  </View>
                ))
              )}

              {askLoading && (
                <View style={styles.aiLoadingRow}>
                  <ActivityIndicator size="small" color={THEME.purple} />
                  <Text style={styles.aiLoadingText}>Vinay AI is analyzing curriculum...</Text>
                </View>
              )}
            </ScrollView>

            <View style={styles.modalInputBar}>
              <TextInput
                style={styles.aiInput}
                value={askQuestion}
                onChangeText={setAskQuestion}
                placeholder="Ask a question about this material..."
                placeholderTextColor={THEME.textTertiary}
              />
              <TouchableOpacity
                onPress={handleAskDocument}
                disabled={!askQuestion.trim() || askLoading}
                style={[
                  styles.aiSendBtn,
                  (!askQuestion.trim() || askLoading) && { opacity: 0.5 }
                ]}
              >
                <Send size={16} color={THEME.white} />
              </TouchableOpacity>
            </View>
          </View>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: THEME.surfaceBorder,
    backgroundColor: THEME.surfaceCard,
  },
  headerBtn: {
    padding: 6,
    marginRight: 8,
  },
  titleContainer: {
    flex: 1,
    marginRight: 8,
  },
  subjectRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  codeBadge: {
    backgroundColor: THEME.cyanMuted,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: THEME.cyan + '40',
  },
  codeBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: THEME.cyan,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  subjectText: {
    fontSize: 12,
    fontWeight: '600',
    color: THEME.textSecondary,
  },
  fileTitleText: {
    fontSize: 14,
    fontWeight: '800',
    color: THEME.textPrimary,
  },
  headerRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  iconBtn: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: THEME.surfaceElevated,
  },
  metaSubheader: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: THEME.surfaceElevated,
    borderBottomWidth: 1,
    borderBottomColor: THEME.surfaceBorder,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  metaTeacherText: {
    fontSize: 11,
    color: THEME.textSecondary,
  },
  metaDot: {
    fontSize: 11,
    color: THEME.textTertiary,
  },
  metaPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: THEME.cyan,
  },
  previewContainer: {
    flex: 1,
    backgroundColor: '#1E222D',
    position: 'relative',
  },
  webView: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(11, 12, 16, 0.85)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingOverlayText: {
    color: THEME.textSecondary,
    fontSize: 13,
    fontWeight: '600',
  },
  errorOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: THEME.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 10,
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 8,
  },
  errorTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: THEME.textPrimary,
  },
  errorDesc: {
    fontSize: 12,
    color: THEME.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
    maxWidth: 320,
  },
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
    paddingHorizontal: 16,
    paddingVertical: 9,
    backgroundColor: THEME.purple,
    borderRadius: 10,
  },
  retryBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: THEME.white,
  },
  bottomSection: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 16,
    backgroundColor: THEME.surfaceCard,
    borderTopWidth: 1,
    borderTopColor: THEME.surfaceBorder,
    gap: 10,
  },
  openExternalBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 13,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 4,
  },
  openDriveBtn: {
    backgroundColor: '#2563EB', // Blue 600 like justintime Drive button
  },
  openGenericBtn: {
    backgroundColor: THEME.purple,
  },
  openExternalBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: THEME.white,
    letterSpacing: 0.3,
  },
  secondaryActionsRow: {
    flexDirection: 'row',
    gap: 6,
    width: '100%',
  },
  secondaryBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 9,
    paddingHorizontal: 4,
    backgroundColor: THEME.surfaceElevated,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: THEME.surfaceBorder,
    minWidth: 0,
  },
  aiBtn: {
    backgroundColor: THEME.purple,
    borderColor: THEME.purple,
  },
  secondaryBtnText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: THEME.textSecondary,
    flexShrink: 1,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: THEME.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '80%',
    paddingBottom: 24,
    borderWidth: 1,
    borderColor: THEME.surfaceBorder,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 18,
    borderBottomWidth: 1,
    borderBottomColor: THEME.surfaceBorder,
  },
  aiIconBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: THEME.purpleMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: THEME.textPrimary,
  },
  modalSubtitle: {
    fontSize: 11,
    color: THEME.textSecondary,
    maxWidth: 220,
  },
  closeBtn: {
    padding: 6,
  },
  fullAiLaunchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: THEME.purpleMuted,
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: THEME.surfaceBorder,
  },
  fullAiLaunchText: {
    fontSize: 12,
    fontWeight: '700',
    color: THEME.purple,
  },
  chatScroll: {
    padding: 16,
    maxHeight: 340,
  },
  emptyAiBox: {
    padding: 16,
    alignItems: 'center',
  },
  emptyAiTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: THEME.textPrimary,
    marginBottom: 4,
  },
  emptyAiDesc: {
    fontSize: 12,
    color: THEME.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 14,
  },
  quickPromptRow: {
    flexDirection: 'row',
    gap: 8,
  },
  quickPill: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 12,
    backgroundColor: THEME.surfaceCard,
    borderWidth: 1,
    borderColor: THEME.surfaceBorder,
  },
  quickPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: THEME.cyan,
  },
  qaBox: {
    backgroundColor: THEME.surfaceCard,
    padding: 12,
    borderRadius: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: THEME.surfaceBorder,
  },
  qText: {
    fontSize: 12,
    fontWeight: '800',
    color: THEME.purple,
    marginBottom: 6,
  },
  aText: {
    fontSize: 13,
    color: THEME.textPrimary,
    lineHeight: 19,
  },
  citationText: {
    fontSize: 10,
    color: THEME.textTertiary,
    marginTop: 6,
    fontStyle: 'italic',
  },
  aiLoadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
  },
  aiLoadingText: {
    fontSize: 12,
    color: THEME.textSecondary,
  },
  modalInputBar: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 10,
    gap: 8,
  },
  aiInput: {
    flex: 1,
    backgroundColor: THEME.surfaceCard,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: THEME.textPrimary,
    fontSize: 13,
    borderWidth: 1,
    borderColor: THEME.surfaceBorder,
  },
  aiSendBtn: {
    backgroundColor: THEME.purple,
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
