import Anthropic from '@anthropic-ai/sdk'

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

const badRequest = (message) => Object.assign(new Error(message), { statusCode: 400 })

/**
 * Writes Instagram copy from the post's own image.
 *
 * Claude reads the image, so the text talks about what is actually in the
 * picture instead of restating a topic. The image must be publicly reachable —
 * an R2 public URL from upload-url is exactly that.
 *
 * Throws with a `statusCode` on bad input or an API failure, so the caller can
 * report it the same way whether it runs in a request or a background job.
 *
 * @returns {Promise<{caption: string, model: string, usage: object}>}
 */
export async function writeCaption({
  imageUrl,
  language = 'en',
  postType = 'FEED',
  topic = '',
  tone = 'friendly',
  format = 'caption',
}) {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw Object.assign(new Error('Missing environment variable: ANTHROPIC_API_KEY'), {
      statusCode: 500,
    })
  }

  if (!imageUrl) throw badRequest('Provide an imageUrl')
  if (!/^https:\/\//i.test(imageUrl)) {
    throw badRequest('Image URL must be publicly reachable over HTTPS')
  }

  const languageName = LANGUAGE_NAMES[language]
  if (!languageName) {
    throw badRequest(
      `Unsupported language "${language}". Use one of: ${Object.keys(LANGUAGE_NAMES).join(', ')}`
    )
  }

  const toneBrief = TONES[tone]
  if (!toneBrief) {
    throw badRequest(`Unknown tone "${tone}". Use one of: ${Object.keys(TONES).join(', ')}`)
  }

  const formatBrief = FORMATS[format]
  if (!formatBrief) {
    throw badRequest(`Unknown format "${format}". Use one of: ${Object.keys(FORMATS).join(', ')}`)
  }

  // A story carries no caption field, so this text is meant to go on the image
  // itself — read in a couple of seconds, not scrolled through. A carousel is a
  // feed caption, but written for someone who has only seen the first image and
  // is deciding whether to swipe.
  const lengthRule =
    postType === 'STORY'
      ? 'This is an Instagram Story, so the text sits on the image itself. Keep it to at most two short lines.'
      : postType === 'CAROUSEL'
        ? `This is a carousel. The reader has seen only the first image and is deciding whether to swipe, so open with a line that makes the rest worth swiping through, and never write about the later images as though they had already been seen. Stay under ${MAX_CAPTION} characters.`
        : `This is a feed post. Stay under ${MAX_CAPTION} characters.`

  const steer = topic.trim()
    ? `\n\nThe person posting wants the copy to lean towards: ${topic.trim()}`
    : ''

  try {
    const client = new Anthropic()

    const response = await client.beta.messages.create({
      model: 'claude-opus-5',
      max_tokens: 2000,
      // A caption is a short creative task, not a reasoning one. This runs in a
      // background function now, so the setting is about cost and latency
      // rather than squeezing under a timeout.
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
      throw Object.assign(new Error('The model declined to write copy for this image'), {
        statusCode: 422,
        category: response.stop_details?.category ?? null,
      })
    }

    const caption = response.content
      .filter((block) => block.type === 'text')
      .map((block) => block.text)
      .join('')
      .trim()

    if (!caption) {
      throw Object.assign(new Error('The model returned no text'), { statusCode: 502 })
    }

    return {
      caption,
      model: response.model,
      usage: { input: response.usage.input_tokens, output: response.usage.output_tokens },
    }
  } catch (error) {
    if (error.statusCode) throw error

    if (error instanceof Anthropic.AuthenticationError) {
      throw Object.assign(new Error('ANTHROPIC_API_KEY is not valid'), { statusCode: 401 })
    }
    if (error instanceof Anthropic.RateLimitError) {
      throw Object.assign(new Error('Rate limited — try again in a moment'), { statusCode: 429 })
    }
    if (error instanceof Anthropic.APIError) {
      // A 400 here usually means Claude could not fetch the image URL.
      throw Object.assign(new Error(error.message), { statusCode: error.status || 502 })
    }
    throw error
  }
}
