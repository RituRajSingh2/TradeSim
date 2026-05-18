import { plainToInstance } from 'class-transformer';
import { IsEnum, IsNumber, IsOptional, IsString, Min, validateSync } from 'class-validator';

enum Environment {
  Development = 'development',
  Production = 'production',
  Test = 'test',
}

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
 * Validate environment variables using class-validator.
 *
 * In development: logs warnings for missing optional vars but allows startup.
 * In production: throws on any validation error.
 */
export function validateEnv(config: Record<string, unknown>): Record<string, unknown> {
  const validated = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });

  const errors = validateSync(validated, {
    skipMissingProperties: config.NODE_ENV !== 'production',
    whitelist: false,
  });

  if (errors.length > 0) {
    const formatted = errors
      .map((err) => {
        const constraints = err.constraints ? Object.values(err.constraints).join(', ') : '';
        return `  - ${err.property}: ${constraints}`;
      })
      .join('\n');

    if (config.NODE_ENV === 'production') {
      throw new Error(`Environment validation failed:\n${formatted}`);
    }

    // eslint-disable-next-line no-console
    console.warn(`⚠️  Environment validation warnings (non-fatal in dev):\n${formatted}`);
  }

  return config;
}
