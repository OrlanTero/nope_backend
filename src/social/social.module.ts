import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserEntity } from '../auth/user.entity';
import { PostEntity } from '../posts/post.entity';
import { BlockEntity } from './block.entity';
import { FollowEntity } from './follow.entity';
import { ProfileMuteEntity } from './profile-mute.entity';
import { ProfileVisitEntity } from './profile-visit.entity';
import { RepostEntity } from './repost.entity';
import { SavedPostEntity } from './saved-post.entity';
import { SavedController, SocialController } from './social.controller';
import { RepostsController } from './reposts.controller';
import { SocialService } from './social.service';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      UserEntity,
      PostEntity,
      FollowEntity,
      BlockEntity,
      ProfileMuteEntity,
      ProfileVisitEntity,
      RepostEntity,
      SavedPostEntity,
    ]),
    NotificationsModule,
  ],
  controllers: [SocialController, SavedController, RepostsController],
  providers: [SocialService],
  exports: [SocialService],
})
export class SocialModule {}
