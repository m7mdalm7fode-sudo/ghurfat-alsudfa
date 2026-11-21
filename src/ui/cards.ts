/**
 * Pixel-art playing cards for «بلوت», drawn on a 30×42 canvas and shown upscaled without smoothing.
 * Number cards show suit pips, the ace one big suit, and the face cards faceless figures in the
 * game's style (الشايب in a bisht and red shemagh, الولد in a white thobe); البنت is a rose, so the
 * deck keeps to the platform's male-only, faceless characters.
 */
const CW = 30, CH = 42
const FONT: Record<string, string[]> = {
  A: ['.#.', '#.#', '###', '#.#', '#.#'], K: ['#.#', '#.#', '##.', '#.#', '#.#'], Q: ['.#.', '#.#', '#.#', '##.', '.##'], J: ['..#', '..#', '..#', '#.#', '.#.'],
  '1': ['.#.', '##.', '.#.', '.#.', '###'], '0': ['###', '#.#', '#.#', '#.#', '###'], '9': ['###', '#.#', '###', '..#', '###'], '8': ['###', '#.#', '###', '#.#', '###'], '7': ['###', '..#', '.#.', '.#.', '.#.'],
}
const PIP: Record<string, string[]> = {
  H: ['##.##', '#####', '#####', '.###.', '..#..'], D: ['..#..', '.###.', '#####', '.###.', '..#..'],
  S: ['..#..', '.###.', '#####', '#####', '.#.#.'], C: ['.###.', '.###.', '#####', '#####', '..#..'],
}
const BIG: Record<string, string[]> = {
  H: ['.##.##.', '#######', '#######', '#######', '.#####.', '..###..', '...#...'], D: ['...#...', '..###..', '.#####.', '#######', '.#####.', '..###..', '...#...'],
  S: ['...#...', '..###..', '.#####.', '#######', '#######', '...#...', '..###..'], C: ['..###..', '..###..', '##.#.##', '#######', '##.#.##', '...#...', '..###..'],
}
/** Left halves (7 wide) of 14-wide figures, mirrored at draw time. */
const FIG: Record<string, string[]> = {
  K: ['....kkk', '...kkkk', '...rwrw', '..rwrwr', '..rwddd', '..wrddd', '..rwddd', '.rwrwdd', '.rwrwrw', '.gbbbtt', 'gbbbbtt', 'gbbbbtg', 'gbbbbtg', 'gbbbbtg', 'gbbbbtt', 'gbbbbtt'],
  J: ['....www', '...wwww', '..wwwww', '..wwddd', '..wwddd', '..wwddd', '.wwwwdd', '.wwwwww', '..ccccc', '.cccccc', 'ccccccn', 'ccccccn', 'ccccccn', 'ssccccn', 'ccccccc', 'ccccccc'],
  Q: ['.......', '....sss', '...sSss', '..ssSSs', '..sssSs', '...ssss', '....sss', '......G', '.GG...G', '..GG..G', '......G', '......G', '.....GG', '......G'],
}
const cache = new Map<string, string>()

