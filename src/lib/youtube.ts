/**
 * @module lib/youtube
 * @description YouTube Data API v3 client.
 *
 * Provides helpers to extract playlist IDs from URLs, fetch playlist metadata,
 * and retrieve all videos (with durations) from a playlist — handling pagination.
 */

import type { Video } from '@/types';

/**
 * Extract a YouTube playlist ID from various URL formats.
 *
 * Supported formats:
 * - `https://www.youtube.com/playlist?list=PLxxxxxx`
 * - `https://youtube.com/playlist?list=PLxxxxxx`
 * - `https://www.youtube.com/watch?v=abc&list=PLxxxxxx`
 * - `https://youtu.be/abc?list=PLxxxxxx`
 * - Raw playlist ID string (e.g. `PLxxxxxx`)
 *
 * @param url - A YouTube URL or raw playlist ID.
 * @returns The playlist ID, or `null` if extraction fails.
 */
export function extractPlaylistId(url: string): string | null {
  if (!url || typeof url !== 'string') return null;

  const trimmed = url.trim();

  // Try parsing as a URL first
  try {
    const parsed = new URL(trimmed);
    const listParam = parsed.searchParams.get('list');
    if (listParam) return listParam;
  } catch {
    // Not a valid URL — fall through to raw ID check
  }

  // Check if it looks like a raw playlist ID (starts with PL, UU, OL, etc.)
  if (/^(PL|UU|OL|LL|FL|RD|BL)[A-Za-z0-9_-]+$/.test(trimmed)) {
    return trimmed;
  }

  return null;
}

/**
 * Fetch playlist metadata (title, channel, video count) via local proxy.
 */
export async function fetchPlaylistMetadata(
  playlistId: string
): Promise<{ title: string; channelTitle: string; videoCount: number }> {
  const url = new URL('/api/youtube/playlist', window.location.origin);
  url.searchParams.set('playlistId', playlistId);
  url.searchParams.set('mode', 'metadata');

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    const response = await fetch(url.toString(), { signal: controller.signal });
    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.error || `Proxy error: ${response.status}`);
    }
    return await response.json();
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Fetch all videos in a playlist via local proxy.
 */
export async function fetchPlaylistVideos(playlistId: string): Promise<Video[]> {
  const url = new URL('/api/youtube/playlist', window.location.origin);
  url.searchParams.set('playlistId', playlistId);
  url.searchParams.set('mode', 'videos');

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25000);

  try {
    const response = await fetch(url.toString(), { signal: controller.signal });
    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.error || `Proxy error: ${response.status}`);
    }
    return await response.json();
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Parse an ISO 8601 duration string into total seconds.
 *
 * @example
 * ```ts
 * parseDuration('PT1H2M3S');   // 3723
 * parseDuration('PT45M');       // 2700
 * parseDuration('PT30S');       // 30
 * parseDuration('P0D');         // 0  (live streams)
 * ```
 *
 * @param duration - An ISO 8601 duration string (e.g. `PT1H2M3S`).
 * @returns Total duration in seconds.
 */
export function parseDuration(duration: string): number {
  if (!duration) return 0;

  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;

  const hours = parseInt(match[1] ?? '0', 10);
  const minutes = parseInt(match[2] ?? '0', 10);
  const seconds = parseInt(match[3] ?? '0', 10);

  return hours * 3600 + minutes * 60 + seconds;
}
