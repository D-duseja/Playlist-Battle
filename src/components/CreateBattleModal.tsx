'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Modal, Button } from '@/components/ui';
import { extractPlaylistId, fetchPlaylistMetadata, fetchPlaylistVideos } from '@/lib/youtube';
import { createBattle } from '@/lib/firestore';
import { Video } from '@/types';
import styles from './CreateBattleModal.module.css';

interface CreateBattleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onBattleCreated: () => void;
}

export function CreateBattleModal({ isOpen, onClose, onBattleCreated }: CreateBattleModalProps) {
  const { user } = useAuth();
  const router = useRouter();
  
  const [step, setStep] = useState<'form' | 'preview' | 'success'>('form');
  const [battleName, setBattleName] = useState('');
  const [playlistUrl, setPlaylistUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [playlistInfo, setPlaylistInfo] = useState<{ title: string; channelTitle: string; videoCount: number; videos: Video[] } | null>(null);
  const [createdBattleId, setCreatedBattleId] = useState<string | null>(null);
  const [createdInviteCode, setCreatedInviteCode] = useState<string | null>(null);

  // Reset state when closed
  React.useEffect(() => {
    if (!isOpen) {
      setStep('form');
      setBattleName('');
      setPlaylistUrl('');
      setError(null);
      setPlaylistInfo(null);
    }
  }, [isOpen]);

  const handleImport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!battleName.trim() || !playlistUrl.trim()) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const playlistId = extractPlaylistId(playlistUrl);
      if (!playlistId) {
        throw new Error('Invalid YouTube playlist URL');
      }

      const metadata = await fetchPlaylistMetadata(playlistId);
      const videos = await fetchPlaylistVideos(playlistId);
      
      if (videos.length === 0) {
        throw new Error('This playlist has no available videos.');
      }

      setPlaylistInfo({ ...metadata, videos });
      setStep('preview');
    } catch (err: any) {
      setError(err.message || 'Failed to import playlist');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!user || !playlistInfo) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const playlistId = extractPlaylistId(playlistUrl)!;
      const battle = await createBattle({
        name: battleName.trim(),
        creatorId: user.uid,
        creatorName: user.displayName || 'Unknown',
        creatorPhotoURL: user.photoURL || '',
        playlistId,
        playlistTitle: playlistInfo.title,
        channelTitle: playlistInfo.channelTitle,
        videos: playlistInfo.videos,
      });

      setCreatedBattleId(battle.id);
      setCreatedInviteCode(battle.inviteCode);
      setStep('success');
      onBattleCreated();
    } catch (err: any) {
      console.error('[CreateBattle] Failed:', err);
      setError(err.message || 'Failed to create battle');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Create Battle" size="md">
      {step === 'form' && (
        <form onSubmit={handleImport} className={styles.form}>
          <div className={styles.inputGroup}>
            <label htmlFor="battleName">Battle Name</label>
            <input
              id="battleName"
              type="text"
              value={battleName}
              onChange={e => setBattleName(e.target.value)}
              placeholder="e.g., Ultimate DSA Sprint"
              maxLength={50}
              required
              className={styles.input}
            />
          </div>
          
          <div className={styles.inputGroup}>
            <label htmlFor="playlistUrl">YouTube Playlist URL</label>
            <input
              id="playlistUrl"
              type="url"
              value={playlistUrl}
              onChange={e => setPlaylistUrl(e.target.value)}
              placeholder="https://youtube.com/playlist?list=..."
              required
              className={styles.input}
            />
          </div>

          {error && <div className={styles.error}>{error}</div>}

          <div className={styles.actions}>
            <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
            <Button type="submit" loading={loading}>Import Playlist</Button>
          </div>
        </form>
      )}

      {step === 'preview' && playlistInfo && (
        <div className={styles.preview}>
          <div className={styles.previewInfo}>
            <h3>{playlistInfo.title}</h3>
            <p className={styles.channel}>by {playlistInfo.channelTitle}</p>
            <p className={styles.videoCount}>{playlistInfo.videos.length} videos</p>
          </div>
          
          <div className={styles.thumbnails}>
            {playlistInfo.videos.slice(0, 3).map(v => (
              <img key={v.videoId} src={v.thumbnailUrl} alt="" className={styles.thumb} />
            ))}
            {playlistInfo.videos.length > 3 && (
              <div className={styles.moreThumb}>+{playlistInfo.videos.length - 3}</div>
            )}
          </div>

          {error && <div className={styles.error}>{error}</div>}

          <div className={styles.actions}>
            <Button variant="secondary" onClick={() => setStep('form')}>Back</Button>
            <Button onClick={handleCreate} loading={loading}>Start Battle</Button>
          </div>
        </div>
      )}

      {step === 'success' && createdInviteCode && (
        <div className={styles.success}>
          <div className={styles.icon}>🎉</div>
          <h2>Battle Created!</h2>
          <p>Share this invite code with your friends:</p>
          
          <div className={styles.inviteBox}>
            <span className={styles.code}>{createdInviteCode}</span>
            <Button 
              size="sm" 
              variant="secondary"
              onClick={() => {
                navigator.clipboard.writeText(createdInviteCode);
                alert('Copied to clipboard!');
              }}
            >
              Copy
            </Button>
          </div>
          
          <div className={styles.actions} style={{ justifyContent: 'center' }}>
            <Button onClick={() => router.push(`/battle/${createdBattleId}`)}>
              Go to Battle
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
