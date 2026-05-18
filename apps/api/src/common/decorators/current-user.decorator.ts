import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { JwtPayload } from '../guards/auth.guard';

/**
 * Extract the current authenticated user from the request.
 *
 * Usage:
 * ```ts
 * @Get('profile')
 * @UseGuards(AuthGuard)
 * getProfile(@CurrentUser() user: JwtPayload) {
 *   return this.usersService.getProfile(user.sub);
 * }
 *
 * @Get('me')
 * @UseGuards(AuthGuard)
 * getMe(@CurrentUser('sub') userId: string) {
 *   return this.usersService.findById(userId);
 * }
 * ```
 */
export const CurrentUser = createParamDecorator(
  (data: keyof JwtPayload | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user as JwtPayload;

    if (!user) return null;
    return data ? user[data] : user;
  },
);
