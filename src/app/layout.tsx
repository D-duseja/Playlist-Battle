import type { Metadata } from 'next';
import { Inter, Outfit } from 'next/font/google';
import { AuthProvider } from '@/contexts/AuthContext';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });
const outfit = Outfit({ subsets: ['latin'], variable: '--font-outfit' });

export const metadata: Metadata = {
  title: 'Playlist Battle — Compete. Learn. Win.',
  description: 'Transform YouTube playlists into multiplayer learning challenges. Compete with friends to complete playlists first.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${inter.variable} ${outfit.variable}`}>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
