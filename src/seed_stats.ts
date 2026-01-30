import 'reflect-metadata';

import { DataSource } from 'typeorm';
import { UserEntity } from './auth/user.entity';
import { PostEntity } from './posts/post.entity';
import { SwipeEntity } from './swipes/swipe.entity';
import { CommentEntity } from './comments/comment.entity';
import { FollowEntity } from './social/follow.entity';
import { RepostEntity } from './social/repost.entity';

function env(name: string, fallback: string) {
  return String(process.env[name] ?? fallback);
}

async function main() {
  const ds = new DataSource({
    type: 'postgres',
    host: env('DATABASE_HOST', 'localhost'),
    port: Number(env('DATABASE_PORT', '5432')),
    username: env('DATABASE_USER', 'postgres'),
    password: env('DATABASE_PASSWORD', 'postgres'),
    database: env('DATABASE_NAME', 'nope'),
    entities: [UserEntity, PostEntity, SwipeEntity, CommentEntity, FollowEntity, RepostEntity],
    synchronize: false,
  });

  await ds.initialize();

  // Posts: dope/nope
  await ds.query(
    [
      'UPDATE posts p',
      'SET',
      '  dope_counts = COALESCE(s.dope_count, 0),',
      '  nope_counts = COALESCE(s.nope_count, 0)',
      'FROM (',
      '  SELECT',
      '    "postId" AS post_id,',
      '    SUM(CASE WHEN verdict = \'DOPE\' THEN 1 ELSE 0 END)::int AS dope_count,',
      '    SUM(CASE WHEN verdict = \'NOPE\' THEN 1 ELSE 0 END)::int AS nope_count',
      '  FROM swipes',
      '  GROUP BY "postId"',
      ') s',
      'WHERE s.post_id = p.id',
    ].join(' '),
  );
  await ds.query(
    [
      'UPDATE posts',
      'SET dope_counts = COALESCE(dope_counts, 0),',
      '    nope_counts = COALESCE(nope_counts, 0)',
    ].join(' '),
  );

  // Posts: reposts
  await ds.query(
    [
      'UPDATE posts p',
      'SET repost_counts = COALESCE(r.cnt, 0)',
      'FROM (',
      '  SELECT "postId" AS post_id, COUNT(*)::int AS cnt',
      '  FROM reposts',
      '  GROUP BY "postId"',
      ') r',
      'WHERE r.post_id = p.id',
    ].join(' '),
  );
  await ds.query('UPDATE posts SET repost_counts = COALESCE(repost_counts, 0)');

  // Posts: comments
  await ds.query(
    [
      'UPDATE posts p',
      'SET comment_counts = COALESCE(c.cnt, 0)',
      'FROM (',
      '  SELECT "targetId"::uuid AS post_id, COUNT(*)::int AS cnt',
      '  FROM comments',
      '  WHERE "targetType" = \'post\' AND "isDeleted" = false',
      '  GROUP BY "targetId"',
      ') c',
      'WHERE c.post_id = p.id',
    ].join(' '),
  );
  await ds.query('UPDATE posts SET comment_counts = COALESCE(comment_counts, 0)');

  // Users: followers
  await ds.query(
    [
      'UPDATE users u',
      'SET follower_counts = COALESCE(f.cnt, 0)',
      'FROM (',
      '  SELECT "followingId" AS uid, COUNT(*)::int AS cnt',
      '  FROM follows',
      '  GROUP BY "followingId"',
      ') f',
      'WHERE f.uid = u.id',
    ].join(' '),
  );
  await ds.query('UPDATE users SET follower_counts = COALESCE(follower_counts, 0)');

  // Users: following
  await ds.query(
    [
      'UPDATE users u',
      'SET following_counts = COALESCE(f.cnt, 0)',
      'FROM (',
      '  SELECT "followerId" AS uid, COUNT(*)::int AS cnt',
      '  FROM follows',
      '  GROUP BY "followerId"',
      ') f',
      'WHERE f.uid = u.id',
    ].join(' '),
  );
  await ds.query('UPDATE users SET following_counts = COALESCE(following_counts, 0)');

  // Users: aggregate stats from posts
  await ds.query(
    [
      'UPDATE users u',
      'SET',
      '  dope_counts = COALESCE(s.dopes, 0),',
      '  nope_counts = COALESCE(s.nopes, 0),',
      '  repost_counts = COALESCE(s.reposts, 0),',
      '  comment_counts = COALESCE(s.comments, 0)',
      'FROM (',
      '  SELECT',
      '    "creatorId" AS uid,',
      '    COALESCE(SUM(dope_counts), 0)::int AS dopes,',
      '    COALESCE(SUM(nope_counts), 0)::int AS nopes,',
      '    COALESCE(SUM(repost_counts), 0)::int AS reposts,',
      '    COALESCE(SUM(comment_counts), 0)::int AS comments',
      '  FROM posts',
      '  GROUP BY "creatorId"',
      ') s',
      'WHERE s.uid = u.id',
    ].join(' '),
  );

  await ds.query(
    [
      'UPDATE users',
      'SET',
      '  dope_counts = COALESCE(dope_counts, 0),',
      '  nope_counts = COALESCE(nope_counts, 0),',
      '  repost_counts = COALESCE(repost_counts, 0),',
      '  comment_counts = COALESCE(comment_counts, 0)',
    ].join(' '),
  );

  // eslint-disable-next-line no-console
  console.log('Backfilled stats counters for posts + users');

  await ds.destroy();
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exitCode = 1;
});
