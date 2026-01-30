export type PostKind = 'photo' | 'video';

export type PostPrivacy = 'everyone' | 'friends' | 'onlyYou';

export type Post = {
  id: string;
  kind: PostKind;
  creatorId: string;
  description: string;
  hashtags: string[];
  privacy: PostPrivacy;
  trackTitle?: string;
  trackId?: string;
  trackArtist?: string;
  trackArtworkUrl?: string;
  trackPreviewUrl?: string;
  trackDurationMs?: number;
  videoUrl?: string;
  imageUrls?: string[];
  coverUrl?: string;
  createdAt: string;
};
