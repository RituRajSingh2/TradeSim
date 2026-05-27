'use client';

import { useState, useRef, useCallback, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowRight, ShieldCheck, ArrowLeft, KeyRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
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

type AuthStep = 'phone' | 'otp';

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
        const verifier = initRecaptcha('send-otp-btn');
        const result = await sendOtp(phone, verifier);
        setConfirmationResult(result);
      } else {
        setConfirmationResult(null);
      }

      setStep('otp');
      setResendTimer(RESEND_COOLDOWN);

      // Focus first OTP input after transition
      setTimeout(() => otpInputsRef.current[0]?.focus(), 150);
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
        firebaseIdToken = await verifyOtp(confirmationResult, otpCode);
      } else {
        firebaseIdToken = `dev:${phone}`;
      }

      await login(firebaseIdToken, phone, otpCode);
      router.replace(returnTo);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Invalid OTP. Please try again.';
      setError(message);
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

      if (value && index < OTP_LENGTH - 1) {
        otpInputsRef.current[index + 1]?.focus();
      }

      if (value && index === OTP_LENGTH - 1) {
        const fullOtp = newOtp.join('');
        if (fullOtp.length === OTP_LENGTH) {
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
        setTimeout(() => handleVerifyOtp(), 150);
      }
    },
    [handleVerifyOtp],
  );

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

  const maskedPhone = phone ? `****${phone.slice(-4)}` : '';

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-4 py-8 bg-bg-primary">
      <div id="recaptcha-container" ref={recaptchaRef} />

      <div className="w-full max-w-sm">
        <div className="mb-8 flex justify-center">
          <Logo size="lg" />
        </div>

        {/* CSS-only instant transitions (120ms fade) */}
        <div className="relative">
          <div className={`transition-opacity duration-120 ease-out ${step === 'phone' ? 'opacity-100 relative z-10' : 'opacity-0 absolute inset-0 pointer-events-none'}`}>
            <div className="text-center mb-8">
              <h1 className="text-2xl font-bold text-text-primary">
                Welcome to TradeSim
              </h1>
              <p className="mt-2 text-sm text-text-secondary">
                Practice trading risk-free with virtual money.
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
                    className="w-full rounded-xl border border-border-primary bg-bg-card px-3 py-3 pl-[5.5rem] text-base font-medium text-text-primary outline-none transition-colors placeholder:text-text-muted focus:border-accent focus:ring-1 focus:ring-accent"
                  />
                </div>
              </div>

              {/* Pre-allocate error height so layout doesn't shift */}
              <div className="min-h-[20px]">
                {error && <p className="text-sm text-negative">{error}</p>}
              </div>

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
              
              <div className="pt-2 text-center">
                <button
                  onClick={() => router.push('/home')}
                  className="text-sm font-medium text-text-secondary hover:text-text-primary transition-colors py-2"
                >
                  Explore Demo Market
                </button>
              </div>
            </div>

            <p className="mt-8 flex items-center justify-center gap-1.5 text-xs text-text-muted">
              <ShieldCheck className="h-3.5 w-3.5" />
              Your data is secured with end-to-end encryption
            </p>
          </div>

          <div className={`transition-opacity duration-120 ease-out ${step === 'otp' ? 'opacity-100 relative z-10' : 'opacity-0 absolute inset-0 pointer-events-none'}`}>
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

            <div className="mb-6 flex justify-center gap-2.5" onPaste={handleOtpPaste}>
              {otp.map((digit, index) => (
                <input
                  key={index}
                  ref={(el) => { otpInputsRef.current[index] = el; }}
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleOtpChange(index, e.target.value)}
                  onKeyDown={(e) => handleOtpKeyDown(index, e)}
                  className={`h-12 w-12 rounded-lg border text-center text-lg font-semibold outline-none transition-colors ${
                    digit
                      ? 'border-accent bg-accent/5 text-text-primary'
                      : 'border-border-primary bg-bg-card text-text-primary'
                  } focus:border-accent focus:ring-1 focus:ring-accent`}
                />
              ))}
            </div>

            <div className="min-h-[24px] mb-2 text-center">
              {error && <p className="text-sm text-negative">{error}</p>}
            </div>

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
              <div className="mt-8 rounded-lg border border-yellow-600/30 bg-yellow-600/5 p-3 text-center">
                <p className="text-xs text-yellow-400 font-medium">
                  Dev Mode — enter any 6 digits to login
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
