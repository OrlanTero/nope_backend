import { IsInt, IsOptional, Min } from 'class-validator';

export class MuteConversationDto {
  @IsOptional()
  @IsInt()
  @Min(0)
  muteForSeconds?: number;
}
