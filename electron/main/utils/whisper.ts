import fs from 'fs'
import { Transcript } from './ai'
import { logger } from './logger'
import { whisperManager } from './whisper-cpp'

const timestampToSeconds = (ts: string): number => {
  if (!ts) return 0
  const parts = ts.split(':')
  const secondsParts = parts[2].split(',')
  const hours = parseInt(parts[0], 10)
  const minutes = parseInt(parts[1], 10)
  const seconds = parseInt(secondsParts[0], 10)
  const milliseconds = parseInt(secondsParts[1], 10)
  return hours * 3600 + minutes * 60 + seconds + milliseconds / 1000
}

/**
 * Transcribes an audio file using whisper.cpp addon.
 * This function maintains compatibility with the previous nodejs-whisper implementation.
 *
 * @param filePath The path to the audio file to transcribe.
 * @param modelName Optional model name (defaults to user preference or 'base.en')
 * @param options Optional transcription options
 * @returns A promise that resolves to the transcribed text in JSON format.
 */
export const transcribeWavFile = async (filePath: string, modelName?: string): Promise<string> => {
  try {
    logger.info(`Starting transcription for ${filePath} with whisper.cpp`)

    const selectedModel = modelName || 'tiny.en'

    if (!whisperManager.isModelInstalled(selectedModel)) {
      logger.info(`Model ${selectedModel} not installed, downloading...`)
      await whisperManager.downloadModel(selectedModel)
    }

    const result = await whisperManager.transcribeFile(filePath, selectedModel, {
      //TOOD: add support for custom options
      language: 'en',
      useVad: false,
      vadThreshold: 0.5,
      progressCallback: (progress) => {
        logger.info(`Transcription progress: ${progress.toFixed(1)}%`)
      }
    })

    logger.info(`Finished transcription for ${filePath}`)
    return result
  } catch (error) {
    logger.error('Error transcribing file with whisper.cpp:', error)
    throw error
  }
}

export { whisperManager }
export * from './whisper-cpp'
