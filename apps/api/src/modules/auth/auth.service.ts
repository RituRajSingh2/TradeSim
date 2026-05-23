import {
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../database/prisma.service';
import { RedisService } from '../../redis/redis.service';
import { FirebaseService } from './firebase.service';
import {
  DEFAULT_BALANCE,
  REFERRAL_BONUS,
  REDIS_KEYS,
  generateReferralCode,
  PlatformEvent,
} from '@tradesim/shared';
import type {
  VerifyOtpRequest,
  VerifyOtpResponse,
  RefreshTokenResponse,
  User,
} from '@tradesim/shared';

interface JwtPayload {
  sub: string;
  phone: string;
}

interface DeviceInfo {
  userAgent?: string;
  ipAddress?: string;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly firebaseService: FirebaseService,
  ) {}

  /**
   * Verify Firebase ID token, find-or-create user, issue JWT pair.
   * Creates a tracked session in the database for device management.
   */
  async verifyAndLogin(
    dto: VerifyOtpRequest,
    device: DeviceInfo,
  ): Promise<VerifyOtpResponse> {
    // 1. Verify Firebase ID token
    const { uid, phone } = await this.firebaseService.verifyIdToken(
      dto.firebaseIdToken,
    );

    // 2. Find or create user
    let user = await this.prisma.user.findUnique({ where: { phone } });
    let isNewUser = false;

    if (!user) {
      isNewUser = true;
      user = await this.createUser(phone, uid, dto.referralCode);
      this.logger.log({
        eventType: PlatformEvent.AUTH_SUCCESS,
        message: `New user created: ${phone}`,
        metadata: { userId: user.id, isNewUser: true }
      });
    } else {
      // Update login metadata (and Firebase UID if changed)
      const updateData: { lastLoginAt: Date; firebaseUid?: string } = {
        lastLoginAt: new Date(),
      };
      if (user.firebaseUid !== uid) {
        updateData.firebaseUid = uid;
      }
      await this.prisma.user.update({
        where: { id: user.id },
        data: updateData,
      });
    }

    // 3. Issue JWT pair
    const tokens = await this.issueTokenPair(user.id, user.phone);

    // 4. Create tracked session in database
    const refreshExpDays = parseInt(
      this.configService.get<string>('jwt.refreshExpiration', '7d').replace('d', ''),
      10,
    ) || 7;

    await this.prisma.session.create({
      data: {
        userId: user.id,
        refreshToken: tokens.refreshToken,
        userAgent: device.userAgent || null,
        ipAddress: device.ipAddress || null,
        expiresAt: new Date(Date.now() + refreshExpDays * 24 * 60 * 60 * 1000),
      },
    });

    // 5. Cache session in Redis for fast lookup
    await this.redis.setJson(
      REDIS_KEYS.userSession(user.id),
      { userId: user.id, phone: user.phone, loggedInAt: new Date().toISOString() },
      refreshExpDays * 24 * 60 * 60,
    );

    return {
      user: {
        id: user.id,
        phone: user.phone,
        name: user.name,
        isNewUser,
      },
      tokens,
    };
  }

  /**
   * Refresh an access token using a valid refresh token.
   *
   * Security: implements **refresh token rotation**.
   * Each refresh call invalidates the old refresh token and issues a new one.
   * If a stolen refresh token is replayed, the session is killed.
   */
  async refreshToken(
    currentRefreshToken: string,
    device: DeviceInfo,
  ): Promise<RefreshTokenResponse & { refreshToken: string }> {
    // 1. Verify the refresh token JWT
    let payload: JwtPayload;
    try {
      const refreshSecret = this.configService.get<string>('jwt.refreshSecret');
      payload = await this.jwtService.verifyAsync<JwtPayload>(currentRefreshToken, {
        secret: refreshSecret,
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    // 2. Find the session with this exact refresh token
    const session = await this.prisma.session.findFirst({
      where: {
        userId: payload.sub,
        refreshToken: currentRefreshToken,
      },
    });

    if (!session) {
      // Token reuse detected — likely a stolen token replay.
      // Kill ALL sessions for this user as a precaution.
      this.logger.warn({
        eventType: PlatformEvent.AUTH_FAILED,
        message: `Refresh token reuse detected for user ${payload.sub}`,
        metadata: { userId: payload.sub }
      });
      await this.prisma.session.deleteMany({ where: { userId: payload.sub } });
      await this.redis.del(REDIS_KEYS.userSession(payload.sub));
      throw new UnauthorizedException('Session invalidated — please login again');
    }

    // 3. Verify user still exists and is active
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('User not found or deactivated');
    }

    // 4. Rotate: issue new token pair and update session
    const newTokens = await this.issueTokenPair(user.id, user.phone);

    const refreshExpDays = parseInt(
      this.configService.get<string>('jwt.refreshExpiration', '7d').replace('d', ''),
      10,
    ) || 7;

    await this.prisma.session.update({
      where: { id: session.id },
      data: {
        refreshToken: newTokens.refreshToken,
        userAgent: device.userAgent || session.userAgent,
        ipAddress: device.ipAddress || session.ipAddress,
        expiresAt: new Date(Date.now() + refreshExpDays * 24 * 60 * 60 * 1000),
      },
    });

    return {
      accessToken: newTokens.accessToken,
      refreshToken: newTokens.refreshToken,
    };
  }

  /**
   * Logout — delete specific session or all sessions.
   */
  async logout(
    userId: string,
    refreshToken: string | undefined,
    allDevices: boolean,
  ): Promise<void> {
    if (allDevices) {
      await this.prisma.session.deleteMany({ where: { userId } });
      this.logger.log({
        eventType: PlatformEvent.USER_LOGOUT,
        message: `All sessions invalidated for user ${userId}`,
        metadata: { userId }
      });
    } else if (refreshToken) {
      await this.prisma.session.deleteMany({
        where: { userId, refreshToken },
      });
    }

    await this.redis.del(REDIS_KEYS.userSession(userId));
  }

  /**
   * Get the current user profile from a userId.
   */
  async getCurrentUser(userId: string): Promise<User> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    return {
      id: user.id,
      phone: user.phone,
      name: user.name,
      avatarUrl: user.avatarUrl,
      referralCode: user.referralCode,
      state: user.state,
      city: user.city,
      isActive: user.isActive,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
    };
  }

  /**
   * List active sessions for a user (device management).
   */
  async getActiveSessions(userId: string) {
    return this.prisma.session.findMany({
      where: {
        userId,
        expiresAt: { gt: new Date() },
      },
      select: {
        id: true,
        userAgent: true,
        ipAddress: true,
        createdAt: true,
        expiresAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Revoke a specific session by ID.
   */
  async revokeSession(userId: string, sessionId: string): Promise<void> {
    await this.prisma.session.deleteMany({
      where: { id: sessionId, userId },
    });
  }

  // ---- Private Helpers ----

  private async createUser(
    phone: string,
    firebaseUid: string,
    referralCode?: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      // Create user
      const user = await tx.user.create({
        data: {
          phone,
          firebaseUid,
          referralCode: generateReferralCode(phone),
          isActive: true,
        },
      });

      // Create portfolio with signup bonus
      await tx.portfolio.create({
        data: {
          userId: user.id,
          balance: DEFAULT_BALANCE,
          investedValue: 0,
          currentValue: 0,
          totalPnl: 0,
          totalPnlPercent: 0,
          dayPnl: 0,
          dayPnlPercent: 0,
        },
      });

      // Create immutable ledger entry for signup bonus
      await tx.ledgerEntry.create({
        data: {
          userId: user.id,
          entryType: 'CREDIT',
          category: 'SIGNUP_BONUS',
          amount: DEFAULT_BALANCE,
          runningBalance: DEFAULT_BALANCE,
          description: `Welcome bonus of ₹${DEFAULT_BALANCE.toLocaleString('en-IN')}`,
        },
      });

      // Create default watchlist
      await tx.watchlist.create({
        data: {
          userId: user.id,
          name: 'My Watchlist',
        },
      });

      // Process referral if provided
      if (referralCode) {
        await this.processReferral(tx, user.id, referralCode);
      }

      return user;
    });
  }

  private async processReferral(
    tx: Parameters<Parameters<typeof this.prisma.$transaction>[0]>[0],
    referredUserId: string,
    referralCode: string,
  ): Promise<void> {
    const referrer = await tx.user.findFirst({
      where: { referralCode },
      include: { portfolio: true },
    });

    if (!referrer || !referrer.portfolio) {
      this.logger.warn(`Invalid referral code: ${referralCode}`);
      return;
    }

    if (referrer.id === referredUserId) return;

    const referral = await tx.referral.create({
      data: {
        referrerId: referrer.id,
        referredUserId,
        status: 'COMPLETED',
        completedAt: new Date(),
      },
    });

    const currentBalance = Number(referrer.portfolio.balance);
    const newBalance = currentBalance + REFERRAL_BONUS;

    await tx.portfolio.update({
      where: { id: referrer.portfolio.id },
      data: { balance: newBalance, version: { increment: 1 } },
    });

    // Immutable ledger entry for referral bonus
    await tx.ledgerEntry.create({
      data: {
        userId: referrer.id,
        entryType: 'CREDIT',
        category: 'REFERRAL_BONUS',
        amount: REFERRAL_BONUS,
        runningBalance: newBalance,
        referralId: referral.id,
        description: 'Referral bonus for inviting a friend',
      },
    });
  }

  private async issueTokenPair(
    userId: string,
    phone: string,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const [accessToken, refreshToken] = await Promise.all([
      this.generateAccessToken(userId, phone),
      this.generateRefreshToken(userId, phone),
    ]);
    return { accessToken, refreshToken };
  }

  private async generateAccessToken(
    userId: string,
    phone: string,
  ): Promise<string> {
    return this.jwtService.signAsync(
      { sub: userId, phone } satisfies JwtPayload,
      {
        expiresIn: this.configService.get<string>('jwt.expiration', '15m'),
      },
    );
  }

  private async generateRefreshToken(
    userId: string,
    phone: string,
  ): Promise<string> {
    return this.jwtService.signAsync(
      { sub: userId, phone } satisfies JwtPayload,
      {
        secret: this.configService.get<string>('jwt.refreshSecret'),
        expiresIn: this.configService.get<string>('jwt.refreshExpiration', '7d'),
      },
    );
  }
}
