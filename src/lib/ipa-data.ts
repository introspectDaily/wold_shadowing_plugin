/**
 * 国际音标（IPA）教学数据。
 * 每个音标包含若干示例单词及其完整音标；另含一组易混淆音标的对比对。
 */

export interface IpaWord {
  /** 单词 */
  word: string;
  /** 单词的完整音标 */
  phonetic: string;
}

export interface Phoneme {
  /** 音标符号 */
  symbol: string;
  /** 中文名称 */
  name: string;
  /** 分组标签，如「单元音」「双元音」「辅音」 */
  category: string;
  /** 细分子分组，如「短元音」「长元音」「爆破音」 */
  subcategory: string;
  /** 元音 / 辅音 */
  type: 'vowel' | 'consonant';
  /** 该音标单独发音的音频地址（人工配置的默认值，可选） */
  audio?: string;
  /** 来源参考（简短标注） */
  ref?: string;
  /** 发音要点说明 */
  description: string;
  /** 示例单词（含音标） */
  words: IpaWord[];
}

export interface IpaPair {
  /** 左侧音标 */
  a: string;
  /** 右侧音标 */
  b: string;
  /** 对比名称 */
  label: string;
  /** 最小对立对提示，如 “bit — beat” */
  hint: string;
  /** 两者差异说明 */
  description: string;
}

const monophthongCategory = '单元音';
const diphthongCategory = '双元音';
const consonantCategory = '辅音';

const shortVowelSub = '短元音';
const longVowelSub = '长元音';
const diphthongSub = '双元音';
const plosiveSub = '爆破音';
const fricativeSub = '摩擦音';
const affricateSub = '破擦音';
const nasalSub = '鼻音';
const approximantSub = '近音';

const REF_VOWEL = 'Oxford 发音指南 · Wikipedia: English phonology';
const REF_CONSONANT = 'Wikipedia: English phonology · Oxford 发音指南';

