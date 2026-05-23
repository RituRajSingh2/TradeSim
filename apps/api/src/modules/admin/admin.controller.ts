import {
  Controller,
  Get,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { AdminAuditInterceptor } from './admin-audit.interceptor';
import { AdminMetricsService } from './admin-metrics.service';

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@UseInterceptors(AdminAuditInterceptor)
@Roles('ADMIN')
export class AdminController {
  constructor(private readonly metricsService: AdminMetricsService) {}

  /**
   * GET /api/admin/metrics
   * Returns operational telemetry for monitoring dashboards.
   */
  @Get('metrics')
  async getMetrics() {
    return {
      success: true,
      data: await this.metricsService.collectMetrics(),
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * GET /api/admin/health
   * Deep health check for all subsystems.
   */
  @Get('health')
  async getDeepHealth() {
    return {
      success: true,
      data: await this.metricsService.deepHealthCheck(),
      timestamp: new Date().toISOString(),
    };
  }
}
