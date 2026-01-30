import { IsIn, IsOptional, IsString } from 'class-validator';

export class CreatePostDto {
  @IsIn(['photo', 'video'])
  kind: 'photo' | 'video';

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  hashtags?: string;

  @IsOptional()
  @IsIn(['everyone', 'friends', 'onlyYou'])
  privacy?: 'everyone' | 'friends' | 'onlyYou';

  @IsOptional()
  @IsString()
  trackTitle?: string;

  @IsOptional()
  @IsString()
  trackId?: string;

  @IsOptional()
  @IsString()
  trackArtist?: string;

  @IsOptional()
  @IsString()
  trackArtworkUrl?: string;

  @IsOptional()
  @IsString()
  trackPreviewUrl?: string;

  @IsOptional()
  @IsString()
  trackDurationMs?: string;

  @IsOptional()
  @IsString()
  allowComments?: string;

  @IsOptional()
  @IsString()
  allowReuse?: string;

  @IsOptional()
  @IsString()
  allowStitch?: string;

  @IsOptional()
  @IsString()
  allowStickers?: string;

  @IsOptional()
  @IsString()
  addToStory?: string;

  @IsOptional()
  @IsString()
  schedulePost?: string;

  @IsOptional()
  @IsString()
  scheduledAt?: string;

  @IsOptional()
  @IsString()
  aiGeneratedContent?: string;

  @IsOptional()
  @IsString()
  autoCheckSoundCopyright?: string;

  @IsOptional()
  @IsString()
  allowVisualSearch?: string;

  @IsOptional()
  @IsString()
  allowHighQualityUploads?: string;

  @IsOptional()
  @IsString()
  saveToDevice?: string;
}
