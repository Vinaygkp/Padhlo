import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  ActivityIndicator,
} from 'react-native';
import { Quote, RotateCw } from 'lucide-react-native';
import { THEME } from '@/constants/theme';
import { DailyThought } from '@/types';
import { thoughtService } from '@/services/thoughtService';

interface ThoughtOfTheDayProps {
  onRefreshSuccess?: (thought: DailyThought) => void;
}

export const ThoughtOfTheDay: React.FC<ThoughtOfTheDayProps> = ({ onRefreshSuccess }) => {
  const [thought, setThought] = useState<DailyThought | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  
  // Animation values for subtle fade-in and smooth refresh
  const [fadeAnim] = useState(() => new Animated.Value(0));
  const [rotateAnim] = useState(() => new Animated.Value(0));

  // Mount effect: Load today's thought once
  useEffect(() => {
    let isMounted = true;

    async function loadThought() {
      try {
        const item = await thoughtService.getThoughtForToday(false);
        if (isMounted) {
          setThought(item);
          setLoading(false);
          Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 600,
            useNativeDriver: true,
          }).start();
        }
      } catch {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    loadThought();

    return () => {
      isMounted = false;
    };
  }, [fadeAnim]);

  const handleManualRefresh = async () => {
    if (refreshing || loading) return;

    setRefreshing(true);

    // Spin animation for the refresh button
    rotateAnim.setValue(0);
    Animated.timing(rotateAnim, {
      toValue: 1,
      duration: 800,
      useNativeDriver: true,
    }).start();

    // Subtle fade down and up on refresh
    Animated.timing(fadeAnim, {
      toValue: 0.3,
      duration: 200,
      useNativeDriver: true,
    }).start();

    try {
      const fresh = await thoughtService.getThoughtForToday(true);
      setThought(fresh);
      if (onRefreshSuccess) {
        onRefreshSuccess(fresh);
      }
    } catch {
      // Retain existing thought if error
    } finally {
      setRefreshing(false);
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }).start();
    }
  };

  const spin = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <View style={styles.cardContainer}>
      {/* Subtle outer gradient border effect */}
      <View style={styles.gradientBorderLayer}>
        <View style={styles.innerCard}>
          {/* Header Row: Glowing quote badge, Title & Refresh Action */}
          <View style={styles.headerRow}>
            <View style={styles.headerLeft}>
              <View style={styles.iconGlowWrap}>
                <Quote size={12} color={THEME.cyan} />
              </View>
              <Text style={styles.headingTitle} numberOfLines={1}>THOUGHT OF THE DAY</Text>
            </View>

            <TouchableOpacity
              activeOpacity={0.7}
              onPress={handleManualRefresh}
              disabled={refreshing || loading}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              style={styles.refreshButton}
            >
              <Animated.View style={{ transform: [{ rotate: spin }] }}>
                {refreshing ? (
                  <ActivityIndicator size="small" color={THEME.purple} />
                ) : (
                  <RotateCw size={13} color={THEME.textSecondary} />
                )}
              </Animated.View>
            </TouchableOpacity>
          </View>

          {/* Body Content with Fade-In Animation */}
          {loading ? (
            <View style={styles.skeletonContainer}>
              <ActivityIndicator size="small" color={THEME.blue} />
              <Text style={styles.loadingText}>Fetching daily wisdom...</Text>
            </View>
          ) : (
            <Animated.View style={[styles.contentWrap, { opacity: fadeAnim }]}>
              <Text style={styles.quoteText}>
                &ldquo;{thought?.quote}&rdquo;
              </Text>
              
              <View style={styles.authorRow}>
                <View style={styles.authorLine} />
                <Text style={styles.authorText}>
                  {thought?.author || 'Unknown'}
                </Text>
              </View>
            </Animated.View>
          )}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  cardContainer: {
    marginBottom: 16,
    borderRadius: 16,
    overflow: 'hidden',
  },
  gradientBorderLayer: {
    borderRadius: 16,
    padding: 1, // 1px glowing edge effect
    backgroundColor: '#26243A', // dark purple-blue border glow
    borderColor: '#382B5A',
    borderWidth: 1,
  },
  innerCard: {
    backgroundColor: '#0F1017', // Dark charcoal/slate
    borderRadius: 15,
    paddingHorizontal: 16,
    paddingTop: 13,
    paddingBottom: 14,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconGlowWrap: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: THEME.cyanMuted,
    borderWidth: 1,
    borderColor: THEME.cyan + '40',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headingTitle: {
    color: THEME.purple,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dateLabel: {
    color: THEME.textTertiary,
    fontSize: 11,
    fontWeight: '500',
  },
  refreshButton: {
    padding: 4,
    borderRadius: 8,
    backgroundColor: '#171722',
  },
  skeletonContainer: {
    paddingVertical: 14,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
  },
  loadingText: {
    color: THEME.textTertiary,
    fontSize: 12,
    fontWeight: '500',
  },
  contentWrap: {
    paddingTop: 2,
  },
  quoteText: {
    color: THEME.textPrimary,
    fontSize: 13.5,
    lineHeight: 20,
    fontStyle: 'italic',
    fontWeight: '400',
  },
  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 8,
  },
  authorLine: {
    width: 14,
    height: 1.5,
    backgroundColor: THEME.blue,
    borderRadius: 1,
  },
  authorText: {
    color: THEME.blue,
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
});
