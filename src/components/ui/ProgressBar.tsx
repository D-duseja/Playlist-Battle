'use client';

import React from 'react';
import styles from './ProgressBar.module.css';

interface ProgressBarProps {
  value: number; // 0 to 100
  showLabel?: boolean;
  size?: 'sm' | 'md';
  className?: string;
}

export function ProgressBar({
  value,
  showLabel = false,
  size = 'md',
  className = ''
}: ProgressBarProps) {
  // Ensure value is between 0 and 100
  const clampedValue = Math.min(Math.max(value, 0), 100);

  return (
    <div className={`${styles.container} ${className}`}>
      <div className={`${styles.track} ${styles[size]}`}>
        <div 
          className={styles.fill} 
          style={{ width: `${clampedValue}%` }}
        >
          <div className={styles.shimmer} />
        </div>
      </div>
      {showLabel && (
        <span className={styles.label}>{Math.round(clampedValue)}%</span>
      )}
    </div>
  );
}
