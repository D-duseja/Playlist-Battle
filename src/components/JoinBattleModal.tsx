'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Modal, Button } from '@/components/ui';
import { 
  getBattleByInviteCode, 
  isParticipant, 
  addParticipant, 
  getPlaylistSnapshot,
  initializeProgress
} from '@/lib/firestore';
import { normalizeInviteCode } from '@/lib/invite-codes';
import styles from './JoinBattleModal.module.css';

interface JoinBattleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onBattleJoined: () => void;
}

export function JoinBattleModal({ isOpen, onClose, onBattleJoined }: JoinBattleModalProps) {
  const { user } = useAuth();
  const router = useRouter();
  
  const [inviteCode, setInviteCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  React.useEffect(() => {
    if (!isOpen) {
      setInviteCode('');
      setError(null);
    }
  }, [isOpen]);

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || inviteCode.length < 6) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const code = normalizeInviteCode(inviteCode);
      const battle = await getBattleByInviteCode(code);
      
      if (!battle) {
        throw new Error('No battle found with this invite code.');
      }
      
      if (battle.status === 'COMPLETED') {
        throw new Error('This battle has already ended.');
      }
      
      const alreadyJoined = await isParticipant(battle.id, user.uid);
      if (alreadyJoined) {
        // Just redirect them to it
        router.push(`/battle/${battle.id}`);
        onClose();
        return;
      }
      
      const snapshot = await getPlaylistSnapshot(battle.snapshotId);
      if (!snapshot) {
        throw new Error('Battle data is corrupted.');
      }
      
      await addParticipant(battle.id, user.uid, user.displayName || 'Unknown', user.photoURL || '');
      await initializeProgress(battle.id, user.uid, snapshot.videos);
      
      onBattleJoined();
      router.push(`/battle/${battle.id}`);
      onClose();
      
    } catch (err: any) {
      setError(err.message || 'Failed to join battle');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Join Battle" size="sm">
      <form onSubmit={handleJoin} className={styles.form}>
        <div className={styles.inputContainer}>
          <input
            type="text"
            value={inviteCode}
            onChange={e => setInviteCode(e.target.value.toUpperCase())}
            placeholder="ENTER CODE"
            maxLength={6}
            required
            className={styles.codeInput}
            autoFocus
          />
        </div>

        {error && <div className={styles.error}>{error}</div>}

        <div className={styles.actions}>
          <Button type="button" variant="ghost" onClick={onClose} fullWidth>Cancel</Button>
          <Button type="submit" loading={loading} disabled={inviteCode.length < 6} fullWidth>
            Join
          </Button>
        </div>
      </form>
    </Modal>
  );
}
