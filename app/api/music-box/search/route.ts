export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const keywords = searchParams.get('keywords');
  if (!keywords) return NextResponse.json({ error: 'Missing keywords' }, { status: 400 });

  try {
    const res = await fetch(
      `https://music.163.com/api/search/get/web?csrf_token=&s=${encodeURIComponent(keywords)}&type=1&offset=0&total=true&limit=10`,
      { headers: { 'Referer': 'https://music.163.com/', 'User-Agent': 'Mozilla/5.0' } }
    );
    return NextResponse.json(await res.json());
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
