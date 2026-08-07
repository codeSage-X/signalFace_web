// Mock data for Signal Face
// lib/types/post.ts

export type PostType = 'video' | 'image' | 'carousel' | 'text';

interface BasePost {
  id: string;
  creatorId: string;
  creatorName: string;
  avatar: string;
  verified: boolean;
  caption: string;
  hashtags?: string[];
  timestamp: string;
  likes: number;
  comments: number;
  liked: boolean;
}

export interface VideoPost extends BasePost {
  type: 'video';
  videoUrl: string;
  poster?: string;
}

export interface ImagePost extends BasePost {
  type: 'image';
  imageUrl: string;
}

export interface CarouselPost extends BasePost {
  type: 'carousel';
  images: string[];
}

export interface TextPost extends BasePost {
  type: 'text';
  content: string;
  bgGradient?: string;
}

export type Post = VideoPost | ImagePost | CarouselPost | TextPost;

export interface Comment {
  id: string;
  author: string;
  avatar: string;
  text: string;
  timestamp: string;
  likes: number;
}

// lib/mock.ts

// Post and Comment are defined above in this file

// Public sample videos (Google's test bucket) - safe to use as placeholders
const SAMPLE_VIDEOS = [
  'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
  'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
  'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',
];

const SAMPLE_IMAGES = [
  'https://picsum.photos/seed/signal1/720/1280',
  'https://picsum.photos/seed/signal2/720/1280',
  'https://picsum.photos/seed/signal3/720/1280',
  'https://picsum.photos/seed/signal4/720/1280',
];

export const mockPosts: Post[] = [
  {
    id: 'p1',
    type: 'video',
    creatorId: 'u1',
    creatorName: 'kamthephotographer_',
    avatar: '📸',
    verified: true,
    caption: "You're asking me if I'm the jealous type.",
    hashtags: ['fyp', 'relatable', 'trending', 'redflags'],
    timestamp: '2h ago',
    likes: 82800,
    comments: 512,
    liked: false,
    videoUrl: SAMPLE_VIDEOS[0],
  },
  {
    id: 'p2',
    type: 'text',
    creatorId: 'u2',
    creatorName: 'nightowl.codes',
    avatar: '🌙',
    verified: false,
    caption: 'unpopular opinion',
    hashtags: ['hottake', 'dev'],
    timestamp: '4h ago',
    likes: 1204,
    comments: 88,
    liked: false,
    content: 'Shipping something imperfect today beats shipping something perfect never.',
    bgGradient: 'linear-gradient(135deg,#7c3aed,#db2777)',
  },
  {
    id: 'p3',
    type: 'image',
    creatorId: 'u3',
    creatorName: 'zaraexplores',
    avatar: '🌍',
    verified: true,
    caption: 'Golden hour never misses',
    hashtags: ['travel', 'sunset'],
    timestamp: '6h ago',
    likes: 34210,
    comments: 210,
    liked: true,
    imageUrl: SAMPLE_IMAGES[0],
  },
  {
    id: 'p4',
    type: 'carousel',
    creatorId: 'u4',
    creatorName: 'studio.wisdom',
    avatar: '🎨',
    verified: false,
    caption: 'Swipe for the process →',
    hashtags: ['design', 'process'],
    timestamp: '8h ago',
    likes: 9520,
    comments: 143,
    liked: false,
    images: [SAMPLE_IMAGES[1], SAMPLE_IMAGES[2], SAMPLE_IMAGES[3]],
  },
  {
    id: 'p5',
    type: 'video',
    creatorId: 'u5',
    creatorName: 'escobar.btb',
    avatar: '🔥',
    verified: true,
    caption: 'Saturday nights hit different',
    hashtags: ['nightlife', 'portharcourt'],
    timestamp: '10h ago',
    likes: 45900,
    comments: 890,
    liked: false,
    videoUrl: SAMPLE_VIDEOS[1],
  },
];

export const mockComments: Record<string, Comment[]> = {
  p1: [
    { id: 'c1', author: 'ada_b', avatar: '🙂', text: 'lmaooo this is so real', timestamp: '1h', likes: 12 },
    { id: 'c2', author: 'timi.k', avatar: '😂', text: 'the way i felt this in my soul', timestamp: '45m', likes: 4 },
  ],
  p3: [
    { id: 'c3', author: 'lena_v', avatar: '🌸', text: 'the colors!! 😍', timestamp: '3h', likes: 20 },
  ],
};
export const mockCreators = [
  { id: '1', name: 'King Jay', avatar: '👨‍🎤', category: 'Music', followers: 125000, signalPrice: 12.45, change24h: 18.5, verified: true },
  { id: '2', name: 'Ella Vibes', avatar: '👩‍🎨', category: 'Lifestyle', followers: 95000, signalPrice: 8.32, change24h: 12.7, verified: true },
  { id: '3', name: 'Crypto Sage', avatar: '🧙‍♂️', category: 'Education', followers: 75000, signalPrice: 6.91, change24h: 9.3, verified: true },
  { id: '4', name: 'Nova Tech', avatar: '🤖', category: 'Technology', followers: 60000, signalPrice: 5.23, change24h: 7.1, verified: true },
  { id: '5', name: 'Maya Moments', avatar: '🎬', category: 'Vlog', followers: 50000, signalPrice: 4.12, change24h: 6.3, verified: true },
  { id: '6', name: 'Future Assets', avatar: '💼', category: 'Finance', followers: 45000, signalPrice: 3.45, change24h: 3.5, verified: false },
];

