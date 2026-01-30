import { IsString } from 'class-validator';

export class ToggleRepostDto {
  @IsString()
  postId!: string;
}
