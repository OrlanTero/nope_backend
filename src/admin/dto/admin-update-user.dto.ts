import { IsBoolean, IsOptional } from 'class-validator';

export class AdminUpdateUserDto {
  @IsOptional()
  @IsBoolean()
  emailVerified?: boolean;

  @IsOptional()
  @IsBoolean()
  profileVerified?: boolean;

  @IsOptional()
  @IsBoolean()
  profileSet?: boolean;
}
