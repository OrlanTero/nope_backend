import { IsBoolean } from 'class-validator';

export class BlockDto {
  @IsBoolean()
  on!: boolean;
}
