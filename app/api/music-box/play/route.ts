import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

  try {
    // 用网易云公开 API（不需要登录就能获取试听链接）
    const res = await fetch(`https://music.163.com/api/song/enhance/player/url?id=${id}&ids=[${id}]&br=320000`, {
      headers: { 'Referer': 'https://music.163.com/', 'User-Agent': 'Mozilla/5.0' },
    });
    const data = await res.json();
    if (data.data?.[0]?.url) return NextResponse.json(data);

    // 降级 128k
    const res2 = await fetch(`https://music.163.com/api/song/enhance/player/url?id=${id}&ids=[${id}]&br=128000`, {
      headers: { 'Referer': 'https://music.163.com/', 'User-Agent': 'Mozilla/5.0' },
    });
    return NextResponse.json(await res2.json());
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
