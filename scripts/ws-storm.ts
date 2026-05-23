import { io, Socket } from 'socket.io-client';
import { performance } from 'perf_hooks';

// ============================================================
// ws-storm.ts
//
// Simulates a WebSocket reconnect storm.
// Connects N clients as fast as possible, subscribes to data,
// drops the connection, and reconnects.
//
// Usage:
//   npx ts-node scripts/ws-storm.ts <API_URL> <TOKEN> [NUM_CLIENTS]
// ============================================================

const API_URL = process.argv[2] || 'http://localhost:3001';
const TOKEN = process.argv[3];
const NUM_CLIENTS = parseInt(process.argv[4] || '50', 10);

if (!TOKEN) {
  console.error('Usage: npx ts-node scripts/ws-storm.ts <API_URL> <TOKEN> [NUM_CLIENTS]');
  process.exit(1);
}

const clients: Socket[] = [];
let connectionCount = 0;
let connectionErrors = 0;
let disconnectCount = 0;

async function run() {
  console.log(`⚡ Starting WS Reconnect Storm Simulation (${NUM_CLIENTS} clients) against ${API_URL}`);
  
  const startTime = performance.now();

  for (let i = 0; i < NUM_CLIENTS; i++) {
    const socket = io(API_URL, {
      auth: { token: TOKEN },
      transports: ['websocket'],
      reconnection: false, // We will manually manage reconnects to simulate a storm
    });

    socket.on('connect', () => {
      connectionCount++;
      // Immediately subscribe to a random popular stock
      const symbols = ['AAPL', 'MSFT', 'TSLA', 'NVDA', 'AMZN'];
      const sym = symbols[Math.floor(Math.random() * symbols.length)];
      socket.emit('subscribe:stock', { symbol: sym });
    });

    socket.on('connect_error', (err) => {
      connectionErrors++;
    });

    socket.on('disconnect', () => {
      disconnectCount++;
    });

    clients.push(socket);
    
    // Slight stagger to avoid completely blocking the local network stack
    await new Promise(r => setTimeout(r, 10));
  }

  // Monitor loop
  const monitor = setInterval(() => {
    console.log(`[Status] Connected: ${connectionCount} | Errors: ${connectionErrors} | Disconnected: ${disconnectCount}`);
    
    if (connectionCount + connectionErrors >= NUM_CLIENTS) {
      const duration = ((performance.now() - startTime) / 1000).toFixed(2);
      console.log(`\n✅ Storm phase 1 complete in ${duration}s.`);
      
      console.log('💥 Forcing massive disconnect in 2 seconds...');
      setTimeout(forceDisconnect, 2000);
      clearInterval(monitor);
    }
  }, 500);
}

function forceDisconnect() {
  const startDrop = performance.now();
  for (const socket of clients) {
    socket.disconnect();
  }
  const duration = ((performance.now() - startDrop) / 1000).toFixed(2);
  console.log(`💥 Dropped ${clients.length} connections in ${duration}s.`);
  console.log('Test complete. Exiting.');
  process.exit(0);
}

run().catch(console.error);
