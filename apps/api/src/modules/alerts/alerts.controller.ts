import { Controller, Get, Post, Body, Param, Delete, UseGuards, Request } from '@nestjs/common';
import { AlertsService } from './alerts.service';
import { JwtAuthGuard } from '../../common/guards/auth.guard';
import { AlertCondition } from '@prisma/client';
import { AlertEvaluationService } from './alert-evaluation.service';

@Controller('alerts')
@UseGuards(JwtAuthGuard)
export class AlertsController {
  constructor(
    private readonly alertsService: AlertsService,
    private readonly alertEvaluation: AlertEvaluationService,
  ) {}

  @Get()
  async getUserAlerts(@Request() req: any) {
    return this.alertsService.getUserAlerts(req.user.id);
  }

  @Post()
  async createAlert(
    @Request() req: any,
    @Body() body: { symbol: string; targetPrice: number; condition: AlertCondition }
  ) {
    const alert = await this.alertsService.createAlert(
      req.user.id,
      body.symbol,
      body.targetPrice,
      body.condition
    );
    
    // Refresh the evaluation cache for this symbol so the new alert is picked up instantly
    await this.alertEvaluation.refreshSymbol(body.symbol);
    
    return alert;
  }
}
