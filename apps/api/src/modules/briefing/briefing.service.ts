import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { RedisService } from '../../redis/redis.service';
import { BriefingContextAssembler, BriefingInsight } from './briefing-context-assembler';

const BRIEFING_CACHE_PREFIX = 'briefing:cache:';
const CACHE_TTL_SECONDS = 60;
const SUPPRESSION_HITS_THRESHOLD = 3;

@Injectable()
export class BriefingService {
  private readonly logger = new Logger(BriefingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly assembler: BriefingContextAssembler,
  ) {}

  /**
   * Retrieves the Morning Briefing for a user.
   * Handles caching, assembling, and suppression cooldowns.
   */
  async getMorningBriefing(userId: string): Promise<BriefingInsight[]> {
    const cacheKey = `${BRIEFING_CACHE_PREFIX}${userId}`;

    // 1. Check Short-Lived Cache
    const cached = await this.redis.getJson<BriefingInsight[]>(cacheKey);
    if (cached) {
      return cached;
    }

    // 2. Assemble Context deterministically
    const rawInsights = await this.assembler.assembleContext(userId);

    // 3. Process Suppression
    const finalInsights = await this.processSuppression(userId, rawInsights);

    // 4. Non-Empty Fallback Check
    if (finalInsights.length === 0) {
      finalInsights.push(this.assembler.generateFallback());
    }

    // 5. Cache Result
    await this.redis.setJson(cacheKey, finalInsights, CACHE_TTL_SECONDS);

    // 6. Log generated insights (Observability)
    this.logger.log({
      event: 'BriefingGenerated',
      userId,
      insights: finalInsights.map((i) => i.id),
      count: finalInsights.length,
    });

    return finalInsights;
  }

  /**
   * Invalidates the briefing cache for a user.
   */
  async invalidateBriefing(userId: string): Promise<void> {
    const cacheKey = `${BRIEFING_CACHE_PREFIX}${userId}`;
    await this.redis.getClient().del(cacheKey);
    this.logger.log({ event: 'BriefingCacheInvalidated', userId });
  }

  /**
   * Evaluates each insight against the InsightHistory table.
   * Suppresses if consecutive hits >= 3 with the same hash.
   */
  private async processSuppression(userId: string, insights: BriefingInsight[]): Promise<BriefingInsight[]> {
    const validInsights: BriefingInsight[] = [];
    const now = new Date();

    for (const insight of insights) {
      // Find history
      const history = await this.prisma.insightHistory.findUnique({
        where: {
          userId_insightId_entityKey: {
            userId,
            insightId: insight.id,
            entityKey: insight.entityKey,
          },
        },
      });

      if (!history) {
        // First time seeing this insight + entity combo
        await this.prisma.insightHistory.create({
          data: {
            userId,
            insightId: insight.id,
            entityKey: insight.entityKey,
            hash: insight.hash,
            consecutiveHits: 1,
            lastShownAt: now,
          },
        });
        validInsights.push(insight);
        continue;
      }

      // Check if suppressed
      if (history.suppressedUntil && history.suppressedUntil > now) {
        if (history.hash === insight.hash) {
          // Still suppressed, and state hasn't changed
          this.logger.debug({ event: 'InsightSuppressed', insightId: insight.id, userId });
          continue;
        } else {
          // State changed! Break suppression
          await this.prisma.insightHistory.update({
            where: { id: history.id },
            data: {
              hash: insight.hash,
              consecutiveHits: 1,
              lastShownAt: now,
              suppressedUntil: null, // Clear suppression
            },
          });
          validInsights.push(insight);
          continue;
        }
      }

      // Not currently suppressed. Check if hash matches.
      if (history.hash === insight.hash) {
        // Meaningful session threshold (preventing every load from bumping hit count).
        // Let's assume if lastShownAt is > 12 hours ago, it counts as a new session.
        const hoursSinceLastShown = (now.getTime() - history.lastShownAt.getTime()) / (1000 * 60 * 60);
        
        let newHits = history.consecutiveHits;
        let newSuppressedUntil = history.suppressedUntil;

        if (hoursSinceLastShown > 12) {
          newHits += 1;
          if (newHits >= SUPPRESSION_HITS_THRESHOLD) {
            // Suppress for 48 hours
            newSuppressedUntil = new Date(now.getTime() + 48 * 60 * 60 * 1000);
            this.logger.debug({ event: 'InsightNewlySuppressed', insightId: insight.id, userId });
          }
        }

        await this.prisma.insightHistory.update({
          where: { id: history.id },
          data: {
            consecutiveHits: newHits,
            lastShownAt: now,
            suppressedUntil: newSuppressedUntil,
          },
        });

        if (!newSuppressedUntil) {
          validInsights.push(insight);
        }
      } else {
        // Hash changed — reset hits
        await this.prisma.insightHistory.update({
          where: { id: history.id },
          data: {
            hash: insight.hash,
            consecutiveHits: 1,
            lastShownAt: now,
            suppressedUntil: null,
          },
        });
        validInsights.push(insight);
      }
    }

    return validInsights;
  }
}
