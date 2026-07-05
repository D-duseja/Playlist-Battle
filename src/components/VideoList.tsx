'use client';

import React from 'react';
import { Video, UserProgress } from '@/types';
import { Badge } from '@/components/ui';
import styles from './VideoList.module.css';

interface VideoListProps {
  videos: Video[];
  progress: Map<string, UserProgress>;
  currentVideoId: string | null;
  onSelectVideo: (video: Video) => void;
}

export function VideoList({ videos, progress, currentVideoId, onSelectVideo }: VideoListProps) {
  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h3>Playlist Lectures</h3>
        <span className={styles.count}>{videos.length} videos</span>
      </div>
      
      <div className={styles.list}>
        {videos.map((video, index) => {
          const p = progress.get(video.videoId);
          const isCompleted = p?.status === 'COMPLETED';
          const isCurrent = video.videoId === currentVideoId;
          
          return (
            <button
              key={video.videoId}
              className={`${styles.item} ${isCurrent ? styles.active : ''} ${isCompleted ? styles.completed : ''}`}
              onClick={() => onSelectVideo(video)}
            >
              <div className={styles.index}>{index + 1}</div>
              
              <div className={styles.thumbnailWrapper}>
                <img src={video.thumbnailUrl} alt="" className={styles.thumbnail} />
                {isCompleted && (
                  <div className={styles.completedOverlay}>
                    <Badge variant="completed" className={styles.tinyBadge}>✓</Badge>
                  </div>
                )}
                <div className={styles.duration}>
                  {formatDuration(video.duration)}
                </div>
              </div>

              <div className={styles.details}>
                <h4 className={styles.title}>{video.title}</h4>
                <div className={styles.meta}>
                  {p?.watchPercentage ? `${Math.round(p.watchPercentage)}% watched` : 'Not started'}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function formatDuration(seconds: number): string {
  if (!seconds) return '0:00';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  
  if (h > 0) {
    return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }
  return `${m}:${s.toString().padStart(2, '0')}`;
}
