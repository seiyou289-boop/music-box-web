import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'data');
const FILE = path.join(DATA_DIR, 'dedications.json');

function rd() {
  try { return JSON.parse(fs.readFileSync(FILE, 'utf-8')); } catch { return []; }
}

function wd(d: any) {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify(d, null, 2), 'utf-8');
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const status = searchParams.get('status') || 'all';
  let all = rd();
  if (status === 'pending') all = all.filter((d: any) => d.status === 'pending');
  else if (status === 'replied') all = all.filter((d: any) => d.status === 'replied');
  return NextResponse.json({ dedications: all });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { songId, name, artist, message, selectedLyrics } = body;
  const all = rd();
  const d = { id: Date.now(), createdAt: new Date().toISOString(), songId, name, artist, message, selectedLyrics, reply: null, repliedAt: null, status: 'pending' };
  all.unshift(d);
  wd(all);
  return NextResponse.json({ success: true, dedication: d });
}

export async function PATCH(req: NextRequest) {
  const { id, reply } = await req.json();
  const all = rd();
  const d = all.find((x: any) => x.id === id);
  if (d) { d.reply = reply; d.repliedAt = new Date().toISOString(); d.status = 'replied'; }
  wd(all);
  return NextResponse.json({ success: true, dedication: d });
}
