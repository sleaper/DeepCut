import path from 'path'
import fs from 'fs/promises'
import { transcribeWavFile } from './whisper'
import { logger } from './logger'
import { initializeYTDlp } from './ytdlp'
import { audioDir } from '@/index'
import { existsSync } from 'fs'

export const transcribeVideo = async (videoId: string): Promise<string> => {
  const ytdlp = await initializeYTDlp()
  // use sessionData here
  await fs.mkdir(audioDir, { recursive: true })

  const audioFile = path.join(audioDir, videoId)
  const audioPath = `${audioFile}.wav`

  if (!existsSync(audioPath)) {
    logger.info(`Downloading audio for video ${videoId} to ${audioPath}`)

    await ytdlp.execPromise([
      '--extract-audio',
      '--audio-format',
      'wav',
      '--audio-quality',
      '8',
      '-o',
      `${audioFile}.%(ext)s`,
      `https://www.youtube.com/watch?v=${videoId}`
    ])

    logger.info(`Audio downloaded for ${videoId}`)
  }

  try {
    await fs.access(audioPath)
  } catch (error) {
    logger.error(`yt-dlp did not create the audio file at ${audioPath}`)
    const audioDirContents = await fs.readdir(audioDir)
    logger.error(`Contents of ${audioDir}:`, audioDirContents)
    throw new Error(`Audio file not found for ${videoId} after download attempt.`)
  }

  const transcript = await transcribeWavFile(audioPath)

  await fs.unlink(audioPath)

  return transcript
}

export interface VideoMetadata {
  description: string
  duration: number
  channelId: string
  title: string
  publishedAt: Date
  videoId: string
  channelName: string
}

export async function getVideoMetadata(videoId: string): Promise<VideoMetadata> {
  try {
    const ytdlp = await initializeYTDlp()
    const metadata = await ytdlp.getVideoInfo(`https://www.youtube.com/watch?v=${videoId}`)

    if (metadata._type !== 'video') {
      throw new Error('Provided URL is not a video.')
    }

    const { upload_date } = metadata
    const parsedDate = new Date(
      `${upload_date.substring(0, 4)}-${upload_date.substring(4, 6)}-${upload_date.substring(6, 8)}`
    )

    return {
      description: metadata.description,
      duration: metadata.duration,
      channelId: metadata.channel_id,
      title: metadata.title,
      publishedAt: parsedDate,
      videoId: metadata.id,
      channelName: metadata.channel
    }
  } catch (error) {
    logger.error(error, `Failed to get metadata for ${videoId}`)
    throw error
  }
}
