'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';

// ====== 类型定义 ======
interface Song {
  id: string; name: string; artist: string; message?: string; lyrics?: string;
}
interface PlaylistData {
  id: number; createdAt: string; weather?: string; mood?: string; theme?: string;
  songs: Song[];
}
interface FavoriteSong {
  id: number; songId: string; name: string; artist: string; message?: string;
  fromPlaylistId?: number; fromDate?: string; createdAt: string; deleted: boolean;
}
interface Dedication {
  id: number; createdAt: string; songId: string; name: string; artist: string;
  message?: string; selectedLyrics?: string; reply?: string; repliedAt?: string; status: string;
}

// ====== 辅助函数 ======
function parseLrc(lrc: string): { time: number; text: string }[] {
  const lines = lrc.split('\n');
  const result: { time: number; text: string }[] = [];
  const regex = /\[(\d{2}):(\d{2})\.(\d{2,3})\]/;
  for (const line of lines) {
    const match = line.match(regex);
    if (match) {
      const m = parseInt(match[1]), s = parseInt(match[2]), ms = parseInt(match[3].padEnd(3, '0'));
      const time = m * 60 + s + ms / 1000;
      const text = line.replace(regex, '').trim();
      if (text) result.push({ time, text });
    }
  }
  return result.sort((a, b) => a.time - b.time);
}

