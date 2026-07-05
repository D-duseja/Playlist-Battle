/**
 * @module lib/progress-sync
 * @description Debounced progress synchronization to Firestore.
 *
 * During video playback, progress updates fire frequently (every few seconds).
 * This module batches those updates using a debounce strategy to reduce
 * Firestore writes while ensuring data is never lost on navigation or tab close.
 */

import type { WatchSegment } from '@/types';

/** Data payload sent to the sync function */
export interface ProgressSyncData {
  battleId: string;
  userId: string;
  videoId: string;
  segments: WatchSegment[];
  watchPercentage: number;
  isCompleted: boolean;
}

/**
 * Manages debounced progress synchronization to a persistent store.
 *
 * - **Debounced sync**: Delays writes by a configurable interval (default 5s).
 *   Each new call resets the timer, so rapid updates collapse into one write.
 * - **Force sync**: Immediately persists data (e.g. on page unload or video completion).
 * - **Cleanup**: Cancels pending timers to prevent memory leaks.
 *
 * @example
 * ```ts
 * const sync = new ProgressSync(async (data) => {
 *   await updateVideoProgress(data.battleId, data.userId, data.videoId, {
 *     watchedSegments: data.segments,
 *     watchPercentage: data.watchPercentage,
 *     status: data.isCompleted ? 'COMPLETED' : 'IN_PROGRESS',
 *   });
 * });
 *
 * // During playback — debounced
 * sync.scheduleSync(progressData);
 *
 * // On page unload — immediate
 * sync.forceSync(progressData);
 *
 * // On component unmount
 * sync.destroy();
 * ```
 */
export class ProgressSync {
  private syncTimeout: ReturnType<typeof setTimeout> | null = null;
  private pendingData: ProgressSyncData | null = null;
  private isSyncing = false;
  private readonly syncIntervalMs: number;
  private readonly syncFn: (data: ProgressSyncData) => Promise<void>;

  /**
   * @param syncFn - The async function that persists progress data.
   * @param intervalMs - Debounce interval in milliseconds. Defaults to 5000ms.
   */
  constructor(
    syncFn: (data: ProgressSyncData) => Promise<void>,
    intervalMs: number = 5000
  ) {
    this.syncFn = syncFn;
    this.syncIntervalMs = intervalMs;
  }

  /**
   * Schedule a debounced sync. If a previous sync is already scheduled,
   * it is cancelled and replaced with the new data.
   *
   * @param data - The latest progress data to persist.
   */
  scheduleSync(data: ProgressSyncData): void {
    this.pendingData = data;

    if (this.syncTimeout !== null) {
      clearTimeout(this.syncTimeout);
    }

    this.syncTimeout = setTimeout(async () => {
      this.syncTimeout = null;
      await this.executePendingSync();
    }, this.syncIntervalMs);
  }

  /**
   * Force an immediate sync, bypassing the debounce timer.
   * Useful for critical moments like video completion or page unload.
   *
   * If a debounced sync is pending, it is cancelled and replaced
   * by this immediate sync.
   *
   * @param data - The progress data to persist immediately.
   */
  async forceSync(data: ProgressSyncData): Promise<void> {
    // Cancel any pending debounced sync
    if (this.syncTimeout !== null) {
      clearTimeout(this.syncTimeout);
      this.syncTimeout = null;
    }

    this.pendingData = data;
    await this.executePendingSync();
  }

  /**
   * Clean up the sync instance by cancelling any pending timers.
   * Call this when the component using the sync is unmounted.
   */
  destroy(): void {
    if (this.syncTimeout !== null) {
      clearTimeout(this.syncTimeout);
      this.syncTimeout = null;
    }
    this.pendingData = null;
  }

  /**
   * Execute the pending sync if there is data and no sync is in progress.
   * Guards against concurrent executions.
   */
  private async executePendingSync(): Promise<void> {
    if (this.isSyncing || !this.pendingData) return;

    this.isSyncing = true;
    const data = this.pendingData;
    this.pendingData = null;

    try {
      await this.syncFn(data);
    } catch (error) {
      // Re-queue the data so it's not lost on transient failures
      console.error('[ProgressSync] Sync failed, re-queuing data:', error);
      if (!this.pendingData) {
        this.pendingData = data;
      }
    } finally {
      this.isSyncing = false;

      // If new data arrived while we were syncing, schedule another sync
      if (this.pendingData) {
        this.scheduleSync(this.pendingData);
      }
    }
  }
}
