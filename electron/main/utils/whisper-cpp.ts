import path from 'path'
import fs from 'fs'
import { app } from 'electron'
import { logger } from './logger'
import { existsSync, mkdirSync, createWriteStream } from 'fs'
import { Transcript } from './ai'

const isDev = process.env.NODE_ENV === 'development'

export interface WhisperModel {
  name: string
  size: string
  description: string
  filename: string
  downloadUrl: string
}

export const AVAILABLE_MODELS: WhisperModel[] = [
  {
    name: 'tiny',
    size: '39 MB',
    description: 'Fastest, lowest quality (32x realtime)',
    filename: 'ggml-tiny.bin',
    downloadUrl: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny.bin'
  },
  {
    name: 'tiny.en',
    size: '39 MB',
    description: 'Fastest, English only (32x realtime)',
    filename: 'ggml-tiny.en.bin',
    downloadUrl: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny.en.bin'
  },
  {
    name: 'base',
    size: '142 MB',
    description: 'Good balance of speed and quality (16x realtime)',
    filename: 'ggml-base.bin',
    downloadUrl: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.bin'
  },
  {
    name: 'base.en',
    size: '142 MB',
    description: 'Good balance, English only (16x realtime)',
    filename: 'ggml-base.en.bin',
    downloadUrl: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.en.bin'
  },
  {
    name: 'small',
    size: '466 MB',
    description: 'Better quality, slower (6x realtime)',
    filename: 'ggml-small.bin',
    downloadUrl: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.bin'
  },
  {
    name: 'small.en',
    size: '466 MB',
    description: 'Better quality, English only (6x realtime)',
    filename: 'ggml-small.en.bin',
    downloadUrl: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.en.bin'
  },
  {
    name: 'medium',
    size: '1.5 GB',
    description: 'High quality, much slower (2x realtime)',
    filename: 'ggml-medium.bin',
    downloadUrl: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-medium.bin'
  },
  {
    name: 'medium.en',
    size: '1.5 GB',
    description: 'High quality, English only (2x realtime)',
    filename: 'ggml-medium.en.bin',
    downloadUrl: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-medium.en.bin'
  }
]

export interface TranscriptionOptions {
  language?: string
  useVad?: boolean
  vadModel?: string
  vadThreshold?: number
  temperature?: number
  maxSegmentLength?: number
  progressCallback?: (progress: number) => void
}

export class WhisperCppManager {
  private modelsDir: string
  private vadModelsDir: string
  private whisperAddon: any = null
  private addonPath: string

  constructor() {
    const userDataPath = app.getPath('userData')
    this.modelsDir = path.join(userDataPath, 'whisper-models')
    this.vadModelsDir = path.join(userDataPath, 'vad-models')
    this.addonPath = isDev
      ? path.join(process.cwd(), 'external/whisper.cpp/build/Release/addon.node.node')
      : path.join(userDataPath, 'whisper/addon.node.node')

    this.ensureDirectories()
  }

  private ensureDirectories() {
    if (!existsSync(this.modelsDir)) {
      mkdirSync(this.modelsDir, { recursive: true })
    }
    if (!existsSync(this.vadModelsDir)) {
      mkdirSync(this.vadModelsDir, { recursive: true })
    }
  }

