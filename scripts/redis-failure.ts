import { exec } from 'child_process';
import { promisify } from 'util';
import { performance } from 'perf_hooks';

// ============================================================
// redis-failure.ts
//
// Simulates a Redis crash/outage by pausing the Docker container.
// Verifies that the API gracefully degrades (e.g. caching bypassed,
// rate limits skipped) without crashing the event loop.
// ============================================================

const execAsync = promisify(exec);

async function checkHealth(apiUrl: string) {
  try {
    const live = await fetch(`${apiUrl}/health/live`);
    const ready = await fetch(`${apiUrl}/health/ready`);
    return {
      live: live.status,
      ready: ready.status
    };
  } catch (e) {
    return { live: 0, ready: 0 };
  }
}

async function run() {
  console.log('🔥 Initiating Redis Chaos Test...');
  const API_URL = process.argv[2] || 'http://localhost:3001';

  // 1. Initial State
  const initial = await checkHealth(API_URL);
  console.log(`[State] Initial - Live: ${initial.live}, Ready: ${initial.ready}`);
  
  if (initial.ready !== 200) {
    console.error('❌ API is not ready. Is the Docker stack running?');
    process.exit(1);
  }

  // 2. Inject Failure
  console.log('\n💥 Pausing Redis container (simulating outage)...');
  await execAsync('docker pause tradesim-redis');

  // 3. Monitor Degradation
  console.log('Waiting 5s for readiness probes to fail...');
  await new Promise(r => setTimeout(r, 5000));
  
  const degraded = await checkHealth(API_URL);
  console.log(`[State] Degraded - Live: ${degraded.live}, Ready: ${degraded.ready}`);
  
  if (degraded.live === 200 && degraded.ready === 503) {
    console.log('✅ API gracefully degraded! (Liveness maintained, Readiness failed)');
  } else {
    console.error('❌ API failed to degrade correctly. Event loop might be blocked or readiness check failed.');
  }

  // 4. Recovery
  console.log('\n🏥 Unpausing Redis container...');
  await execAsync('docker unpause tradesim-redis');

  console.log('Waiting 10s for reconnect...');
  await new Promise(r => setTimeout(r, 10000));

  const recovered = await checkHealth(API_URL);
  console.log(`[State] Recovered - Live: ${recovered.live}, Ready: ${recovered.ready}`);

  if (recovered.ready === 200) {
    console.log('✅ API successfully recovered and reconnected to Redis!');
  } else {
    console.error('❌ API failed to recover automatically.');
  }
}

run().catch(e => {
  console.error('Fatal error:', e);
  // Failsafe recovery — use execAsync so we have a proper promise
  void execAsync('docker unpause tradesim-redis').catch(() => {});
});
