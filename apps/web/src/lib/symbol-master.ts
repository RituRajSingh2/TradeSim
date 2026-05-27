// ============================================================
// Symbol Master Data — India Equity Search Index
// ============================================================
// 
// Structure:
//   symbol      — NSE ticker (canonical key)
//   name        — Full company name
//   short       — Short display name
//   sector      — BSE/NSE sector
//   aliases     — Common alternate names / terms users type
//   tags        — Extra searchable tokens
//
// Ranking on client:
//   1. Exact symbol match          → score 100
//   2. Prefix symbol match         → score 80
//   3. Exact company name match    → score 70
//   4. Alias exact match           → score 60
//   5. Prefix company/alias match  → score 40
//   6. Substring match             → score 20
//
// Typo tolerance: normalize & strip common suffixes before compare.
// ============================================================

export interface SymbolEntry {
  symbol: string;
  name: string;
  short: string;
  exchange: 'NSE' | 'BSE';
  sector: string;
  aliases: string[];
  tags: string[];
  // Pre-computed normalized tokens for fast lookup (set at module load)
  _normalized?: string[];
}

// ---- Helpers ----

function normalizeToken(s: string): string {
  return s.toLowerCase()
    // strip legal suffixes
    .replace(/\b(ltd|limited|industries|industry|enterprises|corp|corporation|pvt|private|holdings|holding|finance|financial|technologies|technology|solutions|services|group|bank|bancorp)\b/gi, '')
    .replace(/[^a-z0-9]/g, '')
    .trim();
}

// ---- Symbol Master ----

