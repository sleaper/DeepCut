import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core'
import crypto from 'crypto'
import { sql } from 'drizzle-orm'
import { InferSelectModel } from 'drizzle-orm'

export type Video = InferSelectModel<typeof videos>
export type Clip = InferSelectModel<typeof clips>
export type Post = InferSelectModel<typeof posts>

export const videos = sqliteTable('videos', {
  videoId: text('video_id').primaryKey(),
  title: text('title').notNull(),
  channelName: text('channel_name').notNull(),
  youtubeChannelId: text('youtube_channel_id').notNull(),
  publishedAt: integer('published_at', { mode: 'timestamp' }).notNull(),
  context: text('context').default('').notNull(),
  transcript: text('transcript'),
  status: text('status', { enum: ['pending', 'transcribed', 'error'] })
    .notNull()
    .default('pending'),
  errorMessage: text('error_message'),
  createdAt: text('created_at')
    .notNull()
    .default(sql`(current_timestamp)`),
  updatedAt: text('updated_at')
    .notNull()
    .default(sql`(current_timestamp)`)
})

export const clips = sqliteTable('clips', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  videoId: text('video_id')
    .notNull()
    .references(() => videos.videoId, { onDelete: 'cascade' }),
  startTime: integer('start_time').notNull(),
  endTime: integer('end_time').notNull(),
  llmReason: text('llm_reason').notNull(),
  proposedTitle: text('proposed_title').notNull(),
  summary: text('summary').notNull(),
  status: text('status', { enum: ['pending', 'produced', 'posted', 'error'] })
    .notNull()
    .default('pending'),
  srt: text('srt'),
  deepgramResponse: text('deepgram_response'),
  errorMessage: text('error_message'),
  postUrl: text('post_url'),
  postId: text('post_id'),
  createdAt: text('created_at')
    .notNull()
    .default(sql`(current_timestamp)`),
  updatedAt: text('updated_at')
    .notNull()
    .default(sql`(current_timestamp)`)
})

export const posts = sqliteTable('posts', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  clipId: text('clip_id')
    .notNull()
    .references(() => clips.id, { onDelete: 'cascade' }),
  platform: text('platform', { enum: ['X', 'YouTube', 'TikTok', 'Instagram'] }).notNull(),
  postUrl: text('post_url'),
  views: integer('views').default(0),
  likes: integer('likes').default(0),
  lastCheckedAt: text('last_checked_at')
    .notNull()
    .default(sql`(current_timestamp)`),
  content: text('content'),
  createdAt: text('created_at')
    .notNull()
    .default(sql`(current_timestamp)`),
  updatedAt: text('updated_at')
    .notNull()
    .default(sql`(current_timestamp)`)
})
