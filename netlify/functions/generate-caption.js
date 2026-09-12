import Anthropic from '@anthropic-ai/sdk'

const CORS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': process.env.ALLOWED_ORIGIN || '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

const json = (statusCode, body) => ({ statusCode, headers: CORS, body: JSON.stringify(body) })

const MAX_CAPTION = 2200

const LANGUAGE_NAMES = { en: 'English', de: 'German' }

const TONES = {
  friendly: 'warm and familiar, like a parent talking to another parent',
  professional: 'calm and credible, the voice of an experienced teacher',
  playful: 'light and fun, with a sense of humour a child would enjoy',
  bold: 'confident and direct, making a strong case without overselling',
}

/** What the caller wants written. Each maps to an instruction, not a template. */
const FORMATS = {
  caption:
    'a full post caption, ending with a light call to action and then 5 to 10 relevant hashtags on their own line',
  hashtags: 'only a hashtag set — 15 to 25 relevant tags, nothing else, no sentences',
  hook: 'only an opening hook — two or three lines that stop the scroll, ending on a cliffhanger',
  cta: 'only a call to action — two or three lines pushing the parent to take the next step',
  thread: 'a numbered list of 5 short points, one per line',
}

/**
 * Who the copy is for and what it may never say.
 *
 * Edit this to change the voice. The hard limits exist because a model writing
 * marketing copy will otherwise invent prices, class times and outcomes that
 * read as real commitments to a parent.
 */
const BRAND_BRIEF = `You write Instagram copy for a mental arithmetic school for children.

Audience: parents of children roughly 5 to 12 years old.
Goal: warm encouragement that leaves a parent wanting to enrol their child in a course.

Voice:
- Warm and motivating. Speak to the parent's pride in their child, not their fear of falling behind.
- Concrete over generic. "Counting faster than the calculator" beats "unlock potential".
- A few emoji, placed where they carry meaning. Never a wall of them.
- Short paragraphs with line breaks. Instagram is read on a phone.

Never:
- Invent prices, dates, class times, locations, discounts, or a number of free places.
- Promise results ("your child will gain 20 IQ points", "guaranteed top of the class").
- Claim the child in the photo is a student, or name anyone.
- Use guilt or comparison to other children.`

/**
 * Writes an Instagram caption from the post's own image.
 *
 * Claude reads the image, so the copy talks about what is actually in the
 * picture instead of restating a topic. The image must be publicly reachable —
 * an R2 public URL from upload-url is exactly that.
 *
 * POST { "imageUrl": "https://...", "language": "en"|"de", "postType": "FEED"|"STORY", "topic": "optional steer" }
 *   ->  200 { ok: true, caption: "..." }
 */
export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS, body: '' }
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' })

  if (!process.env.ANTHROPIC_API_KEY) {
    return json(500, { error: 'Missing environment variable: ANTHROPIC_API_KEY' })
  }

  let body
  try {
    body = JSON.parse(event.body || '{}')
  } catch {
    return json(400, { error: 'Request body is not valid JSON' })
  }

  const {
    imageUrl,
    language = 'en',
    postType = 'FEED',
    topic = '',
    tone = 'friendly',
    format = 'caption',
  } = body

  if (!imageUrl) return json(400, { error: 'Provide an imageUrl' })
  if (!/^https:\/\//i.test(imageUrl)) {
    return json(400, { error: 'Image URL must be publicly reachable over HTTPS' })
  }

  const languageName = LANGUAGE_NAMES[language]
  if (!languageName) {
    return json(400, {
      error: `Unsupported language "${language}". Use one of: ${Object.keys(LANGUAGE_NAMES).join(', ')}`,
    })
  }

  const toneBrief = TONES[tone]
  if (!toneBrief) {
    return json(400, {
      error: `Unknown tone "${tone}". Use one of: ${Object.keys(TONES).join(', ')}`,
    })
  }

  const formatBrief = FORMATS[format]
  if (!formatBrief) {
    return json(400, {
      error: `Unknown format "${format}". Use one of: ${Object.keys(FORMATS).join(', ')}`,
    })
  }

  // A story carries no caption field, so this text is meant to go on the image
  // itself — read in a couple of seconds, not scrolled through.
  const lengthRule =
    postType === 'STORY'
      ? 'This is an Instagram Story, so the text sits on the image itself. Keep it to at most two short lines.'
      : `This is a feed post. Stay under ${MAX_CAPTION} characters.`

  const steer = topic.trim()
    ? `\n\nThe person posting wants the copy to lean towards: ${topic.trim()}`
    : ''

  try {
    const client = new Anthropic()

    const response = await client.beta.messages.create({
      model: 'claude-opus-5',
      max_tokens: 2000,
      // Low effort keeps this inside Netlify's 10s function limit; a caption is
      // a short creative task, not a reasoning one.
      thinking: { type: 'adaptive' },
      output_config: { effort: 'low' },
      betas: ['server-side-fallback-2026-06-01'],
      fallbacks: [{ model: 'claude-opus-4-8' }],
      system: BRAND_BRIEF,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image', source: { type: 'url', url: imageUrl } },
            {
              type: 'text',
              text: `Look at this image and write ${formatBrief}, in ${languageName}.

Tone: ${toneBrief}.

Talk about what is actually in the picture — a child's expression, what they are doing, the setting. Tie it to what the school offers.

${lengthRule}${steer}

Reply with the text only. No preamble, no explanation, no quotation marks around it.`,
            },
          ],
        },
      ],
    })

    if (response.stop_reason === 'refusal') {
      return json(422, {
        ok: false,
        error: 'The model declined to write copy for this image',
        category: response.stop_details?.category ?? null,
      })
    }

    const caption = response.content
      .filter((block) => block.type === 'text')
      .map((block) => block.text)
      .join('')
      .trim()

    if (!caption) return json(502, { ok: false, error: 'The model returned no text' })

    return json(200, {
      ok: true,
      caption,
      model: response.model,
      usage: {
        input: response.usage.input_tokens,
        output: response.usage.output_tokens,
      },
    })
  } catch (error) {
    console.error('Caption generation failed:', error.message)

    if (error instanceof Anthropic.AuthenticationError) {
      return json(401, { ok: false, error: 'ANTHROPIC_API_KEY is not valid' })
    }
    if (error instanceof Anthropic.RateLimitError) {
      return json(429, { ok: false, error: 'Rate limited — try again in a moment' })
    }
    if (error instanceof Anthropic.BadRequestError) {
      // A 400 here usually means Claude could not fetch the image URL.
      return json(400, { ok: false, error: error.message })
    }
    if (error instanceof Anthropic.APIError) {
      return json(error.status || 502, { ok: false, error: error.message })
    }
    return json(500, { ok: false, error: error.message })
  }
}
