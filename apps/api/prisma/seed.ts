// ============================================
// Prisma Seed Script
// Idempotent — safe to re-run via upsert
// ============================================

import { PrismaClient, Exchange, InstrumentType } from '@prisma/client';

const prisma = new PrismaClient();

const NSE_STOCKS = [
  { symbol: 'RELIANCE', name: 'Reliance Industries Ltd', sector: 'Energy', isin: 'INE002A01018' },
  { symbol: 'TCS', name: 'Tata Consultancy Services Ltd', sector: 'IT', isin: 'INE467B01029' },
  { symbol: 'HDFCBANK', name: 'HDFC Bank Ltd', sector: 'Banking', isin: 'INE040A01034' },
  { symbol: 'INFY', name: 'Infosys Ltd', sector: 'IT', isin: 'INE009A01021' },
  { symbol: 'ICICIBANK', name: 'ICICI Bank Ltd', sector: 'Banking', isin: 'INE090A01021' },
  { symbol: 'HINDUNILVR', name: 'Hindustan Unilever Ltd', sector: 'FMCG', isin: 'INE030A01027' },
  { symbol: 'ITC', name: 'ITC Ltd', sector: 'FMCG', isin: 'INE154A01025' },
  { symbol: 'SBIN', name: 'State Bank of India', sector: 'Banking', isin: 'INE062A01020' },
  { symbol: 'BHARTIARTL', name: 'Bharti Airtel Ltd', sector: 'Telecom', isin: 'INE397D01024' },
  { symbol: 'KOTAKBANK', name: 'Kotak Mahindra Bank Ltd', sector: 'Banking', isin: 'INE237A01028' },
  { symbol: 'LT', name: 'Larsen & Toubro Ltd', sector: 'Infrastructure', isin: 'INE018A01030' },
  { symbol: 'AXISBANK', name: 'Axis Bank Ltd', sector: 'Banking', isin: 'INE238A01034' },
  { symbol: 'WIPRO', name: 'Wipro Ltd', sector: 'IT', isin: 'INE075A01022' },
  { symbol: 'ASIANPAINT', name: 'Asian Paints Ltd', sector: 'Consumer', isin: 'INE021A01026' },
  { symbol: 'MARUTI', name: 'Maruti Suzuki India Ltd', sector: 'Auto', isin: 'INE585B01010' },
  { symbol: 'TITAN', name: 'Titan Company Ltd', sector: 'Consumer', isin: 'INE280A01028' },
  { symbol: 'SUNPHARMA', name: 'Sun Pharmaceutical Industries Ltd', sector: 'Pharma', isin: 'INE044A01036' },
  { symbol: 'BAJFINANCE', name: 'Bajaj Finance Ltd', sector: 'Finance', isin: 'INE296A01024' },
  { symbol: 'TATAMOTORS', name: 'Tata Motors Ltd', sector: 'Auto', isin: 'INE155A01022' },
  { symbol: 'NESTLEIND', name: 'Nestle India Ltd', sector: 'FMCG', isin: 'INE239A01016' },
  { symbol: 'HCLTECH', name: 'HCL Technologies Ltd', sector: 'IT', isin: 'INE860A01027' },
  { symbol: 'ULTRACEMCO', name: 'UltraTech Cement Ltd', sector: 'Cement', isin: 'INE481G01011' },
  { symbol: 'POWERGRID', name: 'Power Grid Corporation of India Ltd', sector: 'Energy', isin: 'INE752E01010' },
  { symbol: 'NTPC', name: 'NTPC Ltd', sector: 'Energy', isin: 'INE733E01010' },
  { symbol: 'ONGC', name: 'Oil & Natural Gas Corporation Ltd', sector: 'Energy', isin: 'INE213A01029' },
  { symbol: 'TATASTEEL', name: 'Tata Steel Ltd', sector: 'Metals', isin: 'INE081A01012' },
  { symbol: 'ADANIENT', name: 'Adani Enterprises Ltd', sector: 'Infrastructure', isin: 'INE423A01024' },
  { symbol: 'TECHM', name: 'Tech Mahindra Ltd', sector: 'IT', isin: 'INE669C01036' },
  { symbol: 'INDUSINDBK', name: 'IndusInd Bank Ltd', sector: 'Banking', isin: 'INE095A01012' },
  { symbol: 'JSWSTEEL', name: 'JSW Steel Ltd', sector: 'Metals', isin: 'INE019A01038' },
];

