// ============================================
// Firebase Client SDK — Singleton App + Phone Auth
// ============================================

import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import {
  getAuth,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  type Auth,
  type ConfirmationResult,
} from 'firebase/auth';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || '',
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || '',
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || '',
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || '',
};

let app: FirebaseApp | null = null;
let auth: Auth | null = null;

function getFirebaseApp(): FirebaseApp {
  if (!app) {
    app = getApps().length > 0 ? getApps()[0] : initializeApp(firebaseConfig);
  }
  return app;
}

function getFirebaseAuth(): Auth {
  if (!auth) {
    auth = getAuth(getFirebaseApp());
  }
  return auth;
}

/**
 * Whether Firebase is configured (has an API key).
 * In dev without Firebase, we use mock auth.
 */
export function isFirebaseConfigured(): boolean {
  return !!firebaseConfig.apiKey;
}

/**
 * Initialize invisible reCAPTCHA verifier on a button element.
 * Required by Firebase Phone Auth to prevent abuse.
 */
export function initRecaptcha(
  buttonId: string,
): RecaptchaVerifier {
  const firebaseAuth = getFirebaseAuth();

  const verifier = new RecaptchaVerifier(firebaseAuth, buttonId, {
    size: 'invisible',
    callback: () => {
      // reCAPTCHA solved
    },
  });

  return verifier;
}

/**
 * Send OTP to phone number via Firebase.
 * Returns ConfirmationResult to verify the OTP code.
 */
export async function sendOtp(
  phoneNumber: string,
  recaptchaVerifier: RecaptchaVerifier,
): Promise<ConfirmationResult> {
  const firebaseAuth = getFirebaseAuth();
  // Firebase expects E.164 format: +91XXXXXXXXXX
  const formattedPhone = phoneNumber.startsWith('+91')
    ? phoneNumber
    : `+91${phoneNumber}`;

  return signInWithPhoneNumber(firebaseAuth, formattedPhone, recaptchaVerifier);
}

/**
 * Verify OTP code and get Firebase ID token.
 * This ID token is sent to our backend for verification.
 */
export async function verifyOtp(
  confirmationResult: ConfirmationResult,
  otpCode: string,
): Promise<string> {
  const credential = await confirmationResult.confirm(otpCode);
  const idToken = await credential.user.getIdToken();
  return idToken;
}

/**
 * Sign out from Firebase (client-side only).
 * Server-side session is handled by our backend.
 */
export async function firebaseSignOut(): Promise<void> {
  const firebaseAuth = getFirebaseAuth();
  await firebaseAuth.signOut();
}
