import type {Seat} from '../net/protocol'

/**
 * Six original Arab male characters (drawn as pixel art in `pixel.ts`). The face is always an
 * empty shadow inside the headwear: no eyes, mouth or any facial feature. Each seat owns one.
 */
type Headwear = 'shemagh' | 'ghutra' | 'emamah' | 'litham' | 'massar'
type Prop = 'misbaha' | 'sword' | 'staff' | 'lantern' | 'dallah' | 'khanjar'
export type Character = {
  title: string
  trait: string
  color: string
  robe: string
  robeShade: string
  head: Headwear
  cloth: string
  pattern?: string
  agal: boolean
  bisht?: string
  trim?: string
  prop: Prop
}

export const CHARACTERS: Record<Seat, Character> = {
  p1: {title: 'الصقر', trait: 'نظرة بعيدة وصبر طويل', color: '#e0485f', robe: '#f2ede3', robeShade: '#d6cfc2', head: 'shemagh', cloth: '#f7f2ea', pattern: '#c8324a', agal: true, prop: 'misbaha'},
  p2: {title: 'الفارس', trait: 'لا يتراجع عن التحدي', color: '#e8b84a', robe: '#ece4d2', robeShade: '#cfc4ad', head: 'ghutra', cloth: '#fbfaf6', agal: true, bisht: '#1f1a24', trim: '#e8b84a', prop: 'sword'},
  p3: {title: 'الرحّال', trait: 'يعرف دروب الصحراء', color: '#2fc4b2', robe: '#d9c39a', robeShade: '#b9a27a', head: 'litham', cloth: '#2c3d74', agal: false, prop: 'staff'},
  p4: {title: 'الحكيم', trait: 'يقرأ الطاولة قبل أن يلعب', color: '#9b7cf0', robe: '#f4f0e8', robeShade: '#d8d1c4', head: 'emamah', cloth: '#f6f1e6', agal: false, bisht: '#6b4426', trim: '#e8b84a', prop: 'lantern'},
  p5: {title: 'الكريم', trait: 'قهوته حاضرة دائمًا', color: '#4fd18b', robe: '#e3e6e8', robeShade: '#c3c8cc', head: 'ghutra', cloth: '#ffffff', agal: false, prop: 'dallah'},
  p6: {title: 'الحارس', trait: 'خنجره لا يفارق حزامه', color: '#ff9a4d', robe: '#4a3f52', robeShade: '#352d3c', head: 'massar', cloth: '#1f7f86', pattern: '#e8b84a', agal: false, prop: 'khanjar'},
}
