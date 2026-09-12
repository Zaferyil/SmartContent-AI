// Shared channel catalogue. `fields` drives the credential form in Settings,
// `gradient` is a Tailwind gradient used for the channel's brand accent.
export const PLATFORMS = [
  {
    id: 'instagram',
    name: 'Instagram',
    icon: '📸',
    gradient: 'from-fuchsia-500 via-pink-500 to-orange-400',
    ring: 'ring-pink-400',
    text: 'text-pink-500',
    fields: ['token', 'accountId'],
    formats: 'Feed · Story · Reels',
  },
  {
    id: 'facebook',
    name: 'Facebook',
    icon: '👍',
    gradient: 'from-blue-600 via-blue-500 to-sky-400',
    ring: 'ring-blue-400',
    text: 'text-blue-600',
    fields: ['token', 'pageId'],
    formats: 'Feed · Video · Event',
  },
  {
    id: 'tiktok',
    name: 'TikTok',
    icon: '🎬',
    gradient: 'from-cyan-400 via-slate-800 to-rose-500',
    ring: 'ring-cyan-400',
    text: 'text-cyan-500',
    fields: ['token', 'accountId'],
    formats: 'Video · Sound · Trend',
  },
  {
    id: 'twitter',
    name: 'X',
    icon: '✖️',
    gradient: 'from-slate-700 via-slate-900 to-black',
    ring: 'ring-slate-500',
    text: 'text-slate-800',
    fields: ['apiKey', 'token'],
    formats: 'Post · Thread',
  },
  {
    id: 'linkedin',
    name: 'LinkedIn',
    icon: '💼',
    gradient: 'from-sky-700 via-sky-600 to-cyan-500',
    ring: 'ring-sky-400',
    text: 'text-sky-700',
    fields: ['token', 'orgId'],
    formats: 'Post · Article',
  },
  {
    id: 'pinterest',
    name: 'Pinterest',
    icon: '📌',
    gradient: 'from-red-600 via-rose-500 to-orange-400',
    ring: 'ring-red-400',
    text: 'text-red-600',
    fields: ['token', 'accountId'],
    formats: 'Pin · Board',
  },
]

export const getPlatform = (id) => PLATFORMS.find((p) => p.id === id)

// Deterministic demo metrics so the report screen looks alive without a backend.
export const DEMO_METRICS = {
  instagram: { views: 45200, likes: 8300, comments: 1200, followers: 12400, engagement: 18.4, trend: 12.3 },
  facebook: { views: 18300, likes: 2100, comments: 380, followers: 8600, engagement: 11.2, trend: 4.1 },
  tiktok: { views: 52800, likes: 12100, comments: 2400, followers: 15800, engagement: 22.8, trend: 26.7 },
  twitter: { views: 18900, likes: 2100, comments: 890, followers: 4500, engagement: 16.8, trend: -2.4 },
  linkedin: { views: 9800, likes: 1200, comments: 450, followers: 3200, engagement: 12.4, trend: 8.9 },
  pinterest: { views: 32100, likes: 4500, comments: 200, followers: 6800, engagement: 14.1, trend: 5.6 },
}
