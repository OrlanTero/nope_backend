import { IsOptional, IsBoolean } from 'class-validator';

export class DopeCommentDto {
  @IsOptional()
  @IsBoolean()
  on?: boolean;
}