export const VOWEL_PHONEMES: Phoneme[] = [
  {
    symbol: '/ɪ/',
    subcategory: shortVowelSub,
    ref: REF_VOWEL,
    name: '短元音 /ɪ/',
    category: monophthongCategory,
    type: 'vowel',
    description:
      '短音 i，音值为 [ɪ]：比中文「一」（[i]）更松、更低、更靠后，发音短促、嘴角微展、口腔放松。常见于 sit、big。',
    words: [
      { word: 'bit', phonetic: '/bɪt/' },
      { word: 'sit', phonetic: '/sɪt/' },
      { word: 'ship', phonetic: '/ʃɪp/' },
      { word: 'fish', phonetic: '/fɪʃ/' },
      { word: 'kiss', phonetic: '/kɪs/' },
      { word: 'big', phonetic: '/bɪɡ/' },
    ],
  },
  {
    symbol: '/e/',
    subcategory: shortVowelSub,
    ref: REF_VOWEL,
    name: '短元音 /e/',
    category: monophthongCategory,
    type: 'vowel',
    description:
      '短音 e，音值为 [e]~[ɛ]（中/中低前不圆唇元音）：中文里没有完全对应的单韵母，可理解为发「诶」但更短促、干脆、不带 i 尾。如 bed、pen。',
    words: [
      { word: 'bed', phonetic: '/bed/' },
      { word: 'red', phonetic: '/red/' },
      { word: 'pen', phonetic: '/pen/' },
      { word: 'egg', phonetic: '/eɡ/' },
      { word: 'ten', phonetic: '/ten/' },
      { word: 'desk', phonetic: '/desk/' },
    ],
  },
  {
    symbol: '/æ/',
    subcategory: shortVowelSub,
    ref: REF_VOWEL,
    name: '短元音 /æ/',
    category: monophthongCategory,
    type: 'vowel',
    description:
      '嘴张大、舌头放平的短音，比 /e/ 更开，音色更「亮」。如 cat、hat。',
    words: [
      { word: 'cat', phonetic: '/kæt/' },
      { word: 'hat', phonetic: '/hæt/' },
      { word: 'map', phonetic: '/mæp/' },
      { word: 'bag', phonetic: '/bæɡ/' },
      { word: 'hand', phonetic: '/hænd/' },
      { word: 'black', phonetic: '/blæk/' },
    ],
  },
  {
    symbol: '/ʌ/',
    subcategory: shortVowelSub,
    ref: REF_VOWEL,
    name: '短元音 /ʌ/',
    category: monophthongCategory,
    type: 'vowel',
    description:
      '类似中文「啊」但更短更轻、口型半开。如 cup、sun、love。',
    words: [
      { word: 'cup', phonetic: '/kʌp/' },
      { word: 'sun', phonetic: '/sʌn/' },
      { word: 'bus', phonetic: '/bʌs/' },
      { word: 'up', phonetic: '/ʌp/' },
      { word: 'love', phonetic: '/lʌv/' },
      { word: 'cut', phonetic: '/kʌt/' },
    ],
  },
  {
    symbol: '/ɒ/',
    subcategory: shortVowelSub,
    ref: REF_VOWEL,
    name: '短元音 /ɒ/',
    category: monophthongCategory,
    type: 'vowel',
    description:
      '英式英语的短音 o，口型略圆。如 hot、dog、box。',
    words: [
      { word: 'hot', phonetic: '/hɒt/' },
      { word: 'dog', phonetic: '/dɒɡ/' },
      { word: 'box', phonetic: '/bɒks/' },
      { word: 'clock', phonetic: '/klɒk/' },
      { word: 'stop', phonetic: '/stɒp/' },
      { word: 'shop', phonetic: '/ʃɒp/' },
    ],
  },
  {
    symbol: '/ʊ/',
    subcategory: shortVowelSub,
    ref: REF_VOWEL,
    name: '短元音 /ʊ/',
    category: monophthongCategory,
    type: 'vowel',
    description:
      '短音 u，嘴唇微圆但不紧张。如 put、book、look。',
    words: [
      { word: 'put', phonetic: '/pʊt/' },
      { word: 'book', phonetic: '/bʊk/' },
      { word: 'good', phonetic: '/ɡʊd/' },
      { word: 'look', phonetic: '/lʊk/' },
      { word: 'foot', phonetic: '/fʊt/' },
      { word: 'cook', phonetic: '/kʊk/' },
    ],
  },
  {
    symbol: '/ə/',
    subcategory: shortVowelSub,
    ref: REF_VOWEL,
    name: '中央元音 /ə/',
    category: monophthongCategory,
    type: 'vowel',
    description:
      '最轻的「模糊音」（短音），口腔放松、几乎不费力气，时值很短。常出现在非重读音节，如 about 的 a、sofa 末尾的 a。与它对应的长元音是 /ɜː/（如 bird）。',
    words: [
      { word: 'about', phonetic: '/əˈbaʊt/' },
      { word: 'sofa', phonetic: '/ˈsəʊfə/' },
      { word: 'banana', phonetic: '/bəˈnɑːnə/' },
      { word: 'teacher', phonetic: '/ˈtiːtʃə/' },
      { word: 'water', phonetic: '/ˈwɔːtə/' },
      { word: 'picture', phonetic: '/ˈpɪktʃə/' },
    ],
  },
  {
    symbol: '/iː/',
    subcategory: longVowelSub,
    ref: REF_VOWEL,
    name: '长元音 /iː/',
    category: monophthongCategory,
    type: 'vowel',
    description:
      '长音 i，音值为 [i]：和中文「一」的口型舌位几乎相同，但时值更长、嘴角向两侧拉开、发音更紧绷。如 see、tea。',
    words: [
      { word: 'see', phonetic: '/siː/' },
      { word: 'sea', phonetic: '/siː/' },
      { word: 'tea', phonetic: '/tiː/' },
      { word: 'bee', phonetic: '/biː/' },
      { word: 'tree', phonetic: '/triː/' },
      { word: 'three', phonetic: '/θriː/' },
    ],
  },
  {
    symbol: '/ɜː/',
    subcategory: longVowelSub,
    ref: REF_VOWEL,
    name: '长元音 /ɜː/',
    category: monophthongCategory,
    type: 'vowel',
    description:
      '长音，卷舌或舌中部的「额」音，发音持续且饱满。如 bird、girl。',
    words: [
      { word: 'bird', phonetic: '/bɜːd/' },
      { word: 'girl', phonetic: '/ɡɜːl/' },
      { word: 'shirt', phonetic: '/ʃɜːt/' },
      { word: 'word', phonetic: '/wɜːd/' },
      { word: 'work', phonetic: '/wɜːk/' },
      { word: 'turn', phonetic: '/tɜːn/' },
    ],
  },
  {
    symbol: '/ɑː/',
    subcategory: longVowelSub,
    ref: REF_VOWEL,
    name: '长元音 /ɑː/',
    category: monophthongCategory,
    type: 'vowel',
    description:
      '长音「啊」，嘴张大、舌头放低靠后。如 car、arm、dark。',
    words: [
      { word: 'car', phonetic: '/kɑː/' },
      { word: 'far', phonetic: '/fɑː/' },
      { word: 'arm', phonetic: '/ɑːm/' },
      { word: 'dark', phonetic: '/dɑːk/' },
      { word: 'card', phonetic: '/kɑːd/' },
      { word: 'park', phonetic: '/pɑːk/' },
    ],
  },
  {
    symbol: '/ɔː/',
    subcategory: longVowelSub,
    ref: REF_VOWEL,
    name: '长元音 /ɔː/',
    category: monophthongCategory,
    type: 'vowel',
    description:
      '长音 o，嘴唇收圆、舌位靠后，音色偏「暗」。如 door、more。',
    words: [
      { word: 'door', phonetic: '/dɔː/' },
      { word: 'more', phonetic: '/mɔː/' },
      { word: 'four', phonetic: '/fɔː/' },
      { word: 'horse', phonetic: '/hɔːs/' },
      { word: 'tall', phonetic: '/tɔːl/' },
      { word: 'talk', phonetic: '/tɔːk/' },
    ],
  },
  {
    symbol: '/uː/',
    subcategory: longVowelSub,
    ref: REF_VOWEL,
    name: '长元音 /uː/',
    category: monophthongCategory,
    type: 'vowel',
    description:
      '长音 u，嘴唇收圆并向前突出，发音时值长。如 blue、food、moon。',
    words: [
      { word: 'blue', phonetic: '/bluː/' },
      { word: 'food', phonetic: '/fuːd/' },
      { word: 'moon', phonetic: '/muːn/' },
      { word: 'soon', phonetic: '/suːn/' },
      { word: 'too', phonetic: '/tuː/' },
      { word: 'two', phonetic: '/tuː/' },
    ],
  },
  {
    symbol: '/eɪ/',
    subcategory: diphthongSub,
    ref: REF_VOWEL,
    name: '双元音 /eɪ/',
    category: diphthongCategory,
    type: 'vowel',
    description:
      '由 /e/ 滑向 /ɪ/ 的双元音，口型由开到微收。如 day、name、play。',
    words: [
      { word: 'day', phonetic: '/deɪ/' },
      { word: 'say', phonetic: '/seɪ/' },
      { word: 'name', phonetic: '/neɪm/' },
      { word: 'play', phonetic: '/pleɪ/' },
      { word: 'rain', phonetic: '/reɪn/' },
      { word: 'eight', phonetic: '/eɪt/' },
    ],
  },
  {
    symbol: '/aɪ/',
    subcategory: diphthongSub,
    ref: REF_VOWEL,
    name: '双元音 /aɪ/',
    category: diphthongCategory,
    type: 'vowel',
    description:
      '由 /a/ 滑向 /ɪ/ 的双元音，先张大嘴再收拢。如 my、five、time。',
    words: [
      { word: 'my', phonetic: '/maɪ/' },
      { word: 'fly', phonetic: '/flaɪ/' },
      { word: 'five', phonetic: '/faɪv/' },
      { word: 'time', phonetic: '/taɪm/' },
      { word: 'night', phonetic: '/naɪt/' },
      { word: 'buy', phonetic: '/baɪ/' },
    ],
  },
  {
    symbol: '/ɔɪ/',
    subcategory: diphthongSub,
    ref: REF_VOWEL,
    name: '双元音 /ɔɪ/',
    category: diphthongCategory,
    type: 'vowel',
    description:
      '由 /ɔ/ 滑向 /ɪ/ 的双元音，先圆唇再收拢。如 boy、toy、coin。',
    words: [
      { word: 'boy', phonetic: '/bɔɪ/' },
      { word: 'toy', phonetic: '/tɔɪ/' },
      { word: 'coin', phonetic: '/kɔɪn/' },
      { word: 'oil', phonetic: '/ɔɪl/' },
      { word: 'voice', phonetic: '/vɔɪs/' },
      { word: 'noise', phonetic: '/nɔɪz/' },
    ],
  },
  {
    symbol: '/aʊ/',
    subcategory: diphthongSub,
    ref: REF_VOWEL,
    name: '双元音 /aʊ/',
    category: diphthongCategory,
    type: 'vowel',
    description:
      '由 /a/ 滑向 /ʊ/ 的双元音，先张大嘴再圆唇收拢。如 house、now、cow。',
    words: [
      { word: 'house', phonetic: '/haʊs/' },
      { word: 'now', phonetic: '/naʊ/' },
      { word: 'how', phonetic: '/haʊ/' },
      { word: 'cow', phonetic: '/kaʊ/' },
      { word: 'brown', phonetic: '/braʊn/' },
      { word: 'mouth', phonetic: '/maʊθ/' },
    ],
  },
  {
    symbol: '/əʊ/',
    subcategory: diphthongSub,
    ref: REF_VOWEL,
    name: '双元音 /əʊ/',
    category: diphthongCategory,
    type: 'vowel',
    description:
      '由 /ə/ 滑向 /ʊ/ 的双元音（美式常写作 /oʊ/），口型由开变圆。如 go、home、phone。',
    words: [
      { word: 'go', phonetic: '/ɡəʊ/' },
      { word: 'no', phonetic: '/nəʊ/' },
      { word: 'home', phonetic: '/həʊm/' },
      { word: 'phone', phonetic: '/fəʊn/' },
      { word: 'boat', phonetic: '/bəʊt/' },
      { word: 'snow', phonetic: '/snəʊ/' },
    ],
  },
  {
    symbol: '/ɪə/',
    subcategory: diphthongSub,
    ref: REF_VOWEL,
    name: '双元音 /ɪə/',
    category: diphthongCategory,
    type: 'vowel',
    description:
      '由 /ɪ/ 滑向 /ə/ 的双元音，先紧后松。如 ear、here、near。',
    words: [
      { word: 'ear', phonetic: '/ɪə/' },
      { word: 'here', phonetic: '/hɪə/' },
      { word: 'near', phonetic: '/nɪə/' },
      { word: 'dear', phonetic: '/dɪə/' },
      { word: 'year', phonetic: '/jɪə/' },
      { word: 'hear', phonetic: '/hɪə/' },
    ],
  },
  {
    symbol: '/eə/',
    subcategory: diphthongSub,
    ref: REF_VOWEL,
    name: '双元音 /eə/',
    category: diphthongCategory,
    type: 'vowel',
    description:
      '由 /e/ 滑向 /ə/ 的双元音，开口较大。如 air、hair、chair。',
    words: [
      { word: 'air', phonetic: '/eə/' },
      { word: 'hair', phonetic: '/heə/' },
      { word: 'chair', phonetic: '/tʃeə/' },
      { word: 'where', phonetic: '/weə/' },
      { word: 'there', phonetic: '/ðeə/' },
      { word: 'bear', phonetic: '/beə/' },
    ],
  },
  {
    symbol: '/ʊə/',
    subcategory: diphthongSub,
    ref: REF_VOWEL,
    name: '双元音 /ʊə/',
    category: diphthongCategory,
    type: 'vowel',
    description:
      '由 /ʊ/ 滑向 /ə/ 的双元音，先圆唇再放松。如 sure、tour、poor。',
    words: [
      { word: 'sure', phonetic: '/ʃʊə/' },
      { word: 'tour', phonetic: '/tʊə/' },
      { word: 'poor', phonetic: '/pʊə/' },
      { word: 'pure', phonetic: '/pjʊə/' },
      { word: 'cure', phonetic: '/kjʊə/' },
      { word: 'during', phonetic: '/ˈdjʊərɪŋ/' },
    ],
  },
];

