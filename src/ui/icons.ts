/**
 * Small pixel-art icons (12×12) for cards, roles and badges, drawn from character grids so they
 * match the pixel scene instead of system emoji. `icon(name)` returns an <img> tag.
 */
const PAL: Record<string, string> = {
  k: '#140b07', s: '#e8b48a', S: '#b07a52', r: '#c8324a', R: '#8a1f30', y: '#e8b84a', Y: '#a8782a', w: '#f4ead8', W: '#fff6d8',
  b: '#3a6ea8', B: '#1c2a44', g: '#4fb06a', G: '#2c6a3e', c: '#c8965a', C: '#8a6236', p: '#efe0bc', P: '#c8b48a', m: '#a8744a',
  M: '#6e4a2c', d: '#2a1a10', l: '#a8d8f0', o: '#f0682a', v: '#5a3a8a', V: '#3a2460', n: '#7a7a86', h: '#5a3a24', e: '#ffd23a',
}
const GRID: Record<string, string[]> = {
  // Judge's gavel striking its block: accusation / trial.
  accuse: ['.....kk.....', '....kCCk....', '...kccCCk...', '..kccmmk....', '.kccmmk.....', 'kCcmmYyk....', 'kCCmkkYyk...', '.kCk..kYyk..', '..k..kkkkkk.', '....kcccccck', '...kmmmmmmmm', '....kkkkkkkk'],
  // Loot bag.
  steal: ['............', '....kkkk....', '...kyyyyk...', '....kYYk....', '...kyyyyk...', '..kyyyyyyk..', '.kyyyYYyyyk.', '.kyyYyyyyyk.', '.kyyyYYyyyk.', '.kyyyyyYyyk.', '..kkkkkkkk..', '............'],
  // Watching eye.
  peek: ['............', '............', '....kkkk....', '..kkwwwwkk..', '.kwwkbbkwwk.', 'kwwkbBBbkwwk', 'kwwkbBBbkwwk', '.kwwkbbkwwk.', '..kkwwwwkk..', '....kkkk....', '............', '............'],
  // Shield with a green cross: aid.
  help: ['.kkkkkkkkkk.', 'kwwwwggwwwwk', 'kwwwwggwwwwk', 'kwwggggggwwk', 'kwwggggggwwk', 'kwwwwggwwwwk', 'kwwwwggwwwwk', '.kwwwwwwwwk.', '..kwwwwwwk..', '...kwwwwk...', '....kkkk....', '............'],
  // Camel in profile.
  camel: ['............', '.kk.........', 'kcck........', '.kck..kkk...', '.kck.kccck..', '.kcckcccccck', '..kcccccccck', '..kccccccck.', '..kckkkkkck.', '..kck...kck.', '..kck...kck.', '..kk....kk..'],
  // Scroll with a red seal.
  pardon: ['............', '.kkkkkkkkk..', 'kpppppppppk.', '.kPkkkkkPk..', '.kpppppppk..', '.kPkkkkkPk..', '.kpppppppk..', '.kPkkkrrrk..', '.kppppprRrk.', 'kpppppprrrk.', '.kkkkkkkkk..', '............'],
  // Mud-brick watchtower.
  fort: ['kk.kk.kk.kk.', 'kmkkmkkmkkmk', 'kmmmmmmmmmmk', 'kMmmmmmmmmMk', '.kmmmkkmmmk.', '.kmmkddkmmk.', '.kMmkddkmMk.', '.kmmkddkmmk.', '.kmmkddkmmk.', '.kMmmmmmmMk.', '.kkkkkkkkkk.', '............'],
  // Two chain links.
  bond: ['............', '.kkkk.......', 'knnnnk......', 'knkknk......', 'knkknkkkk...', 'knnnnnknnk..', '.kkkknkkknk.', '....knk.knk.', '....knkkknk.', '.....knnnnk.', '......kkkk..', '............'],
  // Gusts of wind.
  wind: ['............', '.......lll..', '......l...l.', '..........l.', 'lllllllllll.', '............', '.llllllllll.', '...........l', '.......l...l', '........lll.', '............', '............'],
  // Curved khanjar dagger.
  weapon: ['..........k.', '.........kwk', '........kwk.', '.......kwk..', '......kwWk..', '.....kwWk...', '..kkkwWk....', '..kyyyyk....', '...khk......', '..khhk......', '.khhk.......', '.kkk........'],
  // Black cat with yellow eyes.
  cat: ['.n......n...', '.nkn..nkn...', '.nkknnkkn...', '.nkekkekn...', '.nkkkkkkn...', '..nkkkkn..n.', '..nkkkkkn.nk', '.nkkkkkkknk.', '.nkkkkkkkkn.', '.nkkkkkkkn..', '..nnnnnnn...', '............'],
  // Face-down card.
  card: ['.kkkkkkkk...', 'kvvvvvvvvk..', 'kvVvvvvVvk..', 'kvvVvvVvvk..', 'kvvvVVvvvk..', 'kvvvVVvvvk..', 'kvvVvvVvvk..', 'kvVvvvvVvk..', 'kvvvvvvvvk..', '.kkkkkkkk...', '............', '............'],
  // Burn pile flame.
  burn: ['.....o......', '....oo......', '....ooo..o..', '...oyooo.o..', '..ooyyoooo..', '..oyyyyyoo..', '.ooyyWyyyoo.', '.oyyWWWyyyo.', '.oyyWWWyyyo.', '..oyyyyyyo..', '...oooooo...', '............'],
  // Mafia: knife.
  knife: ['..........k.', '.........kw.', '........kwk.', '.......kwk..', '......kwk...', '.....kwk....', '....kwk.....', '...kkk......', '..khk.......', '.khk........', 'khk.........', 'kk..........'],
  // Mafia detective: magnifier.
  look: ['...kkkk.....', '..kllllk....', '.klWllllk...', '.klWllllk...', '.kllllllk...', '..kllllk....', '...kkkkhk...', '.......khk..', '........khk.', '.........khk', '..........kk', '............'],
  // Mafia citizen: mud house.
  house: ['.....kk.....', '....kmmk....', '...kmmmmk...', '..kmmmmmmk..', '.kkkkkkkkkk.', '.kmmmmmmmmk.', '.kmkkmmkkmk.', '.kmkdmmkdmk.', '.kmmmkkmmmk.', '.kmmmkdmmmk.', '.kkkkkkkkkk.', '............'],
  // Vote: hand holding a pebble.
  vote: ['............', '...kkkkkk...', '..kwwwwwwk..', '..kwkkkkwk..', '..kwwwwwwk..', '..kwkkkwwk..', '..kwwwwwwk..', '.kkkkkkkkkk.', '.kssssssssk.', '.kSsssssSsk.', '..kkkkkkkk..', '............'],
  // Ready: green check.
  ready: ['............', '..........gk', '.........ggk', '........ggk.', '.gk....ggk..', '.ggk..ggk...', '..ggkggk....', '...gggk.....', '....gk......', '............', '............', '............'],
  // Black Night: traitor eye mask / peaceful dove / old man's shield.
  traitor: ['............', '............', 'kkkkkkkkkkkk', 'kddddddddddk', 'kdkkdddkkddk', 'kkreekkreekk', 'kdkkdddkkddk', 'kddddddddddk', '.kkkkkkkkkk.', '............', '............', '............'],
  dove: ['............', '.......kk...', '......kwwk..', '..kk.kwwekk.', '.kwwkwwwwkyk', '.kwwwwwwwk..', '..kwwwwwwk..', '...kwwwwwk..', '....kkwwk...', '......kk....', '............', '............'],
  shield: ['.kkkkkkkkkk.', 'kbbbbbbbbbbk', 'kbllbbbbbbbk', 'kblbbbbbbbbk', 'kbbbbbbbbbbk', 'kbbbbbbbbbbk', '.kbbbbbbbbk.', '.kbbbbbbbbk.', '..kbbbbbbk..', '...kbbbbk...', '....kkkk....', '............'],
  // Falcon (الصقر ability) and prayer beads (العارف).
  falcon: ['............', '....kkk.....', '...kccek....', '..kccckyk...', '..kcccck....', '.kCcccccck..', 'kCCccccccck.', '.kCCcccccck.', '..kkCcccck..', '....kyk.k...', '...kyk......', '............'],
  beads: ['....kkkk....', '...kgkkgk...', '..kgk..kgk..', '..kgk..kgk..', '..kgk..kgk..', '...kgkkgk...', '....kggk....', '.....kgk....', '.....kyk....', '....kyyyk...', '....kyyyk...', '.....kkk....'],
}
const cache = new Map<string, string>()

export function iconURL(name: string): string {
  const hit = cache.get(name)
  if (hit) return hit
  const rows = GRID[name] || GRID.card
  const cv = document.createElement('canvas')
  cv.width = 12; cv.height = 12
  const g = cv.getContext('2d')!
  rows.forEach((row, y) => [...row].forEach((ch, x) => { if (PAL[ch]) { g.fillStyle = PAL[ch]; g.fillRect(x, y, 1, 1) } }))
  const url = cv.toDataURL()
  cache.set(name, url)
  return url
}

export function icon(name: string, title = ''): string {
  return `<img class="pi" src="${iconURL(name)}" alt="${title}"${title ? ` title="${title}"` : ''}>`
}
