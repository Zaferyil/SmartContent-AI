/**
 * Local stand-in for the Claude API call.
 * Produces copy in the active UI language so the preview reads correctly
 * before the Netlify function is wired up.
 */

const TEMPLATES = {
  de: {
    caption: (topic, tone) =>
      `${tone} · ${topic}\n\nAlles, was du über ${topic} wissen musst – in einem Beitrag. Eine kleine Änderung macht oft den größten Unterschied.\n\nWie siehst du das? Schreib es in die Kommentare 👇`,
    hashtags: (topic) =>
      `#${slug(topic)} #contentcreation #socialmedia #digitalmarketing #ki #markenaufbau #unternehmertum #marketingtipps #contentcreator #smartcontentai`,
    hook: (topic) =>
      `Die meisten machen bei ${topic} denselben Fehler.\n\nUnd merken es nicht einmal.\n\nHier sind 3 Punkte dazu 👇`,
    cta: (topic) =>
      `Der richtige Zeitpunkt für ${topic} ist jetzt.\n\nKlick auf den Link im Profil und mach heute den ersten Schritt.\n\n→ Begrenzte Plätze`,
    thread: (topic) =>
      `5 Punkte zu ${topic}:\n\n1. Baue ein solides Fundament\n2. Was du nicht misst, kannst du nicht steuern\n3. Konstanz schlägt Perfektion\n4. Hör deiner Zielgruppe zu, statt zu raten\n5. Baue ein wiederholbares System\n\nZum Speichern 🔖`,
  },
  en: {
    caption: (topic, tone) =>
      `${tone} · ${topic}\n\nEverything you need to know about ${topic}, in one post. One small change usually makes the biggest difference.\n\nWhat's your take? Let's talk in the comments 👇`,
    hashtags: (topic) =>
      `#${slug(topic)} #contentcreation #socialmedia #digitalmarketing #ai #brandbuilding #marketingtips #entrepreneurship #contentcreator #smartcontentai`,
    hook: (topic) =>
      `Most people make the same mistake with ${topic}.\n\nAnd they don't even notice.\n\nHere are 3 points 👇`,
    cta: (topic) =>
      `The right time for ${topic} is now.\n\nTap the link in bio and take the first step today.\n\n→ Limited spots`,
    thread: (topic) =>
      `A 5-point guide to ${topic}:\n\n1. Get the foundation right\n2. You can't manage what you don't measure\n3. Consistency beats perfection\n4. Listen to your audience, don't assume\n5. Build a repeatable system\n\nSave this for later 🔖`,
  },
}

function slug(topic) {
  return topic
    .trim()
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, '')
    .split(/\s+/)
    .slice(0, 3)
    .join('')
}

export function generateContent({ topic, format, tone, language }) {
  const pack = TEMPLATES[language] ?? TEMPLATES.en
  const build = pack[format] ?? pack.caption
  return build(topic.trim(), tone)
}