const plosiveCategory = consonantCategory;
const fricativeCategory = consonantCategory;
const affricateCategory = consonantCategory;
const nasalCategory = consonantCategory;
const approximantCategory = consonantCategory;

export const CONSONANT_PHONEMES: Phoneme[] = [
  {
    symbol: '/p/',
    subcategory: plosiveSub,
    ref: REF_CONSONANT,
    name: '清爆破音 /p/',
    category: plosiveCategory,
    type: 'consonant',
    description:
      '双唇闭合后突然打开，气流冲出；不振动声带。如 pen、pig、cup。',
    words: [
      { word: 'pen', phonetic: '/pen/' },
      { word: 'pig', phonetic: '/pɪɡ/' },
      { word: 'cup', phonetic: '/kʌp/' },
      { word: 'happy', phonetic: '/ˈhæpi/' },
      { word: 'top', phonetic: '/tɒp/' },
      { word: 'paper', phonetic: '/ˈpeɪpə/' },
    ],
  },
  {
    symbol: '/b/',
    subcategory: plosiveSub,
    ref: REF_CONSONANT,
    name: '浊爆破音 /b/',
    category: plosiveCategory,
    type: 'consonant',
    description:
      '与 /p/ 位置相同，但声带振动（浊音）。如 bed、big、bus。',
    words: [
      { word: 'bed', phonetic: '/bed/' },
      { word: 'big', phonetic: '/bɪɡ/' },
      { word: 'bus', phonetic: '/bʌs/' },
      { word: 'job', phonetic: '/dʒɒb/' },
      { word: 'book', phonetic: '/bʊk/' },
      { word: 'baby', phonetic: '/ˈbeɪbi/' },
    ],
  },
  {
    symbol: '/t/',
    subcategory: plosiveSub,
    ref: REF_CONSONANT,
    name: '清爆破音 /t/',
    category: plosiveCategory,
    type: 'consonant',
    description:
      '舌尖抵上齿龈后放开，气流冲出；不振动声带。如 tea、two、ten。',
    words: [
      { word: 'tea', phonetic: '/tiː/' },
      { word: 'two', phonetic: '/tuː/' },
      { word: 'ten', phonetic: '/ten/' },
      { word: 'cat', phonetic: '/kæt/' },
      { word: 'sit', phonetic: '/sɪt/' },
      { word: 'time', phonetic: '/taɪm/' },
    ],
  },
  {
    symbol: '/d/',
    subcategory: plosiveSub,
    ref: REF_CONSONANT,
    name: '浊爆破音 /d/',
    category: plosiveCategory,
    type: 'consonant',
    description:
      '与 /t/ 位置相同，但声带振动（浊音）。如 dog、day、red。',
    words: [
      { word: 'dog', phonetic: '/dɒɡ/' },
      { word: 'day', phonetic: '/deɪ/' },
      { word: 'red', phonetic: '/red/' },
      { word: 'bed', phonetic: '/bed/' },
      { word: 'door', phonetic: '/dɔː/' },
      { word: 'good', phonetic: '/ɡʊd/' },
    ],
  },
  {
    symbol: '/k/',
    subcategory: plosiveSub,
    ref: REF_CONSONANT,
    name: '清爆破音 /k/',
    category: plosiveCategory,
    type: 'consonant',
    description:
      '舌后部抵软腭后放开，气流冲出；不振动声带。如 cat、key、book。',
    words: [
      { word: 'cat', phonetic: '/kæt/' },
      { word: 'key', phonetic: '/kiː/' },
      { word: 'book', phonetic: '/bʊk/' },
      { word: 'car', phonetic: '/kɑː/' },
      { word: 'black', phonetic: '/blæk/' },
      { word: 'cold', phonetic: '/kəʊld/' },
    ],
  },
  {
    symbol: '/ɡ/',
    subcategory: plosiveSub,
    ref: REF_CONSONANT,
    name: '浊爆破音 /ɡ/',
    category: plosiveCategory,
    type: 'consonant',
    description:
      '与 /k/ 位置相同，但声带振动（浊音）。如 go、girl、egg。',
    words: [
      { word: 'go', phonetic: '/ɡəʊ/' },
      { word: 'girl', phonetic: '/ɡɜːl/' },
      { word: 'egg', phonetic: '/eɡ/' },
      { word: 'bag', phonetic: '/bæɡ/' },
      { word: 'big', phonetic: '/bɪɡ/' },
      { word: 'dog', phonetic: '/dɒɡ/' },
    ],
  },
  {
    symbol: '/f/',
    subcategory: fricativeSub,
    ref: REF_CONSONANT,
    name: '清摩擦音 /f/',
    category: fricativeCategory,
    type: 'consonant',
    description:
      '上齿轻触下唇，气流从缝隙挤出；不振动声带。如 fish、five、food。',
    words: [
      { word: 'fish', phonetic: '/fɪʃ/' },
      { word: 'five', phonetic: '/faɪv/' },
      { word: 'food', phonetic: '/fuːd/' },
      { word: 'phone', phonetic: '/fəʊn/' },
      { word: 'knife', phonetic: '/naɪf/' },
      { word: 'coffee', phonetic: '/ˈkɒfi/' },
    ],
  },
  {
    symbol: '/v/',
    subcategory: fricativeSub,
    ref: REF_CONSONANT,
    name: '浊摩擦音 /v/',
    category: fricativeCategory,
    type: 'consonant',
    description:
      '与 /f/ 位置相同，但声带振动（浊音）。如 van、very、five。',
    words: [
      { word: 'van', phonetic: '/væn/' },
      { word: 'very', phonetic: '/ˈveri/' },
      { word: 'five', phonetic: '/faɪv/' },
      { word: 'love', phonetic: '/lʌv/' },
      { word: 'video', phonetic: '/ˈvɪdiəʊ/' },
      { word: 'voice', phonetic: '/vɔɪs/' },
    ],
  },
  {
    symbol: '/θ/',
    subcategory: fricativeSub,
    ref: REF_CONSONANT,
    name: '清摩擦音 /θ/',
    category: fricativeCategory,
    type: 'consonant',
    description:
      '舌尖轻触上齿，气流从缝隙挤出；不振动声带。如 think、three、thin。',
    words: [
      { word: 'think', phonetic: '/θɪŋk/' },
      { word: 'three', phonetic: '/θriː/' },
      { word: 'thin', phonetic: '/θɪn/' },
      { word: 'thanks', phonetic: '/θæŋks/' },
      { word: 'mouth', phonetic: '/maʊθ/' },
      { word: 'teeth', phonetic: '/tiːθ/' },
    ],
  },
  {
    symbol: '/ð/',
    subcategory: fricativeSub,
    ref: REF_CONSONANT,
    name: '浊摩擦音 /ð/',
    category: fricativeCategory,
    type: 'consonant',
    description:
      '与 /θ/ 位置相同，但声带振动（浊音）。如 this、that、they。',
    words: [
      { word: 'this', phonetic: '/ðɪs/' },
      { word: 'that', phonetic: '/ðæt/' },
      { word: 'they', phonetic: '/ðeɪ/' },
      { word: 'mother', phonetic: '/ˈmʌðə/' },
      { word: 'father', phonetic: '/ˈfɑːðə/' },
      { word: 'weather', phonetic: '/ˈweðə/' },
    ],
  },
  {
    symbol: '/s/',
    subcategory: fricativeSub,
    ref: REF_CONSONANT,
    name: '清摩擦音 /s/',
    category: fricativeCategory,
    type: 'consonant',
    description:
      '舌尖接近上齿龈，气流从窄缝挤出；不振动声带。如 see、sit、sun。',
    words: [
      { word: 'see', phonetic: '/siː/' },
      { word: 'sit', phonetic: '/sɪt/' },
      { word: 'sun', phonetic: '/sʌn/' },
      { word: 'house', phonetic: '/haʊs/' },
      { word: 'bus', phonetic: '/bʌs/' },
      { word: 'six', phonetic: '/sɪks/' },
    ],
  },
  {
    symbol: '/z/',
    subcategory: fricativeSub,
    ref: REF_CONSONANT,
    name: '浊摩擦音 /z/',
    category: fricativeCategory,
    type: 'consonant',
    description:
      '与 /s/ 位置相同，但声带振动（浊音）。如 zoo、zero、is。',
    words: [
      { word: 'zoo', phonetic: '/zuː/' },
      { word: 'zero', phonetic: '/ˈzɪərəʊ/' },
      { word: 'is', phonetic: '/ɪz/' },
      { word: 'his', phonetic: '/hɪz/' },
      { word: 'nose', phonetic: '/nəʊz/' },
      { word: 'these', phonetic: '/ðiːz/' },
    ],
  },
  {
    symbol: '/ʃ/',
    subcategory: fricativeSub,
    ref: REF_CONSONANT,
    name: '清摩擦音 /ʃ/',
    category: fricativeCategory,
    type: 'consonant',
    description:
      '舌面抬起接近上颚，气流从较宽的缝隙挤出；不振动声带。如 she、ship、fish。',
    words: [
      { word: 'she', phonetic: '/ʃiː/' },
      { word: 'ship', phonetic: '/ʃɪp/' },
      { word: 'fish', phonetic: '/fɪʃ/' },
      { word: 'shop', phonetic: '/ʃɒp/' },
      { word: 'shoe', phonetic: '/ʃuː/' },
      { word: 'wish', phonetic: '/wɪʃ/' },
    ],
  },
  {
    symbol: '/ʒ/',
    subcategory: fricativeSub,
    ref: REF_CONSONANT,
    name: '浊摩擦音 /ʒ/',
    category: fricativeCategory,
    type: 'consonant',
    description:
      '与 /ʃ/ 位置相同，但声带振动（浊音）。常拼作 s（vision）、g（garage）。',
    words: [
      { word: 'vision', phonetic: '/ˈvɪʒn/' },
      { word: 'measure', phonetic: '/ˈmeʒə/' },
      { word: 'pleasure', phonetic: '/ˈpleʒə/' },
      { word: 'television', phonetic: '/ˈtelɪvɪʒn/' },
      { word: 'usual', phonetic: '/ˈjuːʒuəl/' },
      { word: 'garage', phonetic: '/ˈɡærɑːʒ/' },
    ],
  },
  {
    symbol: '/h/',
    subcategory: fricativeSub,
    ref: REF_CONSONANT,
    name: '清摩擦音 /h/',
    category: fricativeCategory,
    type: 'consonant',
    description:
      '喉部气流轻擦发出的清音，只出现在音节开头。如 hat、hand、house。',
    words: [
      { word: 'hat', phonetic: '/hæt/' },
      { word: 'hand', phonetic: '/hænd/' },
      { word: 'house', phonetic: '/haʊs/' },
      { word: 'happy', phonetic: '/ˈhæpi/' },
      { word: 'hello', phonetic: '/həˈləʊ/' },
      { word: 'home', phonetic: '/həʊm/' },
    ],
  },
  {
    symbol: '/tʃ/',
    subcategory: affricateSub,
    ref: REF_CONSONANT,
    name: '清破擦音 /tʃ/',
    category: affricateCategory,
    type: 'consonant',
    description:
      '先发 /t/ 再滑向 /ʃ/ 的破擦音；不振动声带。如 chair、cheese、watch。',
    words: [
      { word: 'chair', phonetic: '/tʃeə/' },
      { word: 'cheese', phonetic: '/tʃiːz/' },
      { word: 'chicken', phonetic: '/ˈtʃɪkɪn/' },
      { word: 'child', phonetic: '/tʃaɪld/' },
      { word: 'watch', phonetic: '/wɒtʃ/' },
      { word: 'teacher', phonetic: '/ˈtiːtʃə/' },
    ],
  },
  {
    symbol: '/dʒ/',
    subcategory: affricateSub,
    ref: REF_CONSONANT,
    name: '浊破擦音 /dʒ/',
    category: affricateCategory,
    type: 'consonant',
    description:
      '先发 /d/ 再滑向 /ʒ/ 的破擦音；声带振动。如 jeep、jump、juice。',
    words: [
      { word: 'jeep', phonetic: '/dʒiːp/' },
      { word: 'jump', phonetic: '/dʒʌmp/' },
      { word: 'juice', phonetic: '/dʒuːs/' },
      { word: 'job', phonetic: '/dʒɒb/' },
      { word: 'age', phonetic: '/eɪdʒ/' },
      { word: 'orange', phonetic: '/ˈɒrɪndʒ/' },
    ],
  },
  {
    symbol: '/m/',
    subcategory: nasalSub,
    ref: REF_CONSONANT,
    name: '鼻音 /m/',
    category: nasalCategory,
    type: 'consonant',
    description:
      '双唇闭合，气流从鼻腔通过，声带振动。如 man、milk、mother。',
    words: [
      { word: 'man', phonetic: '/mæn/' },
      { word: 'milk', phonetic: '/mɪlk/' },
      { word: 'mother', phonetic: '/ˈmʌðə/' },
      { word: 'name', phonetic: '/neɪm/' },
      { word: 'time', phonetic: '/taɪm/' },
      { word: 'home', phonetic: '/həʊm/' },
    ],
  },
  {
    symbol: '/n/',
    subcategory: nasalSub,
    ref: REF_CONSONANT,
    name: '鼻音 /n/',
    category: nasalCategory,
    type: 'consonant',
    description:
      '舌尖抵上齿龈，气流从鼻腔通过，声带振动。如 no、name、nine。',
    words: [
      { word: 'no', phonetic: '/nəʊ/' },
      { word: 'name', phonetic: '/neɪm/' },
      { word: 'nine', phonetic: '/naɪn/' },
      { word: 'sun', phonetic: '/sʌn/' },
      { word: 'pen', phonetic: '/pen/' },
      { word: 'night', phonetic: '/naɪt/' },
    ],
  },
  {
    symbol: '/ŋ/',
    subcategory: nasalSub,
    ref: REF_CONSONANT,
    name: '鼻音 /ŋ/',
    category: nasalCategory,
    type: 'consonant',
    description:
      '舌后部抵软腭，气流从鼻腔通过，声带振动。常拼作 ng。如 sing、song、king。',
    words: [
      { word: 'sing', phonetic: '/sɪŋ/' },
      { word: 'song', phonetic: '/sɒŋ/' },
      { word: 'king', phonetic: '/kɪŋ/' },
      { word: 'long', phonetic: '/lɒŋ/' },
      { word: 'morning', phonetic: '/ˈmɔːnɪŋ/' },
      { word: 'thank', phonetic: '/θæŋk/' },
    ],
  },
  {
    symbol: '/l/',
    subcategory: approximantSub,
    ref: REF_CONSONANT,
    name: '近音 /l/',
    category: approximantCategory,
    type: 'consonant',
    description:
      '舌尖抵上齿龈，气流从舌两侧通过，声带振动。如 look、light、love。',
    words: [
      { word: 'look', phonetic: '/lʊk/' },
      { word: 'light', phonetic: '/laɪt/' },
      { word: 'love', phonetic: '/lʌv/' },
      { word: 'milk', phonetic: '/mɪlk/' },
      { word: 'ball', phonetic: '/bɔːl/' },
      { word: 'school', phonetic: '/skuːl/' },
    ],
  },
  {
    symbol: '/r/',
    subcategory: approximantSub,
    ref: REF_CONSONANT,
    name: '近音 /r/',
    category: approximantCategory,
    type: 'consonant',
    description:
      '齿龈后（卷舌）近音 [ɹ̠]，舌尖向硬腭卷起但不接触、气流从舌面通过，声带振动。符号写作 /r/，但通常不是颤音。如 red、run、right。',
    words: [
      { word: 'red', phonetic: '/red/' },
      { word: 'run', phonetic: '/rʌn/' },
      { word: 'right', phonetic: '/raɪt/' },
      { word: 'room', phonetic: '/ruːm/' },
      { word: 'car', phonetic: '/kɑː/' },
      { word: 'read', phonetic: '/riːd/' },
    ],
  },
  {
    symbol: '/j/',
    subcategory: approximantSub,
    ref: REF_CONSONANT,
    name: '近音 /j/',
    category: approximantCategory,
    type: 'consonant',
    description:
      '舌面抬向硬腭发出的半元音，类似中文「也」。如 yes、you、year。',
    words: [
      { word: 'yes', phonetic: '/jes/' },
      { word: 'you', phonetic: '/juː/' },
      { word: 'year', phonetic: '/jɪə/' },
      { word: 'young', phonetic: '/jʌŋ/' },
      { word: 'yellow', phonetic: '/ˈjeləʊ/' },
      { word: 'new', phonetic: '/njuː/' },
    ],
  },
  {
    symbol: '/w/',
    subcategory: approximantSub,
    ref: REF_CONSONANT,
    name: '近音 /w/',
    category: approximantCategory,
    type: 'consonant',
    description:
      '双唇收圆向前突出发出的半元音，类似中文「我」。如 we、water、window。',
    words: [
      { word: 'we', phonetic: '/wiː/' },
      { word: 'water', phonetic: '/ˈwɔːtə/' },
      { word: 'window', phonetic: '/ˈwɪndəʊ/' },
      { word: 'want', phonetic: '/wɒnt/' },
      { word: 'what', phonetic: '/wɒt/' },
      { word: 'white', phonetic: '/waɪt/' },
    ],
  },
  {
    symbol: '/tr/',
    subcategory: affricateSub,
    ref: REF_CONSONANT,
    name: '清破擦 /tr/',
    category: consonantCategory,
    type: 'consonant',
    description:
      '由 /t/ 滑向 /r/，舌尖抵上齿龈后快速放开，气流冲出。如 tree、train、try。',
    words: [
      { word: 'tree', phonetic: '/triː/' },
      { word: 'train', phonetic: '/treɪn/' },
      { word: 'try', phonetic: '/traɪ/' },
      { word: 'truck', phonetic: '/trʌk/' },
      { word: 'true', phonetic: '/truː/' },
      { word: 'travel', phonetic: '/ˈtrævl/' },
    ],
  },
  {
    symbol: '/ts/',
    subcategory: affricateSub,
    ref: REF_CONSONANT,
    name: '清破擦 /ts/',
    category: consonantCategory,
    type: 'consonant',
    description:
      '由 /t/ 滑向 /s/，舌尖抵上齿龈后放开成摩擦。常见于复数/第三人称词尾。如 cats、hats、students。',
    words: [
      { word: 'cats', phonetic: '/kæts/' },
      { word: 'hats', phonetic: '/hæts/' },
      { word: 'students', phonetic: '/ˈstjuːdənts/' },
      { word: 'boats', phonetic: '/bəʊts/' },
      { word: 'lights', phonetic: '/laɪts/' },
    ],
  },
  {
    symbol: '/dr/',
    subcategory: affricateSub,
    ref: REF_CONSONANT,
    name: '浊破擦 /dr/',
    category: consonantCategory,
    type: 'consonant',
    description:
      '由 /d/ 滑向 /r/，与 /tr/ 位置相同但声带振动（浊音）。如 drive、dream、drink。',
    words: [
      { word: 'drive', phonetic: '/draɪv/' },
      { word: 'dream', phonetic: '/driːm/' },
      { word: 'drink', phonetic: '/drɪŋk/' },
      { word: 'dress', phonetic: '/dres/' },
      { word: 'dry', phonetic: '/draɪ/' },
      { word: 'drop', phonetic: '/drɒp/' },
    ],
  },
  {
    symbol: '/dz/',
    subcategory: affricateSub,
    ref: REF_CONSONANT,
    name: '浊破擦 /dz/',
    category: consonantCategory,
    type: 'consonant',
    description:
      '由 /d/ 滑向 /z/，与 /ts/ 位置相同但声带振动。常见于复数/第三人称词尾。如 beds、words、reads。',
    words: [
      { word: 'beds', phonetic: '/bedz/' },
      { word: 'words', phonetic: '/wɜːdz/' },
      { word: 'hands', phonetic: '/hændz/' },
      { word: 'reads', phonetic: '/riːdz/' },
      { word: 'cards', phonetic: '/kɑːdz/' },
    ],
  },
];

