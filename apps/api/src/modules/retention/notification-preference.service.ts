import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

export interface NotificationPreferences {
  marketOpen: boolean;
  eodSummary: boolean;
  watchlistAlerts: boolean;
}

const DEFAULT_PREFERENCES: NotificationPreferences = {
  marketOpen: true,
  eodSummary: true,
  watchlistAlerts: true,
};

@Injectable()
export class NotificationPreferenceService {
  private readonly logger = new Logger(NotificationPreferenceService.name);

  constructor(private prisma: PrismaService) {}

  async getPreferences(userId: string): Promise<NotificationPreferences> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { notificationPreferences: true }
    });

    if (!user || !user.notificationPreferences) {
      return DEFAULT_PREFERENCES;
    }

    // Merge with defaults in case of missing keys
    return {
      ...DEFAULT_PREFERENCES,
      ...(user.notificationPreferences as Partial<NotificationPreferences>)
    };
  }

  async updatePreferences(
    userId: string,
    updates: Partial<NotificationPreferences>
  ): Promise<NotificationPreferences> {
    const current = await this.getPreferences(userId);
    const updated = { ...current, ...updates };

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        notificationPreferences: updated as any
      }
    });

    return updated;
  }
  
  /**
   * Helper to check if a specific notification type is allowed
   */
  async isAllowed(userId: string, type: keyof NotificationPreferences): Promise<boolean> {
    const prefs = await this.getPreferences(userId);
    return prefs[type];
  }
}
