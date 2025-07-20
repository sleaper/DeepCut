import { db } from '../database/db'
import { eq } from 'drizzle-orm'
import { clips } from '../database/schema'
import { writeFile, readFile, rm } from 'fs/promises'
import { existsSync, chmodSync } from 'fs'
import fs from 'fs'
import path, { join } from 'path'
import { logger } from '../utils/logger'
import { createClient, DeepgramClient } from '@deepgram/sdk'
import { InferSelectModel } from 'drizzle-orm'
import { ytDlpPath, clipsDir } from '@/index'
import { spawn } from 'child_process'
import { app, safeStorage } from 'electron'
import { progressTracker } from '@/utils/progressTracker'

interface DeepgramWord {
  word: string
  start: number
  end: number
  confidence: number
  punctuated_word?: string
}

interface DeepgramUtterance {
  start: number
  end: number
  confidence: number
  channel: number
  transcript: string
  words: DeepgramWord[]
  speaker?: number
  id: string
}

interface DeepgramMetadata {
  transaction_key: string
  request_id: string
  sha256: string
  created: string
  duration: number
  channels: number
}

interface DeepgramTranscriptionResponse {
  metadata: DeepgramMetadata
  results: {
    channels: any[]
    utterances: DeepgramUtterance[]
  }
}

const getDeepgramApiKey = () => {
  const userDataPath = app.getPath('userData')
  const settingsPath = path.join(userDataPath, 'settings.json')

  if (!fs.existsSync(settingsPath)) {
    return null
  }

  const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'))
  const tokenKey = 'DEEPGRAM_API_KEY'

  return safeStorage.decryptString(Buffer.from(settings[tokenKey], 'hex'))
}

async function downloadClip(
  clip: InferSelectModel<typeof clips>,
  outputPath: string,
  ytDlpPath: string
): Promise<void> {
  const videoUrl = `https://www.youtube.com/watch?v=${clip.videoId}`

  logger.info(
    `Downloading and clipping: ${clip.videoId} from ${clip.startTime}s to ${clip.endTime}s`
  )

  try {
    chmodSync(ytDlpPath, 0o755)
  } catch (error) {
    logger.warn(`Could not set executable permission on yt-dlp: ${error}`)
  }

  const args = [
    '-S',
    'proto:https', // WARNING: This is ESSENTIAL for downloading longer videos, because ffmpeg chokes on youtube's m3u8 formats
    '-f',
    'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best',
    '--force-keyframes-at-cuts',
    '--download-sections',
    `*${clip.startTime}-${clip.endTime}`,
    '--merge-output-format',
    'mp4',
    '-o',
    outputPath,
    videoUrl
  ]

  const proc = spawn(join(ytDlpPath, 'yt-dlp'), args, {
    stdio: ['ignore', 'ignore', 'inherit']
  })

  await new Promise((resolve, reject) => {
    proc.on('close', (code) => {
      if (code !== 0) {
        return reject(new Error(`yt-dlp process exited with code ${code}`))
      }
      resolve(null)
    })
    proc.on('error', reject)
  })

  logger.info(`✅ Successfully downloaded clip: ${outputPath}`)
}

async function extractAudio(videoPath: string, audioPath: string): Promise<void> {
  const proc = spawn(
    'ffmpeg',
    [
      '-i',
      videoPath,
      '-vn',
      '-acodec',
      'pcm_s16le',
      '-ar',
      '16000',
      '-ac',
      '1',
      '-y',
      '-loglevel',
      'error',
      audioPath
    ],
    {
      stdio: ['ignore', 'ignore', 'inherit']
    }
  )
  await new Promise((resolve, reject) => {
    proc.on('close', (code) => {
      if (code !== 0) {
        return reject(new Error(`ffmpeg audio extraction failed with code ${code}`))
      }
      resolve(null)
    })
    proc.on('error', reject)
  })

  logger.info(`✅ Successfully extracted audio: ${audioPath}`)
}

async function getTranscriptFromDeepgram(
  audioPath: string
): Promise<DeepgramTranscriptionResponse> {
  const apiKey = getDeepgramApiKey()
  if (!apiKey) {
    throw new Error('DEEPGRAM_API_KEY environment variable not set')
  }

  const audioBuffer = await readFile(audioPath)
  const deepgram: DeepgramClient = createClient(apiKey)

  const { result, error } = await deepgram.listen.prerecorded.transcribeFile(audioBuffer, {
    utterances: true,
    punctuate: true,
    model: 'nova-2'
  })

  if (error) throw error
  if (!result) throw new Error('No result from Deepgram')

  return result as DeepgramTranscriptionResponse
}

