import type { AppConfig } from './config.types';

/**
 * Enforce required secrets at startup.
 * An empty JWT secret would allow anyone to forge valid tokens.
 */
function requireSecret(name: string): string {
  const value = process.env[name];
  if (!value || value.trim().length === 0) {
    throw new Error(
      `❌ ${name} is required but not set. ` +
        `The server cannot start without a valid signing secret.`,
    );
  }
  return value;
}

export default (): AppConfig => ({
  port: parseInt(process.env.PORT || '3001', 10),
  nodeEnv: (process.env.NODE_ENV as AppConfig['nodeEnv']) || 'development',

  database: {
    url: process.env.DATABASE_URL || '',
  },

  redis: {
    url: process.env.REDIS_URL || '',
  },

  firebase: {
    projectId: process.env.FIREBASE_PROJECT_ID || '',
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL || '',
    privateKey: (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
  },

  jwt: {
    secret: requireSecret('JWT_SECRET'),
    expiration: process.env.JWT_EXPIRATION || '15m',
    refreshSecret: requireSecret('JWT_REFRESH_SECRET'),
    refreshExpiration: process.env.JWT_REFRESH_EXPIRATION || '7d',
  },

  razorpay: {
    keyId: process.env.RAZORPAY_KEY_ID || '',
    keySecret: process.env.RAZORPAY_KEY_SECRET || '',
  },

  marketData: {
    provider: process.env.MARKET_DATA_PROVIDER || 'mock',
    pollIntervalMs: parseInt(process.env.MARKET_DATA_POLL_INTERVAL_MS || '5000', 10),
  },

  throttle: {
    ttl: parseInt(process.env.THROTTLE_TTL || '60', 10),
    limit: parseInt(process.env.THROTTLE_LIMIT || '100', 10),
  },

  cors: {
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  },
});
