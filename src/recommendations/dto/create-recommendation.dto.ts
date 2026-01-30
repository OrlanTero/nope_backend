import { IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateRecommendationDto {
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  body?: string;

  @IsOptional()
  @IsString()
  gifUrl?: string;
}
