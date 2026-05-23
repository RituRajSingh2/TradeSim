import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PlatformLogger } from './logger.service';
import { MetricEvent } from '@tradesim/shared';

@Injectable()
export class MetricsAggregatorService implements OnModuleInit, OnModuleDestroy {
  private timer?: NodeJS.Timeout;
  
  // Accumulate counts (e.g., number of failovers in the last 60s)
  private readonly counters = new Map<MetricEvent | string, number>();
  
  // Track instantaneous values (e.g., current connected websockets)
  private readonly gauges = new Map<MetricEvent | string, number>();

  constructor(private readonly logger: PlatformLogger) {}

  onModuleInit() {
    // Emit aggregated metrics every 60 seconds
    this.timer = setInterval(() => this.flush(), 60_000);
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
    this.flush();
  }

  /**
   * Increment a counter metric (resets to 0 after flush).
   */
  increment(metric: MetricEvent | string, value = 1) {
    const current = this.counters.get(metric) || 0;
    this.counters.set(metric, current + value);
  }

  /**
   * Set a gauge metric (persists across flushes until updated).
   */
  setGauge(metric: MetricEvent | string, value: number) {
    this.gauges.set(metric, value);
  }

  /**
   * Flush metrics to the underlying structured JSON logger.
   * This format is optimized for ingestion by Datadog/ELK log-based metrics.
   */
  flush() {
    for (const [metric, value] of this.counters.entries()) {
      this.logger.log({
        eventType: metric as any,
        message: `Metric Counter: ${metric}`,
        metadata: { metricType: 'counter', value }
      });
    }
    
    for (const [metric, value] of this.gauges.entries()) {
      this.logger.log({
        eventType: metric as any,
        message: `Metric Gauge: ${metric}`,
        metadata: { metricType: 'gauge', value }
      });
    }

    // Reset counters after flush, but preserve gauges
    this.counters.clear();
  }
}
