import { GoogleGenAI } from '@google/genai'
import { getApiKey } from './apiKeys'

const promptTemplates = {
  default: `
- Emotional peaks (excitement, revelation, dramatic moments)
- Educational insights or "aha" moments
- Controversial or thought-provoking statements
- Memorable quotes or soundbites
- Story climaxes or plot twists
`,
  funny: `
- Jokes and punchlines
- Ironic or absurd moments
- Funny reactions or interactions
- Unexpected or silly situations
- Witty commentary
`,
  educational: `
- Key learning points
- Clear explanations of complex topics
- Actionable advice or tips
- Demonstrations or tutorials
- Surprising facts or data points
`
} as const

type PromptType = keyof typeof promptTemplates

const models = {
  gemini_1_5: 'gemini-1.5-flash',
  gemini_2_0: 'gemini-2.0-flash'
}

export interface Transcript {
  text: string
  start: string
  end: string
}

export interface PartialClip {
  startTime: number
  endTime: number
  proposedTitle: string
  llmReason: string
  summary: string
}

// Existing clip structure for context
export interface ExistingClip {
  id: string
  startTime: number
  endTime: number
  proposedTitle: string
  summary?: string
}

export async function createAIClips(
  transcript: Transcript[],
  promptType: string,
  customLookFor: string,
  context: string,
  model: string,
  existingClips?: ExistingClip[]
): Promise<PartialClip[]> {
  try {
    const apiKey = getApiKey('GEMINI_API_KEY')
    if (!apiKey) {
      throw new Error('No Gemini API key configured. Please set it in Settings.')
    }

    const genAI = new GoogleGenAI({ apiKey })

    const transcriptText = transcript
      .map((entry) => {
        const [hours, minutes, seconds] = entry.start.split(':')
        const totalSeconds = parseInt(hours) * 3600 + parseInt(minutes) * 60 + parseFloat(seconds)
        return `[${totalSeconds}s] ${entry.text}`
      })
      .join('\n')

    const lastEntry = transcript[transcript.length - 1]
    const totalDuration = parseFloat(lastEntry.end) - parseFloat(lastEntry.start)

    const lookFor =
      promptType === 'custom'
        ? customLookFor
        : promptTemplates[promptType as PromptType] || promptTemplates.default

    // Build existing clips context
    let existingClipsContext = ''
    if (existingClips && existingClips.length > 0) {
      existingClipsContext = `\n\nEXISTING CLIPS TO AVOID:
The following segments have already been identified as clips. Please avoid these time ranges and find DIFFERENT interesting moments:
${existingClips
  .map(
    (clip) =>
      `- ${clip.startTime} to ${clip.endTime}: "${clip.proposedTitle}"${clip.summary ? ` (${clip.summary})` : ''}`
  )
  .join('\n')}

Focus on finding clips in different parts of the video that don't overlap with these existing segments.`
    }

    const prompt = `You are an expert video content analyst specializing in identifying the most engaging and viral-worthy moments in video content.
Analyze this video transcript and identify 5 of the most interesting, engaging, or entertaining segments that would make great short clips.

The clips must respect these constraints:
- MINIMAL DURATION: 50 SECONDS.
- MAXIMAL DURATION: 180 SECONDS.
- The clips should not overlap with each other.${
      existingClips?.length
        ? '\n- AVOID the existing clips listed below - find NEW and DIFFERENT segments.'
        : ''
    }

Look for the following types of content:
${lookFor}

Video Duration: ${totalDuration} seconds
Video Context: ${context}${existingClipsContext}

Transcript:
----------
${transcriptText}
----------

Respond with a JSON array of clips, and nothing else. Your response will be parsed by a machine using JSON.parse(). Do not include any text before or after the array, no code blocks, and no explanations.

Each clip in the JSON array must have the following structure:
- startTime: number (seconds from start of the video)
- endTime: number (seconds from start of the video)
- proposedTitle: string (engaging 5-8 word title)
- llmReason: string (why this moment is interesting/engaging)
- summary: string (a summary which should ENTICE the viewer to watch the clip)

Example format:
[
  {
    "startTime": 45,
    "endTime": 150,
    "proposedTitle": "Mind-blowing Revelation About AI",
    "llmReason": "Contains a surprising insight that challenges common assumptions about AI development",
    "summary": "A summary of the clip which will be used as a description to the clip"
  }
]

Ensure you only respond with the JSON array.`

    console.log(prompt)

    const result = await genAI.models.generateContent({
      model: models[model as keyof typeof models],
      config: {
        temperature: 1.0
      },
      contents: prompt
    })
    const responseText = result.text
    console.log('📝 Gemini response received', responseText)

    // Check if response text exists
    if (!responseText) {
      throw new Error('Empty response from Gemini API')
    }

    // Extract JSON from response
    let jsonMatch = responseText.match(/\[[\s\S]*\]/)
    if (!jsonMatch) {
      // Try to find JSON wrapped in code blocks
      jsonMatch = responseText.match(/```(?:json)?\s*(\[[\s\S]*?\])\s*```/)
      if (jsonMatch) {
        jsonMatch[0] = jsonMatch[1]
      }
    }

    if (!jsonMatch) {
      throw new Error('Could not parse JSON from AI response')
    }

    const aiClips = JSON.parse(jsonMatch[0])

    // Validate and sanitize the AI response
    const validatedClips = aiClips.filter(
      (clip: PartialClip) =>
        typeof clip.startTime === 'number' &&
        typeof clip.endTime === 'number' &&
        typeof clip.proposedTitle === 'string' &&
        typeof clip.llmReason === 'string' &&
        typeof clip.summary === 'string' &&
        clip.startTime < clip.endTime &&
        clip.endTime - clip.startTime >= 30 &&
        clip.endTime - clip.startTime <= 250
    )

    if (validatedClips.length === 0) {
      throw new Error('No valid clips found in AI response')
    }

    if (validatedClips.length === 0) {
      console.error('No valid clips found in AI response. Response was:', responseText)
      // Return empty array instead of throwing error if AI fails to find clips
      return []
    }

    console.log(`🎯 AI identified ${validatedClips.length} interesting clips`)
    return validatedClips
  } catch (error) {
    console.error('❌ Error in AI clip analysis:', error)
    throw error
  }
}

