import { IsIn, IsOptional } from 'class-validator';
import type { NotificationType } from '../notification.entity';

export class MarkSeenDto {
  @IsOptional()
  @IsIn(['mention', 'repost', 'follow', 'message_request'])
  type?: NotificationType;
}