// Nifty 50 index
const INDICES = [
  { symbol: 'NIFTY50', name: 'Nifty 50', sector: null, isin: null },
  { symbol: 'BANKNIFTY', name: 'Nifty Bank', sector: null, isin: null },
  { symbol: 'NIFTYIT', name: 'Nifty IT', sector: null, isin: null },
];

function generateReferralCode(phone: string): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  const seed = phone.split('').reduce((a, b) => a + b.charCodeAt(0), 0);
  for (let i = 0; i < 6; i++) {
    code += chars[(seed * (i + 1) * 7) % chars.length];
  }
  return `TS${code}`;
}

async function seedMarketSymbols() {
  console.log('🏛️  Seeding market symbols...');

  for (const stock of NSE_STOCKS) {
    await prisma.marketSymbol.upsert({
      where: { symbol_exchange: { symbol: stock.symbol, exchange: Exchange.NSE } },
      update: {
        companyName: stock.name,
        sector: stock.sector,
        isin: stock.isin,
      },
      create: {
        symbol: stock.symbol,
        exchange: Exchange.NSE,
        instrumentType: InstrumentType.EQUITY,
        companyName: stock.name,
        sector: stock.sector,
        isin: stock.isin,
        isActive: true,
      },
    });
  }

  for (const index of INDICES) {
    await prisma.marketSymbol.upsert({
      where: { symbol_exchange: { symbol: index.symbol, exchange: Exchange.NSE } },
      update: { companyName: index.name },
      create: {
        symbol: index.symbol,
        exchange: Exchange.NSE,
        instrumentType: InstrumentType.INDEX,
        companyName: index.name,
        isActive: true,
      },
    });
  }

  console.log(`   ✅ ${NSE_STOCKS.length} equities + ${INDICES.length} indices seeded`);
}

async function seedTestUsers() {
  console.log('👤 Seeding test users...');

  const testUsers = [
    { phone: '9876543210', name: 'Test User 1' },
    { phone: '9876543211', name: 'Test User 2' },
    { phone: '9876543212', name: 'Test User 3' },
    { phone: '9876543213', name: 'Test User 4' },
    { phone: '9876543214', name: 'Test User 5' },
  ];

  const DEFAULT_BALANCE = 10_000;

  for (const testUser of testUsers) {
    const referralCode = generateReferralCode(testUser.phone);

    const user = await prisma.user.upsert({
      where: { phone: testUser.phone },
      update: { name: testUser.name },
      create: {
        phone: testUser.phone,
        name: testUser.name,
        referralCode,
        isActive: true,
      },
    });

    // Create portfolio if not exists
    const existingPortfolio = await prisma.portfolio.findUnique({
      where: { userId: user.id },
    });

    if (!existingPortfolio) {
      await prisma.portfolio.create({
        data: {
          userId: user.id,
          balance: DEFAULT_BALANCE,
          investedValue: 0,
          currentValue: 0,
          totalPnl: 0,
          totalPnlPercent: 0,
          dayPnl: 0,
          dayPnlPercent: 0,
        },
      });

      // Signup bonus ledger entry
      await prisma.ledgerEntry.create({
        data: {
          userId: user.id,
          entryType: 'CREDIT',
          category: 'SIGNUP_BONUS',
          amount: DEFAULT_BALANCE,
          runningBalance: DEFAULT_BALANCE,
          description: `Welcome bonus of ₹${DEFAULT_BALANCE.toLocaleString('en-IN')}`,
        },
      });
    }

    // Create default watchlist if not exists
    const existingWatchlist = await prisma.watchlist.findFirst({
      where: { userId: user.id },
    });

    if (!existingWatchlist) {
      const popularSymbols = await prisma.marketSymbol.findMany({
        where: { symbol: { in: ['RELIANCE', 'TCS', 'INFY', 'HDFCBANK', 'SBIN'] } },
      });

      const watchlist = await prisma.watchlist.create({
        data: {
          userId: user.id,
          name: 'My Watchlist',
        },
      });

      for (const sym of popularSymbols) {
        await prisma.watchlistItem.create({
          data: {
            watchlistId: watchlist.id,
            symbolId: sym.id,
            symbol: sym.symbol,
            companyName: sym.companyName,
          },
        });
      }
    }

    console.log(`   ✅ User ${testUser.name} (${testUser.phone})`);
  }
}

async function main() {
  console.log('');
  console.log('🌱 TradeSim Database Seed');
  console.log('========================');
  console.log('');

  try {
    await seedMarketSymbols();
    await seedTestUsers();

    console.log('');
    console.log('✅ Seed completed successfully');
    console.log('');
  } catch (error) {
    console.error('❌ Seed failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

main();
