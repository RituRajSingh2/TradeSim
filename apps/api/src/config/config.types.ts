// ============================================
// Typed Application Configuration
// ============================================
// Every configService.get() call in the app should reference
// keys from this interface. No stringly-typed access.

export interface AppConfig {
  port: number;
  nodeEnv: 'development' | 'production' | 'test';

  database: {
    url: string;
  };

  redis: {
    url: string;
  };

  firebase: {
    projectId: string;
    clientEmail: string;
    privateKey: string;
  };

  jwt: {
    secret: string;
    expiration: string;
    refreshSecret: string;
    refreshExpiration: string;
  };

  razorpay: {
    keyId: string;
    keySecret: string;
  };

  marketData: {
    provider: string;
    pollIntervalMs: number;
  };

  throttle: {
    ttl: number;
    limit: number;
  };

  cors: {
    origin: string;
  };
}

/**
 * Helper type for accessing nested config keys.
 * Usage: configService.get<string>('jwt.secret')
 */
export type ConfigKey = keyof AppConfig;
