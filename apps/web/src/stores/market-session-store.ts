import { create } from 'zustand';

export type SessionState = 'PREOPEN' | 'OPEN' | 'CLOSED' | 'WEEKEND';

interface MarketSessionStore {
  session: SessionState;
  isOpen: boolean;
  
  // E.g., "Opens in 2h 15m" or "Closes in 45m"
  timeRemainingText: string | null;

  // Manual trigger to recalculate (called by an interval)
  refreshSession: () => void;
}

// Fixed NSE Timings (IST)
const MARKET_OPEN_HOUR = 9;
const MARKET_OPEN_MINUTE = 15;
const MARKET_CLOSE_HOUR = 15;
const MARKET_CLOSE_MINUTE = 30;
const PREOPEN_START_HOUR = 9;
const PREOPEN_START_MINUTE = 0;

function getISTDate(): Date {
  const now = new Date();
  // UTC time + 5.5 hours
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  return new Date(utc + 3600000 * 5.5);
}

function calculateSession(): { session: SessionState; isOpen: boolean; timeRemainingText: string | null } {
  const ist = getISTDate();
  const day = ist.getDay(); // 0 = Sunday, 6 = Saturday
  const hours = ist.getHours();
  const minutes = ist.getMinutes();
  
  const currentMinutes = hours * 60 + minutes;
  const preopenMinutes = PREOPEN_START_HOUR * 60 + PREOPEN_START_MINUTE;
  const openMinutes = MARKET_OPEN_HOUR * 60 + MARKET_OPEN_MINUTE;
  const closeMinutes = MARKET_CLOSE_HOUR * 60 + MARKET_CLOSE_MINUTE;

  if (day === 0 || day === 6) {
    return { session: 'WEEKEND', isOpen: false, timeRemainingText: null };
  }

  if (currentMinutes < preopenMinutes) {
    // Before 9:00 AM
    const minsUntilOpen = openMinutes - currentMinutes;
    return { 
      session: 'CLOSED', 
      isOpen: false, 
      timeRemainingText: `Opens in ${Math.floor(minsUntilOpen / 60)}h ${minsUntilOpen % 60}m` 
    };
  }

  if (currentMinutes >= preopenMinutes && currentMinutes < openMinutes) {
    // 9:00 AM to 9:15 AM
    const minsUntilOpen = openMinutes - currentMinutes;
    return { 
      session: 'PREOPEN', 
      isOpen: false, 
      timeRemainingText: `Opens in ${minsUntilOpen}m` 
    };
  }

  if (currentMinutes >= openMinutes && currentMinutes < closeMinutes) {
    // 9:15 AM to 3:30 PM
    const minsUntilClose = closeMinutes - currentMinutes;
    let timeText = `Closes in ${Math.floor(minsUntilClose / 60)}h ${minsUntilClose % 60}m`;
    if (minsUntilClose < 60) {
      timeText = `Closes in ${minsUntilClose}m`;
    }
    return { 
      session: 'OPEN', 
      isOpen: true, 
      timeRemainingText: timeText 
    };
  }

  // After 3:30 PM
  return { session: 'CLOSED', isOpen: false, timeRemainingText: null };
}

export const useMarketSessionStore = create<MarketSessionStore>((set) => ({
  ...calculateSession(),
  refreshSession: () => set(calculateSession()),
}));

// Set up 1-minute interval on the client side only
if (typeof window !== 'undefined') {
  setInterval(() => {
    useMarketSessionStore.getState().refreshSession();
  }, 60000);
}
