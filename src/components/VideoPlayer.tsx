'use client';

import React, { useEffect, useRef, useState } from 'react';
import { WatchSegment, UserProgress } from '@/types';
import { TimelineTracker } from '@/lib/timeline-tracker';
import { ProgressSync } from '@/lib/progress-sync';
import { updateVideoProgress, incrementCompletedLectures } from '@/lib/firestore';
import { ProgressBar, Badge } from '@/components/ui';
import styles from './VideoPlayer.module.css';

interface VideoPlayerProps {
  videoId: string;
  videoDuration: number;
  existingProgress?: UserProgress;
  battleId: string;
  userId: string;
  isReadOnly: boolean;
  onProgressUpdate: (progress: UserProgress) => void;
}

export function VideoPlayer({ 
  videoId, 
  videoDuration, 
  existingProgress,
  battleId,
  userId,
  isReadOnly,
  onProgressUpdate 
}: VideoPlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<any>(null);
  const trackerRef = useRef<TimelineTracker | null>(null);
  const syncRef = useRef<ProgressSync | null>(null);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastTimeRef = useRef<number>(0);

  const [percentage, setPercentage] = useState(existingProgress?.watchPercentage || 0);
  const [isCompleted, setIsCompleted] = useState(existingProgress?.status === 'COMPLETED');
  const isCompletedRef = useRef(existingProgress?.status === 'COMPLETED');
  const [error, setError] = useState<string | null>(null);

  // Initialize YT IFrame API
  useEffect(() => {
    // If we're already completed, we just render the player without tracking
    const initiallyCompleted = existingProgress?.status === 'COMPLETED';
    setIsCompleted(initiallyCompleted);
    isCompletedRef.current = initiallyCompleted;
    setPercentage(existingProgress?.watchPercentage || 0);
    
    // Initialize Tracker and Sync
    trackerRef.current = new TimelineTracker(
      existingProgress?.watchedSegments || [],
      videoDuration
    );

    syncRef.current = new ProgressSync(async (data) => {
      await updateVideoProgress(data.battleId, data.userId, data.videoId, {
        watchedSegments: data.segments,
        watchPercentage: data.watchPercentage,
        status: data.isCompleted ? 'COMPLETED' : 'IN_PROGRESS',
        completedAt: data.isCompleted && !isCompletedRef.current ? new Date() : undefined,
      });

      // Call parent callback
      onProgressUpdate({
        ...existingProgress,
        id: existingProgress?.id || `${battleId}_${userId}_${videoId}`,
        battleId,
        userId,
        videoId,
        watchedSegments: data.segments,
        watchPercentage: data.watchPercentage,
        status: data.isCompleted ? 'COMPLETED' : 'IN_PROGRESS',
        completedAt: data.isCompleted && !isCompletedRef.current ? new Date() : existingProgress?.completedAt || null,
        updatedAt: new Date(),
      });

      if (data.isCompleted && !isCompletedRef.current) {
        isCompletedRef.current = true;
        setIsCompleted(true);
        incrementCompletedLectures(battleId, userId).catch(err => 
          console.error("Failed to update leaderboard:", err)
        );
      }
    });

    const loadPlayer = () => {
      if (playerRef.current) {
        playerRef.current.destroy();
      }
      
      playerRef.current = new (window as any).YT.Player(containerRef.current, {
        videoId,
        playerVars: {
          autoplay: 0,
          rel: 0,
          modestbranding: 1,
        },
        events: {
          onStateChange: handlePlayerStateChange,
          onError: () => setError('Failed to load video'),
        }
      });
    };

    if (!(window as any).YT) {
      const script = document.createElement('script');
      script.src = 'https://www.youtube.com/iframe_api';
      script.async = true;
      document.body.appendChild(script);
      (window as any).onYouTubeIframeAPIReady = loadPlayer;
    } else {
      loadPlayer();
    }

    return () => {
      stopPolling();
      if (playerRef.current) playerRef.current.destroy();
      if (syncRef.current) syncRef.current.destroy();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoId]); // Re-run when video changes

  const startPolling = () => {
    if (pollIntervalRef.current || isReadOnly) return;
    
    lastTimeRef.current = playerRef.current.getCurrentTime();
    
    pollIntervalRef.current = setInterval(() => {
      if (!playerRef.current || !trackerRef.current || !syncRef.current) return;
      
      const currentTime = playerRef.current.getCurrentTime();
      // If time jumped too far, it's a seek. Don't count the jump.
      if (currentTime - lastTimeRef.current > 0 && currentTime - lastTimeRef.current < 2) {
        trackerRef.current.addSegment(lastTimeRef.current, currentTime);
        
        const newPct = trackerRef.current.getWatchPercentage();
        setPercentage(newPct);

        const currentlyCompleted = trackerRef.current.isCompleted();
        
        const data = {
          battleId,
          userId,
          videoId,
          segments: trackerRef.current.getSegments(),
          watchPercentage: newPct,
          isCompleted: currentlyCompleted
        };

        if (currentlyCompleted && !isCompletedRef.current) {
          syncRef.current.forceSync(data);
        } else {
          syncRef.current.scheduleSync(data);
        }
      }
      lastTimeRef.current = currentTime;
    }, 1000);
  };

  const stopPolling = () => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
  };

  const handlePlayerStateChange = (event: any) => {
    const YT = (window as any).YT;
    if (event.data === YT.PlayerState.PLAYING) {
      startPolling();
    } else {
      stopPolling();
      if (syncRef.current && trackerRef.current && !isReadOnly) {
        // Force sync on pause or end
        syncRef.current.forceSync({
          battleId,
          userId,
          videoId,
          segments: trackerRef.current.getSegments(),
          watchPercentage: trackerRef.current.getWatchPercentage(),
          isCompleted: trackerRef.current.isCompleted()
        });
      }
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.playerWrapper}>
        {error ? (
          <div className={styles.error}>{error}</div>
        ) : (
          <>
            <div ref={containerRef} className={styles.player} />
            {isCompleted && (
              <div className={styles.completedOverlay}>
                <Badge variant="completed" className={styles.completedBadge}>✓ Completed</Badge>
              </div>
            )}
          </>
        )}
      </div>
      
      <div className={styles.progressFooter}>
        <div className={styles.progressHeader}>
          <span>Unique watch progress</span>
          <span>{Math.round(percentage)}%</span>
        </div>
        <ProgressBar value={percentage} size="md" />
        {isReadOnly && <p className={styles.readOnlyNote}>Battle has ended. Progress is no longer tracked.</p>}
      </div>
    </div>
  );
}
