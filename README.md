# DeepCut

AI-powered video clip generation that runs locally on your machine. Extract engaging clips from long-form videos like podcasts, lectures, and interviews using AI analysis.

## Features

- **Local AI processing** - Uses Whisper.cpp for transcription and Google Gemini for content analysis
- **Automatic clip generation** - Finds interesting moments in long videos automatically
- **Subtitle generation** - Creates and embeds professional subtitles using Deepgram
- **Privacy focused** - Everything runs on your machine, no data uploaded to external servers
- **Cross-platform** - Works on Windows, macOS, and Linux

## Tech Stack

- **Frontend**: Electron + TypeScript + React + shadcn/ui
- **Database**: SQLite with Drizzle ORM
- **Communication**: tRPC for type-safe client-server communication
- **AI Processing**: Whisper.cpp (local speech recognition) + Google Gemini (content analysis)
- **Subtitle Generation**: Deepgram API
- **Video Processing**: FFmpeg + yt-dlp

## How it works

1. **Input**: Paste a YouTube URL
2. **Download**: Extract audio from the video using yt-dlp
3. **Transcribe**: Process audio locally with Whisper.cpp
4. **Analyze**: Send transcript to Gemini AI to identify engaging moments
5. **Generate**: Download video segments and create clips with embedded subtitles
6. **Export**: Save clips locally or share to social media

## Installation

**Clone with submodules** (required for Whisper.cpp):

```bash
git clone --recursive https://github.com/yourusername/deepcut.git
cd deepcut
```

If you already cloned without `--recursive`, initialize submodules:

```bash
git submodule update --init --recursive
```

**Install and build**:

```bash
pnpm install
pnpm run build:whisper
pnpm dev
```

## Requirements

- **Node.js 20+** and **pnpm**
- **FFmpeg** (for video processing)
- **Google Gemini API key** - For AI content analysis
- **Deepgram API key** - For subtitle generation (optional but recommended)

## Setup

1. Launch the application
2. Go to Settings and add your API keys:
   - Google Gemini API key ([Get one here](https://aistudio.google.com/))
   - Deepgram API key ([Get one here](https://deepgram.com/))
3. Start generating clips!

## Usage

1. **Add video**: Paste a YouTube URL on the home page
2. **Generate clips**: Click "Generate Clips with AI" and wait for processing
3. **Review clips**: Browse generated clips in the clips tab
4. **Edit timing**: Use the clip editor to fine-tune start/end times
5. **Export**: Save clips locally or post to social media

## Building for Distribution

```bash
pnpm build:win    # Windows installer
pnpm build:mac    # macOS app bundle
pnpm build:linux  # Linux AppImage/deb
```

## Development

```bash
pnpm dev          # Start development server
pnpm typecheck    # Check TypeScript types
pnpm format       # Format code with Prettier
```

## License

GPL-3.0
