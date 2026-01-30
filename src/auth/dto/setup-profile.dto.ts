import { IsDateString, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class SetupProfileDto {
  @IsOptional()
  @IsString()
  displayName?: string;

  @IsOptional()
  @IsString()
  username?: string;

  @IsOptional()
  @IsString()
  firstName?: string;

  @IsOptional()
  @IsString()
  lastName?: string;

  @IsOptional()
  @IsIn(['male', 'female', 'non_binary', 'prefer_not_to_say', 'other'])
  gender?: 'male' | 'female' | 'non_binary' | 'prefer_not_to_say' | 'other';

  @IsOptional()
  @IsDateString()
  birthdate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(240)
  bio?: string;
}
