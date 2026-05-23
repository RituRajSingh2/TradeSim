import { performance } from 'perf_hooks';

// ============================================================
// order-stress.ts
//
// Simulates order execution stress testing by hammering the
// trade execution endpoint as fast as possible.
//
// Usage:
//   npx ts-node scripts/order-stress.ts <API_URL> <TOKEN> [CONCURRENCY] [TOTAL_ORDERS]
// ============================================================

const API_URL = process.argv[2] || 'http://localhost:3001/api';
const TOKEN = process.argv[3];
const CONCURRENCY = parseInt(process.argv[4] || '10', 10);
const TOTAL_ORDERS = parseInt(process.argv[5] || '100', 10);

if (!TOKEN) {
  console.error('Usage: npx ts-node scripts/order-stress.ts <API_URL> <TOKEN> [CONCURRENCY] [TOTAL_ORDERS]');
  process.exit(1);
}

const symbols = ['AAPL', 'MSFT', 'TSLA', 'NVDA', 'AMZN'];
let completed = 0;
let successful = 0;
let failed = 0;

async function placeOrderWorker(workerId: number, count: number) {
  for (let i = 0; i < count; i++) {
    const symbol = symbols[Math.floor(Math.random() * symbols.length)];
    const isBuy = Math.random() > 0.5;
    
    try {
      const res = await fetch(`${API_URL}/trading/execute`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${TOKEN}`
        },
        body: JSON.stringify({
          symbol,
          type: 'MARKET',
          side: isBuy ? 'BUY' : 'SELL',
          quantity: Math.floor(Math.random() * 5) + 1,
        })
      });

      if (res.ok) {
        successful++;
      } else {
        failed++;
        // console.log(`Worker ${workerId} failed: ${res.status}`);
      }
    } catch (e) {
      failed++;
    }
    completed++;
    
    if (completed % 20 === 0) {
      console.log(`Progress: ${completed}/${TOTAL_ORDERS} (Success: ${successful}, Failed: ${failed})`);
    }
  }
}

async function run() {
  console.log(`🚀 Starting Order Stress Test`);
  console.log(`Concurrency: ${CONCURRENCY} | Total Orders: ${TOTAL_ORDERS}`);

  const startTime = performance.now();
  const ordersPerWorker = Math.floor(TOTAL_ORDERS / CONCURRENCY);
  const workers = [];

  for (let i = 0; i < CONCURRENCY; i++) {
    // Distribute remainder to the last worker
    const count = (i === CONCURRENCY - 1) 
      ? ordersPerWorker + (TOTAL_ORDERS % CONCURRENCY) 
      : ordersPerWorker;
    
    workers.push(placeOrderWorker(i, count));
  }

  await Promise.all(workers);

  const durationMs = performance.now() - startTime;
  const tps = (TOTAL_ORDERS / (durationMs / 1000)).toFixed(2);

  console.log(`\n✅ Order Stress Test Complete`);
  console.log(`Time taken: ${(durationMs / 1000).toFixed(2)}s`);
  console.log(`Throughput: ${tps} orders/sec`);
  console.log(`Successful: ${successful}`);
  console.log(`Failed:     ${failed}`);
}

run().catch(console.error);
