'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { getUserBattles } from '@/lib/firestore';
import { Battle } from '@/types';
import { Navbar } from '@/components/Navbar';
import { Button, Card, Badge, ProgressBar } from '@/components/ui';
import { CreateBattleModal } from '@/components/CreateBattleModal';
import { JoinBattleModal } from '@/components/JoinBattleModal';
import styles from './page.module.css';

export default function DashboardPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  
  const [battles, setBattles] = useState<Battle[]>([]);
  const [loadingBattles, setLoadingBattles] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      router.replace('/login');
    }
  }, [user, loading, router]);

  const loadBattles = async () => {
    if (!user) return;
    setLoadingBattles(true);
    try {
      // Add timeout so dashboard doesn't hang forever if Firestore is slow
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Firestore request timed out')), 10000)
      );
      const userBattles = await Promise.race([getUserBattles(user.uid), timeoutPromise]);
      setBattles(userBattles);
    } catch (err) {
      console.error('Error loading battles:', err);
      setBattles([]);
    } finally {
      setLoadingBattles(false);
    }
  };

  useEffect(() => {
    if (user) {
      loadBattles();
    }
  }, [user]);

  if (loading || !user) {
    return (
      <div className={styles.loadingContainer}>
        <div className="loading-spinner" />
      </div>
    );
  }

  const copyInviteCode = (e: React.MouseEvent, code: string) => {
    e.stopPropagation(); // prevent card click
    navigator.clipboard.writeText(code);
    alert('Invite code copied: ' + code); // TODO: use a toast notification
  };

  return (
    <div className={styles.container}>
      <Navbar />
      
      <main className={styles.main}>
        <div className={styles.header}>
          <h1 className={styles.title}>Your Battles</h1>
          <div className={styles.actions}>
            <Button onClick={() => setShowJoinModal(true)} variant="secondary">
              🎯 Join Battle
            </Button>
            <Button onClick={() => setShowCreateModal(true)} variant="primary">
              ⚔️ Create Battle
            </Button>
          </div>
        </div>

        {loadingBattles ? (
          <div className={styles.loadingWrapper}>
            <div className="loading-spinner" />
          </div>
        ) : battles.length === 0 ? (
          <div className={styles.emptyState}>
            <div className={styles.emptyIcon}>🏆</div>
            <h2>No Active Battles</h2>
            <p>You haven't joined any battles yet. Create a new one or join with an invite code.</p>
          </div>
        ) : (
          <div className={styles.grid}>
            {battles.map((battle) => (
              <Card 
                key={battle.id} 
                variant="interactive" 
                className={styles.battleCard}
                onClick={() => router.push(`/battle/${battle.id}`)}
              >
                <div className={styles.cardHeader}>
                  <Badge variant={battle.status === 'ACTIVE' ? 'active' : 'completed'}>
                    {battle.status}
                  </Badge>
                  <div 
                    className={styles.inviteCode} 
                    onClick={(e) => copyInviteCode(e, battle.inviteCode)}
                    title="Click to copy invite code"
                  >
                    {battle.inviteCode} 📋
                  </div>
                </div>
                
                <h3 className={styles.battleName}>{battle.name}</h3>
                <p className={styles.playlistTitle}>{battle.playlistTitle}</p>
                
                <div className={styles.stats}>
                  <div className={styles.stat}>
                    <span>👥</span> {battle.participantCount} Participants
                  </div>
                  <div className={styles.stat}>
                    <span>📺</span> {battle.totalVideos} Lectures
                  </div>
                </div>

                {/* Progress mock for now since we'd need to fetch user's specific progress for this battle */}
                <div className={styles.progressSection}>
                  <div className={styles.progressLabels}>
                    <span>Your Progress</span>
                    {/* Placeholder percentage */}
                    <span>0%</span>
                  </div>
                  <ProgressBar value={0} size="sm" />
                </div>
              </Card>
            ))}
          </div>
        )}
      </main>

      <CreateBattleModal 
        isOpen={showCreateModal} 
        onClose={() => setShowCreateModal(false)}
        onBattleCreated={() => {
          loadBattles();
        }}
      />
      
      <JoinBattleModal 
        isOpen={showJoinModal} 
        onClose={() => setShowJoinModal(false)}
        onBattleJoined={() => {
          setShowJoinModal(false);
          loadBattles();
        }}
      />
    </div>
  );
}
