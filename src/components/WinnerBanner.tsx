'use client';
import React from 'react';

interface WinnerBannerProps {
  winnerName: string;
  isCurrentUserWinner: boolean;
}

export function WinnerBanner({ winnerName, isCurrentUserWinner }: WinnerBannerProps) {
  return (
    <div style={{ background: 'linear-gradient(to right, #f59e0b, #eab308)', color: '#000', padding: '1rem', textAlign: 'center', fontWeight: 'bold' }}>
      {isCurrentUserWinner ? '🎉 You won!' : `🏆 ${winnerName} won the battle!`}
    </div>
  );
}
