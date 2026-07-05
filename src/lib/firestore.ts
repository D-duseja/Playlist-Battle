import { db } from './firebase';
import { 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  query, 
  where, 
  updateDoc, 
  serverTimestamp, 
  onSnapshot, 
  addDoc, 
  Timestamp,
  increment,
  writeBatch
} from 'firebase/firestore';
import { Battle, Participant, UserProgress, PlaylistSnapshot, Video, WatchSegment } from '@/types';
import { generateInviteCode } from './invite-codes';

// User operations
export async function createOrUpdateUser(uid: string, data: { displayName: string; email: string; photoURL: string }): Promise<void> {
  const userRef = doc(db, 'users', uid);
  await setDoc(userRef, {
    ...data,
    updatedAt: serverTimestamp(),
  }, { merge: true });
}

// Battle operations  
export async function createBattle(data: { 
  name: string; 
  creatorId: string; 
  creatorName: string; 
  creatorPhotoURL: string;
  playlistId: string; 
  playlistTitle: string; 
  channelTitle: string; 
  videos: Video[]; 
}): Promise<Battle> {
  const inviteCode = generateInviteCode();
  
  // Create snapshot
  const snapshotRef = doc(collection(db, 'playlistSnapshots'));
  await setDoc(snapshotRef, {
    playlistId: data.playlistId,
    title: data.playlistTitle,
    channelTitle: data.channelTitle,
    totalVideos: data.videos.length,
    videos: data.videos,
    createdAt: serverTimestamp(),
  });

  // Create battle
  const battleRef = doc(collection(db, 'battles'));
  const battleData = {
    name: data.name,
    inviteCode,
    creatorId: data.creatorId,
    creatorName: data.creatorName,
    status: 'ACTIVE',
    winnerId: null,
    winnerName: null,
    winnerDeclaredAt: null,
    snapshotId: snapshotRef.id,
    playlistTitle: data.playlistTitle,
    totalVideos: data.videos.length,
    participantCount: 1,
    createdAt: serverTimestamp(),
  };
  await setDoc(battleRef, battleData);

  // Add creator as participant
  await addParticipant(battleRef.id, data.creatorId, data.creatorName, data.creatorPhotoURL);
  
  // Initialize progress
  await initializeProgress(battleRef.id, data.creatorId, data.videos);

  return { id: battleRef.id, ...battleData } as unknown as Battle; // Dates will be incorrect until fetched, but ok for now
}

export async function getBattle(battleId: string): Promise<Battle | null> {
  const docSnap = await getDoc(doc(db, 'battles', battleId));
  if (!docSnap.exists()) return null;
  const data = docSnap.data();
  return {
    id: docSnap.id,
    ...data,
    createdAt: data.createdAt?.toDate(),
    winnerDeclaredAt: data.winnerDeclaredAt?.toDate(),
  } as Battle;
}

export async function getBattleByInviteCode(inviteCode: string): Promise<Battle | null> {
  const q = query(collection(db, 'battles'), where('inviteCode', '==', inviteCode));
  const querySnapshot = await getDocs(q);
  if (querySnapshot.empty) return null;
  
  const docSnap = querySnapshot.docs[0];
  const data = docSnap.data();
  return {
    id: docSnap.id,
    ...data,
    createdAt: data.createdAt?.toDate(),
    winnerDeclaredAt: data.winnerDeclaredAt?.toDate(),
  } as Battle;
}

export async function getUserBattles(userId: string): Promise<Battle[]> {
  const q = query(collection(db, 'participants'), where('userId', '==', userId));
  const querySnapshot = await getDocs(q);
  const battleIds = querySnapshot.docs.map(doc => doc.data().battleId);
  
  if (battleIds.length === 0) return [];

  // Note: in/array-contains has limits. Doing multiple reads is fine for MVP.
  const battles: Battle[] = [];
  for (const battleId of battleIds) {
    const b = await getBattle(battleId);
    if (b) battles.push(b);
  }
  return battles.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

export async function updateBattleWinner(battleId: string, winnerId: string, winnerName: string): Promise<void> {
  await updateDoc(doc(db, 'battles', battleId), {
    status: 'COMPLETED',
    winnerId,
    winnerName,
    winnerDeclaredAt: serverTimestamp(),
  });
}

// Participant operations
export async function addParticipant(battleId: string, userId: string, displayName: string, photoURL: string): Promise<void> {
  const participantId = `${battleId}_${userId}`;
  const participantRef = doc(db, 'participants', participantId);
  
  const pSnap = await getDoc(participantRef);
  if (!pSnap.exists()) {
    await setDoc(participantRef, {
      battleId,
      userId,
      displayName,
      photoURL,
      status: 'ACTIVE',
      completedLectures: 0,
      lastCompletedAt: null,
      joinedAt: serverTimestamp(),
    });

    // Update battle participant count if this isn't the creator (creator is added during createBattle)
    const bRef = doc(db, 'battles', battleId);
    // Let's just blindly increment. Or check if we should.
    // Actually, createBattle calls addParticipant, so if we increment here, createBattle participantCount would be 2.
    // We'll increment participantCount explicitly in the join flow instead.
  }
}

export async function getParticipants(battleId: string): Promise<Participant[]> {
  const q = query(collection(db, 'participants'), where('battleId', '==', battleId));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => {
    const data = doc.data();
    return {
      id: doc.id,
      ...data,
      lastCompletedAt: data.lastCompletedAt?.toDate() || null,
      joinedAt: data.joinedAt?.toDate(),
    } as Participant;
  });
}

