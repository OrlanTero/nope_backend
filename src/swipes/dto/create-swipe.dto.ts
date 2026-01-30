import { IsIn, IsString, IsUUID } from 'class-validator';

export class CreateSwipeDto {
  @IsUUID()
  trackId!: string;

  @IsString()
  @IsIn(['DOPE', 'NOPE'])
  verdict!: 'DOPE' | 'NOPE';
}
