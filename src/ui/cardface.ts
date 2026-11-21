/**
 * Clean, sharp playing cards for «بلوت» (HTML + inline SVG, no pixel upscaling): a big rank and suit
 * in the top corner so a fanned hand stays readable, one large suit in the middle, and flat,
 * faceless figures on the face cards (الشايب: red shemagh, black agal and a bisht; الولد: white
 * ghutra and thobe). البنت is a rose, keeping the platform's male-only, faceless characters.
 */
const PATH: Record<string, string> = {
  H: 'M12 21.5S3 15.6 3 9.6A4.7 4.7 0 0 1 12 7a4.7 4.7 0 0 1 9 2.6c0 6-9 11.9-9 11.9z',
  D: 'M12 1.8 20.2 12 12 22.2 3.8 12z',
  S: 'M12 1.8C9.3 6.4 3.6 9 3.6 14a4.3 4.3 0 0 0 7.4 3L9.8 22.2h4.4L13 17a4.3 4.3 0 0 0 7.4-3c0-5-5.7-7.6-8.4-12.2z',
  C: 'M12 1.9a4.4 4.4 0 0 0-3.6 6.9 4.4 4.4 0 1 0 2.4 7.6L9.8 22.2h4.4l-1-5.8a4.4 4.4 0 1 0 2.4-7.6A4.4 4.4 0 0 0 12 1.9z',
}
const RED = '#d22a3e', BLACK = '#1d1d26'
export const suitColor = (s: string) => (s === 'H' || s === 'D' ? RED : BLACK)
export const suitSVG = (s: string, cls = 'sv') => `<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true"><path fill="${suitColor(s)}" d="${PATH[s]}"/></svg>`

/** Flat faceless figures (viewBox 0 0 40 46) — kept for reference, not shown on cards. */
export function figure(r: string, s: string) {
  const col = suitColor(s)
  if (r === 'Q') return `<svg class="fig" viewBox="0 0 40 46" aria-hidden="true">
    <path d="M20 22v20" stroke="#3d7a3a" stroke-width="2.4" fill="none"/>
    <path d="M20 33c-6-1-9-5-9-8 4 0 8 3 9 8zM20 37c6-1 9-5 9-8-4 0-8 3-9 8z" fill="#4f9a48"/>
    <circle cx="20" cy="15" r="9" fill="${col}"/><path d="M20 7c-3 3-3 7 0 9 3-2 3-6 0-9z" fill="#00000033"/>
    <circle cx="16" cy="16" r="3.6" fill="#ffffff22"/><path d="M13 19c3 3 11 3 14 0" stroke="#00000040" stroke-width="1.4" fill="none"/></svg>`
  const king = r === 'K'
  // Headcloth: red-and-white check for the king, plain white for the boy.
  const cloth = king ? 'url(#chk' + s + ')' : '#fbf8f1'
  return `<svg class="fig" viewBox="0 0 40 46" aria-hidden="true">
    <defs><pattern id="chk${s}" width="3" height="3" patternUnits="userSpaceOnUse"><rect width="3" height="3" fill="#fbf8f1"/><rect width="1.5" height="1.5" fill="#cc2a36"/><rect x="1.5" y="1.5" width="1.5" height="1.5" fill="#cc2a36"/></pattern></defs>
    ${king ? '<path d="M3 46c1-10 5-16 17-16s16 6 17 16z" fill="#5a3418"/><path d="M15 31l5 15 5-15" fill="#f6f1e6"/><path d="M14.5 31l5.5 15M25.5 31 20 46" stroke="#d8a640" stroke-width="1.6"/>'
      : '<path d="M5 46c1-10 4-15 15-15s14 5 15 15z" fill="#f3eee2"/><path d="M20 33v13" stroke="#cfc6b2" stroke-width="1"/><circle cx="20" cy="36" r=".9" fill="#b8ad96"/><circle cx="20" cy="40" r=".9" fill="#b8ad96"/>'}
    <path d="M8 31c0-14 4-24 12-24s12 10 12 24l-4 2c0-9-3-15-8-15s-8 6-8 15z" fill="${cloth}" stroke="#00000022" stroke-width=".6"/>
    <ellipse cx="20" cy="20" rx="7" ry="8.5" fill="#3a2418"/>
    ${king ? '<ellipse cx="20" cy="8.6" rx="9.4" ry="2.3" fill="#141012"/><ellipse cx="20" cy="11.2" rx="9" ry="2" fill="#141012"/>' : ''}
    <path d="M12 26c2 4 5 6 8 6s6-2 8-6" fill="none" stroke="${col}" stroke-width="1.2" opacity=".55"/></svg>`
}

export function cardFace(card: string, cls = '') {
  const r = card.slice(0, -1), s = card.slice(-1), col = suitColor(s)
  // No pictures: the face cards show their letter big in the middle, everything else one big suit.
  const mid = r === 'J' || r === 'Q' || r === 'K' ? `<b class="big">${r}</b>` : suitSVG(s, r === 'A' ? 'mid ace' : 'mid')
  return `<span class="pc ${cls}" style="--sc:${col}"><span class="ix"><b>${r}</b>${suitSVG(s, 'ixs')}</span>${mid}</span>`
}
export const cardBack = (cls = '') => `<span class="pc back ${cls}"></span>`
