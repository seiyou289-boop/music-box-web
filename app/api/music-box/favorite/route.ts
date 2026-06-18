import { NextRequest, NextResponse } from 'next/server';
import { getStore } from '@/lib/store';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const deleted = searchParams.get('deleted') === 'true';
  const songs = getStore().favorites.filter((s: any) => s.deleted === deleted);
  return NextResponse.json(songs);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { songId, name, artist, message, fromPlaylistId, fromDate } = body;
  const store = getStore();
  if (store.favorites.find((s: any) => s.songId === songId && !s.deleted)) {
    return NextResponse.json({ error: 'Already in favorites' }, { status: 409 });
  }
  const song = { id: Date.now(), createdAt: new Date().toISOString(), songId, name, artist, message, fromPlaylistId, fromDate, deleted: false, deletedAt: null };
  store.favorites.unshift(song);
  return NextResponse.json(song);
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = parseInt(searchParams.get('id') || '');
  const permanent = searchParams.get('permanent') === 'true';
  const store = getStore();
  if (permanent) { store.favorites = store.favorites.filter((s: any) => s.id !== id); }
  else { const s = store.favorites.find((s: any) => s.id === id); if (s) { s.deleted = true; s.deletedAt = new Date().toISOString(); } }
  return NextResponse.json({ success: true });
}

export async function PATCH(req: NextRequest) {
  const { ids, action } = await req.json();
  const store = getStore();
  if (action === 'restore') { store.favorites.forEach((s: any) => { if (ids.includes(s.id)) { s.deleted = false; s.deletedAt = null; } }); }
  else if (action === 'delete_permanent') { store.favorites = store.favorites.filter((s: any) => !ids.includes(s.id)); }
  return NextResponse.json({ success: true });
}
