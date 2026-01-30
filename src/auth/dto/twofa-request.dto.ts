import { IsBoolean } from 'class-validator';

export class TwoFaRequestDto {
  @IsBoolean()
  on!: boolean;
}
