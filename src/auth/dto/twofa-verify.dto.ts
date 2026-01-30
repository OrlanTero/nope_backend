import { IsBoolean, IsString, Length } from 'class-validator';

export class TwoFaVerifyDto {
  @IsBoolean()
  on!: boolean;

  @IsString()
  @Length(4, 12)
  code!: string;
}
