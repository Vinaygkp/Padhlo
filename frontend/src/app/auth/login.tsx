import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  KeyboardAvoidingView, 
  Platform
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { BookOpen, Eye, EyeOff, KeyRound, RotateCw } from 'lucide-react-native';
import { THEME } from '@/constants/theme';
import { Input } from '@/components/Input';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { useStudyHub } from '@/store/StudyHubContext';
import { openPortfolio } from '@/constants/portfolio';

export default function LoginScreen() {
  const router = useRouter();
  const { login, sendOtp, verifyOtpAndLogin } = useStudyHub();

  // Mode: 'PASSWORD' or 'OTP'
  const [authMode, setAuthMode] = useState<'PASSWORD' | 'OTP'>('PASSWORD');
  const [otpStep, setOtpStep] = useState<1 | 2>(1); // 1 = Request, 2 = Verify

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [infoMessage, setInfoMessage] = useState('');
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    let timer: any;
    if (cooldown > 0) {
      timer = setInterval(() => {
        setCooldown((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [cooldown]);

  // Standard Password Login
  const handlePasswordLogin = async () => {
    if (!email.trim()) {
      setError('Email address is required.');
      return;
    }
    if (!password.trim()) {
      setError('Password is required.');
      return;
    }

    setError('');
    setLoading(true);

    const sanitizedEmail = email.trim().toLowerCase().replace(/\.+/g, '.').replace('@.', '@');

    try {
      await login(sanitizedEmail, password.trim());
      setLoading(false);
      router.replace('/(tabs)');
    } catch (e: any) {
      setLoading(false);
      setError(e.message || 'Invalid email or password. Please check your credentials.');
    }
  };

  // Step 1: Send OTP for login
  const handleSendLoginOtp = async () => {
    if (!email.trim() || !email.includes('@')) {
      setError('Please enter a valid registered email address.');
      return;
    }

    setError('');
    setInfoMessage('');
    setLoading(true);

    try {
      const res = await sendOtp(email.trim().toLowerCase(), 'LOGIN');
      setLoading(false);
      if (res.success) {
        setOtpStep(2);
        setCooldown(res.cooldownSeconds || 45);
        setInfoMessage(res.message);
      } else {
        setError(res.message || 'Failed to send OTP.');
      }
    } catch (e: any) {
      setLoading(false);
      setError(e.message || 'Error communicating with auth server.');
    }
  };

  // Step 2: Verify OTP for login
  const handleVerifyLoginOtp = async () => {
    if (!otpCode.trim() || otpCode.trim().length !== 6) {
      setError('Please enter the 6-digit verification code.');
      return;
    }

    setError('');
    setLoading(true);

    try {
      const res = await verifyOtpAndLogin(email.trim().toLowerCase(), otpCode.trim(), 'LOGIN');
      setLoading(false);
      if (res.success) {
        router.replace('/(tabs)');
      } else {
        setError(res.message || 'Incorrect or expired OTP.');
      }
    } catch (e: any) {
      setLoading(false);
      setError(e.message || 'OTP verification failed.');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          {/* Logo Header */}
          <View style={styles.header}>
            <View style={styles.logoBadge}>
              <BookOpen size={34} color={THEME.purple} />
            </View>
            <View style={styles.logoRow}>
              <Text style={styles.logoPadh}>Padh</Text>
              <Text style={styles.logoLo}>lo</Text>
            </View>
            <Text style={styles.subtitle}>Smart Notes, Exams & Vinay AI</Text>
          </View>

          {/* Login Card */}
          <Card style={styles.card} variant="elevated">
            {/* Toggle Mode: Password Login vs Secure OTP Login */}
            <View style={styles.tabSwitchContainer}>
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => { setAuthMode('PASSWORD'); setError(''); setInfoMessage(''); }}
                style={[styles.tabSwitchBtn, authMode === 'PASSWORD' && styles.tabSwitchBtnActive]}
              >
                <Text style={[styles.tabSwitchText, authMode === 'PASSWORD' && styles.tabSwitchTextActive]}>
                  Password Sign In
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => { setAuthMode('OTP'); setOtpStep(1); setError(''); setInfoMessage(''); }}
                style={[styles.tabSwitchBtn, authMode === 'OTP' && styles.tabSwitchBtnActive]}
              >
                <Text style={[styles.tabSwitchText, authMode === 'OTP' && styles.tabSwitchTextActive]}>
                  OTP Sign In
                </Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.formTitle}>
              {authMode === 'PASSWORD' ? 'Welcome back' : otpStep === 1 ? 'Sign In with Verification Code' : 'Verify your email'}
            </Text>
            <Text style={styles.formSubtitle}>
              {authMode === 'PASSWORD' 
                ? 'Sign in to access your study materials.' 
                : otpStep === 1 
                  ? 'Enter your registered email address to receive a secure 6-digit code.'
                  : 'Enter the 6-digit code sent to your registered email address.'}
            </Text>

            {error ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            {infoMessage ? (
              <View style={styles.infoBox}>
                <Text style={styles.infoText}>{infoMessage}</Text>
              </View>
            ) : null}

            {/* A. Password Login Flow */}
            {authMode === 'PASSWORD' && (
              <>
                <Input
                  label="Email address"
                  value={email}
                  onChangeText={(t) => { setEmail(t); setError(''); }}
                  placeholder="enter email "
                  keyboardType="email-address"
                />

                <Input
                  label="Password"
                  value={password}
                  onChangeText={(t) => { setPassword(t); setError(''); }}
                  placeholder="Enter your password"
                  secureTextEntry={!showPassword}
                  rightIcon={showPassword ? <EyeOff size={18} color={THEME.textSecondary} /> : <Eye size={18} color={THEME.textSecondary} />}
                  onRightIconPress={() => setShowPassword(!showPassword)}
                />

                <TouchableOpacity 
                  activeOpacity={0.7}
                  onPress={() => {
                    setAuthMode('OTP');
                    setOtpStep(1);
                  }}
                  style={styles.forgotBtn}
                >
                  <Text style={styles.forgotText}>Sign in with verification code instead</Text>
                </TouchableOpacity>

                <Button
                  title="Sign In"
                  onPress={() => handlePasswordLogin()}
                  loading={loading}
                  size="lg"
                  variant="purple"
                  style={styles.loginBtn}
                />
              </>
            )}

            {/* B. OTP Login Flow */}
            {authMode === 'OTP' && (
              <>
                {otpStep === 1 ? (
                  <>
                    <Input
                      label="Email address"
                      value={email}
                      onChangeText={(t) => { setEmail(t); setError(''); }}
                      placeholder="enter email "
                      keyboardType="email-address"
                    />

                    <Button
                      title={loading ? "Sending code…" : "Send verification code"}
                      onPress={handleSendLoginOtp}
                      loading={loading}
                      size="lg"
                      variant="purple"
                      style={styles.loginBtn}
                    />
                  </>
                ) : (
                  <>
                    <View style={styles.otpHeaderBox}>
                      <View style={styles.otpIconCircle}>
                        <KeyRound size={22} color={THEME.cyan} />
                      </View>
                      <Text style={styles.otpTargetText}>We sent a verification code to <Text style={styles.boldText}>{email}</Text></Text>
                    </View>

                    <Input
                      label="Verification code"
                      value={otpCode}
                      onChangeText={(t) => { setOtpCode(t.replace(/[^0-9]/g, '')); setError(''); }}
                      placeholder="Enter 6-digit code"
                      keyboardType="numeric"
                      maxLength={6}
                    />

                    <Button
                      title={loading ? "Verifying…" : "Verify and continue"}
                      onPress={handleVerifyLoginOtp}
                      loading={loading}
                      size="lg"
                      variant="blue"
                      style={styles.loginBtn}
                    />

                    <View style={styles.resendRow}>
                      {cooldown > 0 ? (
                        <Text style={styles.cooldownText}>You can request another code in {cooldown} seconds.</Text>
                      ) : (
                        <TouchableOpacity onPress={handleSendLoginOtp} disabled={loading} style={styles.resendBtn}>
                          <RotateCw size={14} color={THEME.purple} />
                          <Text style={styles.resendBtnText}>Resend code</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </>
                )}
              </>
            )}

            {/* Register Footer */}
            <View style={styles.registerRow}>
              <Text style={styles.registerText}>Don&apos;t have an account? </Text>
              <TouchableOpacity onPress={() => router.push('/auth/register')}>
                <Text style={styles.registerLink}>Create account</Text>
              </TouchableOpacity>
            </View>

            {/* Developer Attribution Link */}
            <TouchableOpacity 
              activeOpacity={0.7} 
              onPress={openPortfolio} 
              style={styles.portfolioLink}
            >
              <Text style={styles.portfolioLinkText}>
                Engineered by <Text style={styles.portfolioAuthor}>vinay kumar</Text>
              </Text>
            </TouchableOpacity>
          </Card>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.background,
  },
  scrollContent: {
    padding: 24,
    paddingBottom: 48,
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
    marginTop: 10,
  },
  logoBadge: {
    width: 68,
    height: 68,
    borderRadius: 20,
    backgroundColor: THEME.surfaceCard,
    borderWidth: 1,
    borderColor: THEME.surfaceBorder,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logoPadh: {
    color: THEME.purple,
    fontSize: 34,
    fontWeight: '900',
    letterSpacing: -1,
  },
  logoLo: {
    color: THEME.cyan,
    fontSize: 34,
    fontWeight: '900',
    letterSpacing: -1,
  },
  subtitle: {
    color: THEME.textSecondary,
    fontSize: 13,
    marginTop: 4,
  },
  card: {
    padding: 20,
    borderRadius: 24,
    borderColor: THEME.surfaceBorder,
  },
  tabSwitchContainer: {
    flexDirection: 'row',
    backgroundColor: '#14141E',
    borderRadius: 12,
    padding: 3,
    marginBottom: 16,
  },
  tabSwitchBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 9,
    alignItems: 'center',
  },
  tabSwitchBtnActive: {
    backgroundColor: THEME.surfaceElevated,
    borderWidth: 1,
    borderColor: THEME.borderHighlight,
  },
  tabSwitchText: {
    color: THEME.textTertiary,
    fontSize: 13,
    fontWeight: '600',
  },
  tabSwitchTextActive: {
    color: THEME.textPrimary,
    fontWeight: '700',
  },
  formTitle: {
    color: THEME.textPrimary,
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  formSubtitle: {
    color: THEME.textSecondary,
    fontSize: 13,
    marginTop: 2,
    marginBottom: 16,
  },
  errorBox: {
    backgroundColor: THEME.redMuted,
    borderWidth: 1,
    borderColor: THEME.red,
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
  },
  errorText: {
    color: THEME.red,
    fontSize: 13,
    fontWeight: '500',
  },
  infoBox: {
    backgroundColor: THEME.purpleMuted,
    borderWidth: 1,
    borderColor: THEME.purple,
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
  },
  infoText: {
    color: THEME.textPrimary,
    fontSize: 13,
    fontWeight: '500',
  },
  forgotBtn: {
    alignSelf: 'flex-end',
    marginBottom: 16,
    paddingVertical: 4,
  },
  forgotText: {
    color: THEME.blue,
    fontSize: 12,
    fontWeight: '600',
  },
  loginBtn: {
    marginBottom: 20,
  },
  otpHeaderBox: {
    alignItems: 'center',
    marginBottom: 16,
  },
  otpIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: THEME.cyanMuted,
    borderWidth: 1,
    borderColor: THEME.cyan + '40',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  otpTargetText: {
    color: THEME.textSecondary,
    fontSize: 13,
  },
  boldText: {
    color: THEME.cyan,
    fontWeight: '700',
  },
  resendRow: {
    alignItems: 'center',
    marginBottom: 16,
  },
  cooldownText: {
    color: THEME.textTertiary,
    fontSize: 12,
  },
  resendBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  resendBtnText: {
    color: THEME.purple,
    fontSize: 13,
    fontWeight: '600',
  },
  registerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 16,
  },
  registerText: {
    color: THEME.textSecondary,
    fontSize: 13,
  },
  registerLink: {
    color: THEME.purple,
    fontSize: 13,
    fontWeight: '700',
  },
  portfolioLink: {
    marginTop: 20,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: THEME.surfaceBorder,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  portfolioLinkText: {
    fontSize: 12,
    color: THEME.textTertiary,
    textAlign: 'center',
  },
  portfolioAuthor: {
    color: THEME.purple,
    fontWeight: '800',
    textDecorationLine: 'underline',
  },
  portfolioPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(6, 182, 212, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(6, 182, 212, 0.3)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  portfolioPillText: {
    fontSize: 11,
    color: THEME.cyan,
    fontWeight: '700',
  },
});
