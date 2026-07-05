/**
 * @module types
 * @description Core domain types for Playlist Battle application.
 * Defines all shared interfaces and type aliases used across the codebase.
 */

/** Current state of a battle */
export type BattleStatus = 'ACTIVE' | 'COMPLETED';

/** Current state of a participant within a battle */
export type ParticipantStatus = 'ACTIVE' | 'FORFEITED';

/** Progress state for a single lecture/video */
export type LectureStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED';

/** Authenticated user profile */
export interface User {
  uid: string;
  displayName: string;
  email: string;
  photoURL: string;
  createdAt: Date;
}

/** A single video within a playlist snapshot */
export interface Video {
  videoId: string;
  title: string;
  thumbnailUrl: string;
  /** Duration in seconds */
  duration: number;
  /** Zero-based position/order in the playlist */
  position: number;
}

/** Immutable snapshot of a YouTube playlist at battle creation time */
export interface PlaylistSnapshot {
  id: string;
  playlistId: string;
  title: string;
  channelTitle: string;
  totalVideos: number;
  videos: Video[];
  createdAt: Date;
}

/** A battle instance linking participants to a playlist */
export interface Battle {
  id: string;
  name: string;
  inviteCode: string;
  creatorId: string;
  creatorName: string;
  status: BattleStatus;
  winnerId: string | null;
  winnerName: string | null;
  winnerDeclaredAt: Date | null;
  snapshotId: string;
  playlistTitle: string;
  totalVideos: number;
  participantCount: number;
  createdAt: Date;
}

/** A user's membership record within a battle */
export interface Participant {
  id: string;
  battleId: string;
  userId: string;
  displayName: string;
  photoURL: string;
  status: ParticipantStatus;
  completedLectures: number;
  lastCompletedAt: Date | null;
  joinedAt: Date;
}

/** A contiguous watched time range: [startTime, endTime] in seconds */
export type WatchSegment = [number, number];

/** Per-video watch progress for a user within a battle */
export interface UserProgress {
  id: string;
  battleId: string;
  userId: string;
  videoId: string;
  /** Merged array of unique watched time ranges */
  watchedSegments: WatchSegment[];
  /** Computed watch percentage (0–100) */
  watchPercentage: number;
  status: LectureStatus;
  completedAt: Date | null;
  updatedAt: Date;
}

/** Computed leaderboard row for display */
export interface LeaderboardEntry {
  userId: string;
  displayName: string;
  photoURL: string;
  completedLectures: number;
  totalLectures: number;
  /** Overall completion percentage (0–100) */
  progressPercentage: number;
  lastCompletedAt: Date | null;
  status: ParticipantStatus;
}
