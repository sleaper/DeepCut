import { logger } from './logger'
import { whisperManager } from './whisper-cpp'
import { progressTracker } from './progressTracker'

/**
 * Transcribes an audio file using whisper.cpp addon.
 * This function maintains compatibility with the previous nodejs-whisper implementation.
 *
 * @param filePath The path to the audio file to transcribe.
 * @param modelName Optional model name (defaults to user preference or 'base.en')
 * @param options Optional transcription options
 * @returns A promise that resolves to the transcribed text in JSON format.
 */
export const transcribeWavFile = async (
  filePath: string,
  videoId: string,
  modelName?: string
): Promise<string> => {
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
        progressTracker.updateProgress(videoId, {
          stage: 'transcription',
          progress: progress,
          message: 'Transcription in progress...'
        })
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
