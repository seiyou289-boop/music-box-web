import { NextRequest, NextResponse } from 'next/server';
import { getStore } from '@/lib/store';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  const store = getStore();

  if (id) {
    const pl = store.playlists.find((p: any) => p.id === parseInt(id));
    return NextResponse.json(pl || null);
  }

  const month = searchParams.get('month');
  let playlists = store.playlists;
  if (month) {
    const [y, m] = month.split('-').map(Number);
    playlists = playlists.filter((p: any) => {
      const d = new Date(p.createdAt);
      return d.getFullYear() === y && d.getMonth() + 1 === m;
    });
  }

  return NextResponse.json(playlists);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { weather, mood, theme, songs } = body;
  const store = getStore();

  const playlist = {
    id: Date.now(),
    createdAt: new Date().toISOString(),
    weather: weather || '',
    mood: mood || '',
    theme: theme || '',
    songs: (songs || []).map((s: any, i: number) => ({
      id: String(Math.random()).slice(2, 10),
      songId: s.id,
      name: s.name,
      artist: s.artist,
      message: s.message,
      lyrics: s.lyrics,
      order: i,
    })),
  };

  store.playlists.unshift(playlist);
  // 只保留最近50个歌单
  if (store.playlists.length > 50) store.playlists.length = 50;

  return NextResponse.json(playlist);
}
