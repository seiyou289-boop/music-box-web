import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

  try {
    const res = await fetch(`https://music.163.com/api/song/lyric?id=${id}&lv=-1&kv=-1&tv=-1`, {
      headers: { 'Referer': 'https://music.163.com/', 'User-Agent': 'Mozilla/5.0' },
    });
    return NextResponse.json(await res.json());
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
