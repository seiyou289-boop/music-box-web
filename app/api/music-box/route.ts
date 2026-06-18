import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'data');
const PLAYLISTS_FILE = path.join(DATA_DIR, 'playlists.json');

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function readData(file: string) {
  ensureDir();
  try { return JSON.parse(fs.readFileSync(file, 'utf-8')); }
  catch { return []; }
}

function writeData(file: string, data: any) {
  ensureDir();
  fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf-8');
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');

  let playlists = readData(PLAYLISTS_FILE);

  if (id) {
    const pl = playlists.find((p: any) => p.id === parseInt(id));
    return NextResponse.json(pl || null);
  }

  const month = searchParams.get('month');
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

  const playlists = readData(PLAYLISTS_FILE);
  const newPlaylist = {
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

  playlists.unshift(newPlaylist);
  writeData(PLAYLISTS_FILE, playlists);

  return NextResponse.json(newPlaylist);
}
