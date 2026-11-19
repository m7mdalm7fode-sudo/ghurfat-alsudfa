/**
 * Six original Arab male characters (drawn as pixel art in `pixel.ts`). The face is always an
 * empty shadow inside the headwear: no eyes, mouth or any facial feature. «آخر فنجال» uses the
 * first six (one per seat); «الذيابة» and «القطوة السوداء» use up to twelve.
 */
type Headwear = 'shemagh' | 'ghutra' | 'emamah' | 'litham' | 'massar'
type Prop = 'misbaha' | 'sword' | 'staff' | 'lantern' | 'dallah' | 'khanjar' | 'falcon' | 'pouch'
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

export const CHARACTERS: Record<string, Character> = {
  p1: {title: 'الصقر', trait: 'نظرة بعيدة وصبر طويل', color: '#e0485f', robe: '#f2ede3', robeShade: '#d6cfc2', head: 'shemagh', cloth: '#f7f2ea', pattern: '#c8324a', agal: true, bisht: '#4a3324', trim: '#7a5636', prop: 'misbaha'},
  p2: {title: 'الفارس', trait: 'لا يتراجع عن التحدي', color: '#e8b84a', robe: '#ece4d2', robeShade: '#cfc4ad', head: 'ghutra', cloth: '#fbfaf6', agal: true, bisht: '#1f1a24', trim: '#e8b84a', prop: 'sword'},
  p3: {title: 'الرحّال', trait: 'يعرف دروب الصحراء', color: '#2fc4b2', robe: '#d9c39a', robeShade: '#b9a27a', head: 'litham', cloth: '#2c3d74', agal: false, prop: 'staff'},
  p4: {title: 'الحكيم', trait: 'يقرأ الطاولة قبل أن يلعب', color: '#9b7cf0', robe: '#f4f0e8', robeShade: '#d8d1c4', head: 'emamah', cloth: '#f6f1e6', agal: false, bisht: '#6b4426', trim: '#e8b84a', prop: 'lantern'},
  p5: {title: 'الكريم', trait: 'قهوته حاضرة دائمًا', color: '#4fd18b', robe: '#e3e6e8', robeShade: '#c3c8cc', head: 'ghutra', cloth: '#ffffff', agal: false, prop: 'dallah'},
  p6: {title: 'الحارس', trait: 'خنجره لا يفارق حزامه', color: '#ff9a4d', robe: '#4a3f52', robeShade: '#352d3c', head: 'massar', cloth: '#1f7f86', pattern: '#e8b84a', agal: false, prop: 'khanjar'},
  p7: {title: 'الدليل', trait: 'يقرأ الأثر قبل أن يُرى', color: '#6fb3ff', robe: '#c9b48a', robeShade: '#a8936a', head: 'litham', cloth: '#5a4632', agal: false, prop: 'staff'},
  p8: {title: 'الشاعر', trait: 'كلمته تسبقه إلى المجالس', color: '#ff7f9f', robe: '#efe8dc', robeShade: '#d2c9b8', head: 'ghutra', cloth: '#fbfaf6', agal: true, bisht: '#2a3a5a', trim: '#e8b84a', prop: 'misbaha'},
  p9: {title: 'العارف', trait: 'صامت يرى ما لا يُقال', color: '#9ad14f', robe: '#3e4a3a', robeShade: '#2c3529', head: 'emamah', cloth: '#2f5a3a', agal: false, prop: 'lantern'},
  p10: {title: 'الصيّاد', trait: 'صقره على كتفه دائمًا', color: '#d8a060', robe: '#8a7454', robeShade: '#6c5a40', head: 'shemagh', cloth: '#f2ece0', pattern: '#a82a3a', agal: true, prop: 'falcon'},
  p11: {title: 'التاجر', trait: 'يعرف ثمن كل شيء', color: '#ffd94a', robe: '#e9e2d0', robeShade: '#cbc3ae', head: 'ghutra', cloth: '#ffffff', agal: true, bisht: '#5a2a2a', trim: '#e8b84a', prop: 'pouch'},
  p12: {title: 'الراعي', trait: 'يسهر على غنمه حتى الفجر', color: '#5fd0e0', robe: '#a8936e', robeShade: '#887452', head: 'massar', cloth: '#7a2a2a', pattern: '#e3d6b8', agal: false, prop: 'staff'},
}
