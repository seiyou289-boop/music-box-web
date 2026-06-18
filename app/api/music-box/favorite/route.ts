import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'data');
const FILE = path.join(DATA_DIR, 'favorites.json');

function rd() {
  try { return JSON.parse(fs.readFileSync(FILE, 'utf-8')); } catch { return []; }
}

function wd(d: any) {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify(d, null, 2), 'utf-8');
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const deleted = searchParams.get('deleted') === 'true';
  const songs = rd().filter((s: any) => s.deleted === deleted);
  return NextResponse.json(songs);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { songId, name, artist, message, fromPlaylistId, fromDate } = body;
  const all = rd();
  if (all.find((s: any) => s.songId === songId && !s.deleted)) {
    return NextResponse.json({ error: 'Already in favorites' }, { status: 409 });
  }
  const song = { id: Date.now(), createdAt: new Date().toISOString(), songId, name, artist, message, fromPlaylistId, fromDate, deleted: false, deletedAt: null };
  all.unshift(song);
  wd(all);
  return NextResponse.json(song);
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = parseInt(searchParams.get('id') || '');
  const permanent = searchParams.get('permanent') === 'true';
  let all = rd();
  if (permanent) {
    all = all.filter((s: any) => s.id !== id);
  } else {
    const s = all.find((s: any) => s.id === id);
    if (s) { s.deleted = true; s.deletedAt = new Date().toISOString(); }
  }
  wd(all);
  return NextResponse.json({ success: true });
}

export async function PATCH(req: NextRequest) {
  const { ids, action } = await req.json();
  let all = rd();
  if (action === 'restore') {
    all.forEach((s: any) => { if (ids.includes(s.id)) { s.deleted = false; s.deletedAt = null; } });
  } else if (action === 'delete_permanent') {
    all = all.filter((s: any) => !ids.includes(s.id));
  }
  wd(all);
  return NextResponse.json({ success: true });
}
