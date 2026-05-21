import { Injectable, OnModuleDestroy, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis, { RedisOptions } from 'ioredis';
import { randomUUID } from 'crypto';

/**
 * Redis service providing caching, pub/sub, and atomic operations.
 *
 * Connection strategy:
 * - Upstash (rediss://) → TLS enabled automatically
 * - Local Redis (redis://) → plain TCP
 * - Missing URL → lazy-connect stub (no-ops in dev, fails in prod)
 *
 * For horizontal WebSocket scaling, use createSubscriber() to get
 * a dedicated connection — Redis pub/sub requires separate connections
 * for subscribing and publishing.
 */
@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private readonly client: Redis;
  private readonly redisUrl: string;
  private _isHealthy = false;

  constructor(private readonly configService: ConfigService) {
    this.redisUrl = this.configService.get<string>('redis.url', '');

    if (!this.redisUrl) {
      this.logger.warn('REDIS_URL not configured — Redis features disabled');
      this.client = new Redis({ lazyConnect: true });
      return;
    }

    this.client = this.createConnection('primary');
  }

  /** Whether the primary connection is healthy. */
  get isHealthy(): boolean {
    return this._isHealthy;
  }

  getClient(): Redis {
    return this.client;
  }

  async onModuleDestroy(): Promise<void> {
    if (this.client.status !== 'end') {
      await this.client.quit();
      this.logger.log('Redis disconnected');
    }
  }

  // ---- Key-Value Operations ----

  async get(key: string): Promise<string | null> {
    if (!this.redisUrl) return null;
    return this.client.get(key);
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    if (!this.redisUrl) return;
    if (ttlSeconds) {
      await this.client.setex(key, ttlSeconds, value);
    } else {
      await this.client.set(key, value);
    }
  }

  async del(...keys: string[]): Promise<number> {
    if (!this.redisUrl || keys.length === 0) return 0;
    return this.client.del(...keys);
  }

  async exists(key: string): Promise<boolean> {
    if (!this.redisUrl) return false;
    const result = await this.client.exists(key);
    return result === 1;
  }

  // ---- JSON Helpers ----

  async getJson<T>(key: string): Promise<T | null> {
    if (!this.redisUrl) return null;
    const raw = await this.client.get(key);
    if (!raw) return null;

    try {
      return JSON.parse(raw) as T;
    } catch {
      this.logger.warn(`Failed to parse JSON for key: ${key}`);
      return null;
    }
  }

  async setJson<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
    await this.set(key, JSON.stringify(value), ttlSeconds);
  }

  // ---- Atomic Operations ----

  async incr(key: string): Promise<number> {
    if (!this.redisUrl) return 0;
    return this.client.incr(key);
  }

  async incrBy(key: string, amount: number): Promise<number> {
    if (!this.redisUrl) return 0;
    return this.client.incrby(key, amount);
  }

  async expire(key: string, ttlSeconds: number): Promise<void> {
    if (!this.redisUrl) return;
    await this.client.expire(key, ttlSeconds);
  }

  /** Increment and set TTL atomically (for rate limiting). */
  async incrWithExpiry(key: string, ttlSeconds: number): Promise<number> {
    if (!this.redisUrl) return 0;
    const multi = this.client.multi();
    multi.incr(key);
    multi.expire(key, ttlSeconds);
    const results = await multi.exec();
    return (results?.[0]?.[1] as number) ?? 0;
  }

  // ---- Distributed Locks ----

  /**
   * Acquires a distributed lock.
   * @param key Lock key name.
   * @param ttlSeconds Time-to-live for the lock.
   * @returns A unique token if the lock was acquired, or null if it was already held.
   */
  async acquireLock(key: string, ttlSeconds: number): Promise<string | null> {
    if (!this.redisUrl) return randomUUID(); // fallback for dev
    const token = randomUUID();
    const result = await this.client.set(key, token, 'EX', ttlSeconds, 'NX');
    if (result === 'OK') {
      return token;
    }
    return null;
  }

  /**
   * Releases a distributed lock only if the token matches.
   * Uses an atomic Lua script to prevent split-brain accidental releases.
   * @param key Lock key name.
   * @param token The token returned by acquireLock.
   * @returns true if released successfully, false otherwise.
   */
  async releaseLock(key: string, token: string): Promise<boolean> {
    if (!this.redisUrl) return true; // fallback for dev
    
    const script = `
      if redis.call("get", KEYS[1]) == ARGV[1] then
        return redis.call("del", KEYS[1])
      else
        return 0
      end
    `;

    const result = await this.client.eval(script, 1, key, token);
    return result === 1;
  }

  // ---- Pub/Sub ----

  async publish(channel: string, message: string): Promise<void> {
    if (!this.redisUrl) return;
    await this.client.publish(channel, message);
  }

  async publishJson<T>(channel: string, data: T): Promise<void> {
    await this.publish(channel, JSON.stringify(data));
  }

  /**
   * Create a dedicated Redis connection for subscriptions.
   * Redis requires separate connections for pub/sub subscribers.
   */
  createSubscriber(): Redis {
    if (!this.redisUrl) {
      return new Redis({ lazyConnect: true });
    }
    return this.createConnection('subscriber');
  }

  // ---- Internal ----

  /**
   * Single factory for all Redis connections — eliminates
   * duplicated TLS/retry logic between primary and subscriber.
   */
  private createConnection(label: string): Redis {
    const options: RedisOptions = {
      maxRetriesPerRequest: 3,
      retryStrategy: (times) => {
        if (times > 5) {
          this.logger.error(`Redis [${label}] — giving up after ${times} retries`);
          return null;
        }
        const delay = Math.min(times * 200, 3000);
        this.logger.warn(`Redis [${label}] — retry #${times} in ${delay}ms`);
        return delay;
      },
      // Upstash uses rediss:// (TLS). Detect and enable automatically.
      tls: this.redisUrl.startsWith('rediss://') ? {} : undefined,
    };

    const connection = new Redis(this.redisUrl, options);

    connection.on('connect', () => {
      this._isHealthy = true;
      this.logger.log(`✅ Redis [${label}] connected`);
    });

    connection.on('error', (err) => {
      this._isHealthy = false;
      this.logger.error(`Redis [${label}] error: ${err.message}`);
    });

    connection.on('close', () => {
      this._isHealthy = false;
    });

    return connection;
  }
}