export async function regenerateClipSummary(
  transcript: Transcript[],
  clipStartTime: number,
  clipEndTime: number,
  proposedTitle: string,
  currentSummary: string,
  model: string = 'gemini_2_0'
): Promise<string> {
  try {
    const apiKey = getApiKey('GEMINI_API_KEY')
    if (!apiKey) {
      throw new Error('No Gemini API key configured. Please set it in Settings.')
    }

    const genAI = new GoogleGenAI({ apiKey })

    // Filter only valid segments
    const relevantTranscript = transcript.filter((entry) => {
      const entryStart = parseFloat(entry.start)
      const entryEnd = parseFloat(entry.end)
      return entryStart < clipEndTime + 20 && entryEnd > clipStartTime - 20
    })

    // Build transcript text
    const transcriptText = relevantTranscript
      .map((entry) => `[${entry.start}s] ${entry.text}`)
      .join('\n')

    const prompt = `You are an expert content analyst. Generate a new, engaging summary for this video clip.

CLIP DETAILS:
Title: "${proposedTitle}"
Duration: ${clipStartTime}s to ${clipEndTime}s (${Math.round(clipEndTime - clipStartTime)}s long)

CURRENT SUMMARY:
"${currentSummary}"

TRANSCRIPT SEGMENT:
${transcriptText}

Generate a NEW, different summary that:
- Is engaging and entices viewers to watch the clip
- Captures the key moments and value of this segment
- Is different from the current summary
- Uses exciting, clickable language
- MAXIMUM is 260 characters
- You are posting to X
- It should not be cringe or too long
- Do not use too many emojis or hashtags
- It should sound wise

Respond with ONLY the new summary text, no additional formatting or explanation.`

    console.log('🔄 Regenerating summary for clip:', proposedTitle)

    const result = await genAI.models.generateContent({
      model: models[model as keyof typeof models],
      config: {
        temperature: 1.0
      },
      contents: prompt
    })

    const responseText = result.text?.trim()

    if (!responseText) {
      throw new Error('Empty response from Gemini API')
    }

    console.log('✅ New summary generated')
    return responseText
  } catch (error) {
    console.error('❌ Error regenerating clip summary:', error)
    throw error
  }
}