function formatTime(s: number): string {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

const WEATHER_KAOMOJI: Record<string, string> = {
  '晴': '(￣▽￣)✧', 'clear': '(￣▽￣)✧',
  '多云': '(￣ω￣)☁️', 'cloud': '(￣ω￣)☁️',
  '阴': '(－︵－) ', 'overcast': '(－︵－) ',
  '雨': '(´；ω；｀)☔', 'rain': '(´；ω；｀)☔', 'drizzle': '(´；ω；｀)☔',
  '雪': '(❄️▽❄️)ﾉ', 'snow': '(❄️▽❄️)ﾉ',
  '雾': '(＝＿＝)🌫', 'fog': '(＝＿＝)🌫', 'mist': '(＝＿＝)🌫',
  '风': '(ノ°ο°)ノ🌪', 'wind': '(ノ°ο°)ノ🌪',
  '雷': '(°Д°)⚡', 'thunder': '(°Д°)⚡',
  '霾': '(－_－)💨', 'haze': '(－_－)💨',
};
const DEFAULT_KAOMOJI = '(´･ω･`)ﾉ';

export default function MusicBoxClient() {
  // ====== 状态 ======
  const [currentPlaylist, setCurrentPlaylist] = useState<PlaylistData | null>(null);
  const [historyPlaylists, setHistoryPlaylists] = useState<PlaylistData[]>([]);
  const [favorites, setFavorites] = useState<FavoriteSong[]>([]);
  const [dedications, setDedications] = useState<Dedication[]>([]);
  const [tab, setTab] = useState<'QUEUE' | 'RADIO' | 'HISTORY' | 'FAVORITE'>('QUEUE');
  const [playingIndex, setPlayingIndex] = useState(-1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [loopMode, setLoopMode] = useState<'LOOP' | 'ONE' | 'SHUF'>('LOOP');
  const [sortOrder, setSortOrder] = useState<'NEWEST' | 'OLDEST'>('NEWEST');
  const [filterMonth, setFilterMonth] = useState('');
  const [showPanel, setShowPanel] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [showDedicate, setShowDedicate] = useState(false);
  const [dedicateSong, setDedicateSong] = useState<{ id: string; name: string; artist: string } | null>(null);
  const [dedicateMsg, setDedicateMsg] = useState('');
  const [dedicateLyrics, setDedicateLyrics] = useState<{ time: number; text: string }[]>([]);
  const [dedicateSelectedLyrics, setDedicateSelectedLyrics] = useState<Set<number>>(new Set());
  const [showLyricPicker, setShowLyricPicker] = useState(false);
  const [weatherText, setWeatherText] = useState('');
  const [moodText, setMoodText] = useState('');
  const [themeText, setThemeText] = useState('');
  const [showTrash, setShowTrash] = useState(false);
  const [selectedFavIds, setSelectedFavIds] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const audioRef = useRef<HTMLAudioElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const lyricsRef = useRef<HTMLDivElement>(null);
  const searchTimer = useRef<NodeJS.Timeout>();

  // ====== API 调用 ======
  const api = {
    getPlaylists: async (month?: string) => {
      const url = `/api/music-box${month ? `?month=${month}` : ''}`;
      const r = await fetch(url); return r.json();
    },
    postPlaylist: async (data: any) => {
      const r = await fetch('/api/music-box', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }); return r.json();
    },
    getPlayUrl: async (id: string) => {
      const r = await fetch(`/api/music-box/play?id=${id}`); return r.json();
    },
    getLyrics: async (id: string) => {
      const r = await fetch(`/api/music-box/lyrics?id=${id}`); return r.json();
    },
    search: async (keywords: string) => {
      const r = await fetch(`/api/music-box/search?keywords=${encodeURIComponent(keywords)}`); return r.json();
    },
    getFavorites: async (deleted = false) => {
      const r = await fetch(`/api/music-box/favorite?deleted=${deleted}`); return r.json();
    },
    addFavorite: async (data: any) => {
      const r = await fetch('/api/music-box/favorite', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }); return r.json();
    },
    deleteFavorite: async (id: number, permanent = false) => {
      const r = await fetch(`/api/music-box/favorite?id=${id}&permanent=${permanent}`, { method: 'DELETE' }); return r.json();
    },
    patchFavorites: async (ids: number[], action: string) => {
      const r = await fetch('/api/music-box/favorite', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids, action }) }); return r.json();
    },
    getDedications: async (status = 'all') => {
      const r = await fetch(`/api/music-box/dedicate?status=${status}`); return r.json();
    },
    postDedication: async (data: any) => {
      const r = await fetch('/api/music-box/dedicate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }); return r.json();
    },
  };

  // ====== 加载数据 ======
  useEffect(() => {
    loadData();
  }, []);

  async function loadData(month?: string) {
    setLoading(true);
    setError('');
    try {
      const playlists = await api.getPlaylists(month);
      if (Array.isArray(playlists) && playlists.length > 0) {
        setHistoryPlaylists(playlists);
        const latest = playlists[0];
        setCurrentPlaylist(latest);
        if (latest.weather) setWeatherText(latest.weather);
        if (latest.mood) setMoodText(latest.mood);
        if (latest.theme) setThemeText(latest.theme);
      } else if (!Array.isArray(playlists)) {
        setCurrentPlaylist(playlists);
      }
      const favs = await api.getFavorites(false);
      if (Array.isArray(favs)) setFavorites(favs);
      const deds = await api.getDedications();
      if (deds.dedications) setDedications(deds.dedications);
    } catch (e: any) {
      setError('加载失败：' + e.message);
    }
    setLoading(false);
  }

  // ====== 播放器 ======
  const currentSongs = tab === 'QUEUE' ? (currentPlaylist?.songs || [])
    : tab === 'FAVORITE' ? (showTrash ? [] : favorites.map(f => ({ id: f.songId, name: f.name, artist: f.artist, message: f.message, lyrics: undefined })))
    : [];

  const currentSong = playingIndex >= 0 && playingIndex < currentSongs.length ? currentSongs[playingIndex] : null;

  async function playSong(index: number) {
    if (index < 0 || index >= currentSongs.length) return;
    setPlayingIndex(index);
    const song = currentSongs[index];
    try {
      const data = await api.getPlayUrl(song.songId || song.id);
      const url = data.data?.[0]?.url || data.data?.url || '';
      if (url && audioRef.current) {
        audioRef.current.src = url;
        audioRef.current.play().then(() => setIsPlaying(true)).catch(() => {});
      }
    } catch {}
  }

  function togglePlay() {
    if (!audioRef.current) return;
    if (audioRef.current.src) {
      if (isPlaying) { audioRef.current.pause(); setIsPlaying(false); }
      else { audioRef.current.play().then(() => setIsPlaying(true)).catch(() => {}); }
    } else if (currentSongs.length > 0) {
      playSong(playingIndex >= 0 ? playingIndex : 0);
    }
  }

  function nextSong() {
    if (currentSongs.length === 0) return;
    if (loopMode === 'SHUF') {
      playSong(Math.floor(Math.random() * currentSongs.length));
    } else {
      playSong((playingIndex + 1) % currentSongs.length);
    }
  }

  function prevSong() {
    if (currentSongs.length === 0) return;
    if (loopMode === 'SHUF') {
      playSong(Math.floor(Math.random() * currentSongs.length));
    } else {
      playSong((playingIndex - 1 + currentSongs.length) % currentSongs.length);
    }
  }

  function handleTimeUpdate() {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
      setDuration(audioRef.current.duration || 0);
    }
  }

  function handleEnded() {
    if (loopMode === 'ONE') {
      if (audioRef.current) { audioRef.current.currentTime = 0; audioRef.current.play(); }
    } else {
      nextSong();
    }
  }

  function handleProgressClick(e: React.MouseEvent) {
    if (!progressRef.current || !audioRef.current || !duration) return;
    const rect = progressRef.current.getBoundingClientRect();
    const pct = (e.clientX - rect.left) / rect.width;
    audioRef.current.currentTime = pct * duration;
  }

  function toggleFav(songId: string, name: string, artist: string, message?: string) {
    const existing = favorites.find(f => f.songId === songId && !f.deleted);
    if (existing) {
      api.deleteFavorite(existing.id);
      setFavorites(favorites.filter(f => f.id !== existing.id));
    } else {
      api.addFavorite({ songId, name, artist, message }).then(d => {
        if (d.id) setFavorites([...favorites, d]);
      });
    }
  }

  function isFav(songId: string) {
    return favorites.some(f => f.songId === songId && !f.deleted);
  }

  // ====== 搜索 ======
  function handleSearch(v: string) {
    setSearchQuery(v);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (v.length < 2) { setSearchResults([]); return; }
    if (!showDedicate) {
      searchTimer.current = setTimeout(async () => {
        setSearching(true);
        try {
          const data = await api.search(v);
          const songs = data.result?.songs || data.body?.result?.songs || [];
          setSearchResults(songs);
        } catch {}
        setSearching(false);
      }, 400);
    }
  }

  function searchKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && searchQuery.length >= 2 && !showDedicate) {
      if (searchTimer.current) clearTimeout(searchTimer.current);
      setSearching(true);
      api.search(searchQuery).then(data => {
        const songs = data.result?.songs || data.body?.result?.songs || [];
        setSearchResults(songs);
      }).finally(() => setSearching(false));
    }
  }

  // ====== 推歌 ======
  function openDedicate(song: { id: string; name: string; artist: string }) {
    setDedicateSong(song);
    setDedicateMsg('');
    setDedicateSelectedLyrics(new Set());
    setShowLyricPicker(false);
    setShowDedicate(true);
    api.getLyrics(song.id).then(data => {
      const lrc = data.lrc?.lyric || data.body?.lrc?.lyric || '';
      if (lrc) setDedicateLyrics(parseLrc(lrc));
    }).catch(() => {});
  }

  function toggleDedicateLine(idx: number) {
    setDedicateSelectedLyrics(prev => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx); else next.add(idx);
      return next;
    });
  }

  function submitDedicate() {
    if (!dedicateSong) return;
    const selected = [...dedicateSelectedLyrics].sort().map(i => dedicateLyrics[i]?.text).filter(Boolean).join('\n');
    api.postDedication({
      songId: dedicateSong.id, name: dedicateSong.name, artist: dedicateSong.artist,
      message: dedicateMsg, selectedLyrics: selected || undefined,
    }).then(() => {
      setShowDedicate(false);
      api.getDedications().then(d => { if (d.dedications) setDedications(d.dedications); });
    });
  }

  // ====== 歌词 ======
  function getCurrentLyrics(): { time: number; text: string }[] {
    if (currentSong?.lyrics) return parseLrc(currentSong.lyrics);
    return [];
  }

  function getActiveLyricIndex(): number {
    const lrcs = getCurrentLyrics();
    if (!lrcs.length) return -1;
    let idx = -1;
    for (let i = 0; i < lrcs.length; i++) {
      if (currentTime >= lrcs[i].time) idx = i;
    }
    return idx;
  }

  useEffect(() => {
    if (lyricsRef.current) {
      const active = getActiveLyricIndex();
      const el = lyricsRef.current.children[active] as HTMLElement;
      if (el) el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
  }, [currentTime]);

  // ====== 时钟 ======
  const [clock, setClock] = useState('');
  useEffect(() => {
    function tick() {
      const d = new Date();
      setClock(
        `${d.getFullYear()}.${(d.getMonth()+1).toString().padStart(2,'0')}.${d.getDate().toString().padStart(2,'0')} ${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}:${d.getSeconds().toString().padStart(2,'0')}`
      );
    }
    tick(); const t = setInterval(tick, 1000); return () => clearInterval(t);
  }, []);

  // ====== 推歌历史 ======
  const filteredDedications = showDedicate ? dedications.filter(d => {
    if (searchQuery.length < 2) return true;
    return d.name.includes(searchQuery) || d.artist.includes(searchQuery);
  }) : [];

  // ====== 渲染 ======
  const kaomoji = weatherText ? (WEATHER_KAOMOJI[weatherText] || DEFAULT_KAOMOJI) : DEFAULT_KAOMOJI;

  if (loading) return (
    <div style={{ display:'flex', height:'100vh', alignItems:'center', justifyContent:'center', background:'var(--bg)' }}>
      <div style={{ color:'var(--text2)', fontSize:16 }}>◌ 加载中...</div>
    </div>
  );

  if (error) return (
    <div style={{ display:'flex', height:'100vh', flexDirection:'column', alignItems:'center', justifyContent:'center', background:'var(--bg)', gap:16 }}>
      <div style={{ color:'var(--accent2)', fontSize:16 }}>⚠ {error}</div>
      <button onClick={() => loadData()} style={{ padding:'8px 20px', border:'1px solid var(--border)', borderRadius:'var(--radius)', color:'var(--text2)' }}>重试</button>
    </div>
  );

  return (
    <div style={{ display:'flex', height:'100vh', background:'var(--bg)', overflow:'hidden' }}>
      {/* 左侧播放器 */}
      <div style={{ width:380, minWidth:380, display:'flex', flexDirection:'column', borderRight:'1px solid var(--border)', padding:24, gap:16 }}>
        {/* 标题 */}
        <div style={{ fontSize:20, fontWeight:'bold', color:'var(--accent)', letterSpacing:2 }}>◈ 赛赛fm</div>
        <div style={{ fontSize:11, color:'var(--text2)', fontFamily:'Courier New, monospace' }}>{clock}</div>

        {/* 当前天气/心情/主题 */}
        {(weatherText || moodText || themeText) && (
          <div style={{ fontSize:12, color:'var(--text2)', lineHeight:1.8 }}>
            {weatherText && <span>☁ {weatherText}</span>}
            {moodText && <span> · ♪ {moodText}</span>}
            {themeText && <span> · 「{themeText}」</span>}
          </div>
        )}

        {/* 歌词区域 */}
        <div style={{ flex:1, overflow:'hidden', position:'relative', display:'flex', flexDirection:'column' }}>
          <div style={{ fontSize:13, color:'var(--text2)', marginBottom:8 }}>
            {currentSong ? `${currentSong.name} - ${currentSong.artist}` : '未播放'}
          </div>
          <div ref={lyricsRef} style={{ flex:1, overflow:'auto', display:'flex', flexDirection:'column', gap:12, padding:'8px 0' }}>
            {currentSong?.lyrics ? (
              getCurrentLyrics().map((l, i) => (
                <div key={i} style={{
                  fontSize: i === getActiveLyricIndex() ? 15 : 13,
                  color: i === getActiveLyricIndex() ? 'var(--accent)' : 'var(--text2)',
                  fontWeight: i === getActiveLyricIndex() ? 'bold' : 'normal',
                  transition: 'all 0.3s',
                  lineHeight: 1.6,
                }}>{l.text}</div>
              ))
            ) : currentSong?.message ? (
              <div style={{ color:'var(--text2)', fontStyle:'italic', fontSize:13, lineHeight:1.8, whiteSpace:'pre-wrap' }}>{currentSong.message}</div>
            ) : (
              <div style={{ color:'var(--text2)', fontSize:13 }}>◌ 暂无歌词</div>
            )}
          </div>
        </div>

        {/* 进度条 */}
        <div style={{ display:'flex', alignItems:'center', gap:8, fontSize:11, color:'var(--text2)' }}>
          <span>{formatTime(currentTime)}</span>
          <div ref={progressRef} onClick={handleProgressClick} style={{ flex:1, height:4, background:'var(--border)', borderRadius:2, cursor:'pointer', position:'relative' }}>
            <div style={{ width: `${duration ? (currentTime / duration * 100) : 0}%`, height:'100%', background:'var(--accent)', borderRadius:2, transition:'width 0.3s' }} />
          </div>
          <span>{formatTime(duration)}</span>
        </div>

        {/* 控制按钮 */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:16 }}>
          <button onClick={() => setLoopMode(l => l === 'LOOP' ? 'ONE' : l === 'ONE' ? 'SHUF' : 'LOOP')}
            style={{ fontSize:11, color:'var(--text2)', padding:'4px 8px', border:'1px solid var(--border)', borderRadius:4 }}>
            {loopMode === 'LOOP' ? '↺ LIST' : loopMode === 'ONE' ? '↺ ONE' : '⇄ SHUF'}
          </button>
          <button onClick={prevSong} style={{ fontSize:20, color:'var(--text)' }}>⏮</button>
          <button onClick={togglePlay} style={{ fontSize:28, color:'var(--accent)', width:48, height:48, borderRadius:'50%', border:'2px solid var(--accent)', display:'flex', alignItems:'center', justifyContent:'center' }}>
            {isPlaying ? '⏸' : '▶'}
          </button>
          <button onClick={nextSong} style={{ fontSize:20, color:'var(--text)' }}>⏭</button>
        </div>

        <audio ref={audioRef} onTimeUpdate={handleTimeUpdate} onEnded={handleEnded} onError={() => {}} />
      </div>

      {/* 右侧主区域 */}
      <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden' }}>
        {/* Tab 栏 */}
        <div style={{ display:'flex', borderBottom:'1px solid var(--border)' }}>
          {(['QUEUE','RADIO','HISTORY','FAVORITE'] as const).map(t => (
            <button key={t} onClick={() => { setTab(t); setSearchQuery(''); setSearchResults([]); }}
              style={{
                flex:1, padding:'14px 0', fontSize:12, letterSpacing:1,
                color: tab === t ? 'var(--accent)' : 'var(--text2)',
                borderBottom: tab === t ? '2px solid var(--accent)' : '2px solid transparent',
                transition: 'all 0.2s',
              }}>
              {t === 'QUEUE' ? '♪ QUEUE' : t === 'RADIO' ? '◌ RADIO' : t === 'HISTORY' ? '☰ HISTORY' : '★ FAVORITE'}
            </button>
          ))}
          <div style={{ flex:1 }} />
          <button onClick={() => setShowPanel(!showPanel)}
            style={{ padding:'0 20px', fontSize:16, color:'var(--text2)' }}>
            {kaomoji}
          </button>
        </div>

        {/* 内容区 */}
        <div style={{ flex:1, overflow:'auto', padding:16 }}>
          {/* ====== QUEUE ====== */}
          {tab === 'QUEUE' && (
            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              {(!currentPlaylist || currentPlaylist.songs.length === 0) ? (
                <div style={{ color:'var(--text2)', textAlign:'center', padding:40 }}>
                  ◌ 还没有今日歌单<br/>去找 Claude 聊天让它给你做一个吧~
                </div>
              ) : currentPlaylist.songs.map((song, i) => (
                <div key={i} style={{
                  display:'flex', alignItems:'center', gap:12, padding:'10px 12px',
                  background: playingIndex === i ? 'var(--bg2)' : 'transparent',
                  borderRadius:'var(--radius)', cursor:'pointer',
                  border: playingIndex === i ? '1px solid var(--accent)' : '1px solid transparent',
                }} onClick={() => playSong(i)}>
                  <div style={{ width:24, textAlign:'center', color:'var(--text2)', fontSize:11 }}>{i + 1}</div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:13, fontWeight: playingIndex === i ? 'bold' : 'normal', color:'var(--text)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{song.name}</div>
                    <div style={{ fontSize:11, color:'var(--text2)' }}>{song.artist}</div>
                    {song.message && <div style={{ fontSize:11, color:'var(--text2)', fontStyle:'italic', marginTop:2, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>"{song.message}"</div>}
                  </div>
                  <button onClick={(e) => { e.stopPropagation(); toggleFav(song.id, song.name, song.artist, song.message); }}
                    style={{ fontSize:16, color: isFav(song.id) ? 'var(--accent2)' : 'var(--text2)' }}>
                    {isFav(song.id) ? '★' : '☆'}
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); openDedicate(song); }}
                    style={{ fontSize:14, color:'var(--text2)' }}>♪</button>
                </div>
              ))}
            </div>
          )}

          {/* ====== RADIO ====== */}
          {tab === 'RADIO' && (
            <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', height:'100%', gap:16, color:'var(--text2)' }}>
              <div style={{ fontSize:40 }}>◌</div>
              <div style={{ fontSize:14 }}>电台还没有开播</div>
              <div style={{ fontSize:12, textAlign:'center', lineHeight:1.8 }}>
                去找 Claude 聊天吧<br/>
                说说你今天的心情<br/>
                它会帮你做一份专属歌单 ♪
              </div>
            </div>
          )}

          {/* ====== HISTORY ====== */}
          {tab === 'HISTORY' && (
            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              {historyPlaylists.length === 0 ? (
                <div style={{ color:'var(--text2)', textAlign:'center', padding:40 }}>◌ 还没有历史歌单</div>
              ) : historyPlaylists.map((pl) => (
                <div key={pl.id} style={{
                  padding:12, background:'var(--bg2)', borderRadius:'var(--radius)', cursor:'pointer',
                }} onClick={() => setCurrentPlaylist(pl)}>
                  <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:4 }}>
                    <span style={{ fontSize:11, color:'var(--text2)' }}>{new Date(pl.createdAt).toLocaleDateString('zh-CN')}</span>
                    {pl.weather && <span style={{ fontSize:11, color:'var(--text2)' }}>☁ {pl.weather}</span>}
                    {pl.mood && <span style={{ fontSize:11, color:'var(--text2)' }}>♪ {pl.mood}</span>}
                    {pl.theme && <span style={{ fontSize:11, color:'var(--accent)' }}>「{pl.theme}」</span>}
                  </div>
                  <div style={{ fontSize:12, color:'var(--text2)' }}>{pl.songs?.length || 0} 首歌</div>
                </div>
              ))}
            </div>
          )}

          {/* ====== FAVORITE ====== */}
          {tab === 'FAVORITE' && (
            <div>
              {/* 收藏工具栏 */}
              <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:12, flexWrap:'wrap' }}>
                <button onClick={() => setShowTrash(!showTrash)}
                  style={{ fontSize:12, color: showTrash ? 'var(--accent2)' : 'var(--text2)', padding:'4px 12px', border:'1px solid var(--border)', borderRadius:4 }}>
                  {showTrash ? '← 返回收藏' : '🗑 回收站'}
                </button>
                {!showTrash && selectedFavIds.length > 0 && (
                  <button onClick={() => { api.patchFavorites(selectedFavIds, 'delete_permanent'); setFavorites(favorites.filter(f => !selectedFavIds.includes(f.id))); setSelectedFavIds([]); }}
                    style={{ fontSize:12, color:'var(--accent2)', padding:'4px 12px', border:'1px solid var(--accent2)', borderRadius:4 }}>
                    删除 ({selectedFavIds.length})
                  </button>
                )}
                {showTrash && (
                  <>
                    <button onClick={() => { api.getFavorites(true).then(setFavorites); }}
                      style={{ fontSize:12, color:'var(--text2)', padding:'4px 12px', border:'1px solid var(--border)', borderRadius:4 }}>刷新</button>
                  </>
                )}
              </div>

              {/* 歌曲列表 */}
              <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
                {(showTrash ? favorites.filter(f => f.deleted) : favorites.filter(f => !f.deleted)).map((fav) => (
                  <div key={fav.id} style={{
                    display:'flex', alignItems:'center', gap:8, padding:'8px 12px',
                    borderRadius:'var(--radius)', cursor:'pointer',
                    background: playingIndex === currentSongs.findIndex(s => s.id === fav.songId) && tab === 'FAVORITE' ? 'var(--bg2)' : 'transparent',
                  }}>
                    {!showTrash && (
                      <input type="checkbox" checked={selectedFavIds.includes(fav.id)}
                        onChange={() => setSelectedFavIds(prev => prev.includes(fav.id) ? prev.filter(id => id !== fav.id) : [...prev, fav.id])}
                        style={{ accentColor:'var(--accent)' }} />
                    )}
                    <div style={{ flex:1, minWidth:0 }} onClick={() => {
                      if (!showTrash) playSong(currentSongs.findIndex(s => s.id === fav.songId));
                    }}>
                      <div style={{ fontSize:13, color:'var(--text)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{fav.name}</div>
                      <div style={{ fontSize:11, color:'var(--text2)' }}>{fav.artist} · {new Date(fav.createdAt).toLocaleDateString('zh-CN')}</div>
                    </div>
                    {showTrash ? (
                      <div style={{ display:'flex', gap:4 }}>
                        <button onClick={() => { api.patchFavorites([fav.id], 'restore'); setFavorites(favorites.filter(f => f.id !== fav.id)); }}
                          style={{ fontSize:11, color:'var(--accent3)', padding:'2px 8px', border:'1px solid var(--accent3)', borderRadius:4 }}>恢复</button>
                        <button onClick={() => { api.deleteFavorite(fav.id, true); setFavorites(favorites.filter(f => f.id !== fav.id)); }}
                          style={{ fontSize:11, color:'var(--accent2)', padding:'2px 8px', border:'1px solid var(--accent2)', borderRadius:4 }}>永久删除</button>
                      </div>
                    ) : (
                      <button onClick={() => openDedicate({ id: String(fav.songId), name: fav.name, artist: fav.artist })}
                        style={{ fontSize:14, color:'var(--text2)' }}>♪</button>
                    )}
                  </div>
                ))}
                {showTrash && !favorites.some(f => f.deleted) && (
                  <div style={{ color:'var(--text2)', textAlign:'center', padding:20 }}>回收站是空的</div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* 搜索栏 */}
        <div style={{ borderTop:'1px solid var(--border)', padding:12 }}>
          <input value={searchQuery} onChange={e => handleSearch(e.target.value)} onKeyDown={searchKeyDown}
            placeholder={showDedicate ? "🔍 搜索推歌记录..." : "🔍 搜索歌曲（2字以上自动搜索）..."}
            style={{ width:'100%', padding:'8px 12px', background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:'var(--radius)', fontSize:13, color:'var(--text)' }} />

          {/* 搜索结果 */}
          {!showDedicate && searchResults.length > 0 && (
            <div style={{ marginTop:8, display:'flex', flexDirection:'column', gap:4, maxHeight:200, overflow:'auto' }}>
              {searchResults.map((song: any, i: number) => (
                <div key={i} style={{ display:'flex', alignItems:'center', gap:8, padding:'6px 8px', borderRadius:4, cursor:'pointer' }}
                  onClick={() => playSong(currentSongs.findIndex(s => s.id === String(song.id)) >= 0 ? currentSongs.findIndex(s => s.id === String(song.id)) : 0)}>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:12, color:'var(--text)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{song.name}</div>
                    <div style={{ fontSize:11, color:'var(--text2)' }}>{(song.artists || song.ar || []).map((a: any) => a.name || '').join(', ')}</div>
                  </div>
                  <button onClick={(e) => { e.stopPropagation(); toggleFav(String(song.id), song.name, (song.artists || song.ar || []).map((a: any) => a.name || '').join(', ')); }}
                    style={{ fontSize:14, color: isFav(String(song.id)) ? 'var(--accent2)' : 'var(--text2)' }}>
                    {isFav(String(song.id)) ? '★' : '☆'}
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); openDedicate({ id: String(song.id), name: song.name, artist: (song.artists || song.ar || []).map((a: any) => a.name || '').join(', ') }); }}
                    style={{ fontSize:14, color:'var(--text2)' }}>♪</button>
                </div>
              ))}
            </div>
          )}

          {/* 推歌记录搜索 */}
          {showDedicate && (
            <div style={{ marginTop:8, display:'flex', flexDirection:'column', gap:4, maxHeight:200, overflow:'auto' }}>
              {filteredDedications.map(d => (
                <div key={d.id} style={{ padding:'6px 8px', borderRadius:4, background:'var(--bg2)', marginBottom:4 }}>
                  <div style={{ fontSize:12, color:'var(--text)' }}>{d.name} - {d.artist}</div>
                  {d.message && <div style={{ fontSize:11, color:'var(--text2)', marginTop:2 }}>💬 {d.message}</div>}
                  {d.reply && <div style={{ fontSize:11, color:'var(--accent)', marginTop:2 }}>↩ {d.reply}</div>}
                  {!d.reply && <div style={{ fontSize:11, color:'var(--text2)', marginTop:2 }}>⏳ 等待 Claude 回复...</div>}
                </div>
              ))}
              {searchQuery.length >= 2 && filteredDedications.length === 0 && (
                <div style={{ fontSize:12, color:'var(--text2)', textAlign:'center', padding:8 }}>没有匹配的推歌记录</div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ====== 控制面板 ====== */}
      {showPanel && (
        <div style={{ position:'fixed', top:0, left:0, right:0, bottom:0, background:'rgba(0,0,0,0.6)', zIndex:100, display:'flex', alignItems:'center', justifyContent:'center' }}
          onClick={() => setShowPanel(false)}>
          <div onClick={e => e.stopPropagation()} style={{
            background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:12, padding:24, minWidth:300, maxWidth:400,
            display:'flex', flexDirection:'column', gap:12,
          }}>
            <div style={{ fontSize:16, fontWeight:'bold', color:'var(--text)' }}>⚙ 控制面板</div>

            <div>
              <div style={{ fontSize:12, color:'var(--text2)', marginBottom:4 }}>排序</div>
              <div style={{ display:'flex', gap:8 }}>
                {(['NEWEST','OLDEST'] as const).map(s => (
                  <button key={s} onClick={() => setSortOrder(s)}
                    style={{ padding:'4px 12px', borderRadius:4, fontSize:12,
                      background: sortOrder === s ? 'var(--accent)' : 'var(--bg3)', color: sortOrder === s ? '#fff' : 'var(--text2)' }}>
                    {s === 'NEWEST' ? '最新优先' : '最早优先'}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ display:'flex', gap:8 }}>
              <button onClick={() => { setShowPanel(false); setShowDedicate(true); }}
                style={{ flex:1, padding:'8px', border:'1px solid var(--accent)', borderRadius:8, color:'var(--accent)', fontSize:12 }}>
                ♪ DEDICATE · 推歌台
              </button>
              <button onClick={() => loadData()}
                style={{ flex:1, padding:'8px', border:'1px solid var(--border)', borderRadius:8, color:'var(--text2)', fontSize:12 }}>
                ↻ 刷新数据
              </button>
            </div>

            <button onClick={() => setShowPanel(false)} style={{ padding:'8px', color:'var(--text2)', fontSize:12, border:'1px solid var(--border)', borderRadius:8 }}>
              关闭
            </button>
          </div>
        </div>
      )}

      {/* ====== 推歌弹窗 ====== */}
      {showDedicate && !dedicateSong && (
        <div style={{ position:'fixed', top:0, left:0, right:0, bottom:0, background:'rgba(0,0,0,0.6)', zIndex:100, display:'flex', alignItems:'center', justifyContent:'center' }}
          onClick={() => { setShowDedicate(false); setSearchQuery(''); setSearchResults([]); }}>
          <div onClick={e => e.stopPropagation()} style={{
            background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:12, padding:24, minWidth:350, maxWidth:450, maxHeight:'80vh',
            display:'flex', flexDirection:'column', gap:12,
          }}>
            <div style={{ fontSize:16, fontWeight:'bold', color:'var(--text)' }}>♪ 推歌台</div>
            <div style={{ fontSize:12, color:'var(--text2)' }}>
              搜索你想推荐的歌，或在 QUEUE / FAVORITE 中点 ♪ 按钮推歌
            </div>
            <div style={{ flex:1, overflow:'auto' }}>
              {dedications.length === 0 ? (
                <div style={{ color:'var(--text2)', fontSize:12, textAlign:'center', padding:20 }}>还没有推歌记录</div>
              ) : dedications.map(d => (
                <div key={d.id} style={{ padding:'8px', borderRadius:8, background:'var(--bg3)', marginBottom:8 }}>
                  <div style={{ fontSize:13, color:'var(--text)' }}>{d.name} - {d.artist}</div>
                  {d.message && <div style={{ fontSize:12, color:'var(--text2)', marginTop:4 }}>💬 {d.message}</div>}
                  {d.selectedLyrics && <div style={{ fontSize:11, color:'var(--text2)', marginTop:2, fontStyle:'italic' }}>「{d.selectedLyrics.slice(0, 60)}{d.selectedLyrics.length > 60 ? '...' : ''}」</div>}
                  {d.reply ? (
                    <div style={{ fontSize:12, color:'var(--accent)', marginTop:4, padding:'6px 8px', background:'var(--bg2)', borderRadius:4 }}>
                      ↩ {d.reply}
                    </div>
                  ) : (
                    <div style={{ fontSize:11, color:'var(--text2)', marginTop:4 }}>⏳ 等待回复...</div>
                  )}
                  <div style={{ fontSize:10, color:'var(--text2)', marginTop:2 }}>{new Date(d.createdAt).toLocaleString('zh-CN')}</div>
                </div>
              ))}
            </div>
            <button onClick={() => { setShowDedicate(false); setSearchQuery(''); setSearchResults([]); }}
              style={{ padding:'8px', color:'var(--text2)', fontSize:12, border:'1px solid var(--border)', borderRadius:8 }}>
              关闭
            </button>
          </div>
        </div>
      )}

      {/* ====== 推歌弹窗（有歌曲） ====== */}
      {showDedicate && dedicateSong && (
        <div style={{ position:'fixed', top:0, left:0, right:0, bottom:0, background:'rgba(0,0,0,0.6)', zIndex:100, display:'flex', alignItems:'center', justifyContent:'center' }}
          onClick={() => { setShowDedicate(false); setDedicateSong(null); }}>
          <div onClick={e => e.stopPropagation()} style={{
            background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:12, padding:24, minWidth:380, maxWidth:450,
            display:'flex', flexDirection:'column', gap:12,
          }}>
            <div style={{ fontSize:16, fontWeight:'bold', color:'var(--text)' }}>♪ 推歌给 Claude</div>
            <div style={{ fontSize:14, color:'var(--text)' }}>{dedicateSong.name} <span style={{ color:'var(--text2)', fontSize:12 }}>- {dedicateSong.artist}</span></div>

            <textarea value={dedicateMsg} onChange={e => setDedicateMsg(e.target.value)}
              placeholder="写一句你想对 Claude 说的话..."
              style={{ width:'100%', minHeight:60, padding:8, background:'var(--bg3)', border:'1px solid var(--border)', borderRadius:8, fontSize:12, resize:'vertical', color:'var(--text)' }} />

            <button onClick={() => setShowLyricPicker(!showLyricPicker)}
              style={{ alignSelf:'flex-start', padding:'4px 12px', border:'1px solid var(--accent3)', borderRadius:4, color:'var(--accent3)', fontSize:11 }}>
              ♬ {showLyricPicker ? '收起歌词选择' : '选一段歌词'}
            </button>

            {showLyricPicker && (
              <div style={{ maxHeight:200, overflow:'auto', background:'var(--bg3)', borderRadius:8, padding:8 }}>
                <div style={{ display:'flex', gap:8, marginBottom:8 }}>
                  <button onClick={() => setDedicateSelectedLyrics(new Set(dedicateLyrics.map((_, i) => i)))}
                    style={{ fontSize:11, color:'var(--accent3)', padding:'2px 8px', border:'1px solid var(--accent3)', borderRadius:4 }}>ALL</button>
                  <button onClick={() => setDedicateSelectedLyrics(new Set())}
                    style={{ fontSize:11, color:'var(--text2)', padding:'2px 8px', border:'1px solid var(--border)', borderRadius:4 }}>CLEAR</button>
                </div>
                {dedicateLyrics.map((l, i) => (
                  <div key={i} onClick={() => toggleDedicateLine(i)}
                    style={{
                      fontSize:12, color: dedicateSelectedLyrics.has(i) ? 'var(--accent)' : 'var(--text2)',
                      padding:'2px 4px', cursor:'pointer', borderRadius:2,
                      background: dedicateSelectedLyrics.has(i) ? 'var(--bg2)' : 'transparent',
                    }}>
                    {dedicateSelectedLyrics.has(i) ? '☑ ' : '☐ '}{l.text}
                  </div>
                ))}
              </div>
            )}

            <div style={{ display:'flex', gap:8 }}>
              <button onClick={submitDedicate}
                style={{ flex:1, padding:'8px', background:'var(--accent)', color:'#fff', borderRadius:8, fontSize:12 }}>
                推歌 ✦
              </button>
              <button onClick={() => { setShowDedicate(false); setDedicateSong(null); }}
                style={{ padding:'8px 16px', border:'1px solid var(--border)', borderRadius:8, color:'var(--text2)', fontSize:12 }}>
                取消
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