const formatTime = (seconds: number) => {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = Math.floor(seconds % 60)
  const milliseconds = Math.floor((seconds % 1) * 1000)
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs
    .toString()
    .padStart(2, '0')},${milliseconds.toString().padStart(3, '0')}`
}

async function generateSubtitlesAndAddToClip(
  clip: InferSelectModel<typeof clips>,
  deepgramResponse: DeepgramTranscriptionResponse,
  videoPath: string
): Promise<void> {
  const srtPath = videoPath.replace('.mp4', '.srt')
  const utterances = deepgramResponse.results?.utterances

  if (!utterances || utterances.length === 0) {
    logger.warn('⚠️ No transcript data found for this clip timeframe')
    return
  }

  let srtContent = ''
  let subtitleIndex = 1
  const maxWordsPerLine = 5

  for (const utterance of utterances) {
    const words = utterance.words
    for (let i = 0; i < words.length; i += maxWordsPerLine) {
      const chunk = words.slice(i, i + maxWordsPerLine)
      if (chunk.length === 0) continue

      const startTime = chunk[0].start
      const endTime = chunk[chunk.length - 1].end
      const text = chunk
        .map((word: DeepgramWord) => word.punctuated_word || word.word)
        .join(' ')
        .trim()

      if (text) {
        srtContent += `${subtitleIndex++}\n${formatTime(startTime)} --> ${formatTime(endTime)}\n${text}\n\n`
      }
    }
  }

  if (!srtContent) {
    logger.warn('⚠️ No transcript data found for this clip timeframe')
    return
  }

  await writeFile(srtPath, srtContent, 'utf-8')
  await db.update(clips).set({ srt: srtContent }).where(eq(clips.id, clip.id))
  logger.info(`📝 Generated subtitles: ${srtPath}`)

  const finalOutputPath = videoPath.replace('.mp4', '_with_subs.mp4')
  const ffmpegArgs = [
    '-i',
    videoPath,
    '-vf',
    `subtitles=${srtPath}:force_style='FontName=Arial\\,Bold=-1\\,FontSize=24\\,PrimaryColour=&HFFFFFF\\,BorderStyle=3\\,Outline=2\\,OutlineColour=&H80000000\\,Shadow=1\\,MarginV=30\\,Alignment=2'`,
    '-movflags',
    '+faststart',
    '-c:a',
    'copy',
    '-y',
    finalOutputPath
  ]

  const ffmpegArgsWithLogging = [...ffmpegArgs, '-loglevel', 'error']

  const proc = spawn('ffmpeg', ffmpegArgsWithLogging, {
    stdio: ['ignore', 'ignore', 'inherit']
  })

  await new Promise((resolve, reject) => {
    proc.on('close', (code) => {
      if (code !== 0) {
        return reject(new Error(`ffmpeg subtitle process failed with code ${code}`))
      }
      resolve(null)
    })
    proc.on('error', reject)
  })

  logger.info(`✅ Subtitles added: ${finalOutputPath}`)

  const mvProc = spawn('mv', [finalOutputPath, videoPath], {
    stdio: 'inherit'
  })
  await new Promise((resolve, reject) => {
    mvProc.on('close', (code) => {
      if (code !== 0) {
        return reject(new Error(`mv process failed with code ${code}`))
      }
      resolve(null)
    })
    mvProc.on('error', reject)
  })
  await rm(srtPath)
}

const updateClipProgress = (clip: InferSelectModel<typeof clips>, progress: number): void => {
  const existingClipsInProgress = progressTracker.getProgress(clip.videoId)?.clips
  const updatedProgress = existingClipsInProgress?.map((c) =>
    c.clipId === clip.id ? { ...c, progress } : c
  )

  progressTracker.updateProgress(clip.videoId, {
    stage: 'production',
    clips: updatedProgress
  })
}

export async function produceClip(clip: InferSelectModel<typeof clips>): Promise<string> {
  const clipOutputPath = path.resolve(clipsDir, `${clip.id}.mp4`)
  const audioPath = path.resolve(clipsDir, `${clip.id}.wav`)

  if (existsSync(clipOutputPath)) {
    logger.info(`Clip ${clip.id} already exists in filesystem. Skipping.`)
    return clip.id
  }

  try {
    await downloadClip(clip, clipOutputPath, ytDlpPath)
    updateClipProgress(clip, 25)

    await extractAudio(clipOutputPath, audioPath)
    updateClipProgress(clip, 50)

    const deepgramResponse = await getTranscriptFromDeepgram(audioPath)
    updateClipProgress(clip, 75)

    await db
      .update(clips)
      .set({ deepgramResponse: JSON.stringify(deepgramResponse) })
      .where(eq(clips.id, clip.id))

    await generateSubtitlesAndAddToClip(clip, deepgramResponse, clipOutputPath)
    updateClipProgress(clip, 100)

    await db
      .update(clips)
      .set({
        status: 'produced'
      })
      .where(eq(clips.id, clip.id))

    return clip.id
  } catch (error) {
    await db
      .update(clips)
      .set({
        status: 'error',
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        updatedAt: new Date().toISOString()
      })
      .where(eq(clips.id, clip.id))
    throw error
  } finally {
    await rm(audioPath)
  }
}
