import { IsInt, IsOptional, IsString, IsUUID, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class ListRecommendationsDto {
  @IsOptional()
  @IsUUID()
  beforeId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Max(200)
  limit?: number;

  @IsOptional()
  @IsString()
  q?: string;
}