  async initializeAddon() {
    if (this.whisperAddon) return this.whisperAddon

    try {
      if (!existsSync(this.addonPath)) {
        throw new Error(
          `Addon not found at ${this.addonPath}. Please run 'bun run build:whisper' first.`
        )
      }

      this.whisperAddon = require(this.addonPath)
      logger.info('✅ Whisper.cpp addon loaded successfully')
      return this.whisperAddon
    } catch (error) {
      logger.error('❌ Failed to load whisper.cpp addon:', error)
      throw new Error(
        `Whisper.cpp addon not available: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    }
  }

  getAvailableModels(): WhisperModel[] {
    return AVAILABLE_MODELS
  }

  getInstalledModels(): WhisperModel[] {
    return AVAILABLE_MODELS.filter((model) => this.isModelInstalled(model.name))
  }

  isModelInstalled(modelName: string): boolean {
    const model = AVAILABLE_MODELS.find((m) => m.name === modelName)
    if (!model) return false

    const modelPath = path.join(this.modelsDir, model.filename)
    return existsSync(modelPath) && fs.statSync(modelPath).size > 0
  }

  getModelPath(modelName: string): string {
    const model = AVAILABLE_MODELS.find((m) => m.name === modelName)
    if (!model) {
      throw new Error(`Model ${modelName} not found`)
    }
    return path.join(this.modelsDir, model.filename)
  }

  async downloadModel(modelName: string, onProgress?: (progress: number) => void): Promise<void> {
    const model = AVAILABLE_MODELS.find((m) => m.name === modelName)
    if (!model) {
      throw new Error(`Model ${modelName} not found`)
    }

    const modelPath = path.join(this.modelsDir, model.filename)

    if (this.isModelInstalled(modelName)) {
      logger.info(`Model ${modelName} already exists and is valid`)
      return
    }

    logger.info(`📥 Downloading model ${modelName} (${model.size})...`)

    try {
      const response = await fetch(model.downloadUrl, {
        credentials: 'same-origin'
      })
      if (!response.ok) {
        throw new Error(`Failed to download: ${response.statusText}`)
      }

      const totalSize = parseInt(response.headers.get('content-length') || '0')
      let downloadedSize = 0

      const fileStream = createWriteStream(modelPath)
      const reader = response.body?.getReader()

      if (!reader) {
        throw new Error('Failed to get response reader')
      }

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        downloadedSize += value.length
        fileStream.write(value)

        if (onProgress && totalSize > 0) {
          const progress = (downloadedSize / totalSize) * 100
          onProgress(progress)
        }
      }

      await new Promise((resolve, reject) => {
        fileStream.end((error) => {
          if (error) reject(error)
          else resolve(void 0)
        })
      })

      logger.info(`✅ Model ${modelName} downloaded successfully`)
    } catch (error) {
      // Clean up partial download
      if (existsSync(modelPath)) {
        fs.unlinkSync(modelPath)
      }
      throw error
    }
  }

  async downloadVadModel(): Promise<string> {
    const vadModelName = 'ggml-silero-v5.1.2.bin'
    const vadModelPath = path.join(this.vadModelsDir, vadModelName)

    if (existsSync(vadModelPath)) {
      return vadModelPath
    }

    logger.info('📥 Downloading VAD model...')

    try {
      const response = await fetch(
        'https://huggingface.co/ggml-org/whisper-vad/resolve/main/ggml-silero-v5.1.2.bin'
      )
      if (!response.ok) {
        throw new Error(`Failed to download VAD model: ${response.statusText}`)
      }

      const fileStream = createWriteStream(vadModelPath)
      const reader = response.body?.getReader()

      if (!reader) {
        throw new Error('Failed to get VAD model response reader')
      }

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        fileStream.write(value)
      }

      await new Promise((resolve, reject) => {
        fileStream.end((error) => {
          if (error) reject(error)
          else resolve(void 0)
        })
      })

      logger.info('✅ VAD model downloaded successfully')
      return vadModelPath
    } catch (error) {
      if (existsSync(vadModelPath)) {
        fs.unlinkSync(vadModelPath)
      }
      throw error
    }
  }

  async transcribeFile(
    audioPath: string,
    modelName: string = 'base.en',
    options: TranscriptionOptions = {}
  ): Promise<string> {
    if (!this.isModelInstalled(modelName)) {
      throw new Error(`Model ${modelName} not installed. Please download it first.`)
    }

    const modelPath = this.getModelPath(modelName)

    try {
      await this.initializeAddon()

      const { whisper } = this.whisperAddon
      const { promisify } = require('util')
      const whisperAsync = promisify(whisper)

      // Prepare transcription parameters
      const params: any = {
        model: modelPath,
        fname_inp: audioPath,
        language: options.language || 'en',
        use_gpu: true,
        flash_attn: false,
        no_prints: true,
        no_timestamps: false,
        detect_language: !options.language,
        comma_in_time: true,
        print_progress: false,
        max_len: options.maxSegmentLength || 0,
        temperature: options.temperature || 0.0,
        progress_callback: options.progressCallback
      }

      // Add VAD if requested
      if (options.useVad) {
        try {
          const vadModelPath = await this.downloadVadModel()
          params.vad = true
          params.vad_model = vadModelPath
          params.vad_threshold = options.vadThreshold || 0.5
          params.vad_min_speech_duration_ms = 250
          params.vad_min_silence_duration_ms = 100
          params.vad_speech_pad_ms = 30
          params.vad_samples_overlap = 0.1
        } catch (vadError) {
          logger.warn('⚠️ VAD model download failed, proceeding without VAD:', vadError)
          params.vad = false
        }
      }

      logger.info(
        `🎤 Transcribing ${path.basename(audioPath)} with model ${modelName}${options.useVad ? ' (VAD enabled)' : ''}`
      )

      const result: { transcription: string[] } = await whisperAsync(params)

      const array: Transcript[] = result.transcription.map((segment) => {
        return {
          start: segment[0],
          end: segment[1],
          text: segment[2]
        }
      })

      return JSON.stringify(array)
    } catch (error) {
      logger.error('❌ Transcription failed:', error)
      throw error
    }
  }

  deleteModel(modelName: string): boolean {
    const model = AVAILABLE_MODELS.find((m) => m.name === modelName)
    if (!model) return false

    const modelPath = path.join(this.modelsDir, model.filename)

    try {
      if (existsSync(modelPath)) {
        fs.unlinkSync(modelPath)
        logger.info(`🗑️ Deleted model ${modelName}`)
        return true
      }
      return false
    } catch (error) {
      logger.error(`Failed to delete model ${modelName}:`, error)
      return false
    }
  }

  getModelSize(modelName: string): number {
    if (!this.isModelInstalled(modelName)) return 0

    const modelPath = this.getModelPath(modelName)
    try {
      return fs.statSync(modelPath).size
    } catch {
      return 0
    }
  }
}

// Singleton instance
export const whisperManager = new WhisperCppManager()
