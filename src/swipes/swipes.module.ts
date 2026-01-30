import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RealtimeModule } from '../realtime/realtime.module';
import { UserEntity } from '../auth/user.entity';
import { PostEntity } from '../posts/post.entity';
import { SwipeEntity } from './swipe.entity';
import { SwipesController } from './swipes.controller';
import { SwipesService } from './swipes.service';

@Module({
  imports: [TypeOrmModule.forFeature([SwipeEntity, PostEntity, UserEntity]), RealtimeModule],
  controllers: [SwipesController],
  providers: [SwipesService],
})
export class SwipesModule {}
