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