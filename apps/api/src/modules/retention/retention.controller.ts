import { Controller, Get, Patch, Body, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { NotificationPreferenceService, NotificationPreferences } from './notification-preference.service';

@Controller('retention')
@UseGuards(JwtAuthGuard)
export class RetentionController {
  constructor(private readonly preferenceService: NotificationPreferenceService) {}

  @Get('preferences')
  async getPreferences(@CurrentUser() user: { id: string }) {
    const prefs = await this.preferenceService.getPreferences(user.id);
    return { data: prefs };
  }

  @Patch('preferences')
  async updatePreferences(
    @CurrentUser() user: { id: string },
    @Body() updates: Partial<NotificationPreferences>
  ) {
    const updated = await this.preferenceService.updatePreferences(user.id, updates);
    return { data: updated };
  }
}