export const mockSignals = [
  { id: '1', name: 'Starter Signal', price: 0.1, potentialValue: 22, badge: 'users', category: 'early', supply: 1000000 },
  { id: '2', name: 'Growth Signal', price: 0.5, potentialValue: 125, badge: 'trending-up', category: 'growth', supply: 1000000 },
  { id: '3', name: 'Influence Signal', price: 1.0, potentialValue: 300, badge: 'star', category: 'influence', supply: 1000000 },
  { id: '4', name: 'Creator Signal', price: 2.5, potentialValue: 850, badge: 'crown', category: 'creator', supply: 1000000 },
  { id: '5', name: 'Legend Signal', price: 5.0, potentialValue: 1800, badge: 'gem', category: 'legend', supply: 1000000 },
  { id: '6', name: 'Visionary Signal', price: 10.0, potentialValue: 5000, badge: 'rocket', category: 'visionary', supply: 1000000 },
];

export const mockRealms = [
  { id: '1', name: 'Afrobeats Realm', image: '🔴', members: 24560, gradient: 'from-red-600 to-pink-600' },
  { id: '2', name: 'AI & Tech Realm', image: '🔵', members: 18700, gradient: 'from-blue-600 to-cyan-600' },
  { id: '3', name: 'Crypto Realm', image: '🟠', members: 32100, gradient: 'from-orange-600 to-yellow-600' },
  { id: '4', name: 'Fashion Realm', image: '🟣', members: 15300, gradient: 'from-purple-600 to-pink-600' },
  { id: '5', name: 'Gaming Realm', image: '🟢', members: 28900, gradient: 'from-green-600 to-emerald-600' },
  { id: '6', name: 'Web3 Realm', image: '🟡', members: 21400, gradient: 'from-yellow-600 to-orange-600' },
];

export const mockRewards = [
  { id: '1', title: 'Daily Check-in', points: 50, frequency: 'daily', completed: true },
  { id: '2', title: 'Watch Video', points: 100, frequency: 'weekly', completed: false },
  { id: '3', title: 'Invite a Friend', points: 250, frequency: 'one-time', completed: false },
  { id: '4', title: 'Trade Signals', points: 75, frequency: 'daily', completed: false },
  { id: '5', title: 'Create Post', points: 150, frequency: 'daily', completed: false },
];

export const mockActivity = [
  { id: '1', action: 'You bought King Jay Signal', timestamp: '2h ago', points: '+10.5' },
  { id: '2', action: 'You sold AI & Tech Realm Signal', timestamp: '15m ago', points: '-5.2' },
  { id: '3', action: 'Ella Vibes signal price increased', timestamp: '1h ago', points: '+12.7' },
  { id: '4', action: 'You earned 50 NXR Rewards', timestamp: '2h ago', points: '+50' },
  { id: '5', action: 'Crypto Sage joined your realm', timestamp: '3h ago', points: '+5' },
];


// Generate price history for charts
export const generatePriceHistory = (initialPrice: number, days: number = 30) => {
  const data = [];
  let price = initialPrice;
  for (let i = 0; i < days; i++) {
    const change = (Math.random() - 0.5) * 0.2;
    price = Math.max(price + change, initialPrice * 0.5);
    data.push({
      date: new Date(Date.now() - (days - i) * 24 * 60 * 60 * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      price: parseFloat(price.toFixed(2)),
    });
  }
  return data;
};

// Friends list
export const mockFriends = [
  { id: '1', name: 'King Jay', avatar: '👨‍🎤', username: '@kingjay', followers: 125000, isFollowing: true },
  { id: '2', name: 'Ella Vibes', avatar: '👩‍🎨', username: '@ellavibes', followers: 95000, isFollowing: true },
  { id: '3', name: 'Crypto Sage', avatar: '🧙‍♂️', username: '@cryptosage', followers: 75000, isFollowing: false },
  { id: '4', name: 'Nova Tech', avatar: '🤖', username: '@novatech', followers: 60000, isFollowing: true },
  { id: '5', name: 'Maya Moments', avatar: '🎬', username: '@mayamoments', followers: 50000, isFollowing: false },
  { id: '6', name: 'Future Assets', avatar: '💼', username: '@futureassets', followers: 45000, isFollowing: true },
];

// Followers list
export const mockFollowers = [
  { id: '101', name: 'Alex Designer', avatar: '🎨', username: '@alexdesigner', followers: 8900 },
  { id: '102', name: 'Jordan Dev', avatar: '👨‍💻', username: '@jordandev', followers: 12400 },
  { id: '103', name: 'Sam Creator', avatar: '📸', username: '@samcreator', followers: 6700 },
  { id: '104', name: 'Chris Music', avatar: '🎵', username: '@chrismusic', followers: 45000 },
  { id: '105', name: 'Taylor Artist', avatar: '🖼️', username: '@taylorartist', followers: 23000 },
  { id: '106', name: 'Morgan Writer', avatar: '✍️', username: '@morganwriter', followers: 18900 },
];

// Market data
export const marketData = {
  totalMarketValue: 124560789,
  change24h: 24.56,
  signals: 1250000,
  traders: 89700,
  volume: 18600000,
  realms: 312,
};
