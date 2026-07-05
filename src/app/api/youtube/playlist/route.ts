import { NextResponse } from 'next/server';
import { Video } from '@/types';
import { parseDuration } from '@/lib/youtube';

const YOUTUBE_API_BASE = 'https://www.googleapis.com/youtube/v3';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const playlistId = searchParams.get('playlistId');
  const mode = searchParams.get('mode'); // 'metadata' or 'videos'
  
  if (!playlistId) {
    return NextResponse.json({ error: 'Missing playlistId parameter' }, { status: 400 });
  }
  
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'Server missing YOUTUBE_API_KEY configuration' }, { status: 500 });
  }

  try {
    if (mode === 'metadata') {
      const url = new URL(`${YOUTUBE_API_BASE}/playlists`);
      url.searchParams.set('part', 'snippet,contentDetails');
      url.searchParams.set('id', playlistId);
      url.searchParams.set('key', apiKey);

      const response = await fetch(url.toString());
      if (!response.ok) throw new Error(`YouTube API error: ${response.status}`);
      const data = await response.json();

      if (!data.items || data.items.length === 0) {
        return NextResponse.json({ error: 'Playlist not found' }, { status: 404 });
      }

      const playlist = data.items[0];
      return NextResponse.json({
        title: playlist.snippet.title,
        channelTitle: playlist.snippet.channelTitle,
        videoCount: playlist.contentDetails.itemCount,
      });
    }

    if (mode === 'videos') {
      const allItems: any[] = [];
      let nextPageToken: string | undefined;

      // 1. Fetch all items in playlist
      do {
        const url = new URL(`${YOUTUBE_API_BASE}/playlistItems`);
        url.searchParams.set('part', 'snippet,contentDetails');
        url.searchParams.set('playlistId', playlistId);
        url.searchParams.set('maxResults', '50');
        url.searchParams.set('key', apiKey);
        if (nextPageToken) url.searchParams.set('pageToken', nextPageToken);

        const response = await fetch(url.toString());
        if (!response.ok) throw new Error(`YouTube API error: ${response.status}`);
        const data = await response.json();

        for (const item of data.items ?? []) {
          const videoId = item.contentDetails?.videoId ?? item.snippet?.resourceId?.videoId;
          if (!videoId) continue;

          const thumbnails = item.snippet?.thumbnails ?? {};
          const thumbnailUrl = thumbnails.medium?.url ?? thumbnails.default?.url ?? thumbnails.high?.url ?? '';

          allItems.push({
            videoId,
            title: item.snippet?.title ?? 'Untitled',
            thumbnailUrl,
            position: item.snippet?.position ?? allItems.length,
          });
        }
        nextPageToken = data.nextPageToken;
      } while (nextPageToken);

      // 2. Fetch durations
      const durationMap = new Map<string, number>();
      for (let i = 0; i < allItems.length; i += 50) {
        const batch = allItems.slice(i, i + 50);
        const videoIds = batch.map((v) => v.videoId).join(',');

        const url = new URL(`${YOUTUBE_API_BASE}/videos`);
        url.searchParams.set('part', 'contentDetails');
        url.searchParams.set('id', videoIds);
        url.searchParams.set('key', apiKey);

        const response = await fetch(url.toString());
        if (!response.ok) throw new Error(`YouTube API error: ${response.status}`);
        const data = await response.json();

        for (const item of data.items ?? []) {
          durationMap.set(item.id, parseDuration(item.contentDetails?.duration ?? 'PT0S'));
        }
      }

      // 3. Combine
      const videos: Video[] = allItems.map((item) => ({
        videoId: item.videoId,
        title: item.title,
        thumbnailUrl: item.thumbnailUrl,
        duration: durationMap.get(item.videoId) ?? 0,
        position: item.position,
      }));

      return NextResponse.json(videos);
    }

    return NextResponse.json({ error: 'Invalid mode' }, { status: 400 });
  } catch (error: any) {
    console.error('[YouTube API Proxy Error]', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
