import { plainToInstance } from 'class-transformer';
import { IsEnum, IsNumber, IsOptional, IsString, Min, validateSync } from 'class-validator';

enum Environment {
  Development = 'development',
  Production = 'production',
  Test = 'test',
}

// Weak/placeholder secrets that are explicitly rejected in production.
const FORBIDDEN_SECRETS = [
  'CHANGE_ME',
  'CHANGE_ME_USE_OPENSSL_RAND_HEX_32',
  'development_secret_key_123!',
  'secret',
  'password',
  'changeme',
  'your-secret-here',
  'your_jwt_secret',
  '',
];

class EnvironmentVariables {
  @IsEnum(Environment)
  @IsOptional()
  NODE_ENV: Environment = Environment.Development;

  @IsNumber()
  @IsOptional()
  @Min(1)
  PORT: number = 3001;

  @IsString()
  DATABASE_URL: string;

  @IsString()
  REDIS_URL: string;

  @IsString()
  JWT_SECRET: string;

  @IsString()
  JWT_REFRESH_SECRET: string;

  @IsString()
  @IsOptional()
  JWT_EXPIRATION: string = '15m';

  @IsString()
  @IsOptional()
  JWT_REFRESH_EXPIRATION: string = '7d';

  @IsString()
  @IsOptional()
  CORS_ORIGIN: string = 'http://localhost:3000';

  // Optional — required for auth but not for bootstrap
  @IsString()
  @IsOptional()
  FIREBASE_PROJECT_ID: string;

  @IsString()
  @IsOptional()
  FIREBASE_CLIENT_EMAIL: string;

  @IsString()
  @IsOptional()
  FIREBASE_PRIVATE_KEY: string;

  @IsString()
  @IsOptional()
  RAZORPAY_KEY_ID: string;

  @IsString()
  @IsOptional()
  RAZORPAY_KEY_SECRET: string;

  @IsNumber()
  @IsOptional()
  @Min(1000)
  MARKET_DATA_POLL_INTERVAL_MS: number = 5000;

  @IsNumber()
  @IsOptional()
  THROTTLE_TTL: number = 60;

  @IsNumber()
  @IsOptional()
  THROTTLE_LIMIT: number = 100;
}

/**
 * In production, enforce that JWT secrets are:
 *   - At least 32 characters long
 *   - Not a known-weak placeholder value
 */
function validateSecretStrength(name: string, value: string | undefined): string | null {
  if (!value) return `${name} is required but not set`;

  const normalised = value.trim().toLowerCase();
  for (const forbidden of FORBIDDEN_SECRETS) {
    if (normalised === forbidden.toLowerCase()) {
      return `${name} is a placeholder/weak value — generate a real secret: openssl rand -hex 32`;
    }
  }

  if (value.length < 32) {
    return `${name} must be at least 32 characters. Current length: ${value.length}`;
  }

  return null; // OK
}

/**
 * Validate environment variables using class-validator.
 *
 * In development: logs warnings for missing optional vars but allows startup.
 * In production:  throws on any validation error OR weak secret.
 */
export function validateEnv(config: Record<string, unknown>): Record<string, unknown> {
  const validated = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });

  const errors = validateSync(validated, {
    skipMissingProperties: config.NODE_ENV !== 'production',
    whitelist: false,
  });

  const secretErrors: string[] = [];

  // Production-only: enforce secret strength
  if (config.NODE_ENV === 'production') {
    const jwtErr = validateSecretStrength('JWT_SECRET', config.JWT_SECRET as string);
    if (jwtErr) secretErrors.push(jwtErr);

    const refreshErr = validateSecretStrength('JWT_REFRESH_SECRET', config.JWT_REFRESH_SECRET as string);
    if (refreshErr) secretErrors.push(refreshErr);

    // Confirm the two secrets are different (prevents key-reuse attacks)
    if (
      config.JWT_SECRET &&
      config.JWT_REFRESH_SECRET &&
      config.JWT_SECRET === config.JWT_REFRESH_SECRET
    ) {
      secretErrors.push('JWT_SECRET and JWT_REFRESH_SECRET must be different values');
    }
  }

  const allErrors = [
    ...errors.map((err) => {
      const constraints = err.constraints ? Object.values(err.constraints).join(', ') : '';
      return `  - ${err.property}: ${constraints}`;
    }),
    ...secretErrors.map((e) => `  - ${e}`),
  ];

  if (allErrors.length > 0) {
    const formatted = allErrors.join('\n');

    if (config.NODE_ENV === 'production') {
      throw new Error(`Environment validation failed:\n${formatted}`);
    }

    // eslint-disable-next-line no-console
    console.warn(`\u26a0\ufe0f  Environment validation warnings (non-fatal in dev):\n${formatted}`);
  }

  return config;
}
