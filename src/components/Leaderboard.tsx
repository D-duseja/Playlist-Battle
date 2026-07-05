'use client';

import React from 'react';
import { Participant } from '@/types';
import { Badge } from '@/components/ui';
import styles from './Leaderboard.module.css';

interface LeaderboardProps {
  participants: Participant[];
  totalLectures: number;
  currentUserId: string;
  winnerId: string | null;
}

export function Leaderboard({ participants, totalLectures, currentUserId, winnerId }: LeaderboardProps) {
  // Sort participants by completed lectures (descending)
  // If tied, sort by lastCompletedAt (ascending - whoever finished first is higher)
  // If both null, sort by joinedAt (ascending)
  const sortedParticipants = [...participants].sort((a, b) => {
    if (b.completedLectures !== a.completedLectures) {
      return b.completedLectures - a.completedLectures;
    }
    
    if (a.lastCompletedAt && b.lastCompletedAt) {
      return a.lastCompletedAt.getTime() - b.lastCompletedAt.getTime();
    }
    if (a.lastCompletedAt) return -1;
    if (b.lastCompletedAt) return 1;
    
    // Fallback to joined date
    return (a.joinedAt?.getTime() || 0) - (b.joinedAt?.getTime() || 0);
  });

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h3>Leaderboard</h3>
        <span className={styles.badge}>Live 🔴</span>
      </div>

      <div className={styles.list}>
        {sortedParticipants.map((p, index) => {
          const isCurrentUser = p.userId === currentUserId;
          const isWinner = p.userId === winnerId;
          const percentage = totalLectures > 0 ? (p.completedLectures / totalLectures) * 100 : 0;
          
          return (
            <div 
              key={p.userId} 
              className={`${styles.row} ${isCurrentUser ? styles.highlight : ''} ${isWinner ? styles.winnerRow : ''}`}
            >
              <div className={styles.rank}>
                {isWinner ? '👑' : `#${index + 1}`}
              </div>
              
              <div className={styles.avatarWrapper}>
                {p.photoURL ? (
                  <img src={p.photoURL} alt={p.displayName} className={styles.avatar} />
                ) : (
                  <div className={styles.avatarPlaceholder}>
                    {p.displayName.charAt(0)}
                  </div>
                )}
              </div>
              
              <div className={styles.info}>
                <div className={styles.nameRow}>
                  <span className={styles.name}>{p.displayName}</span>
                  {isCurrentUser && <Badge variant="default" className={styles.youBadge}>You</Badge>}
                </div>
                
                <div className={styles.progressTrack}>
                  <div 
                    className={styles.progressFill} 
                    style={{ width: `${percentage}%`, background: isWinner ? 'var(--color-warning)' : 'var(--color-primary)' }} 
                  />
                </div>
              </div>
              
              <div className={styles.score}>
                <span className={styles.completed}>{p.completedLectures}</span>
                <span className={styles.total}>/{totalLectures}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
