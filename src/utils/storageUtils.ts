import { HeroProgress } from '../types';

/**
 * Robust LocalStorage Utility with Auto-Compaction & Quota-Exceeded Protection
 */

export function sanitizeConsoleEntriesForStorage(
  entries: any[],
  maxEntries: number = 500
): any[] {
  if (!Array.isArray(entries)) return [];
  const sliced = entries.length > maxEntries ? entries.slice(-maxEntries) : entries;

  return sliced.map((entry) => {
    if (!entry) return entry;
    const clean = { ...entry };
    // Strip raw huge data URLs from entry.image
    if (clean.image && typeof clean.image === 'string' && clean.image.startsWith('data:') && clean.image.length > 500) {
      delete clean.image;
    }
    // Prune excessive base64 in attachments to prevent localStorage quota exhaustion
    if (Array.isArray(clean.attachments) && clean.attachments.length > 0) {
      clean.attachments = clean.attachments.map((att: any) => {
        if (!att) return att;
        if (att.data && typeof att.data === 'string' && att.data.startsWith('data:') && att.data.length > 500) {
          return {
            ...att,
            data: att.url || '',
          };
        }
        return att;
      });
    }
    return clean;
  });
}

/**
 * Sanitizes and compacts progressMap for safe storage in LocalStorage.
 * Keeps all vital character stats, damage, relationships, and scenarios intact,
 * while pruning excessive repetitive historical chat/combat logs to prevent 5MB LocalStorage overflow.
 */
export function sanitizeProgressMapForStorage(
  rawProgressMap: Record<string, HeroProgress> | null | undefined,
  maxLogsPerHero: number = 500
): Record<string, HeroProgress> {
  if (!rawProgressMap || typeof rawProgressMap !== 'object') return {};

  const cleanMap: Record<string, HeroProgress> = {};

  for (const [heroId, progress] of Object.entries(rawProgressMap)) {
    if (!progress || typeof progress !== 'object') continue;

    // Preserve consoleEntries (up to maxLogsPerHero latest entries per hero)
    const cleanConsole = sanitizeConsoleEntriesForStorage(progress.consoleEntries, maxLogsPerHero);

    // Preserve logs (up to maxLogsPerHero latest entries per hero)
    const cleanLogs = Array.isArray(progress.logs)
      ? (progress.logs.length > maxLogsPerHero ? progress.logs.slice(-maxLogsPerHero) : progress.logs)
      : [];

    cleanMap[heroId] = {
      heroId: progress.heroId || heroId,
      dayCount: typeof progress.dayCount === 'number' ? progress.dayCount : 1,
      stats: progress.stats,
      partDamage: progress.partDamage || { head: 0, timer: 0, chest: 0, leftArm: 0, rightArm: 0, torso: 0, legs: 0 },
      partExposure: progress.partExposure || { head: 0, timer: 0, chest: 0, leftArm: 0, rightArm: 0, torso: 0, legs: 0 },
      consoleEntries: cleanConsole,
      logs: cleanLogs,
      envTheme: progress.envTheme,
      isEnergyShock: !!progress.isEnergyShock,
      scenarioConfig: progress.scenarioConfig,
      relationshipState: progress.relationshipState,
      activeRelationship: progress.activeRelationship,
      lastUpdated: progress.lastUpdated || Date.now(),
    };
  }

  return cleanMap;
}

/**
 * Safely writes key/value to LocalStorage with automatic QuotaExceeded recovery & compaction.
 */
export function safeLocalStorageSet(key: string, value: any): boolean {
  if (typeof localStorage === 'undefined') return false;

  const serialize = (val: any) => (typeof val === 'string' ? val : JSON.stringify(val));

  try {
    let sanitizedVal = value;
    if (key === 'ultra_progress_map_v2' && typeof value === 'object') {
      sanitizedVal = sanitizeProgressMapForStorage(value, 500);
    } else if ((key.startsWith('ultra_chat_entries_v2') || key === 'ultra_current_chat_entries_v2') && Array.isArray(value)) {
      sanitizedVal = sanitizeConsoleEntriesForStorage(value, 500);
    }
    const payload = serialize(sanitizedVal);

    localStorage.setItem(key, payload);
    return true;
  } catch (e: any) {
    const isQuotaError =
      e?.name === 'QuotaExceededError' ||
      e?.code === 22 ||
      e?.code === 1014 ||
      e?.number === -2147024882 ||
      (e?.message && typeof e.message === 'string' && e.message.toLowerCase().includes('quota'));

    if (isQuotaError) {
      console.warn(`[StorageGuard] LocalStorage quota exceeded when writing "${key}". Initiating auto-compaction...`);
      try {
        // Step 1: Clean up redundant / temporary cache keys
        const temporaryKeys = [
          'ultra_temp_cache',
          'ultra_debug_logs',
          'ultra_old_session',
          'ultrawoman_temp_dialogue',
        ];
        temporaryKeys.forEach((k) => {
          try {
            localStorage.removeItem(k);
          } catch {}
        });

        // Step 2: If key being written is progressMap, compact to 100 entries first
        if (key === 'ultra_progress_map_v2' && typeof value === 'object') {
          const compacted = sanitizeProgressMapForStorage(value, 100);
          localStorage.setItem(key, JSON.stringify(compacted));
          console.info(`[StorageGuard] Successfully saved compacted progress map.`);
          return true;
        }

        // Step 3: If writing another key, compact existing ultra_progress_map_v2 to free space
        const existingProgressMap = localStorage.getItem('ultra_progress_map_v2');
        if (existingProgressMap && key !== 'ultra_progress_map_v2') {
          try {
            const parsed = JSON.parse(existingProgressMap);
            const compacted = sanitizeProgressMapForStorage(parsed, 100);
            localStorage.setItem('ultra_progress_map_v2', JSON.stringify(compacted));
          } catch {}
        }

        // Step 4: Retry writing the target key
        localStorage.setItem(key, serialize(value));
        return true;
      } catch (compactErr) {
        console.warn(`[StorageGuard] Secondary compaction failed for "${key}". Attempting minimal fallback:`, compactErr);
        try {
          if (key === 'ultra_progress_map_v2' && typeof value === 'object') {
            const fallbackCompacted = sanitizeProgressMapForStorage(value, 20);
            localStorage.setItem(key, JSON.stringify(fallbackCompacted));
            return true;
          }
        } catch {}
        return false;
      }
    } else {
      console.error(`[StorageGuard] Error writing "${key}":`, e);
      return false;
    }
  }
}

/**
 * Safely reads and parses key from LocalStorage.
 */
export function safeLocalStorageGet<T = any>(key: string, defaultValue: T): T {
  if (typeof localStorage === 'undefined') return defaultValue;
  try {
    const raw = localStorage.getItem(key);
    if (raw === null || raw === undefined) return defaultValue;
    return JSON.parse(raw) as T;
  } catch {
    return defaultValue;
  }
}
