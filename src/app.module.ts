import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { DatabaseModule } from './database/database.module';
import { FeedModule } from './feed/feed.module';
import { PostsModule } from './posts/posts.module';
import { RealtimeModule } from './realtime/realtime.module';
import { SwipesModule } from './swipes/swipes.module';
import { StorageModule } from './storage/storage.module';
import { CommentsModule } from './comments/comments.module';
import { MessagesModule } from './messages/messages.module';
import { NotificationsModule } from './notifications/notifications.module';
import { SocialModule } from './social/social.module';
import { SearchModule } from './search/search.module';
import { LeaderboardModule } from './leaderboard/leaderboard.module';
import { EmailModule } from './email/email.module';
import { TracksModule } from './tracks/tracks.module';
import { GifsModule } from './gifs/gifs.module';
import { RecommendationsModule } from './recommendations/recommendations.module';
import { AdminModule } from './admin/admin.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    DatabaseModule,
    StorageModule,
    EmailModule,
    RealtimeModule,
    AuthModule,
    FeedModule,
    PostsModule,
    SwipesModule,
    CommentsModule,
    MessagesModule,
    NotificationsModule,
    SocialModule,
    SearchModule,
    LeaderboardModule,
    TracksModule,
    GifsModule,
    RecommendationsModule,
    AdminModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
