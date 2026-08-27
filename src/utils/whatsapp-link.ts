/**
 * Builds a WhatsApp share URL for an external composer.
 *
 * No phone number is included: this prototype has no employee contact data and
 * will not invent one. `wa.me` without a recipient opens WhatsApp's own
 * contact picker with the text pre-filled, so the person chooses the recipient
 * and taps send themselves.
 *
 * The message is percent-encoded, so line breaks and `&`/`#` characters survive
 * intact instead of cutting the text short. Plain text only.
 */

export function buildWhatsAppUrl(message: string): string {
  return `https://wa.me/?text=${encodeURIComponent(message)}`
}
