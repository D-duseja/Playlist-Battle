'use client';

import React from 'react';
import styles from './Badge.module.css';

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'active' | 'completed' | 'forfeited' | 'winner' | 'default';
  pulse?: boolean;
}

export function Badge({
  variant = 'default',
  pulse = false,
  className = '',
  children,
  ...props
}: BadgeProps) {
  const classes = [
    styles.badge,
    styles[variant],
    pulse ? styles.pulse : '',
    className
  ].filter(Boolean).join(' ');

  return (
    <span className={classes} {...props}>
      {children}
    </span>
  );
}
