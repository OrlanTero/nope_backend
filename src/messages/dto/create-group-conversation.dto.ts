import { IsArray, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class CreateGroupConversationDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  title?: string;

  @IsArray()
  @IsUUID('4', { each: true })
  participantUserIds!: string[];
}
