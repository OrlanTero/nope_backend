import { IsBoolean } from 'class-validator';

export class FollowDto {
  @IsBoolean()
  on!: boolean;
}
