import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as admin from 'firebase-admin';

/**
 * Firebase Admin SDK wrapper.
 *
 * Responsibilities:
 * - Initialize Firebase Admin on startup
 * - Verify Firebase ID tokens (from client-side OTP flow)
 * - Extract phone number from verified token
 *
 * The client-side Firebase SDK handles the OTP send/verify UI.
 * This service only verifies the resulting ID token server-side.
 */
@Injectable()
export class FirebaseService implements OnModuleInit {
  private readonly logger = new Logger(FirebaseService.name);
  private app: admin.app.App | null = null;
  private _isInitialized = false;

  constructor(private readonly configService: ConfigService) {}

  get isInitialized(): boolean {
    return this._isInitialized;
  }

  onModuleInit(): void {
    const projectId = this.configService.get<string>('firebase.projectId');
    const clientEmail = this.configService.get<string>('firebase.clientEmail');
    const privateKey = this.configService.get<string>('firebase.privateKey');

    if (!projectId || !clientEmail || !privateKey) {
      this.logger.warn(
        'Firebase credentials not configured — auth will use dev mode',
      );
      return;
    }

    try {
      this.app = admin.initializeApp({
        credential: admin.credential.cert({
          projectId,
          clientEmail,
          privateKey,
        }),
      });
      this._isInitialized = true;
      this.logger.log('✅ Firebase Admin initialized');
    } catch (error) {
      this.logger.error('❌ Firebase Admin initialization failed', error);
    }
  }

  /**
   * Verify a Firebase ID token and extract the phone number.
   *
   * In dev mode (no Firebase credentials), accepts a mock token
   * format: `dev:<phone>` for testing without Firebase.
   */
  async verifyIdToken(idToken: string): Promise<{
    uid: string;
    phone: string;
  }> {
    // Dev mode — allow mock tokens for local development ONLY
    if (!this._isInitialized) {
      const nodeEnv = this.configService.get<string>('nodeEnv');

      // CRITICAL: Never allow dev-mode bypass in production
      if (nodeEnv === 'production') {
        this.logger.error(
          'Firebase not initialized in production — refusing to authenticate',
        );
        throw new Error(
          'Authentication service unavailable. Firebase is not configured.',
        );
      }

      if (idToken.startsWith('dev:')) {
        const phone = idToken.replace('dev:', '');
        this.logger.warn(`Dev mode: accepting mock token for ${phone}`);
        return {
          uid: `dev_${phone}`,
          phone,
        };
      }
      throw new Error('Firebase not initialized and no dev token provided');
    }

    const decodedToken = await admin.auth().verifyIdToken(idToken);

    if (!decodedToken.phone_number) {
      throw new Error('Token does not contain a phone number');
    }

    // Normalize phone: remove +91 prefix, keep 10 digits
    const rawPhone = decodedToken.phone_number;
    const phone = rawPhone.replace(/^\+91/, '');

    return {
      uid: decodedToken.uid,
      phone,
    };
  }
}
