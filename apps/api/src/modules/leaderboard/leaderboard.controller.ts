import { Controller, Get, Query, UseGuards, Request, BadRequestException } from '@nestjs/common';
import { LeaderboardService } from './leaderboard.service';
import { JwtAuthGuard } from '../../common/guards/auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { type JwtPayload } from '../../common/guards/auth.guard';

@Controller('leaderboard')
export class LeaderboardController {
  constructor(private readonly leaderboardService: LeaderboardService) {}

  /**
   * GET /api/leaderboard?scope=global&timeframe=monthly&metric=return_percent
   */
  @Get()
  async getLeaderboard(
    @Query('scope') scope = 'global',
    @Query('timeframe') timeframe = 'monthly',
    @Query('metric') metric = 'return_percent',
    @Query('limit') limit = '100',
  ) {
    const validTimeframes = ['daily', 'weekly', 'monthly', 'yearly', 'all_time'];
    const validMetrics = ['return_percent', 'realized_pnl', 'win_rate'];

    if (!validTimeframes.includes(timeframe)) throw new BadRequestException(`Invalid timeframe`);
    if (!validMetrics.includes(metric)) throw new BadRequestException(`Invalid metric`);

    const rankings = await this.leaderboardService.getTopRanking(scope, timeframe, metric, parseInt(limit, 10));
    return { data: rankings };
  }

  /**
   * GET /api/leaderboard/me?scope=global&timeframe=monthly&metric=return_percent
   */
  @UseGuards(JwtAuthGuard)
  @Get('me')
  async getMyRank(
    @CurrentUser() user: JwtPayload,
    @Query('scope') scope = 'global',
    @Query('timeframe') timeframe = 'monthly',
    @Query('metric') metric = 'return_percent',
  ) {
    const rankData = await this.leaderboardService.getUserRank(user.sub, scope, timeframe, metric);
    return { data: rankData };
  }
}
