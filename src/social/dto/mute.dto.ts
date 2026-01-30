import { IsBoolean } from 'class-validator';

export class MuteDto {
  @IsBoolean()
  on!: boolean;
}
