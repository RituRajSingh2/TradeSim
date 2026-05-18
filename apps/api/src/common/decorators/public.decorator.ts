import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/**
 * Mark a route as publicly accessible (bypasses JwtAuthGuard).
 *
 * Usage:
 * ```ts
 * @Public()
 * @Get('health')
 * checkHealth() { ... }
 * ```
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