export const SYMBOL_MASTER: SymbolEntry[] = [
  // === Nifty 50 Core ===
  { symbol: 'RELIANCE', name: 'Reliance Industries Limited', short: 'Reliance', exchange: 'NSE', sector: 'Energy', aliases: ['reliance', 'reliance industries', 'ril', 'mukesh ambani'], tags: ['oil', 'gas', 'telecom', 'jio', 'retail'] },
  { symbol: 'TCS', name: 'Tata Consultancy Services Limited', short: 'TCS', exchange: 'NSE', sector: 'IT', aliases: ['tcs', 'tata consultancy', 'tata it', 'tata software'], tags: ['it', 'software', 'outsourcing'] },
  { symbol: 'HDFCBANK', name: 'HDFC Bank Limited', short: 'HDFC Bank', exchange: 'NSE', sector: 'Banking', aliases: ['hdfc bank', 'hdfc', 'hdfcbank'], tags: ['bank', 'private bank', 'credit'] },
  { symbol: 'INFY', name: 'Infosys Limited', short: 'Infosys', exchange: 'NSE', sector: 'IT', aliases: ['infosys', 'infy', 'infosys technologies'], tags: ['it', 'software', 'outsourcing'] },
  { symbol: 'ICICIBANK', name: 'ICICI Bank Limited', short: 'ICICI Bank', exchange: 'NSE', sector: 'Banking', aliases: ['icici bank', 'icici'], tags: ['bank', 'private bank'] },
  { symbol: 'HINDUNILVR', name: 'Hindustan Unilever Limited', short: 'HUL', exchange: 'NSE', sector: 'FMCG', aliases: ['hindustan unilever', 'hul', 'unilever india', 'surf', 'dove'], tags: ['fmcg', 'consumer goods'] },
  { symbol: 'SBIN', name: 'State Bank of India', short: 'SBI', exchange: 'NSE', sector: 'Banking', aliases: ['sbi', 'state bank', 'state bank of india'], tags: ['bank', 'psu', 'public sector'] },
  { symbol: 'BHARTIARTL', name: 'Bharti Airtel Limited', short: 'Airtel', exchange: 'NSE', sector: 'Telecom', aliases: ['airtel', 'bharti airtel', 'bhartiartl'], tags: ['telecom', 'mobile', '5g'] },
  { symbol: 'ITC', name: 'ITC Limited', short: 'ITC', exchange: 'NSE', sector: 'FMCG', aliases: ['itc', 'itc limited', 'cigarette'], tags: ['fmcg', 'tobacco', 'hotels'] },
  { symbol: 'KOTAKBANK', name: 'Kotak Mahindra Bank Limited', short: 'Kotak Bank', exchange: 'NSE', sector: 'Banking', aliases: ['kotak', 'kotak bank', 'kotak mahindra'], tags: ['bank', 'private bank'] },
  { symbol: 'LT', name: 'Larsen & Toubro Limited', short: 'L&T', exchange: 'NSE', sector: 'Infrastructure', aliases: ['l&t', 'larsen', 'larsen toubro', 'larsen and toubro', 'lt'], tags: ['infra', 'construction', 'engineering'] },
  { symbol: 'AXISBANK', name: 'Axis Bank Limited', short: 'Axis Bank', exchange: 'NSE', sector: 'Banking', aliases: ['axis bank', 'axis', 'axisbank'], tags: ['bank', 'private bank'] },
  { symbol: 'ASIANPAINT', name: 'Asian Paints Limited', short: 'Asian Paints', exchange: 'NSE', sector: 'Consumer', aliases: ['asian paints', 'asian paint', 'asianpaint'], tags: ['paint', 'consumer', 'home'] },
  { symbol: 'MARUTI', name: 'Maruti Suzuki India Limited', short: 'Maruti', exchange: 'NSE', sector: 'Auto', aliases: ['maruti', 'maruti suzuki', 'suzuki', 'maruti car'], tags: ['auto', 'car', 'automobile'] },
  { symbol: 'SUNPHARMA', name: 'Sun Pharmaceutical Industries Limited', short: 'Sun Pharma', exchange: 'NSE', sector: 'Pharma', aliases: ['sun pharma', 'sun pharmaceutical', 'sunpharma'], tags: ['pharma', 'medicine', 'healthcare'] },
  { symbol: 'WIPRO', name: 'Wipro Limited', short: 'Wipro', exchange: 'NSE', sector: 'IT', aliases: ['wipro'], tags: ['it', 'software', 'outsourcing'] },
  { symbol: 'HCLTECH', name: 'HCL Technologies Limited', short: 'HCL Tech', exchange: 'NSE', sector: 'IT', aliases: ['hcl', 'hcl tech', 'hcl technologies'], tags: ['it', 'software'] },
  { symbol: 'BAJFINANCE', name: 'Bajaj Finance Limited', short: 'Bajaj Finance', exchange: 'NSE', sector: 'NBFC', aliases: ['bajaj finance', 'bajajfinance', 'bajaj fin'], tags: ['nbfc', 'lending', 'consumer finance'] },
  { symbol: 'BAJAJFINSV', name: 'Bajaj Finserv Limited', short: 'Bajaj Finserv', exchange: 'NSE', sector: 'Financial Services', aliases: ['bajaj finserv', 'bajajfinsv'], tags: ['insurance', 'finance'] },
  { symbol: 'ADANIENT', name: 'Adani Enterprises Limited', short: 'Adani Ent', exchange: 'NSE', sector: 'Conglomerate', aliases: ['adani enterprises', 'adanient', 'adani'], tags: ['adani', 'ports', 'energy'] },
  { symbol: 'ADANIPORTS', name: 'Adani Ports and Special Economic Zone Limited', short: 'Adani Ports', exchange: 'NSE', sector: 'Infrastructure', aliases: ['adani ports', 'adaniports', 'mundra port'], tags: ['ports', 'logistics', 'adani'] },
  { symbol: 'TATAMOTORS', name: 'Tata Motors Limited', short: 'Tata Motors', exchange: 'NSE', sector: 'Auto', aliases: ['tata motors', 'tatamotors', 'jaguar', 'jlr', 'land rover'], tags: ['auto', 'car', 'ev', 'electric'] },
  { symbol: 'TATASTEEL', name: 'Tata Steel Limited', short: 'Tata Steel', exchange: 'NSE', sector: 'Metals', aliases: ['tata steel', 'tatasteel', 'steel'], tags: ['steel', 'metal', 'mining'] },
  { symbol: 'NTPC', name: 'NTPC Limited', short: 'NTPC', exchange: 'NSE', sector: 'Power', aliases: ['ntpc', 'national thermal power'], tags: ['power', 'electricity', 'psu'] },
  { symbol: 'POWERGRID', name: 'Power Grid Corporation of India Limited', short: 'PowerGrid', exchange: 'NSE', sector: 'Power', aliases: ['power grid', 'powergrid'], tags: ['power', 'electricity', 'psu'] },
  { symbol: 'ONGC', name: 'Oil and Natural Gas Corporation Limited', short: 'ONGC', exchange: 'NSE', sector: 'Energy', aliases: ['ongc', 'oil and natural gas', 'oil india'], tags: ['oil', 'gas', 'psu'] },
  { symbol: 'TECHM', name: 'Tech Mahindra Limited', short: 'Tech Mahindra', exchange: 'NSE', sector: 'IT', aliases: ['tech mahindra', 'techm', 'mahindra tech'], tags: ['it', 'software', 'telecom it'] },
  { symbol: 'ULTRACEMCO', name: 'UltraTech Cement Limited', short: 'UltraTech', exchange: 'NSE', sector: 'Cement', aliases: ['ultratech cement', 'ultracemco', 'ultratech'], tags: ['cement', 'construction'] },
  { symbol: 'TITAN', name: 'Titan Company Limited', short: 'Titan', exchange: 'NSE', sector: 'Consumer', aliases: ['titan', 'titan company', 'tanishq'], tags: ['watches', 'jewellery', 'retail'] },
  { symbol: 'NESTLEIND', name: 'Nestlé India Limited', short: 'Nestlé', exchange: 'NSE', sector: 'FMCG', aliases: ['nestle', 'nestle india', 'nestleind', 'maggi'], tags: ['fmcg', 'food', 'consumer'] },
  { symbol: 'JSWSTEEL', name: 'JSW Steel Limited', short: 'JSW Steel', exchange: 'NSE', sector: 'Metals', aliases: ['jsw steel', 'jswsteel', 'jsw'], tags: ['steel', 'metal'] },
  { symbol: 'HINDALCO', name: 'Hindalco Industries Limited', short: 'Hindalco', exchange: 'NSE', sector: 'Metals', aliases: ['hindalco', 'novelis', 'aluminium', 'aluminum'], tags: ['aluminium', 'metal', 'copper'] },
  { symbol: 'DRREDDY', name: 'Dr. Reddys Laboratories Limited', short: "Dr. Reddy's", exchange: 'NSE', sector: 'Pharma', aliases: ["dr reddy's", 'dr reddys', 'drreddy', 'drreddy labs'], tags: ['pharma', 'generics', 'us market'] },
  { symbol: 'DIVISLAB', name: 'Divis Laboratories Limited', short: 'Divis Lab', exchange: 'NSE', sector: 'Pharma', aliases: ['divis', 'divis lab', 'divislab'], tags: ['pharma', 'api', 'bulk drug'] },
  { symbol: 'CIPLA', name: 'Cipla Limited', short: 'Cipla', exchange: 'NSE', sector: 'Pharma', aliases: ['cipla'], tags: ['pharma', 'generics'] },
  { symbol: 'EICHERMOT', name: 'Eicher Motors Limited', short: 'Eicher Motors', exchange: 'NSE', sector: 'Auto', aliases: ['eicher', 'eicher motors', 'royal enfield', 're'], tags: ['auto', 'motorcycle', 'bike'] },
  { symbol: 'BAJAJ-AUTO', name: 'Bajaj Auto Limited', short: 'Bajaj Auto', exchange: 'NSE', sector: 'Auto', aliases: ['bajaj auto', 'bajaj', 'bajaj bike'], tags: ['auto', 'motorcycle', 'two-wheeler'] },
  { symbol: 'M&M', name: 'Mahindra & Mahindra Limited', short: 'M&M', exchange: 'NSE', sector: 'Auto', aliases: ['mahindra', 'm&m', 'mm', 'mahindra mahindra', 'mahindra tractor'], tags: ['auto', 'suv', 'tractor', 'ev'] },
  { symbol: 'APOLLOHOSP', name: 'Apollo Hospitals Enterprise Limited', short: 'Apollo Hospitals', exchange: 'NSE', sector: 'Healthcare', aliases: ['apollo hospital', 'apollo health', 'apollohosp'], tags: ['hospital', 'healthcare', 'medical'] },
  { symbol: 'GRASIM', name: 'Grasim Industries Limited', short: 'Grasim', exchange: 'NSE', sector: 'Cement', aliases: ['grasim'], tags: ['cement', 'viscose', 'aditya birla'] },
  { symbol: 'INDUSINDBK', name: 'IndusInd Bank Limited', short: 'IndusInd Bank', exchange: 'NSE', sector: 'Banking', aliases: ['indusind bank', 'indusindbk', 'indusind'], tags: ['bank', 'private bank'] },
  { symbol: 'TATACONSUM', name: 'Tata Consumer Products Limited', short: 'Tata Consumer', exchange: 'NSE', sector: 'FMCG', aliases: ['tata consumer', 'tataconsum', 'tata tea', 'tetley', 'tata salt'], tags: ['fmcg', 'tea', 'food'] },
  { symbol: 'COALINDIA', name: 'Coal India Limited', short: 'Coal India', exchange: 'NSE', sector: 'Mining', aliases: ['coal india', 'coalindia'], tags: ['coal', 'mining', 'psu', 'energy'] },
  { symbol: 'HEROMOTOCO', name: 'Hero MotoCorp Limited', short: 'Hero Moto', exchange: 'NSE', sector: 'Auto', aliases: ['hero motocorp', 'hero moto', 'heromotoco', 'hero honda'], tags: ['auto', 'motorcycle', 'two-wheeler'] },
  { symbol: 'BPCL', name: 'Bharat Petroleum Corporation Limited', short: 'BPCL', exchange: 'NSE', sector: 'Energy', aliases: ['bpcl', 'bharat petroleum'], tags: ['oil', 'petrol', 'psu', 'refinery'] },
  // === Mid-Cap Popular ===
  { symbol: 'ZOMATO', name: 'Zomato Limited', short: 'Zomato', exchange: 'NSE', sector: 'Technology', aliases: ['zomato', 'food delivery'], tags: ['food tech', 'startup', 'delivery'] },
  { symbol: 'NYKAA', name: 'FSN E-Commerce Ventures Limited', short: 'Nykaa', exchange: 'NSE', sector: 'E-Commerce', aliases: ['nykaa', 'fsn', 'beauty ecommerce'], tags: ['ecommerce', 'beauty', 'startup'] },
  { symbol: 'PAYTM', name: 'One97 Communications Limited', short: 'Paytm', exchange: 'NSE', sector: 'Fintech', aliases: ['paytm', 'one97'], tags: ['fintech', 'payments', 'startup'] },
  { symbol: 'DMART', name: 'Avenue Supermarts Limited', short: 'DMart', exchange: 'NSE', sector: 'Retail', aliases: ['dmart', 'd-mart', 'avenue supermarts', 'dmart store'], tags: ['retail', 'supermarket', 'grocery'] },
  { symbol: 'PVR', name: 'PVR Inox Limited', short: 'PVR Inox', exchange: 'NSE', sector: 'Media', aliases: ['pvr', 'pvr inox', 'inox cinema', 'pvr cinemas'], tags: ['movies', 'cinema', 'entertainment'] },
  { symbol: 'IRCTC', name: 'Indian Railway Catering and Tourism Corporation Limited', short: 'IRCTC', exchange: 'NSE', sector: 'Tourism', aliases: ['irctc', 'indian railways', 'railway catering'], tags: ['railway', 'train', 'tourism', 'psu'] },
  { symbol: 'HAL', name: 'Hindustan Aeronautics Limited', short: 'HAL', exchange: 'NSE', sector: 'Defence', aliases: ['hal', 'hindustan aeronautics', 'defence psu'], tags: ['defence', 'aviation', 'psu'] },
  { symbol: 'POLYCAB', name: 'Polycab India Limited', short: 'Polycab', exchange: 'NSE', sector: 'Electricals', aliases: ['polycab', 'wires cables'], tags: ['wires', 'cables', 'electricals'] },
  { symbol: 'PIDILITIND', name: 'Pidilite Industries Limited', short: 'Pidilite', exchange: 'NSE', sector: 'Chemicals', aliases: ['pidilite', 'fevicol', 'fevikwik'], tags: ['adhesive', 'chemicals', 'consumer'] },
];

