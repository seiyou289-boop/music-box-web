import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const LIBRARY_FILE = path.join('C:', 'Users', 'everlyn', 'MusicBox', 'library.json');

// 情绪 → 风格映射
const MOOD_STYLES: Record<string, string[]> = {
  '晴朗': ['R&B', 'Pop', 'Funk'],
  '雨天': ['Ballad', 'Jazz', 'Ambient'],
  '夜晚': ['Indie', 'Dream Pop', 'Lo-fi'],
  'emo': ['Alternative', 'Rock', 'Soul'],
  '活力': ['Pop Rock', 'Dance', 'Funk'],
  '放松': ['Jazz', 'Bossa Nova', 'Ambient'],
  '专注': ['Classical', 'Piano', 'BGM'],
  '怀旧': ['Ballad', 'Cantopop', 'Mandopop'],
};

function analyzeTaste(library: any) {
  const songs = library.songs || [];
  const artistCount: Record<string, number> = {};
  const decadeCount: Record<string, number> = {};

  songs.forEach((s: any) => {
    s.artist.split(', ').forEach((a: string) => {
      artistCount[a] = (artistCount[a] || 0) + 1;
    });
  });

  const topArtists = Object.entries(artistCount)
    .sort((a: any, b: any) => b[1] - a[1])
    .slice(0, 30)
    .map(([name, count]) => ({ name, count }));

  // 从歌手推风格
  const styles = new Set<string>();
  const styleMap: Record<string, string[]> = {
    '陶喆': ['R&B', 'Soul', 'Mandopop'],
    '王菲': ['Alternative', 'Dream Pop', 'Cantopop'],
    'Lana Del Rey': ['Dream Pop', 'Indie', 'Baroque Pop'],
    '陈奕迅': ['Cantopop', 'Ballad'],
    '方大同': ['R&B', 'Soul', 'Funk'],
    '宇多田ヒカル': ['J-Pop', 'R&B'],
    'Måneskin': ['Rock', 'Glam Rock'],
    'Ariana Grande': ['Pop', 'R&B'],
    'Olivia Rodrigo': ['Pop Rock', 'Alternative'],
    'My Chemical Romance': ['Alternative Rock', 'Emo'],
    'Cocteau Twins': ['Dream Pop', 'Ethereal', 'Shoegaze'],
    '伍佰': ['Rock', 'Taiwanese Rock'],
    'The Beatles': ['Classic Rock', 'Pop'],
    '凤凰传奇': ['Chinese Folk', 'Pop'],
    '薛之谦': ['Mandopop', 'Ballad'],
    '齐豫': ['Folk', 'New Age'],
    '张悬': ['Indie Folk', 'Alternative'],
    '孙燕姿': ['Mandopop'],
    '林忆莲': ['Cantopop', 'R&B'],
    '容祖儿': ['Cantopop'],
    'G-DRAGON': ['K-Pop', 'Hip-Hop', 'Rap'],
    'GALI': ['Chinese Hip-Hop', 'Rap'],
    '王力宏': ['Mandopop', 'R&B', 'Hip-Hop'],
    'DJ Okawari': ['Jazz Hip-Hop', 'Lo-fi', 'Instrumental'],
  };

  topArtists.forEach((a: any) => {
    if (styleMap[a.name]) {
      styleMap[a.name].forEach((s: string) => styles.add(s));
    }
  });

  return {
    totalSongs: songs.length,
    uniqueArtists: Object.keys(artistCount).length,
    topArtists,
    detectedStyles: Array.from(styles),
    recommendation: generateRecommendation(Array.from(styles)),
  };
}

function generateRecommendation(styles: string[]) {
  const recs: string[] = [];

  if (styles.some(s => ['R&B', 'Soul', 'Funk'].includes(s))) {
    recs.push('你明显喜欢 R&B/Soul，推荐听：Stevie Wonder、Erykah Badu、丁世光、袁娅维');
  }
  if (styles.some(s => ['Dream Pop', 'Indie', 'Shoegaze', 'Ethereal'].includes(s))) {
    recs.push('你有独立/梦幻口味，推荐听：Beach House、Slowdive、My Bloody Valentine、Cigarettes After Sex');
  }
  if (styles.some(s => ['Rock', 'Alternative Rock', 'Pop Rock'].includes(s))) {
    recs.push('你喜欢摇滚/另类，推荐听：Arctic Monkeys、Tame Impala、草东没有派对、落日飞车');
  }
  if (styles.some(s => ['Mandopop', 'Cantopop', 'Ballad'].includes(s))) {
    recs.push('华语流行是你的主盘，可以试试：单依纯、周兴哲、岑宁儿、林家谦');
  }
  if (styles.some(s => ['K-Pop', 'Hip-Hop', 'Rap'].includes(s))) {
    recs.push('你有 Hip-Hop/K-Pop 倾向，推荐听：BewhY、pH-1、JONY J、ICE');
  }
  if (styles.some(s => ['Jazz', 'Lo-fi', 'Instrumental'].includes(s))) {
    recs.push('你喜欢氛围/爵士系，推荐听：Nujabes、J Dilla、FKJ、Tom Misch');
  }

  return recs;
}

export async function GET() {
  try {
    const lib = JSON.parse(fs.readFileSync(LIBRARY_FILE, 'utf-8'));
    const analysis = analyzeTaste(lib);
    return NextResponse.json(analysis);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
