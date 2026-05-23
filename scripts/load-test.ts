import { io, Socket } from 'socket.io-client';
import { performance } from 'perf_hooks';

// ============================================================
// load-test.ts
//
// Simulates Market Open Burst by combining WS connections,
// heavy quote subscriptions, and monitoring event loop lag.
//
// Usage:
//   npx ts-node scripts/load-test.ts <API_URL> <TOKEN>
// ============================================================

const API_URL = process.argv[2] || 'http://localhost:3001';
const TOKEN = process.argv[3];
const NUM_CLIENTS = 20;

if (!TOKEN) {
  console.error('Usage: npx ts-node scripts/load-test.ts <API_URL> <TOKEN>');
  process.exit(1);
}

let eventLoopLag = 0;
let receivedQuotes = 0;

// Measure Node.js event loop lag
function measureLag() {
  const start = performance.now();
  setTimeout(() => {
    eventLoopLag = performance.now() - start - 100;
    measureLag();
  }, 100);
}

async function run() {
  console.log(`📈 Starting Market Open Burst Simulation`);
  measureLag();

  const clients: Socket[] = [];
  const symbols = ['AAPL', 'MSFT', 'TSLA', 'NVDA', 'AMZN', 'META', 'GOOGL', 'NFLX', 'AMD', 'INTC'];

  // 1. Establish connections
  for (let i = 0; i < NUM_CLIENTS; i++) {
    const socket = io(API_URL, {
      auth: { token: TOKEN },
      transports: ['websocket'],
    });

    socket.on('price:update', () => {
      receivedQuotes++;
    });

    clients.push(socket);
  }

  console.log(`Waiting for ${NUM_CLIENTS} connections to stabilize...`);
  await new Promise(r => setTimeout(r, 2000));

  // 2. Heavy Subscriptions (Market Open Burst)
  console.log(`🔥 Emitting massive subscription burst...`);
  for (const socket of clients) {
    // Each client subscribes to 5 random symbols
    for (let i = 0; i < 5; i++) {
      const sym = symbols[Math.floor(Math.random() * symbols.length)];
      socket.emit('subscribe:stock', { symbol: sym });
    }
  }

  // 3. Monitor performance
  let ticks = 0;
  const monitor = setInterval(() => {
    ticks++;
    const memUsage = process.memoryUsage().heapUsed / 1024 / 1024;
    console.log(`[Metrics] Lag: ${eventLoopLag.toFixed(2)}ms | Mem: ${memUsage.toFixed(2)}MB | Quotes Rcvd: ${receivedQuotes}`);
    
    // Reset quote counter to measure quotes/sec
    receivedQuotes = 0;

    if (ticks >= 15) { // Run for 15 seconds
      clearInterval(monitor);
      for (const s of clients) s.disconnect();
      console.log('✅ Load test complete.');
      process.exit(0);
    }
  }, 1000);
}

run().catch(console.error);
