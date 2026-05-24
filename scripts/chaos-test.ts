import { execSync } from 'child_process';
import * as path from 'path';

// ============================================================
// chaos-test.ts
//
// Master test runner for the Chaos Testing suite.
// Sequentially runs infrastructure failure scenarios.
// ============================================================

const API_URL = process.argv[2] || 'http://localhost:3001';
const TOKEN = process.argv[3] || 'DUMMY_TOKEN_PLEASE_PROVIDE';

const scripts = [
  { name: 'Provider Failure', file: 'provider-failure.ts', args: [API_URL] },
  { name: 'Redis Failure', file: 'redis-failure.ts', args: [API_URL] },
  { name: 'WebSocket Instability', file: 'ws-instability.ts', args: [API_URL, TOKEN] },
];

console.log('==================================================');
console.log('☢️  TRADESIM CHAOS TESTING SUITE');
console.log('==================================================\n');
console.log('Warning: This suite interacts with local Docker containers.');
console.log('Ensure tradesim-api and tradesim-redis are running.\n');

for (const script of scripts) {
  console.log(`\n--- Running: ${script.name} ---`);
  try {
    const args = script.args.join(' ');
    execSync(`npx tsx ${path.join(__dirname, script.file)} ${args}`, { stdio: 'inherit' });
  } catch (error) {
    console.error(`❌ ${script.name} suite failed.`);
  }
}

console.log('\n==================================================');
console.log('✅  CHAOS TESTING COMPLETE');
console.log('==================================================');
