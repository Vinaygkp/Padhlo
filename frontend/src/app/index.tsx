import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { useRouter } from 'expo-router';
import { BookOpen } from 'lucide-react-native';
import { THEME } from '@/constants/theme';
import { useStudyHub } from '@/store/StudyHubContext';

export default function SplashScreen() {
  const router = useRouter();
  const { isLoading, isAuthenticated, currentUser } = useStudyHub();

  const [progress] = useState(() => new Animated.Value(0));
  const [fadeAnim] = useState(() => new Animated.Value(0));
  const [scaleAnim] = useState(() => new Animated.Value(0.85));

  useEffect(() => {
    // Fade & scale in logo
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 6,
        useNativeDriver: true,
      }),
      Animated.timing(progress, {
        toValue: 1,
        duration: 1800,
        useNativeDriver: false,
      }),
    ]).start();
  }, [fadeAnim, progress, scaleAnim]);

  useEffect(() => {
    if (isLoading) return;

    const timer = setTimeout(() => {
      if (isAuthenticated && currentUser) {
        router.replace('/(tabs)');
      } else {
        router.replace('/auth/login');
      }
    }, 2000);

    return () => clearTimeout(timer);
  }, [isLoading, isAuthenticated, currentUser, router]);

  const progressWidth = progress.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.brandContainer, { opacity: fadeAnim, transform: [{ scale: scaleAnim }] }]}>
        <View style={styles.logoBadge}>
          <BookOpen size={44} color={THEME.purple} />
        </View>

        <View style={styles.logoRow}>
          <Text style={styles.logoTextPadh}>Padh</Text>
          <Text style={styles.logoTextLo}>lo</Text>
        </View>

        <Text style={styles.tagline}>Padho. Seekho. Aage Badho.</Text>
      </Animated.View>

      {/* Futuristic animated loading progress */}
      <View style={styles.progressContainer}>
        <View style={styles.progressTrack}>
          <Animated.View style={[styles.progressBar, { width: progressWidth }]} />
        </View>
        <Text style={styles.loadingText}>Loading Padhlo...</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.background,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  brandContainer: {
    alignItems: 'center',
    marginBottom: 60,
  },
  logoBadge: {
    width: 88,
    height: 88,
    borderRadius: 24,
    backgroundColor: THEME.surfaceCard,
    borderWidth: 1.5,
    borderColor: THEME.purple + '70',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    shadowColor: THEME.purple,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.45,
    shadowRadius: 18,
    elevation: 8,
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logoTextPadh: {
    fontSize: 44,
    fontWeight: '900',
    color: THEME.purple,
    letterSpacing: -1,
  },
  logoTextLo: {
    fontSize: 44,
    fontWeight: '900',
    color: THEME.cyan,
    letterSpacing: -1,
  },
  tagline: {
    fontSize: 14,
    color: THEME.textSecondary,
    fontWeight: '700',
    marginTop: 8,
    letterSpacing: 1.1,
  },
  progressContainer: {
    width: '70%',
    alignItems: 'center',
  },
  progressTrack: {
    width: '100%',
    height: 4,
    backgroundColor: THEME.surfaceBorder,
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: 12,
  },
  progressBar: {
    height: '100%',
    backgroundColor: THEME.purple,
  },
  loadingText: {
    fontSize: 12,
    color: THEME.textTertiary,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
});
