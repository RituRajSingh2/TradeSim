import { Controller, Get, UseGuards, Request } from '@nestjs/common';
import { JwtAuthGuard, type JwtPayload } from '../../common/guards/auth.guard';
import { BriefingService } from './briefing.service';
import { BriefingInsight } from './briefing-context-assembler';

interface BriefingResponse {
  success: boolean;
  data: {
    insights: BriefingInsight[];
  };
}

@Controller('briefing')
@UseGuards(JwtAuthGuard)
export class BriefingController {
  constructor(private readonly briefingService: BriefingService) {}

  @Get('morning-context')
  async getMorningContext(@Request() req: any): Promise<BriefingResponse> {
    const user = req.user as JwtPayload;
    
    // Strict lightweight payload: Returns only array of 1-3 insights
    const insights = await this.briefingService.getMorningBriefing(user.sub);

    return {
      success: true,
      data: {
        insights,
      },
    };
  }
}
