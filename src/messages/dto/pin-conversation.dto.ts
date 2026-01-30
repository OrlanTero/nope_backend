import { IsBoolean } from 'class-validator';

export class PinConversationDto {
  @IsBoolean()
  pinned!: boolean;
}