export function cardURL(card: string): string {
  const hit = cache.get(card)
  if (hit) return hit
  const r = card.slice(0, -1), s = card.slice(-1), red = s === 'H' || s === 'D'
  const ink = red ? '#c8324a' : '#1e1e2a', dark = red ? '#7a1424' : '#000000'
  const cv = document.createElement('canvas'); cv.width = CW; cv.height = CH
  const g = cv.getContext('2d')!
  const px = (x: number, y: number, c: string) => { g.fillStyle = c; g.fillRect(x, y, 1, 1) }
  const grid = (rows: string[], x: number, y: number, col: (ch: string) => string | null, scale = 1) => rows.forEach((row, j) => [...row].forEach((ch, i) => { const c = col(ch); if (c) { g.fillStyle = c; g.fillRect(x + i * scale, y + j * scale, scale, scale) } }))
  // Body with clipped corners and a dark outline.
  g.fillStyle = '#100a06'; g.fillRect(1, 0, CW - 2, CH); g.fillRect(0, 1, CW, CH - 2)
  g.fillStyle = '#f4ead8'; g.fillRect(1, 1, CW - 2, CH - 2)
  g.fillStyle = '#dccfb2'; g.fillRect(1, CH - 2, CW - 2, 1); g.fillRect(CW - 2, 1, 1, CH - 2)
  // Corner index: rank over a small pip, top-left and (upside down) bottom-right.
  const glyphs = r === '10' ? ['1', '0'] : [r]
  const corner = (flip: boolean) => {
    glyphs.forEach((ch, k) => FONT[ch].forEach((row, j) => [...row].forEach((v, i) => { if (v === '#') { const x = 2 + k * 4 + i, y = 2 + j; flip ? px(CW - 1 - x, CH - 1 - y, ink) : px(x, y, ink) } })))
    PIP[s].forEach((row, j) => [...row].forEach((v, i) => { if (v === '#') { const x = 2 + i, y = 8 + j; flip ? px(CW - 1 - x, CH - 1 - y, ink) : px(x, y, ink) } }))
  }
  corner(false); corner(true)
  const pip = (cx: number, cy: number, flip = false) => PIP[s].forEach((row, j) => [...row].forEach((v, i) => { if (v === '#') px(cx - 2 + i, flip ? cy + 2 - j : cy - 2 + j, ink) }))
  if (r === 'A') grid(BIG[s], 8, 14, ch => (ch === '#' ? ink : null), 2)
  else if (FIG[r]) {
    // Gold frame, then the mirrored figure.
    g.fillStyle = '#c89a3a'; g.strokeStyle = '#c89a3a'
    for (let x = 7; x <= 22; x++) { px(x, 9, '#c89a3a'); px(x, 32, '#c89a3a') }
    for (let y = 9; y <= 32; y++) { px(7, y, '#c89a3a'); px(22, y, '#c89a3a') }
    const pal: Record<string, string> = {k: '#141010', r: '#c8324a', w: '#fbf6ea', d: '#2a1a12', g: '#d9a441', b: '#4a2c18', t: '#efe6d2', c: '#e8dcc0', n: '#8a7a5a', s: ink, S: dark, G: '#3a7a3a'}
    const rows = FIG[r].map(h => h + [...h].reverse().join(''))
    grid(rows, 8, r === 'Q' ? 13 : 12, ch => pal[ch] || null)
  } else {
    // Three 5-pixel columns (8–12, 13–17, 18–22) clear of the corner indexes.
    const L = 10, R = 20, M = 15
    const n = Number(r), at: [number, number][] = []
    const side = (ys: number[]) => ys.forEach(y => at.push([L, y], [R, y]))
    if (n === 7) { side([8, 17, 26]); at.push([M, 12]) }
    if (n === 8) { side([8, 17, 26]); at.push([M, 12], [M, 22]) }
    if (n === 9) { side([8, 14, 20, 26]); at.push([M, 17]) }
    if (n === 10) { side([8, 14, 20, 26]); at.push([M, 11], [M, 23]) }
    for (const [x, y] of at) pip(x, y, y > 17)
  }
  const url = cv.toDataURL()
  cache.set(card, url)
  return url
}

/** A face-down card back: dark red with a gold sadu diamond pattern. */
export function backURL(): string {
  const hit = cache.get('back')
  if (hit) return hit
  const cv = document.createElement('canvas'); cv.width = CW; cv.height = CH
  const g = cv.getContext('2d')!
  g.fillStyle = '#100a06'; g.fillRect(1, 0, CW - 2, CH); g.fillRect(0, 1, CW, CH - 2)
  g.fillStyle = '#7a1e2a'; g.fillRect(1, 1, CW - 2, CH - 2)
  g.fillStyle = '#d9a441'
  for (let y = 3; y < CH - 3; y++) for (let x = 3; x < CW - 3; x++) if ((Math.abs((x % 6) - 3) + Math.abs((y % 6) - 3)) === 3) g.fillRect(x, y, 1, 1)
  const url = cv.toDataURL(); cache.set('back', url); return url
}
