import { IsIn, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class SendMessageDto {
  @IsIn(['text', 'gif', 'media', 'sticker'])
  type!: 'text' | 'gif' | 'media' | 'sticker';

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  text?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  gifUrl?: string;

  @IsOptional()
  @IsUUID()
  replyToMessageId?: string;
}