export const ALL_PHONEMES: Phoneme[] = [
  ...VOWEL_PHONEMES,
  ...CONSONANT_PHONEMES,
];

export function getPhoneme(symbol: string): Phoneme | undefined {
  return ALL_PHONEMES.find((p) => p.symbol === symbol);
}

export const IPA_PAIRS: IpaPair[] = [
  {
    a: '/ɪ/',
    b: '/iː/',
    label: '短 i 与长 iː',
    hint: 'bit — beat',
    description:
      '两者舌头位置接近，但 /ɪ/ 更短更松，/iː/ 更长更紧、嘴角拉得更开。',
  },
  {
    a: '/ə/',
    b: '/ɜː/',
    label: '短 /ə/ 与长 /ɜː/',
    hint: 'about — bird',
    description:
      '/ə/ 是短而轻的「模糊音」，常出现在非重读音节；/ɜː/ 是它的长元音，发同样的中部舌位但时值更长、更饱满（英式常带轻微卷舌）。',
  },
  {
    a: '/e/',
    b: '/æ/',
    label: '短音 e 与 æ',
    hint: 'bed — bad',
    description: '/e/ 口型较合，/æ/ 嘴张得更大、舌位更低，音色更亮。',
  },
  {
    a: '/æ/',
    b: '/ʌ/',
    label: 'æ 与 ʌ',
    hint: 'bad — bud',
    description: '/æ/ 嘴张大且偏前，/ʌ/ 口型半开、舌位靠中后，更像短「啊」。',
  },
  {
    a: '/ʌ/',
    b: '/ɑː/',
    label: 'ʌ 与 ɑː',
    hint: 'cut — cart',
    description: '/ʌ/ 是短音且口型更合，/ɑː/ 是长音、嘴张得更大、舌位更低。',
  },
  {
    a: '/e/',
    b: '/eɪ/',
    label: '短音 e 与双元音 eɪ',
    hint: 'let — late',
    description: '/e/ 是单个短音，/eɪ/ 由 /e/ 滑向 /ɪ/，音长明显更长且滑动。',
  },
  {
    a: '/ɒ/',
    b: '/ɔː/',
    label: 'ɒ 与 ɔː',
    hint: 'hot — horse',
    description: '/ɒ/ 短而口腔较开，/ɔː/ 长且嘴唇收得更圆。',
  },
  {
    a: '/ʊ/',
    b: '/uː/',
    label: 'ʊ 与 uː',
    hint: 'full — fool',
    description: '/ʊ/ 短而嘴唇较松，/uː/ 长且嘴唇收圆突出、肌肉更紧张。',
  },
  {
    a: '/əʊ/',
    b: '/aʊ/',
    label: 'əʊ 与 aʊ',
    hint: 'boat — bout',
    description: '/əʊ/ 从 /ə/ 滑向 /ʊ/（嘴收圆），/aʊ/ 从 /a/ 滑向 /ʊ/（先张大嘴）。',
  },
  {
    a: '/ɪə/',
    b: '/eə/',
    label: 'ɪə 与 eə',
    hint: 'beer — bear',
    description: '/ɪə/ 以短紧的 /ɪ/ 开头，/eə/ 以更开的 /e/ 开头。',
  },
  {
    a: '/eɪ/',
    b: '/aɪ/',
    label: 'eɪ 与 aɪ',
    hint: 'late — light',
    description: '/eɪ/ 开头口型较合，/aɪ/ 开头嘴张得更大。',
  },
  {
    a: '/θ/',
    b: '/ð/',
    label: '清 th 与浊 th',
    hint: 'thin — this',
    description: '发音位置相同，/θ/ 不振动声带（清），/ð/ 振动声带（浊）。',
  },
  {
    a: '/s/',
    b: '/ʃ/',
    label: 's 与 ʃ',
    hint: 'see — she',
    description: '/s/ 舌尖靠前、气流尖细，/ʃ/ 舌面抬得更高、气流更宽、嘴唇微圆。',
  },
  {
    a: '/s/',
    b: '/z/',
    label: 's 与 z',
    hint: 'see — zoo',
    description: '位置相同，/s/ 清、/z/ 浊（振动声带）。',
  },
  {
    a: '/s/',
    b: '/θ/',
    label: 's 与 th(θ)',
    hint: 'sink — think',
    description: '/s/ 舌尖抵上齿龈，/θ/ 舌尖轻触上齿、从齿缝挤出。',
  },
  {
    a: '/f/',
    b: '/v/',
    label: 'f 与 v',
    hint: 'fan — van',
    description: '位置相同（上齿碰下唇），/f/ 清、/v/ 浊。',
  },
  {
    a: '/v/',
    b: '/w/',
    label: 'v 与 w',
    hint: 'vest — west',
    description: '/v/ 上齿碰下唇、有摩擦，/w/ 双唇收圆、无摩擦。',
  },
  {
    a: '/ʃ/',
    b: '/tʃ/',
    label: 'ʃ 与 tʃ',
    hint: 'ship — chip',
    description: '/ʃ/ 是持续的摩擦音，/tʃ/ 是先堵住再爆破的破擦音。',
  },
  {
    a: '/tʃ/',
    b: '/dʒ/',
    label: 'tʃ 与 dʒ',
    hint: 'cheap — jeep',
    description: '发音位置相同，/tʃ/ 清、/dʒ/ 浊（振动声带）。',
  },
  {
    a: '/p/',
    b: '/b/',
    label: 'p 与 b',
    hint: 'pat — bat',
    description: '位置相同，/p/ 清、/b/ 浊。',
  },
  {
    a: '/t/',
    b: '/d/',
    label: 't 与 d',
    hint: 'two — do',
    description: '位置相同，/t/ 清、/d/ 浊。',
  },
  {
    a: '/k/',
    b: '/ɡ/',
    label: 'k 与 ɡ',
    hint: 'coat — goat',
    description: '位置相同，/k/ 清、/ɡ/ 浊。',
  },
  {
    a: '/n/',
    b: '/ŋ/',
    label: 'n 与 ŋ',
    hint: 'sin — sing',
    description: '/n/ 舌尖抵上齿龈，/ŋ/ 舌后部抵软腭。',
  },
  {
    a: '/l/',
    b: '/r/',
    label: 'l 与 r',
    hint: 'light — right',
    description: '/l/ 舌尖抵上齿龈、气流从两侧过，/r/ 舌尖卷起不接触。',
  },
  {
    a: '/z/',
    b: '/ð/',
    label: 'z 与 ð',
    hint: 'breeze — breathe',
    description: '/z/ 舌尖抵上齿龈，/ð/ 舌尖轻触上齿。',
  },
];