// ---- Pre-compute normalized tokens at module load ----
SYMBOL_MASTER.forEach((entry) => {
  entry._normalized = [
    normalizeToken(entry.symbol),
    normalizeToken(entry.name),
    normalizeToken(entry.short),
    ...entry.aliases.map(normalizeToken),
    ...entry.tags.map(normalizeToken),
  ].filter(Boolean);
});

// ---- Trending list (curated for Indian retail users) ----
export const TRENDING_SYMBOLS = [
  'RELIANCE', 'TCS', 'HDFCBANK', 'INFY', 'SBIN',
  'TATAMOTORS', 'ZOMATO', 'ADANIENT', 'ICICIBANK', 'ITC',
];

// ============================================================
// Search Engine — Entirely in-memory, <5ms per query
// ============================================================

export interface SearchResult extends SymbolEntry {
  score: number;
  matchType: 'exact_symbol' | 'prefix_symbol' | 'exact_name' | 'alias' | 'prefix' | 'fuzzy';
}

export function searchSymbols(rawQuery: string, limit = 10): SearchResult[] {
  const query = rawQuery.trim();
  if (!query) return [];

  const q = query.toLowerCase();
  const qNorm = normalizeToken(q);
  const qUpper = query.toUpperCase();

  const scored: SearchResult[] = [];

  for (const entry of SYMBOL_MASTER) {
    let score = 0;
    let matchType: SearchResult['matchType'] = 'fuzzy';

    const symbolUp = entry.symbol.toUpperCase();

    // 1. Exact symbol match
    if (symbolUp === qUpper) {
      score = 100;
      matchType = 'exact_symbol';
    }
    // 2. Prefix symbol match
    else if (symbolUp.startsWith(qUpper)) {
      score = 80 - symbolUp.length; // shorter = higher rank within prefix
      matchType = 'prefix_symbol';
    }
    // 3. Exact company name (normalized)
    else if (normalizeToken(entry.name) === qNorm && qNorm.length > 2) {
      score = 70;
      matchType = 'exact_name';
    }
    // 4. Alias exact match
    else if (entry.aliases.some(a => a.toLowerCase() === q)) {
      score = 60;
      matchType = 'alias';
    }
    // 5. Prefix match on company/short/alias
    else if (
      entry.name.toLowerCase().startsWith(q) ||
      entry.short.toLowerCase().startsWith(q) ||
      entry.aliases.some(a => a.toLowerCase().startsWith(q))
    ) {
      score = 40;
      matchType = 'prefix';
    }
    // 6. Substring / fuzzy match on all normalized tokens
    else if (entry._normalized?.some(token => token.includes(qNorm) && qNorm.length >= 2)) {
      score = 20;
      matchType = 'fuzzy';
    }

    if (score > 0) {
      scored.push({ ...entry, score, matchType });
    }
  }

  // Sort by score descending, stable
  scored.sort((a, b) => b.score - a.score);

  return scored.slice(0, limit);
}
