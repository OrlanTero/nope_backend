import { IsOptional, IsString } from 'class-validator';
import { AdminListDto } from './admin-list.dto';

export class AdminListPostsDto extends AdminListDto {
  @IsOptional()
  @IsString()
  q?: string;
}
