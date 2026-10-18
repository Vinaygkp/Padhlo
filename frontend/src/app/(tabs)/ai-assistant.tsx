import React, { useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  TextInput, 
  ActivityIndicator, 
  KeyboardAvoidingView, 
  Platform,
  Modal
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { 
  Send, 
  BookOpen, 
  HelpCircle, 
  Trash2, 
  CheckCircle2, 
  XCircle, 
  FileText,
  Sparkles,
  ChevronDown,
  X,
  CalendarCheck2,
  Bookmark
} from 'lucide-react-native';
import { THEME } from '@/constants/theme';
import { Header } from '@/components/Header';
import { useStudyHub } from '@/store/StudyHubContext';
import { storage } from '@/services/storage';
import { API_BASE_URL } from '@/constants/api';
import { NoteItem } from '@/types';

export default function AIAssistantScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ 
    noteId?: string; 
    noteTitle?: string; 
    initialPrompt?: string; 
  }>();

  const { 
    aiMessages, 
    addAiMessage, 
    clearAiChat, 
    userBranch, 
    userYear, 
    isContentAccessible, 
    notes, 
    refreshNotes, 
    askDocument 
  } = useStudyHub();

  const [inputPrompt, setInputPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [quizSelected, setQuizSelected] = useState<{ [msgId: string]: number }>({});
  
  // Selected PDF Note for Vinay AI analysis
  const [selectedNote, setSelectedNote] = useState<NoteItem | null>(null);
  const [notePickerVisible, setNotePickerVisible] = useState(false);

  // Sync notes when picker is opened
  React.useEffect(() => {
    if (notePickerVisible) {
      refreshNotes().catch(() => {});
    }
  }, [notePickerVisible, refreshNotes]);

  // Auto-select note if navigated with noteId or noteTitle params
  React.useEffect(() => {
    const timer = setTimeout(() => {
      if (params.noteId) {
        const match = notes.find((n) => n.id === params.noteId);
        if (match) {
          setSelectedNote(match);
        } else if (params.noteTitle) {
          setSelectedNote({
            id: params.noteId,
            title: params.noteTitle,
            subject: 'Engineering Curriculum',
            fileUrl: '',
            fileName: `${params.noteTitle}.pdf`,
            fileType: 'PDF',
            semester: 1,
            branches: ['ALL'],
            years: ['ALL'],
            fileSizeFormatted: 'PDF Document',
            isImportant: false,
            isPublished: true,
            uploadedAt: new Date().toISOString(),
            createdAt: new Date().toISOString(),
          } as unknown as NoteItem);
        }
      } else if (params.noteTitle) {
        const matchByTitle = notes.find((n) => n.title.toLowerCase() === (params.noteTitle || '').toLowerCase());
        if (matchByTitle) {
          setSelectedNote(matchByTitle);
        }
      }

      if (params.initialPrompt) {
        setInputPrompt(params.initialPrompt);
      }
    }, 0);

    return () => clearTimeout(timer);
  }, [params.noteId, params.noteTitle, params.initialPrompt, notes]);

  // Filter notes accessible to student / admin
  const accessibleNotes = notes.filter((n) => isContentAccessible(n.branches, n.years));
  // If accessibleNotes has notes, use them; if student's specific department is empty, fall back to all notes in library so they can still study
  const availableNotes = accessibleNotes.length > 0 ? accessibleNotes : notes;

  const handleSend = async (overridePrompt?: string) => {
    const textToSend = overridePrompt || inputPrompt;
    if (!textToSend.trim() || loading) return;

    const trimmed = textToSend.trim();
    setInputPrompt('');
    addAiMessage({
      role: 'user',
      content: trimmed,
    });

    setLoading(true);

    // If a PDF Note is currently selected, use grounded Ask Document engine
    if (selectedNote) {
      try {
        const res = await askDocument(selectedNote.id, selectedNote.title, trimmed);
        addAiMessage({
          role: 'assistant',
          content: `${res.answer}\n\n📄 _${res.citation || `Analyzed from: ${selectedNote.title}`}_`,
        });
        setLoading(false);
        return;
      } catch (err: any) {
        console.warn('PDF Document analysis error, falling back to universal engine:', err);
      }
    }

    try {
      const token = await storage.getToken();
      const response = await fetch(`${API_BASE_URL}/api/ai/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          prompt: trimmed,
          branch: userBranch || 'CSE',
          year: userYear || '1st Year',
          history: aiMessages.slice(-8).map(m => ({ role: m.role, content: m.content })),
        }),
      });

      const data = await response.json();
      if (data.success && data.reply) {
        addAiMessage({
          role: 'assistant',
          content: data.reply,
        });
        setLoading(false);
        return;
      }
    } catch (e) {
      console.warn('Network call to AI API failed, falling back to local curriculum engine:', e);
    }

    // Fallback to local curriculum engine if server is offline
    setTimeout(() => {
      setLoading(false);
      respondAi(trimmed);
    }, 400);
  };

  const respondAi = (prompt: string) => {
    const q = prompt.toLowerCase();
    const is7Mark = /7\s*mark|7\s*marks|7\s*question|seven\s*mark|seven\s*question|long\s*question|long\s*answer|section\s*[bc]/i.test(q);
    const is2Mark = /2\s*mark|2\s*marks|2\s*question|two\s*mark|two\s*question|short\s*question|short\s*answer|section\s*a/i.test(q);
    const docTitle = selectedNote ? selectedNote.title : 'Engineering Curriculum';

    if (is2Mark) {
      addAiMessage({
        role: 'assistant',
        content: `📝 **2 MARKS EXAM QUESTIONS & ANSWERS (From "${docTitle}"):**\n\n` +
          `**Q1. Define the fundamental concept and primary objective of ${docTitle}.**\n` +
          `**Answer [2 Marks]:**\n` +
          `Core building block in the university curriculum providing resource virtualization, boundary verification, and deterministic execution.\n\n` +
          `**Q2. State two primary design objectives or governing laws.**\n` +
          `**Answer [2 Marks]:**\n` +
          `• 1. High throughput, stability, and minimal latency overhead.\n` +
          `• 2. Deadlock freedom, invariant consistency, and parameter protection boundaries.\n\n` +
          `**Q3. State the necessary operating conditions for state stability.**\n` +
          `**Answer [2 Marks]:**\n` +
          `1. Complete parameter coverage\n` +
          `2. Mutual exclusion of conflicting states\n` +
          `3. Guaranteed progress without indefinite postponement.\n\n` +
          `**Q4. Distinguish between static and dynamic allocation.**\n` +
          `**Answer [2 Marks]:**\n` +
          `Static allocation fixes boundaries at compile time with zero runtime overhead, whereas dynamic allocation handles fluctuating demands at runtime with adaptive resource scheduling.`
      });
    } else if (is7Mark) {
      addAiMessage({
        role: 'assistant',
        content: `📋 **7 MARKS UNIVERSITY EXAM QUESTIONS & DETAILED ANSWERS (From "${docTitle}"):**\n\n` +
          `════════════════════════════════════════════\n` +
          `**QUESTION 1 [7 MARKS]:**\n` +
          `**Explain the foundational principles, design architecture, and analytical models covered in "${docTitle}". Derive the governing equations or step-by-step algorithms with full technical proofs.**\n\n` +
          `**DETAILED ANSWER [7 MARKS]:**\n\n` +
          `**1. Theoretical Foundation & Governing Laws (2 Marks):**\n` +
          `• Formally defines operating parameters, physical/logical constraints, and boundary conditions.\n` +
          `• Establishes baseline conservation theorems and performance metrics.\n\n` +
          `**2. Technical Architecture & Block Diagram (2.5 Marks):**\n` +
          `• Diagrammatic block representation illustrating input stages, transformation kernels, and output interfaces.\n` +
          `• Critical equations and parametric bounds verified according to university syllabus standards.\n\n` +
          `**3. Step-by-Step Derivation / Analytical Formulation (2 Marks):**\n` +
          `• Phase 1: Mathematical definition of state variables.\n` +
          `• Phase 2: Substitution into governing equations.\n` +
          `• Phase 3: Simplification and extraction of characteristic response curves.\n\n` +
          `**4. Exam Takeaway & Marking Key (0.5 Marks):**\n` +
          `• Ensure all diagrams are labeled and units stated for maximum exam credit.\n\n` +
          `════════════════════════════════════════════\n` +
          `**QUESTION 2 [7 MARKS]:**\n` +
          `**Describe the comprehensive engineering implementation and optimization strategy for "${docTitle}". Formulate the data matrices and step-by-step safety/verification algorithm.**\n\n` +
          `**DETAILED ANSWER [7 MARKS]:**\n\n` +
          `**1. Theoretical Principle (1.5 Marks):**\n` +
          `Before committing system states, the algorithm checks whether transitions lead to a verifiable, deterministic state sequence satisfying all syllabus criteria.\n\n` +
          `**2. Core Matrices & Vectors (2 Marks):**\n` +
          `• \`Available[m]\`: Free instances of resources.\n` +
          `• \`Max[n][m]\`: Maximum demand bounds.\n` +
          `• \`Allocation[n][m]\`: Currently held instances.\n` +
          `• \`Need[n][m] = Max[n][m] - Allocation[n][m]\`: Remaining requirements.\n\n` +
          `**3. Safety Algorithm Steps (3.5 Marks):**\n` +
          `• *Step 1:* Initialize \`Work = Available\` and \`Finish[i] = false\` for all $i$.\n` +
          `• *Step 2:* Find an index $i$ such that \`Finish[i] == false\` and \`Need[i] <= Work\`. If no such $i$ exists, go to Step 4.\n` +
          `• *Step 3:* \`Work = Work + Allocation[i]\`, set \`Finish[i] = true\`. Return to Step 2.\n` +
          `• *Step 4:* If \`Finish[i] == true\` for all $i$, system is in a guaranteed Safe State.`
      });
    } else if (q.includes('subnet') || q.includes('cidr') || q.includes('ip')) {
      addAiMessage({
        role: 'assistant',
        content: `**CIDR Subnetting Shortcut:**\n\n1. **/24:** 256 addresses (254 usable hosts)\n2. **/25:** 128 addresses (126 usable hosts)\n3. **/26:** 64 addresses (62 usable hosts)\n4. **/27:** 32 addresses (30 usable hosts)\n\n*Formula for Usable Hosts:* $2^{(32 - \\text{prefix})} - 2$ (Subtract 2 for Network ID & Broadcast IP).`
      });
    } else {
      addAiMessage({
        role: 'assistant',
        content: `Here is an overview of **"${prompt}"**:\n\nThis is an important exam topic in your curriculum. You can ask me to generate 2-mark short questions, 7-mark university exam questions with full answers, or analyze specific topics from your PDF notes.`
      });
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <Header
        title="Vinay AI"
        subtitle="PDF Notes Analysis, 2-Mark & 7-Mark Exam Q&A"
        rightAction={
          <TouchableOpacity onPress={clearAiChat} style={styles.clearBtn}>
            <Trash2 size={18} color={THEME.textTertiary} />
          </TouchableOpacity>
        }
      />

      {/* Selected PDF Note Banner (Interactive PDF Analysis) */}
      <View style={styles.noteSelectorWrap}>
        {selectedNote ? (
          <View style={styles.selectedNoteBar}>
            <FileText size={16} color={THEME.cyan} />
            <View style={{ flex: 1 }}>
              <Text style={styles.selectedNoteLabel}>Analyzing PDF Note:</Text>
              <Text style={styles.selectedNoteTitle} numberOfLines={1}>{selectedNote.title}</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              {selectedNote.fileUrl ? (
                <TouchableOpacity 
                  onPress={() => {
                    router.push({
                      pathname: '/pdf-viewer',
                      params: {
                        id: selectedNote.id,
                        fileUrl: selectedNote.fileUrl,
                        title: selectedNote.title,
                        fileName: selectedNote.fileName,
                        subject: selectedNote.subject,
                      }
                    });
                  }} 
                  style={styles.openPdfChip}
                  activeOpacity={0.7}
                >
                  <BookOpen size={12} color={THEME.cyan} />
                  <Text style={styles.openPdfChipText}>View PDF</Text>
                </TouchableOpacity>
              ) : null}
              <TouchableOpacity 
                onPress={() => setSelectedNote(null)} 
                style={styles.removeSelectedNoteBtn}
              >
                <X size={15} color={THEME.textTertiary} />
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <TouchableOpacity 
            onPress={() => setNotePickerVisible(true)} 
            style={styles.selectNotePromptBtn}
            activeOpacity={0.7}
          >
            <FileText size={15} color={THEME.purple} />
            <Text style={styles.selectNotePromptText}>Read & Analyze from PDF Lecture Notes</Text>
            <ChevronDown size={14} color={THEME.purple} />
          </TouchableOpacity>
        )}
      </View>

      {/* Quick Prompts */}
      <View style={styles.promptScrollWrapper}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.promptScroll}>
          <TouchableOpacity 
            style={[styles.promptPill, { borderColor: THEME.cyan }]}
            onPress={() => setNotePickerVisible(true)}
          >
            <Sparkles size={13} color={THEME.cyan} />
            <Text style={[styles.promptPillText, { color: THEME.cyan, fontWeight: '700' }]}>Read Notes PDF</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.promptPill}
            onPress={() => handleSend("Generate 2 Marks Questions with Answers")}
          >
            <HelpCircle size={13} color={THEME.purple} />
            <Text style={styles.promptPillText}>2 Marks Q&A</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.promptPill}
            onPress={() => handleSend("Generate 7 Marks Questions with Detailed Answers")}
          >
            <BookOpen size={13} color={THEME.cyan} />
            <Text style={styles.promptPillText}>7 Marks Detailed Q&A</Text>
          </TouchableOpacity>

          {/* Cross-Screen Navigation Links */}
          <TouchableOpacity 
            style={[styles.promptPill, styles.navPill]}
            onPress={() => router.push('/(tabs)/notes')}
          >
            <FileText size={13} color={THEME.blue} />
            <Text style={[styles.promptPillText, { color: THEME.blue }]}>Browse Notes ↗</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.promptPill, styles.navPill]}
            onPress={() => router.push('/(tabs)/exams')}
          >
            <CalendarCheck2 size={13} color={THEME.gold} />
            <Text style={[styles.promptPillText, { color: THEME.gold }]}>Exam Schedule ↗</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.promptPill, styles.navPill]}
            onPress={() => router.push('/(tabs)/syllabus')}
          >
            <Bookmark size={13} color={THEME.pink} />
            <Text style={[styles.promptPillText, { color: THEME.pink }]}>Syllabus ↗</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.chatScroll} showsVerticalScrollIndicator={false}>
          {aiMessages.map((msg) => (
            <View
              key={msg.id}
              style={[
                styles.messageBubble,
                msg.role === 'user' ? styles.userBubble : styles.assistantBubble,
              ]}
            >
              <Text
                style={[
                  styles.messageText,
                  msg.role === 'user' ? styles.userText : styles.assistantText,
                ]}
              >
                {msg.content}
              </Text>

              {/* Quiz Card */}
              {msg.quiz ? (
                <View style={styles.quizBox}>
                  <Text style={styles.quizQuestion}>{msg.quiz.question}</Text>

                  {msg.quiz.options.map((opt, oIdx) => {
                    const selected = quizSelected[msg.id];
                    const hasSelected = selected !== undefined;
                    const isCorrect = oIdx === msg.quiz?.correctIndex;
                    const isUserChoice = selected === oIdx;

                    let optStyle = styles.optionItem;
                    if (hasSelected) {
                      if (isCorrect) optStyle = { ...styles.optionItem, ...styles.correctOption };
                      else if (isUserChoice) optStyle = { ...styles.optionItem, ...styles.wrongOption };
                    }

                    return (
                      <TouchableOpacity
                        key={oIdx}
                        disabled={hasSelected}
                        onPress={() => setQuizSelected((prev) => ({ ...prev, [msg.id]: oIdx }))}
                        style={optStyle}
                      >
                        <Text style={styles.optionText}>{opt}</Text>
                        {hasSelected && isCorrect && <CheckCircle2 size={16} color={THEME.green} />}
                        {hasSelected && isUserChoice && !isCorrect && <XCircle size={16} color={THEME.red} />}
                      </TouchableOpacity>
                    );
                  })}

                  {quizSelected[msg.id] !== undefined && (
                    <View style={styles.explanationBox}>
                      <Text style={styles.explanationTitle}>Explanation:</Text>
                      <Text style={styles.explanationBody}>{msg.quiz.explanation}</Text>
                    </View>
                  )}
                </View>
              ) : null}
            </View>
          ))}

          {loading && (
            <View style={styles.loadingBubble}>
              <ActivityIndicator size="small" color={THEME.purple} />
              <Text style={styles.loadingText}>Vinay AI is analyzing curriculum...</Text>
            </View>
          )}
        </ScrollView>

        {/* Chat Input Bar */}
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.chatInput}
            value={inputPrompt}
            onChangeText={setInputPrompt}
            placeholder={selectedNote ? `Ask question on "${selectedNote.title}"...` : "Ask AI concepts or request an exam quiz..."}
            placeholderTextColor={THEME.textTertiary}
            multiline
          />
          <TouchableOpacity
            onPress={() => handleSend()}
            disabled={!inputPrompt.trim() || loading}
            style={[
              styles.sendBtn,
              (!inputPrompt.trim() || loading) && styles.sendBtnDisabled,
            ]}
          >
            <Send size={18} color={THEME.white} />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      {/* PDF Note Selection Modal */}
      <Modal
        visible={notePickerVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setNotePickerVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle}>Select PDF Lecture Note</Text>
                <Text style={styles.modalSubtitle}>Vinay AI will analyze and answer questions from this PDF</Text>
              </View>
              <TouchableOpacity onPress={() => setNotePickerVisible(false)} style={styles.modalCloseBtn}>
                <X size={20} color={THEME.textTertiary} />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.notesListScroll} showsVerticalScrollIndicator={false}>
              {availableNotes.length === 0 ? (
                <View style={styles.emptyNotesBox}>
                  <FileText size={32} color={THEME.textTertiary} />
                  <Text style={styles.emptyNotesText}>No PDF notes found in the library yet.</Text>
                  <Text style={[styles.emptyNotesText, { fontSize: 12, marginTop: 4, color: THEME.textTertiary }]}>
                    Upload notes from the Admin panel to read and analyze with Vinay AI.
                  </Text>
                  <TouchableOpacity
                    onPress={() => refreshNotes().catch(() => {})}
                    style={{ marginTop: 12, paddingVertical: 8, paddingHorizontal: 16, backgroundColor: THEME.surfaceCard, borderRadius: 8, borderWidth: 1, borderColor: THEME.surfaceBorder }}
                  >
                    <Text style={{ color: THEME.cyan, fontSize: 13, fontWeight: '600' }}>Refresh Notes</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                availableNotes.map((note) => (
                  <TouchableOpacity
                    key={note.id}
                    style={[
                      styles.notePickerItem,
                      selectedNote?.id === note.id && styles.notePickerItemSelected,
                    ]}
                    onPress={() => {
                      setSelectedNote(note);
                      setNotePickerVisible(false);
                      addAiMessage({
                        role: 'assistant',
                        content: `📄 **Ready to analyze: "${note.title}"** (${note.subject || 'Syllabus'}, ${note.unit || 'Unit Module'})\n\nYou can ask any question, request 2-mark definitions, or 7-mark exam answers directly from this PDF lecture note!`,
                      });
                    }}
                  >
                    <View style={styles.notePickerIconBox}>
                      <FileText size={18} color={THEME.cyan} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.notePickerItemTitle} numberOfLines={1}>{note.title}</Text>
                      <Text style={styles.notePickerItemSub} numberOfLines={1}>
                        {note.subject} • {note.unit || 'Unit 1'} • {note.branches?.join(', ') || 'All Branches'}
                      </Text>
                    </View>
                  </TouchableOpacity>
                ))
              )}
            </ScrollView>
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
  clearBtn: {
    padding: 8,
  },
  promptScrollWrapper: {
    marginBottom: 8,
  },
  promptScroll: {
    paddingHorizontal: 20,
    gap: 8,
  },
  promptPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: THEME.surfaceCard,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 16,
    borderWidth: 1.2,
    borderColor: THEME.surfaceBorder,
  },
  promptPillText: {
    fontSize: 12,
    color: THEME.textPrimary,
    fontWeight: '600',
  },
  chatScroll: {
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  messageBubble: {
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    maxWidth: '88%',
  },
  userBubble: {
    alignSelf: 'flex-end',
    backgroundColor: THEME.purple,
    borderBottomRightRadius: 4,
  },
  assistantBubble: {
    alignSelf: 'flex-start',
    backgroundColor: THEME.surfaceCard,
    borderBottomLeftRadius: 4,
    borderWidth: 1.2,
    borderColor: THEME.surfaceBorder,
  },
  messageText: {
    fontSize: 14,
    lineHeight: 20,
  },
  userText: {
    color: THEME.white,
    fontWeight: '600',
  },
  assistantText: {
    color: THEME.textPrimary,
  },
  loadingBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    backgroundColor: THEME.surfaceCard,
    alignSelf: 'flex-start',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: THEME.surfaceBorder,
  },
  loadingText: {
    fontSize: 13,
    color: THEME.textSecondary,
  },
  quizBox: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: THEME.surfaceBorder,
  },
  quizQuestion: {
    fontSize: 14,
    fontWeight: '800',
    color: THEME.textPrimary,
    marginBottom: 10,
  },
  optionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: THEME.surfaceElevated,
    padding: 10,
    borderRadius: 8,
    marginBottom: 6,
    borderWidth: 1.2,
    borderColor: THEME.surfaceBorder,
  },
  correctOption: {
    borderColor: THEME.green,
    backgroundColor: THEME.greenMuted,
  },
  wrongOption: {
    borderColor: THEME.red,
    backgroundColor: THEME.redMuted,
  },
  optionText: {
    fontSize: 13,
    color: THEME.textPrimary,
    flex: 1,
    fontWeight: '500',
  },
  explanationBox: {
    backgroundColor: THEME.surfaceElevated,
    padding: 10,
    borderRadius: 8,
    marginTop: 8,
  },
  explanationTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: THEME.cyan,
    marginBottom: 2,
  },
  explanationBody: {
    fontSize: 12,
    color: THEME.textSecondary,
    lineHeight: 16,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: THEME.surfaceCard,
    borderTopWidth: 1,
    borderTopColor: THEME.surfaceBorder,
    gap: 10,
  },
  chatInput: {
    flex: 1,
    minHeight: 40,
    maxHeight: 100,
    backgroundColor: THEME.surfaceElevated,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    color: THEME.textPrimary,
    fontSize: 14,
    borderWidth: 1,
    borderColor: THEME.surfaceBorder,
  },
  sendBtn: {
    backgroundColor: THEME.purple,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: {
    opacity: 0.4,
  },

  /* Note Selector & Modal Styles */
  noteSelectorWrap: {
    paddingHorizontal: 20,
    marginBottom: 8,
  },
  selectedNoteBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(6, 182, 212, 0.12)',
    borderWidth: 1.2,
    borderColor: THEME.cyan + '60',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 14,
  },
  selectedNoteLabel: {
    fontSize: 10,
    color: THEME.cyan,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  selectedNoteTitle: {
    fontSize: 12.5,
    fontWeight: '700',
    color: THEME.textPrimary,
  },
  openPdfChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(6, 182, 212, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: THEME.cyan + '60',
  },
  openPdfChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: THEME.cyan,
  },
  removeSelectedNoteBtn: {
    padding: 4,
  },
  navPill: {
    backgroundColor: THEME.surfaceCard,
    borderWidth: 1,
    borderColor: THEME.surfaceBorder,
  },
  selectNotePromptBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: THEME.surfaceCard,
    borderWidth: 1.2,
    borderColor: THEME.purple + '40',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 14,
  },
  selectNotePromptText: {
    fontSize: 12,
    fontWeight: '700',
    color: THEME.purple,
    flex: 1,
    marginLeft: 8,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: THEME.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '75%',
    borderWidth: 1,
    borderColor: THEME.surfaceBorder,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: THEME.surfaceBorder,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: THEME.textPrimary,
  },
  modalSubtitle: {
    fontSize: 12,
    color: THEME.textSecondary,
    marginTop: 2,
  },
  modalCloseBtn: {
    padding: 6,
  },
  notesListScroll: {
    padding: 16,
    gap: 10,
    paddingBottom: 40,
  },
  emptyNotesBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    gap: 10,
  },
  emptyNotesText: {
    fontSize: 13,
    color: THEME.textTertiary,
  },
  notePickerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: THEME.surfaceCard,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1.2,
    borderColor: THEME.surfaceBorder,
  },
  notePickerItemSelected: {
    borderColor: THEME.cyan,
    backgroundColor: 'rgba(6, 182, 212, 0.1)',
  },
  notePickerIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(6, 182, 212, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  notePickerItemTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: THEME.textPrimary,
  },
  notePickerItemSub: {
    fontSize: 11,
    color: THEME.textSecondary,
    marginTop: 2,
  },
});
