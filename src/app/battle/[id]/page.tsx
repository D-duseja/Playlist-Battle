'use client';

import React, { use, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Navbar } from '@/components/Navbar';
import { VideoPlayer } from '@/components/VideoPlayer';
import { VideoList } from '@/components/VideoList';
import { Leaderboard } from '@/components/Leaderboard';
import { WinnerBanner } from '@/components/WinnerBanner';
import { 
  getBattle, 
  getPlaylistSnapshot, 
  getParticipants, 
  getProgress,
  updateBattleWinner 
} from '@/lib/firestore';
import { Battle, PlaylistSnapshot, Participant, UserProgress, Video } from '@/types';
import { db } from '@/lib/firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import styles from './page.module.css';

export default function BattlePage({ params }: { params: Promise<{ id: string }> }) {
  const { id: battleId } = use(params);
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [battle, setBattle] = useState<Battle | null>(null);
  const [snapshot, setSnapshot] = useState<PlaylistSnapshot | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [progress, setProgress] = useState<Map<string, UserProgress>>(new Map());
  const [loading, setLoading] = useState(true);
  const [currentVideo, setCurrentVideo] = useState<Video | null>(null);

  // Refs to hold latest battle/snapshot for use inside onSnapshot callback
  const battleRef = useRef<Battle | null>(null);
  const snapshotRef = useRef<PlaylistSnapshot | null>(null);

  // Auth redirect
  useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/login');
    }
  }, [user, authLoading, router]);

  // Load initial data
  useEffect(() => {
    if (!user) return;
    
    async function loadData() {
      try {
        const battleData = await getBattle(battleId);
        if (!battleData) {
          console.error("Battle not found");
          setLoading(false);
          return;
        }
        setBattle(battleData);
        battleRef.current = battleData;

        const snapData = await getPlaylistSnapshot(battleData.snapshotId);
        if (snapData) {
          setSnapshot(snapData);
          snapshotRef.current = snapData;
        }

        // Load progress for this user
        const userProgressArray = await getProgress(battleId, user!.uid);
        const progressMap = new Map();
        userProgressArray.forEach(p => progressMap.set(p.videoId, p));
        setProgress(progressMap);

        // Select first incomplete video, or just first video
        if (snapData && snapData.videos.length > 0) {
          const firstIncomplete = snapData.videos.find(v => {
            const p = progressMap.get(v.videoId);
            return !p || p.status !== 'COMPLETED';
          });
          setCurrentVideo(firstIncomplete || snapData.videos[0]);
        }
      } catch (err) {
        console.error("Error loading battle data:", err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [battleId, user]);

  // Real-time listener for participants (Leaderboard)
  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'participants'), where('battleId', '==', battleId));
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const parts = querySnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          lastCompletedAt: data.lastCompletedAt?.toDate() || null,
          joinedAt: data.joinedAt?.toDate(),
        } as Participant;
      });
      setParticipants(parts);

      // Check if someone won (using refs to avoid stale closures)
      const currentBattle = battleRef.current;
      const currentSnapshot = snapshotRef.current;
      if (currentBattle && currentBattle.status === 'ACTIVE' && currentSnapshot) {
        const winner = parts.find(p => p.completedLectures === currentSnapshot.totalVideos);
        if (winner) {
          updateBattleWinner(battleId, winner.userId, winner.displayName).then(() => {
            const updatedBattle = { ...currentBattle, status: 'COMPLETED' as const, winnerId: winner.userId, winnerName: winner.displayName };
            setBattle(updatedBattle);
            battleRef.current = updatedBattle;
          });
        }
      }
    });
    return () => unsubscribe();
  }, [battleId, user]);

  if (authLoading || loading) {
    return (
      <div className={styles.loadingContainer}>
        <div className="loading-spinner" />
      </div>
    );
  }

  if (!battle || !snapshot) {
    return (
      <div className={styles.errorContainer}>
        <h1>Battle Not Found</h1>
        <button onClick={() => router.push('/dashboard')}>Back to Dashboard</button>
      </div>
    );
  }

  const isCurrentUserParticipant = participants.some(p => p.userId === user?.uid);
  if (!isCurrentUserParticipant) {
    // This could happen if they try to navigate directly to the URL
    return (
      <div className={styles.errorContainer}>
        <h1>You are not in this battle.</h1>
        <button onClick={() => router.push('/dashboard')}>Back to Dashboard</button>
      </div>
    );
  }

  const copyInviteCode = () => {
    navigator.clipboard.writeText(battle.inviteCode);
    alert('Invite code copied: ' + battle.inviteCode);
  };

  const handleProgressUpdate = (videoId: string, newProgress: UserProgress) => {
    setProgress(prev => {
      const next = new Map(prev);
      next.set(videoId, newProgress);
      return next;
    });
  };

  return (
    <div className={styles.container}>
      <Navbar />
      
      {battle.status === 'COMPLETED' && battle.winnerName && (
        <WinnerBanner 
          winnerName={battle.winnerName} 
          isCurrentUserWinner={battle.winnerId === user?.uid} 
        />
      )}

      <main className={styles.main}>
        <header className={styles.header}>
          <div className={styles.headerInfo}>
            <button className={styles.backBtn} onClick={() => router.push('/dashboard')}>
              ← Back
            </button>
            <div>
              <h1 className={styles.title}>{battle.name}</h1>
              <p className={styles.subtitle}>{battle.playlistTitle}</p>
            </div>
          </div>
          <button className={styles.shareBtn} onClick={copyInviteCode}>
            🔗 Copy Invite Code
          </button>
        </header>

        <div className={styles.grid}>
          {/* Left Column */}
          <div className={styles.leftCol}>
            {currentVideo ? (
              <VideoPlayer 
                videoId={currentVideo.videoId}
                videoDuration={currentVideo.duration}
                existingProgress={progress.get(currentVideo.videoId)}
                battleId={battleId}
                userId={user!.uid}
                isReadOnly={battle.status === 'COMPLETED'}
                onProgressUpdate={(p) => handleProgressUpdate(currentVideo.videoId, p)}
              />
            ) : (
              <div className={styles.placeholderPlayer}>No video selected</div>
            )}
            
            <VideoList 
              videos={snapshot.videos}
              progress={progress}
              currentVideoId={currentVideo?.videoId || null}
              onSelectVideo={setCurrentVideo}
            />
          </div>

          {/* Right Column */}
          <div className={styles.rightCol}>
            <Leaderboard 
              participants={participants}
              totalLectures={snapshot.totalVideos}
              currentUserId={user!.uid}
              winnerId={battle.winnerId}
            />
          </div>
        </div>
      </main>
    </div>
  );
}
