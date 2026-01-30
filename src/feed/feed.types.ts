export type TrackType = 'photo' | 'video';

export type FeedTrack = {
  id: string;
  type: TrackType;
  imageUrl: string;
  imageUrls?: string[];
  videoUrl?: string;
  coverUrl?: string;
  trackTitle?: string;
  trackId?: string;
  trackArtist?: string;
  trackArtworkUrl?: string;
  trackPreviewUrl?: string;
  trackDurationMs?: number;
  creatorId?: string;
  creatorDisplayName?: string;
  creatorAvatarUrl?: string;
  repostedById?: string;
  repostedByDisplayName?: string;
  repostedByAvatarUrl?: string;
  isReposted?: boolean;
  description?: string;
  createdAt: string;
  myVerdict?: 'DOPE' | 'NOPE';
  dopeCount: number;
  nopeCount: number;
  commentCount: number;
};
