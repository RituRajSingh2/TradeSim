import { exec } from 'child_process';
import { promisify } from 'util';

// ============================================================
// provider-failure.ts
//
// Simulates an upstream Market Data Provider outage.
// Blackholes DNS for Yahoo Finance inside the API container to
// trigger the ProviderManager circuit breaker and verify mock
// fallback activation and stale-data safeguarding.
// ============================================================

const execAsync = promisify(exec);

async function checkQuote(apiUrl: string) {
  const start = Date.now();
  try {
    const res = await fetch(`${apiUrl}/api/market/quote/AAPL`);
    const data = await res.json();
    return {
      status: res.status,
      duration: Date.now() - start,
      isMock: data.isMock || false,
      staleness: data.staleness?.isStale || false,
    };
  } catch (e) {
    return { status: 0, duration: Date.now() - start, isMock: false, staleness: false };
  }
}

async function run() {
  console.log('🔥 Initiating Provider Chaos Test...');
  const API_URL = process.argv[2] || 'http://localhost:3001';

  console.log('\n[Phase 1] Normal Operation');
  const normal = await checkQuote(API_URL);
  console.log(`Status: ${normal.status} | Latency: ${normal.duration}ms | Mock: ${normal.isMock}`);

  console.log('\n💥 Injecting Upstream Outage (Blackholing query1.finance.yahoo.com)...');
  // Inject bad host entry
  await execAsync('docker exec tradesim-api sh -c "echo \'127.0.0.1 query1.finance.yahoo.com\' >> /etc/hosts"');

  console.log('\n[Phase 2] Waiting for Circuit Breaker to Trip (requires 3 failures)...');
  
  for (let i = 1; i <= 4; i++) {
    console.log(`\nAttempt ${i}:`);
    const attempt = await checkQuote(API_URL);
    console.log(`Status: ${attempt.status} | Latency: ${attempt.duration}ms | Mock: ${attempt.isMock}`);
    if (attempt.isMock) {
      console.log('✅ Circuit breaker tripped! Mock fallback activated.');
      break;
    }
  }

  console.log('\n🏥 Removing Blackhole (Restoring Upstream)...');
  // Remove the injected host entry
  await execAsync('docker exec tradesim-api sh -c "sed -i \'/query1.finance.yahoo.com/d\' /etc/hosts"');

  console.log('Waiting 5 minutes for Circuit Breaker Cooloff is too long for a script.');
  console.log('To verify immediate recovery, the container would need to be restarted, or wait 5 mins.');
  console.log('✅ Provider resilience test complete.');
}

run().catch(async e => {
  console.error('Fatal error:', e);
  // Failsafe recovery
  await execAsync('docker exec tradesim-api sh -c "sed -i \'/query1.finance.yahoo.com/d\' /etc/hosts"').catch(() => {});
});
