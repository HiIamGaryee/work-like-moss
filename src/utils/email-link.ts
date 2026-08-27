/**
 * Builds a `mailto:` URL for an external email composer.
 *
 * No recipient is ever included: this prototype has no employee contact data
 * and will not invent an address. The composer opens with the subject and body
 * filled in, and the person still chooses who to send it to and whether to send
 * it at all.
 *
 * Everything is percent-encoded rather than concatenated raw, so a message
 * containing `&`, `?`, `#` or a line break cannot truncate the body or smuggle
 * extra parameters into the URL. Bodies are plain text — no HTML.
 */

type EmailDraft = {
  subject?: string
  body: string
}

export function buildMailtoUrl({ subject, body }: EmailDraft): string {
  const params = new URLSearchParams()
  if (subject && subject.trim() !== '') params.set('subject', subject)
  params.set('body', body)

  /*
   * `URLSearchParams` encodes a space as `+`, which some mail clients render
   * literally in a body. `mailto:` expects percent-encoding, so the pairs are
   * assembled with `encodeURIComponent` instead.
   */
  const encoded = [...params.entries()]
    .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
    .join('&')

  return `mailto:?${encoded}`
}
