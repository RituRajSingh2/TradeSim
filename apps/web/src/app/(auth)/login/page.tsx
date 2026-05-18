'use client';

import { useState, useRef, useCallback, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Phone, ArrowRight, ShieldCheck, ArrowLeft, KeyRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Logo } from '@/components/ui/logo';
import { PageSpinner } from '@/components/ui/spinner';
import { useAuth } from '@/providers/auth-provider';
import {
  isFirebaseConfigured,
  initRecaptcha,
  sendOtp,
  verifyOtp,
} from '@/lib/firebase';
import type { ConfirmationResult } from 'firebase/auth';

const OTP_LENGTH = 6;
const RESEND_COOLDOWN = 30; // seconds

type AuthStep = 'phone' | 'otp' | 'onboarding';

export default function LoginPage() {
  return (
    <Suspense fallback={<PageSpinner />}>
      <LoginContent />
    </Suspense>
  );
}

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnTo = searchParams.get('returnTo') || '/home';
  const { login, isAuthenticated } = useAuth();

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      router.replace(returnTo);
    }
  }, [isAuthenticated, router, returnTo]);

  const [step, setStep] = useState<AuthStep>('phone');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState<string[]>(new Array(OTP_LENGTH).fill(''));
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [resendTimer, setResendTimer] = useState(0);
  const [confirmationResult, setConfirmationResult] =
    useState<ConfirmationResult | null>(null);

  const otpInputsRef = useRef<(HTMLInputElement | null)[]>([]);
  const recaptchaRef = useRef<HTMLDivElement>(null);

  // ---- Resend Timer ----
  useEffect(() => {
    if (resendTimer <= 0) return;
    const timer = setInterval(() => {
      setResendTimer((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [resendTimer]);

  // ---- Phone Validation ----
  const isPhoneValid = /^[6-9]\d{9}$/.test(phone);

  // ---- Send OTP ----
  const handleSendOtp = useCallback(async () => {
    if (!isPhoneValid) return;
    setIsLoading(true);
    setError('');

    try {
      if (isFirebaseConfigured()) {
        // Production: Firebase Phone Auth
        const verifier = initRecaptcha('send-otp-btn');
        const result = await sendOtp(phone, verifier);
        setConfirmationResult(result);
      } else {
        // Dev mode: skip Firebase, use mock
        setConfirmationResult(null);
      }

      setStep('otp');
      setResendTimer(RESEND_COOLDOWN);

      // Focus first OTP input after transition
      setTimeout(() => otpInputsRef.current[0]?.focus(), 300);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Failed to send OTP';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [phone, isPhoneValid]);

  // ---- Verify OTP ----
  const handleVerifyOtp = useCallback(async () => {
    const otpCode = otp.join('');
    if (otpCode.length !== OTP_LENGTH) return;
    setIsLoading(true);
    setError('');

    try {
      let firebaseIdToken: string;

      if (confirmationResult) {
        // Production: verify with Firebase
        firebaseIdToken = await verifyOtp(confirmationResult, otpCode);
      } else {
        // Dev mode: use mock token
        firebaseIdToken = `dev:${phone}`;
      }

      // Login via our backend
      await login(firebaseIdToken, phone, otpCode);

      // Navigate to return URL or home
      router.replace(returnTo);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Invalid OTP. Please try again.';
      setError(message);
      // Clear OTP inputs on error
      setOtp(new Array(OTP_LENGTH).fill(''));
      otpInputsRef.current[0]?.focus();
    } finally {
      setIsLoading(false);
    }
  }, [otp, confirmationResult, phone, login, router, returnTo]);

  // ---- OTP Input Handling ----
  const handleOtpChange = useCallback(
    (index: number, value: string) => {
      if (!/^\d*$/.test(value)) return;

      const newOtp = [...otp];
      newOtp[index] = value.slice(-1);
      setOtp(newOtp);

      // Auto-advance to next input
      if (value && index < OTP_LENGTH - 1) {
        otpInputsRef.current[index + 1]?.focus();
      }

      // Auto-submit when all digits filled
      if (value && index === OTP_LENGTH - 1) {
        const fullOtp = newOtp.join('');
        if (fullOtp.length === OTP_LENGTH) {
          // Small delay for UX
          setTimeout(() => handleVerifyOtp(), 150);
        }
      }
    },
    [otp, handleVerifyOtp],
  );

  const handleOtpKeyDown = useCallback(
    (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Backspace' && !otp[index] && index > 0) {
        otpInputsRef.current[index - 1]?.focus();
      }
    },
    [otp],
  );

  const handleOtpPaste = useCallback(
    (e: React.ClipboardEvent) => {
      e.preventDefault();
      const pasted = e.clipboardData.getData('text').replace(/\D/g, '');
      if (pasted.length === OTP_LENGTH) {
        setOtp(pasted.split(''));
        otpInputsRef.current[OTP_LENGTH - 1]?.focus();
        // Auto-submit
        setTimeout(() => handleVerifyOtp(), 150);
      }
    },
    [handleVerifyOtp],
  );

  // ---- Resend OTP ----
  const handleResend = useCallback(async () => {
    if (resendTimer > 0) return;
    setError('');
    setOtp(new Array(OTP_LENGTH).fill(''));

    try {
      if (isFirebaseConfigured()) {
        const verifier = initRecaptcha('send-otp-btn');
        const result = await sendOtp(phone, verifier);
        setConfirmationResult(result);
      }
      setResendTimer(RESEND_COOLDOWN);
    } catch {
      setError('Failed to resend OTP. Please try again.');
    }
  }, [phone, resendTimer]);

  // ---- Slide animation ----
  const slideVariants = {
    enter: (direction: number) => ({
      x: direction > 0 ? 300 : -300,
      opacity: 0,
    }),
    center: { x: 0, opacity: 1 },
    exit: (direction: number) => ({
      x: direction > 0 ? -300 : 300,
      opacity: 0,
    }),
  };

  const maskedPhone = phone ? `****${phone.slice(-4)}` : '';

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-4 py-8">
      {/* reCAPTCHA container */}
      <div id="recaptcha-container" ref={recaptchaRef} />

      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="mb-8 flex justify-center">
          <Logo size="lg" />
        </div>

        <AnimatePresence mode="wait" custom={step === 'otp' ? 1 : -1}>
          {step === 'phone' && (
            <motion.div
              key="phone-step"
              custom={1}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.25, ease: 'easeInOut' }}
            >
              <div className="text-center mb-8">
                <h1 className="text-2xl font-bold text-text-primary">
                  Welcome to TradeSim
                </h1>
                <p className="mt-2 text-sm text-text-secondary">
                  Sign in with your phone number to start trading
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-text-secondary">
                    Phone Number
                  </label>
                  <div className="relative">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5 text-sm text-text-muted">
                      <span>🇮🇳</span>
                      <span>+91</span>
                      <span className="text-border-primary">|</span>
                    </div>
                    <input
                      type="tel"
                      inputMode="numeric"
                      maxLength={10}
                      placeholder="Enter 10-digit number"
                      value={phone}
                      onChange={(e) => {
                        setPhone(e.target.value.replace(/\D/g, ''));
                        setError('');
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && isPhoneValid) handleSendOtp();
                      }}
                      autoFocus
                      className="w-full rounded-xl border border-border-primary bg-bg-card px-3 py-3 pl-[5.5rem] text-base text-text-primary outline-none transition-colors placeholder:text-text-muted focus:border-accent focus:ring-1 focus:ring-accent"
                    />
                  </div>
                </div>

                {error && (
                  <p className="text-sm text-negative">{error}</p>
                )}

                <Button
                  id="send-otp-btn"
                  variant="primary"
                  size="lg"
                  onClick={handleSendOtp}
                  isLoading={isLoading}
                  disabled={!isPhoneValid || isLoading}
                  className="w-full"
                >
                  Send OTP
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>

              <p className="mt-6 flex items-center justify-center gap-1.5 text-xs text-text-muted">
                <ShieldCheck className="h-3.5 w-3.5" />
                Your data is secured with end-to-end encryption
              </p>
            </motion.div>
          )}

          {step === 'otp' && (
            <motion.div
              key="otp-step"
              custom={1}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.25, ease: 'easeInOut' }}
            >
              {/* Back button */}
              <button
                onClick={() => {
                  setStep('phone');
                  setError('');
                  setOtp(new Array(OTP_LENGTH).fill(''));
                }}
                className="mb-4 flex items-center gap-1 text-sm text-text-secondary transition-colors hover:text-text-primary"
              >
                <ArrowLeft className="h-4 w-4" />
                Change number
              </button>

              <div className="text-center mb-8">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-accent/10">
                  <KeyRound className="h-6 w-6 text-accent" />
                </div>
                <h1 className="text-2xl font-bold text-text-primary">
                  Enter OTP
                </h1>
                <p className="mt-2 text-sm text-text-secondary">
                  We sent a 6-digit code to{' '}
                  <span className="font-medium text-text-primary">
                    +91 {maskedPhone}
                  </span>
                </p>
              </div>

              {/* OTP Inputs */}
              <div className="mb-6 flex justify-center gap-2.5" onPaste={handleOtpPaste}>
                {otp.map((digit, index) => (
                  <input
                    key={index}
                    ref={(el) => { otpInputsRef.current[index] = el; }}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleOtpChange(index, e.target.value)}
                    onKeyDown={(e) => handleOtpKeyDown(index, e)}
                    className={`h-12 w-12 rounded-lg border text-center text-lg font-semibold outline-none transition-all ${
                      digit
                        ? 'border-accent bg-accent/5 text-text-primary'
                        : 'border-border-primary bg-bg-card text-text-primary'
                    } focus:border-accent focus:ring-1 focus:ring-accent`}
                  />
                ))}
              </div>

              {error && (
                <p className="mb-4 text-center text-sm text-negative">{error}</p>
              )}

              <Button
                variant="primary"
                size="lg"
                onClick={handleVerifyOtp}
                isLoading={isLoading}
                disabled={otp.join('').length !== OTP_LENGTH || isLoading}
                className="w-full"
              >
                Verify & Login
                <ArrowRight className="h-4 w-4" />
              </Button>

              {/* Resend */}
              <div className="mt-4 text-center">
                {resendTimer > 0 ? (
                  <p className="text-xs text-text-muted">
                    Resend OTP in{' '}
                    <span className="font-medium text-text-secondary">
                      {resendTimer}s
                    </span>
                  </p>
                ) : (
                  <button
                    onClick={handleResend}
                    className="text-xs font-medium text-accent transition-colors hover:text-accent-hover"
                  >
                    Resend OTP
                  </button>
                )}
              </div>

              {!isFirebaseConfigured() && (
                <div className="mt-6 rounded-lg border border-yellow-600/30 bg-yellow-600/5 p-3 text-center">
                  <p className="text-xs text-yellow-400">
                    Dev Mode — enter any 6 digits to login
                  </p>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
