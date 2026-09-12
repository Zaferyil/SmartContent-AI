/**
 * Asks Claude to write the copy from the post's own image.
 *
 * Replaces the local template generator: the text now describes what is
 * actually in the picture, which is the point of the feature.
 */
export async function generateCaption({ imageUrl, language, postType, topic, tone, format }) {
  const response = await fetch('/.netlify/functions/generate-caption', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ imageUrl, language, postType, topic, tone, format }),
  })

  const data = await response.json().catch(() => ({}))
  if (!response.ok || !data.ok) {
    throw new Error(data.error || `Could not generate the caption (HTTP ${response.status})`)
  }
  return data.caption
}
