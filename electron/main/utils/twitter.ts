import { TwitterApi } from 'twitter-api-v2'
import { logger } from './logger'
import fs from 'fs/promises'
import { getApiKey } from './apiKeys'

export function createTwitterClient() {
  const appKey = getApiKey('X_APP_KEY')
  const appSecret = getApiKey('X_APP_SECRET')
  const accessToken = getApiKey('X_ACCESS_TOKEN')
  const accessSecret = getApiKey('X_ACCESS_SECRET')

  console.log(appKey, appSecret, accessToken, accessSecret)

  if (!appKey || !appSecret || !accessToken || !accessSecret) {
    throw new Error(
      'Missing Twitter API credentials. Please set X_APP_KEY, X_APP_SECRET, X_ACCESS_TOKEN, and X_ACCESS_SECRET environment variables.'
    )
  }

  return new TwitterApi({
    appKey,
    appSecret,
    accessToken,
    accessSecret
  })
}

export interface TwitterPostResult {
  success: boolean
  postId?: string
  postUrl?: string
  replyId?: string
  error?: string
}

export async function postClipToTwitter(
  videoPath: string,
  summary: string,
  sourceVideoId: string
): Promise<TwitterPostResult> {
  try {
    const client = createTwitterClient()
    const rwClient = client.readWrite

    logger.info(`📤 Starting Twitter post process for video: ${videoPath}`)

    const fileBuffer = Buffer.from(await fs.readFile(videoPath))

    // 1. Upload video
    logger.info('📹 Uploading video to Twitter...')
    const mediaId = await rwClient.v1.uploadMedia(fileBuffer, {
      mimeType: 'video/mp4'
    })

    // 2. Create main post with summary and video
    logger.info('📝 Creating main post...')
    const mainPost = await rwClient.v2.tweet({
      text: summary,
      media: { media_ids: [mediaId] }
    })

    const postUrl = `https://twitter.com/i/web/status/${mainPost.data.id}`

    // 3. Reply with source information
    logger.info('💬 Adding source reply...')
    const sourceText = `🎬 Source: https://www.youtube.com/watch?v=${sourceVideoId}`

    const reply = await rwClient.v2.tweet({
      text: sourceText,
      reply: { in_reply_to_tweet_id: mainPost.data.id }
    })

    logger.info(`✅ Successfully posted to Twitter: ${postUrl}`)

    return {
      success: true,
      postId: mainPost.data.id,
      postUrl,
      replyId: reply.data.id
    }
  } catch (error) {
    throw error
  }
}
