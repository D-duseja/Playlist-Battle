'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User as FirebaseUser, GoogleAuthProvider, signInWithPopup, signOut as firebaseSignOut, onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { createOrUpdateUser } from '@/lib/firestore';

interface AuthContextType {
  user: FirebaseUser | null;
  loading: boolean;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let hasResolved = false;
    
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      hasResolved = true;
      setUser(currentUser);
      if (currentUser) {
        // Automatically persist user in Firestore
        try {
          await createOrUpdateUser(currentUser.uid, {
            displayName: currentUser.displayName || 'Unknown User',
            email: currentUser.email || '',
            photoURL: currentUser.photoURL || '',
          });
        } catch (err) {
          console.error('[AuthProvider] Failed to sync user to Firestore:', err);
        }
      }
      setLoading(false);
    });

    // Safety timeout: if onAuthStateChanged hasn't fired in 5 seconds,
    // assume no user and let the app render the login page.
    const timeout = setTimeout(() => {
      if (!hasResolved) {
        console.warn('[AuthProvider] Firebase Auth did not respond in 5s — falling back to unauthenticated state.');
        setLoading(false);
      }
    }, 5000);

    return () => {
      unsubscribe();
      clearTimeout(timeout);
    };
  }, []);

  const signIn = async () => {
    const provider = new GoogleAuthProvider();
    await signInWithPopup(auth, provider);
  };

  const signOut = async () => {
    await firebaseSignOut(auth);
  };

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
