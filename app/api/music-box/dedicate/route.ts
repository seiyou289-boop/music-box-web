import { NextRequest, NextResponse } from 'next/server';
import { getStore } from '@/lib/store';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const status = searchParams.get('status') || 'all';
  let all = getStore().dedications;
  if (status === 'pending') all = all.filter((d: any) => d.status === 'pending');
  else if (status === 'replied') all = all.filter((d: any) => d.status === 'replied');
  return NextResponse.json({ dedications: all });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { songId, name, artist, message, selectedLyrics } = body;
  const d = { id: Date.now(), createdAt: new Date().toISOString(), songId, name, artist, message, selectedLyrics, reply: null, repliedAt: null, status: 'pending' };
  getStore().dedications.unshift(d);
  return NextResponse.json({ success: true, dedication: d });
}

export async function PATCH(req: NextRequest) {
  const { id, reply } = await req.json();
  const d = getStore().dedications.find((x: any) => x.id === id);
  if (d) { d.reply = reply; d.repliedAt = new Date().toISOString(); d.status = 'replied'; }
  return NextResponse.json({ success: true, dedication: d });
}
