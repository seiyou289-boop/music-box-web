import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: '赛赛电台初代目',
  description: '每天根据你的心情和天气，生成一份专属歌单',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
