'use client';

import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui';
import styles from './Navbar.module.css';

export function Navbar() {
  const { user, signOut } = useAuth();

  return (
    <nav className={styles.navbar}>
      <div className={styles.container}>
        <div className={styles.logo}>
          <span className={styles.icon}>⚔️</span>
          <span className="gradient-text">Playlist Battle</span>
        </div>
        
        {user && (
          <div className={styles.userSection}>
            <div className={styles.userInfo}>
              {user.photoURL ? (
                <img src={user.photoURL} alt="Avatar" className={styles.avatar} />
              ) : (
                <div className={styles.avatarPlaceholder}>
                  {user.displayName?.charAt(0) || 'U'}
                </div>
              )}
              <span className={styles.name}>{user.displayName}</span>
            </div>
            <Button variant="ghost" size="sm" onClick={signOut}>
              Sign Out
            </Button>
          </div>
        )}
      </div>
    </nav>
  );
}
