/**
 * @module lib/timeline-tracker
 * @description Core progress tracking engine for Playlist Battle.
 *
 * Tracks unique watched time by maintaining a set of merged, non-overlapping
 * time segments. Handles segment addition, overlap merging, percentage
 * calculation, and completion detection.
 *
 * This is the heart of the fair-progress system: rewinding and re-watching
 * the same portion does NOT inflate your watch percentage.
 */

import type { WatchSegment } from '@/types';

/**
 * Merge an array of potentially overlapping watch segments into
 * a minimal set of non-overlapping segments.
 *
 * @param segments - Array of `[start, end]` time ranges (in seconds).
 * @returns A new array of merged, sorted, non-overlapping segments.
 *
 * @example
 * ```ts
 * mergeSegments([[0, 10], [5, 15], [20, 30]]);
 * // => [[0, 15], [20, 30]]
 *
 * mergeSegments([[10, 20], [0, 5]]);
 * // => [[0, 5], [10, 20]]
 * ```
 */
export function mergeSegments(segments: WatchSegment[]): WatchSegment[] {
  if (segments.length <= 1) return segments.map((s) => [...s] as WatchSegment);

  // Sort by start time, then by end time for ties
  const sorted = [...segments].sort((a, b) => a[0] - b[0] || a[1] - b[1]);

  const merged: WatchSegment[] = [[...sorted[0]]];

  for (let i = 1; i < sorted.length; i++) {
    const current = sorted[i];
    const previous = merged[merged.length - 1];

    if (current[0] <= previous[1]) {
      // Overlapping or adjacent — extend the previous segment
      previous[1] = Math.max(previous[1], current[1]);
    } else {
      // No overlap — start a new segment
      merged.push([...current] as WatchSegment);
    }
  }

  return merged;
}

/**
 * Tracks unique watched time for a single video.
 *
 * Maintains a set of merged segments and provides real-time
 * calculations for watch percentage and completion status.
 *
 * @example
 * ```ts
 * const tracker = new TimelineTracker([], 600); // 10-minute video
 * tracker.addSegment(0, 60);      // watched first minute
 * tracker.addSegment(30, 120);    // watched 0:30–2:00 (overlaps)
 * tracker.getUniqueWatchedTime(); // 120 (seconds)
 * tracker.getWatchPercentage();   // 20
 * tracker.isCompleted();          // false
 * ```
 */
export class TimelineTracker {
  private segments: WatchSegment[];
  private videoDuration: number;

  /**
   * @param existingSegments - Previously saved segments from Firestore.
   * @param videoDuration - Total video duration in seconds.
   */
  constructor(existingSegments: WatchSegment[], videoDuration: number) {
    this.videoDuration = Math.max(videoDuration, 0);
    // Merge on init to ensure consistency even if stored data has overlaps
    this.segments = mergeSegments(existingSegments);
  }

  /**
   * Add a new watched segment and automatically merge with existing ones.
   *
   * Clamps values to `[0, videoDuration]` and ignores degenerate segments
   * where `start >= end` after clamping.
   *
   * @param start - Start time in seconds.
   * @param end - End time in seconds.
   */
  addSegment(start: number, end: number): void {
    // Clamp to valid range
    const clampedStart = Math.max(0, Math.min(start, this.videoDuration));
    const clampedEnd = Math.max(0, Math.min(end, this.videoDuration));

    // Ignore zero-length or negative segments
    if (clampedStart >= clampedEnd) return;

    this.segments.push([clampedStart, clampedEnd]);
    this.segments = mergeSegments(this.segments);
  }

  /**
   * Get the current set of merged, non-overlapping segments.
   * Returns a deep copy to prevent external mutation.
   */
  getSegments(): WatchSegment[] {
    return this.segments.map((s) => [...s] as WatchSegment);
  }

  /**
   * Calculate the total unique watched time in seconds.
   * This is the sum of all merged segment durations.
   */
  getUniqueWatchedTime(): number {
    return this.segments.reduce((total, [start, end]) => total + (end - start), 0);
  }

  /**
   * Calculate the watch percentage (0–100).
   * Returns 0 if the video has zero duration.
   */
  getWatchPercentage(): number {
    if (this.videoDuration <= 0) return 0;

    const percentage = (this.getUniqueWatchedTime() / this.videoDuration) * 100;
    // Clamp to 100 to handle floating point edge cases
    return Math.min(Math.round(percentage * 100) / 100, 100);
  }

  /**
   * Check whether the video is considered "completed".
   * Completion threshold is **90%** of unique watched time.
   *
   * The 90% threshold accounts for intros, outros, and minor
   * buffering gaps that shouldn't penalize the viewer.
   */
  isCompleted(): boolean {
    return this.getWatchPercentage() >= 90;
  }
}