export async function isParticipant(battleId: string, userId: string): Promise<boolean> {
  const participantId = `${battleId}_${userId}`;
  const docSnap = await getDoc(doc(db, 'participants', participantId));
  return docSnap.exists();
}

export async function forfeitParticipant(battleId: string, userId: string): Promise<void> {
  const participantId = `${battleId}_${userId}`;
  await updateDoc(doc(db, 'participants', participantId), {
    status: 'FORFEITED'
  });
}

export async function updateParticipantProgress(battleId: string, userId: string, completedLectures: number, lastCompletedAt: Date | null): Promise<void> {
  const participantId = `${battleId}_${userId}`;
  await updateDoc(doc(db, 'participants', participantId), {
    completedLectures,
    lastCompletedAt: lastCompletedAt ? Timestamp.fromDate(lastCompletedAt) : null,
  });
}

// Progress operations
export async function getProgress(battleId: string, userId: string): Promise<UserProgress[]> {
  const q = query(
    collection(db, 'progress'), 
    where('battleId', '==', battleId),
    where('userId', '==', userId)
  );
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => {
    const data = doc.data();
    return {
      id: doc.id,
      ...data,
      completedAt: data.completedAt?.toDate() || null,
      updatedAt: data.updatedAt?.toDate(),
    } as UserProgress;
  });
}

export async function getVideoProgress(battleId: string, userId: string, videoId: string): Promise<UserProgress | null> {
  const progressId = `${battleId}_${userId}_${videoId}`;
  const docSnap = await getDoc(doc(db, 'progress', progressId));
  if (!docSnap.exists()) return null;
  const data = docSnap.data();
  return {
    id: docSnap.id,
    ...data,
    completedAt: data.completedAt?.toDate() || null,
    updatedAt: data.updatedAt?.toDate(),
  } as UserProgress;
}

export async function updateVideoProgress(
  battleId: string, 
  userId: string, 
  videoId: string, 
  data: { watchedSegments: WatchSegment[]; watchPercentage: number; status: 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED'; completedAt?: Date | null; }
): Promise<void> {
  const progressId = `${battleId}_${userId}_${videoId}`;
  const updateData: any = {
    ...data,
    updatedAt: serverTimestamp()
  };
  if (data.completedAt !== undefined) {
      updateData.completedAt = data.completedAt ? Timestamp.fromDate(data.completedAt) : null;
  }
  
  await updateDoc(doc(db, 'progress', progressId), updateData);
}

export async function initializeProgress(battleId: string, userId: string, videos: Video[]): Promise<void> {
  // Use batched writes — Firestore allows max 500 ops per batch
  for (let i = 0; i < videos.length; i += 500) {
    const batch = writeBatch(db);
    const chunk = videos.slice(i, i + 500);

    for (const video of chunk) {
      const progressId = `${battleId}_${userId}_${video.videoId}`;
      const ref = doc(db, 'progress', progressId);
      batch.set(ref, {
        battleId,
        userId,
        videoId: video.videoId,
        watchedSegments: [],
        watchPercentage: 0,
        status: 'NOT_STARTED',
        completedAt: null,
        updatedAt: serverTimestamp(),
      });
    }

    await batch.commit();
  }
}

// Snapshot operations  
export async function getPlaylistSnapshot(snapshotId: string): Promise<PlaylistSnapshot | null> {
  const docSnap = await getDoc(doc(db, 'playlistSnapshots', snapshotId));
  if (!docSnap.exists()) return null;
  const data = docSnap.data();
  return {
    id: docSnap.id,
    ...data,
    createdAt: data.createdAt?.toDate(),
  } as PlaylistSnapshot;
}
