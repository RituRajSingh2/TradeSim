import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { PlatformLogger } from '../logger/logger.service';

/**
 * Guard that checks if the authenticated user has one of the required roles.
 * Must be used AFTER JwtAuthGuard so that request.user is populated.
 *
 * Usage on controller or handler:
 *   @UseGuards(JwtAuthGuard, RolesGuard)
 *   @Roles('ADMIN')
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly logger: PlatformLogger,
  ) {
    this.logger.setContext(RolesGuard.name);
  }

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // If no @Roles() decorator, allow access
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('No authenticated user');
    }

    // user.role comes from the DB (populated via JWT sub → DB lookup, or directly from JWT if we extend the payload)
    // For now, we look it up from the request user object which may have role attached
    const userRole: string = user.role || 'USER';
    const hasRole = requiredRoles.includes(userRole);

    if (!hasRole) {
      this.logger.warn({
        message: `Access denied: user ${user.sub} with role ${userRole} tried to access ${request.method} ${request.url}`,
        eventType: 'AUTH_ROLE_DENIED',
        metadata: {
          userId: user.sub,
          userRole,
          requiredRoles,
          method: request.method,
          path: request.url,
        },
      });
      throw new ForbiddenException('Insufficient permissions');
    }

    return true;
  }
}
