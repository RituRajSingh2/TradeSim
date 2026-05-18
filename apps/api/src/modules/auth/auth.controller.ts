import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
  Req,
  Res,
  HttpCode,
  HttpStatus,
  UseGuards,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { JwtAuthGuard, type JwtPayload } from '../../common/guards/auth.guard';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ZodPipe } from '../../common/pipes/zod.pipe';
import {
  VerifyOtpRequestSchema,
  LogoutRequestSchema,
  type VerifyOtpRequest,
  type LogoutRequest,
} from '@tradesim/shared';

const REFRESH_TOKEN_COOKIE = 'tradesim_refresh';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * POST /api/auth/login
   *
   * Verify Firebase ID token + OTP, find-or-create user.
   * Returns: accessToken in body, refreshToken in httpOnly cookie.
   */
  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body(new ZodPipe(VerifyOtpRequestSchema)) body: VerifyOtpRequest,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const device = {
      userAgent: req.headers['user-agent'],
      ipAddress: req.ip || req.socket.remoteAddress,
    };

    const result = await this.authService.verifyAndLogin(body, device);

    // Set refresh token in httpOnly cookie (not accessible via JS)
    this.setRefreshCookie(res, result.tokens.refreshToken);

    // Return only the access token in the response body
    return {
      user: result.user,
      accessToken: result.tokens.accessToken,
    };
  }

  /**
   * POST /api/auth/refresh
   *
   * Exchange refresh token (from httpOnly cookie) for new token pair.
   * Implements refresh token rotation — old token is invalidated.
   */
  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const refreshToken = req.cookies?.[REFRESH_TOKEN_COOKIE];

    if (!refreshToken) {
      // Fallback: accept from body for mobile clients
      const bodyToken = req.body?.refreshToken;
      if (!bodyToken) {
        throw new UnauthorizedException('No refresh token provided');
      }

      const result = await this.authService.refreshToken(bodyToken, {
        userAgent: req.headers['user-agent'],
        ipAddress: req.ip || req.socket.remoteAddress,
      });

      // For mobile: return both tokens in body (no cookies)
      return {
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
      };
    }

    const device = {
      userAgent: req.headers['user-agent'],
      ipAddress: req.ip || req.socket.remoteAddress,
    };

    const result = await this.authService.refreshToken(refreshToken, device);

    // Set the rotated refresh token in cookie
    this.setRefreshCookie(res, result.refreshToken);

    // Return only the access token in body
    return { accessToken: result.accessToken };
  }

  /**
   * POST /api/auth/logout
   *
   * Invalidate current session. Clears refresh cookie.
   */
  @UseGuards(JwtAuthGuard)
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(
    @CurrentUser() user: JwtPayload,
    @Body(new ZodPipe(LogoutRequestSchema)) body: LogoutRequest,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const refreshToken = req.cookies?.[REFRESH_TOKEN_COOKIE] || undefined;

    await this.authService.logout(user.sub, refreshToken, body.allDevices);

    // Clear the refresh token cookie
    res.clearCookie(REFRESH_TOKEN_COOKIE, {
      httpOnly: true,
      secure: this.isProduction,
      sameSite: 'strict',
      path: '/api/auth',
    });

    return { message: 'Logged out successfully' };
  }

  /**
   * GET /api/auth/me
   *
   * Get the current authenticated user's profile.
   */
  @UseGuards(JwtAuthGuard)
  @Get('me')
  async me(@CurrentUser() user: JwtPayload) {
    return this.authService.getCurrentUser(user.sub);
  }

  /**
   * GET /api/auth/sessions
   *
   * List active sessions for device management.
   */
  @UseGuards(JwtAuthGuard)
  @Get('sessions')
  async sessions(@CurrentUser() user: JwtPayload) {
    return this.authService.getActiveSessions(user.sub);
  }

  /**
   * DELETE /api/auth/sessions/:id
   *
   * Revoke a specific session by ID.
   */
  @UseGuards(JwtAuthGuard)
  @Delete('sessions/:id')
  @HttpCode(HttpStatus.OK)
  async revokeSession(
    @CurrentUser() user: JwtPayload,
    @Param('id') sessionId: string,
  ) {
    await this.authService.revokeSession(user.sub, sessionId);
    return { message: 'Session revoked' };
  }

  // ---- Private Helpers ----

  private get isProduction(): boolean {
    return this.configService.get<string>('nodeEnv') === 'production';
  }

  /**
   * Set refresh token as httpOnly, secure, sameSite cookie.
   * Path is scoped to /api/auth to prevent it being sent on every request.
   */
  private setRefreshCookie(res: Response, token: string): void {
    const refreshExpDays = parseInt(
      this.configService.get<string>('jwt.refreshExpiration', '7d').replace('d', ''),
      10,
    ) || 7;

    res.cookie(REFRESH_TOKEN_COOKIE, token, {
      httpOnly: true,
      secure: this.isProduction,
      sameSite: this.isProduction ? 'strict' : 'lax',
      path: '/api/auth',
      maxAge: refreshExpDays * 24 * 60 * 60 * 1000,
    });
  }
}
