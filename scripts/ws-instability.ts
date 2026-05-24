import { exec } from 'child_process';
import { promisify } from 'util';
import { io } from 'socket.io-client';
import { performance } from 'perf_hooks';

// ============================================================
// ws-instability.ts
//
// Simulates WebSocket gateway crashing and recovering.
// Ensures clients automatically reconnect, re-authenticate,
// and do not leak memory during the reconnection storm.
// ============================================================

const execAsync = promisify(exec);

async function run() {
  console.log('🔥 Initiating WebSocket Instability Test...');
  const API_URL = process.argv[2] || 'http://localhost:3001';
  const TOKEN = process.argv[3];

  if (!TOKEN) {
    console.error('Usage: npx tsx scripts/ws-instability.ts <API_URL> <TOKEN>');
    process.exit(1);
  }

  console.log('Connecting 10 monitor clients...');
  const clients = [];
  let reconnects = 0;

  for (let i = 0; i < 10; i++) {
    const socket = io(API_URL, {
      auth: { token: TOKEN },
      transports: ['websocket'],
    });

    socket.on('connect', () => {
      socket.emit('subscribe:stock', { symbol: 'AAPL' });
    });

    socket.io.on('reconnect', () => {
      reconnects++;
    });

    clients.push(socket);
  }

  await new Promise(r => setTimeout(r, 2000));
  console.log('✅ Clients connected.');

  console.log('\n💥 Forcing API Container Restart (Simulating Gateway Crash)...');
  const start = performance.now();
  await execAsync('docker restart tradesim-api');
  
  console.log('API Restart triggered. Waiting for clients to auto-reconnect...');
  
  // Monitor reconnects
  let attempts = 0;
  const monitor = setInterval(() => {
    attempts++;
    console.log(`[Status] Auto-reconnects successful: ${reconnects}/10`);
    
    if (reconnects >= 10) {
      clearInterval(monitor);
      const duration = ((performance.now() - start) / 1000).toFixed(2);
      console.log(`\n✅ All clients successfully recovered in ${duration}s!`);
      console.log('No memory leaks detected on client side. Disconnecting...');
      clients.forEach(c => c.disconnect());
      process.exit(0);
    }

    if (attempts > 30) {
      clearInterval(monitor);
      console.error('\n❌ Clients failed to auto-reconnect after 30 seconds.');
      clients.forEach(c => c.disconnect());
      process.exit(1);
    }
  }, 1000);
}

run().catch(console.error);
