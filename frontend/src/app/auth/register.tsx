import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  KeyboardAvoidingView, 
  Platform,
  Alert
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Eye, EyeOff, ArrowLeft, ShieldAlert, KeyRound, RotateCw, CheckCircle2 } from 'lucide-react-native';
import { THEME } from '@/constants/theme';
import { Input } from '@/components/Input';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { BranchDropdown } from '@/components/BranchDropdown';
import { YearDropdown } from '@/components/YearDropdown';
import { useStudyHub } from '@/store/StudyHubContext';
import { BranchCode, AcademicYear } from '@/types';
import { openPortfolio } from '@/constants/portfolio';

export default function RegisterScreen() {
  const router = useRouter();
  const { sendOtp, verifyOtpAndLogin } = useStudyHub();

  // Registration Step: 1 = Form Details, 2 = Email OTP Verification
  const [otpStep, setOtpStep] = useState<1 | 2>(1);

  // Form Fields
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [mobile, setMobile] = useState('');
  const [branch, setBranch] = useState<BranchCode | ''>('');
  const [academicYear, setAcademicYear] = useState<AcademicYear | ''>('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // OTP Fields
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [cooldown, setCooldown] = useState(0);

  // Countdown timer for resend OTP cooldown
  useEffect(() => {
    let timer: any;
    if (cooldown > 0) {
      timer = setInterval(() => {
        setCooldown((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [cooldown]);

  // Validate form fields
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const isFormValid =
    name.trim().length >= 2 &&
    emailRegex.test(email.trim()) &&
    branch !== '' &&
    academicYear !== '' &&
    password.length >= 6 &&
    password === confirmPassword;

  // Step 1: Validate Details and Send Real OTP to student's entered email
  const handleInitiateOtp = async () => {
    if (!name.trim() || name.trim().length < 2) {
      setError('Please enter your full name (minimum 2 characters).');
      return;
    }
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !emailRegex.test(cleanEmail)) {
      setError('Please enter a valid email address.');
      return;
    }
    if (!branch) {
      setError('Please select your engineering branch.');
      return;
    }
    if (!academicYear) {
      setError('Please select your current academic year.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setError('');
    setSuccessMessage('');
    setLoading(true);

    try {
      const res = await sendOtp(cleanEmail, 'REGISTRATION');
      setLoading(false);
      if (res.success) {
        setOtpStep(2);
        setCooldown(res.cooldownSeconds || 45);
        setSuccessMessage('OTP sent successfully.');
      } else {
        if (res.code === 'EMAIL_ALREADY_EXISTS' || res.message?.toLowerCase().includes('already exists')) {
          Alert.alert(
            'Account Exists',
            'An account already exists for this email. Please sign in.',
            [
              { text: 'Go to Sign In', onPress: () => router.push('/auth/login') },
              { text: 'Cancel', style: 'cancel' }
            ]
          );
        }
        setError(res.message || 'Failed to dispatch verification code.');
      }
    } catch (e: any) {
      setLoading(false);
      if (e?.code === 'EMAIL_ALREADY_EXISTS' || e?.message?.toLowerCase().includes('already exists')) {
        Alert.alert(
          'Account Exists',
          'An account already exists for this email. Please sign in.',
          [
            { text: 'Go to Sign In', onPress: () => router.push('/auth/login') },
            { text: 'Cancel', style: 'cancel' }
          ]
        );
      }
      setError(e.message || 'Error communicating with authentication server.');
    }
  };

  // Resend OTP
  const handleResendOtp = async () => {
    if (cooldown > 0 || loading) return;
    setError('');
    setSuccessMessage('');
    setLoading(true);
    try {
      const res = await sendOtp(email.trim().toLowerCase(), 'REGISTRATION');
      setLoading(false);
      if (res.success) {
        setCooldown(res.cooldownSeconds || 45);
        setSuccessMessage('OTP sent successfully.');
      } else {
        setError(res.message || 'Failed to resend code.');
      }
    } catch (e: any) {
      setLoading(false);
      setError(e.message || 'Failed to resend code.');
    }
  };

  // Step 2: Verify OTP and save Student profile permanently in MongoDB
  const handleVerifyAndCompleteRegistration = async () => {
    if (!otp.trim() || otp.trim().length !== 6) {
      setError('Please enter the 6-digit verification code.');
      return;
    }

    if (!branch || !academicYear) {
      setError('Please select your branch and academic year.');
      return;
    }

    setError('');
    setSuccessMessage('');
    setLoading(true);

    try {
      const result = await verifyOtpAndLogin(
        email.trim().toLowerCase(),
        otp.trim(),
        'REGISTRATION',
        {
          name: name.trim(),
          password,
          branch,
          academicYear,
          mobile: mobile.trim() || undefined,
        }
      );

      setLoading(false);
      if (result.success) {
        Alert.alert('Account Verified', `Welcome to Padhlo, ${name.trim()}! Your student account is now active.`, [
          { text: 'Start Studying', onPress: () => router.replace('/(tabs)') }
        ]);
      } else {
        setError(result.message || 'Incorrect verification code.');
      }
    } catch (e: any) {
      setLoading(false);
      setError(e.message || 'Verification failed. The code is incorrect or expired.');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : undefined} 
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <TouchableOpacity 
            activeOpacity={0.7} 
            onPress={() => {
              if (otpStep === 2) {
                setOtpStep(1);
              } else {
                if (router.canGoBack()) {
                  router.back();
                } else {
                  router.replace('/auth/login');
                }
              }
            }} 
            style={styles.backBtn}
          >
            <ArrowLeft size={18} color={THEME.textSecondary} />
            <Text style={styles.backText}>
              {otpStep === 2 ? 'Back to Edit Details' : 'Back to Sign In'}
            </Text>
          </TouchableOpacity>

          <View style={styles.header}>
            <Text style={styles.title}>Create your account</Text>
            <Text style={styles.subtitle}>
              {otpStep === 2 
                ? 'Enter the 6-digit code sent to your email address.' 
                : 'Enter your details to create your student account with email verification.'}
            </Text>
          </View>

          {/* Guaranteed Student Role Notice */}
          <View style={styles.noticeBox}>
            <ShieldAlert size={16} color={THEME.cyan} />
            <Text style={styles.noticeText}>
              Registration creates a verified student account. All lecture notes and exam schedules are filtered to your branch and academic year.
            </Text>
          </View>

          <Card style={styles.card} variant="elevated">
            {error ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            {successMessage ? (
              <View style={styles.successBox}>
                <CheckCircle2 size={15} color={THEME.green} />
                <Text style={styles.successText}>{successMessage}</Text>
              </View>
            ) : null}

            {otpStep === 1 ? (
              <>
                <Input
                  label="Full name"
                  value={name}
                  onChangeText={(t) => { setName(t); setError(''); }}
                  placeholder="Enter your full name"
                />

                <Input
                  label="Email address"
                  value={email}
                  onChangeText={(t) => { setEmail(t); setError(''); }}
                  placeholder="Enter email"
                  keyboardType="email-address"
                />

                <Input
                  label="Mobile number"
                  value={mobile}
                  onChangeText={setMobile}
                  placeholder="Enter your mobile number (optional)"
                  keyboardType="phone-pad"
                />

                {/* Searchable Branch Dropdown */}
                <BranchDropdown
                  selectedBranch={branch}
                  onSelectBranch={(b) => { setBranch(b); setError(''); }}
                  label="Select your branch *"
                  placeholder="Choose your engineering branch"
                />

                {/* Academic Year Dropdown (1st Year - 4th Year) */}
                <YearDropdown
                  selectedYear={academicYear}
                  onSelectYear={(y) => { setAcademicYear(y); setError(''); }}
                  label="Select your academic year *"
                  placeholder="Choose your current year"
                />

                <Input
                  label="Create password"
                  value={password}
                  onChangeText={(t) => { setPassword(t); setError(''); }}
                  placeholder="At least 6 characters"
                  secureTextEntry={!showPassword}
                  rightIcon={showPassword ? <EyeOff size={18} color={THEME.textSecondary} /> : <Eye size={18} color={THEME.textSecondary} />}
                  onRightIconPress={() => setShowPassword(!showPassword)}
                />

                <Input
                  label="Confirm password"
                  value={confirmPassword}
                  onChangeText={(t) => { setConfirmPassword(t); setError(''); }}
                  placeholder="Re-enter your password"
                  secureTextEntry={!showPassword}
                />

                {/* Verify Email & Register Button */}
                <Button
                  title={loading ? "Sending verification code…" : "Verify Email & Register"}
                  onPress={handleInitiateOtp}
                  loading={loading}
                  disabled={!isFormValid || loading}
                  icon={<KeyRound size={18} color="#FFFFFF" />}
                  style={styles.submitBtn}
                />
              </>
            ) : (
              // Step 2: OTP Entry & Verification
              <View style={styles.otpStepWrap}>
                <Input
                  label="Verification code"
                  value={otp}
                  onChangeText={(t) => { setOtp(t.replace(/[^0-9]/g, '')); setError(''); }}
                  placeholder="Enter 6-digit code"
                  keyboardType="numeric"
                  maxLength={6}
                />

                <Button
                  title={loading ? "Verifying…" : "Verify and Complete Registration"}
                  onPress={handleVerifyAndCompleteRegistration}
                  loading={loading}
                  disabled={otp.length !== 6 || loading}
                  style={styles.submitBtn}
                />

                <View style={styles.resendRow}>
                  {cooldown === 0 && (
                    <TouchableOpacity onPress={handleResendOtp} disabled={loading} style={styles.resendBtn}>
                      <RotateCw size={14} color={THEME.purple} />
                      <Text style={styles.resendBtnText}>Resend code</Text>
                    </TouchableOpacity>
                  )}
                </View>

                <TouchableOpacity 
                  onPress={() => {
                    setOtpStep(1);
                  }}
                  style={styles.directSwitchBtn}
                >
                  <Text style={styles.directSwitchText}>← Back to edit registration details</Text>
                </TouchableOpacity>
              </View>
            )}

            <View style={styles.footerRow}>
              <Text style={styles.footerText}>Already have an account? </Text>
              <TouchableOpacity onPress={() => router.push('/auth/login')}>
                <Text style={styles.loginLink}>Sign in</Text>
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
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
    paddingVertical: 4,
  },
  backText: {
    color: THEME.textSecondary,
    fontSize: 14,
    fontWeight: '500',
  },
  header: {
    marginBottom: 16,
  },
  title: {
    color: THEME.textPrimary,
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  subtitle: {
    color: THEME.textSecondary,
    fontSize: 14,
    marginTop: 4,
    lineHeight: 20,
  },
  noticeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: THEME.cyanMuted,
    borderWidth: 1,
    borderColor: THEME.cyan + '40',
    borderRadius: 12,
    padding: 12,
    marginBottom: 20,
  },
  noticeText: {
    color: THEME.textSecondary,
    fontSize: 12,
    lineHeight: 17,
    flex: 1,
  },
  card: {
    padding: 20,
    borderRadius: 20,
    borderColor: THEME.surfaceBorder,
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
  successBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: THEME.greenMuted,
    borderWidth: 1,
    borderColor: THEME.green + '40',
    borderRadius: 8,
    paddingVertical: 9,
    paddingHorizontal: 12,
    marginBottom: 16,
  },
  successText: {
    color: THEME.green,
    fontSize: 13,
    fontWeight: '600',
  },
  submitBtn: {
    marginTop: 8,
  },
  otpOptionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 14,
    paddingVertical: 8,
  },
  otpOptionText: {
    color: THEME.purple,
    fontSize: 13,
    fontWeight: '600',
  },
  otpStepWrap: {
    paddingVertical: 4,
  },
  resendRow: {
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 8,
  },
  resendBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    padding: 6,
  },
  resendBtnText: {
    color: THEME.purple,
    fontSize: 13,
    fontWeight: '600',
  },
  directSwitchBtn: {
    alignItems: 'center',
    marginTop: 14,
    paddingVertical: 6,
  },
  directSwitchText: {
    color: THEME.textSecondary,
    fontSize: 13,
    fontWeight: '500',
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
  },
  footerText: {
    color: THEME.textSecondary,
    fontSize: 13,
  },
  loginLink: {
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
