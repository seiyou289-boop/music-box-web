// 内存存储（Vercel serverless 兼容）
const store: { playlists: any[]; favorites: any[]; dedications: any[] } = {
  playlists: [],
  favorites: [],
  dedications: [],
};

export function getStore() { return store; }
