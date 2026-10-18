import AsyncStorage from '@react-native-async-storage/async-storage';
import { DailyThought } from '../types';

const THOUGHT_STORAGE_KEY = 'studyhub_thought_of_the_day';

/**
 * Curated offline fallback thoughts focusing on studying, discipline, consistency,
 * engineering, learning, self-improvement, and success.
 */
export const FALLBACK_THOUGHTS: { quote: string; author: string }[] = [
  {
    quote: "Continuous improvement is better than delayed perfection.",
    author: "Mark Twain",
  },
  {
    quote: "Discipline is the bridge between goals and accomplishment.",
    author: "Jim Rohn",
  },
  {
    quote: "Scientists study the world as it is; engineers create the world that has never been.",
    author: "Theodore von Kármán",
  },
  {
    quote: "Live as if you were to die tomorrow. Learn as if you were to live forever.",
    author: "Mahatma Gandhi",
  },
  {
    quote: "Success is the sum of small efforts, repeated day in and day out.",
    author: "Robert Collier",
  },
  {
    quote: "It always seems impossible until it's done.",
    author: "Nelson Mandela",
  },
  {
    quote: "The beautiful thing about learning is that no one can take it away from you.",
    author: "B.B. King",
  },
  {
    quote: "We are what we repeatedly do. Excellence, then, is not an act, but a habit.",
    author: "Aristotle",
  },
  {
    quote: "An investment in knowledge pays the best interest.",
    author: "Benjamin Franklin",
  },
  {
    quote: "The secret of getting ahead is getting started.",
    author: "Mark Twain",
  },
];

/**
 * Returns formatted local calendar date string YYYY-MM-DD
 */
export function getLocalTodayDateString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Returns human-readable display date: e.g. "Tuesday, 13 October"
 */
export function getFormattedDisplayDate(): string {
  const now = new Date();
  return now.toLocaleDateString('en-US', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
}

/**
 * Picks a deterministic fallback quote for today's date if offline
 */
export function getFallbackForDate(dateStr: string): DailyThought {
  let hash = 0;
  for (let i = 0; i < dateStr.length; i++) {
    hash = (hash << 5) - hash + dateStr.charCodeAt(i);
    hash |= 0;
  }
  const index = Math.abs(hash) % FALLBACK_THOUGHTS.length;
  const item = FALLBACK_THOUGHTS[index];
  return {
    quote: item.quote,
    author: item.author,
    dateStr,
    displayDate: getFormattedDisplayDate(),
    source: 'offline-curated',
    lastUpdated: new Date().toISOString(),
  };
}

/**
 * Modular quote providers
 */
interface QuoteResult {
  quote: string;
  author: string;
  source: string;
}

// Provider 1: ZenQuotes Daily Quote
async function fetchFromZenQuotes(): Promise<QuoteResult | null> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);
    const res = await fetch('https://zenquotes.io/api/today', {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });
    clearTimeout(timeoutId);

    if (!res.ok) return null;
    const data = await res.json();
    if (Array.isArray(data) && data.length > 0 && data[0].q) {
      return {
        quote: data[0].q.trim(),
        author: (data[0].a || 'Unknown').trim(),
        source: 'zenquotes',
      };
    }
  } catch {
    // Network or timeout, fallback to next
  }
  return null;
}

// Provider 2: DummyJSON Quotes API (Verified working without API key)
async function fetchFromDummyJson(): Promise<QuoteResult | null> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    const res = await fetch('https://dummyjson.com/quotes/random', {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });
    clearTimeout(timeoutId);

    if (!res.ok) return null;
    const data = await res.json();
    if (data && data.quote) {
      return {
        quote: data.quote.trim(),
        author: (data.author || 'Anonymous').trim(),
        source: 'dummyjson',
      };
    }
  } catch {
    // Timeout or network error
  }
  return null;
}

/**
 * Main Thought of the Day Service
 */
export const thoughtService = {
  /**
   * Retrieves the cached thought from AsyncStorage
   */
  async getStoredThought(): Promise<DailyThought | null> {
    try {
      const raw = await AsyncStorage.getItem(THOUGHT_STORAGE_KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch {
      return null;
    }
  },

  /**
   * Persists thought to local AsyncStorage
   */
  async saveStoredThought(thought: DailyThought): Promise<void> {
    try {
      await AsyncStorage.setItem(THOUGHT_STORAGE_KEY, JSON.stringify(thought));
    } catch (e) {
      console.warn('Failed to save daily thought to storage', e);
    }
  },

  /**
   * Fetches fresh quote from live APIs with fallback chaining
   */
  async fetchLiveQuote(): Promise<{ quote: string; author: string; source: string }> {
    // Try primary provider (ZenQuotes)
    const primary = await fetchFromZenQuotes();
    if (primary) return primary;

    // Try secondary provider (DummyJSON)
    const secondary = await fetchFromDummyJson();
    if (secondary) return secondary;

    // If both failed, pick a random fallback quote
    const randIndex = Math.floor(Math.random() * FALLBACK_THOUGHTS.length);
    const fallback = FALLBACK_THOUGHTS[randIndex];
    return {
      quote: fallback.quote,
      author: fallback.author,
      source: 'offline-fallback',
    };
  },

  /**
   * Gets thought for today:
   * 1. Checks if stored thought matches current calendar day (YYYY-MM-DD).
   * 2. If it matches, returns it immediately without network request.
   * 3. If new day or no stored thought, fetches from API and stores.
   * 4. If network fails, keeps previous or uses curated fallback.
   */
  async getThoughtForToday(forceRefresh: boolean = false): Promise<DailyThought> {
    const today = getLocalTodayDateString();
    const displayDate = getFormattedDisplayDate();

    const cached = await this.getStoredThought();

    // If not forcing refresh and cached thought matches today, use it directly!
    if (!forceRefresh && cached && cached.dateStr === today && cached.quote) {
      return cached;
    }

    try {
      const live = await this.fetchLiveQuote();
      const newThought: DailyThought = {
        quote: live.quote,
        author: live.author,
        dateStr: today,
        displayDate,
        source: live.source,
        lastUpdated: new Date().toISOString(),
      };

      await this.saveStoredThought(newThought);
      return newThought;
    } catch {
      // Offline / network failure: fallback to existing cached thought or deterministic today fallback
      if (cached && cached.quote) {
        return cached;
      }
      const fallback = getFallbackForDate(today);
      await this.saveStoredThought(fallback);
      return fallback;
    }
  },
};
