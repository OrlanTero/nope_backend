import { IsUUID } from 'class-validator';

export class ToggleSaveDto {
  @IsUUID()
  postId!: string;
}
