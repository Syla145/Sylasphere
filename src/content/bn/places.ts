import type { L10n, PlaceItem } from '../../domain/types';

/**
 * Bangladeshi places. English names follow the official spellings of 2018
 * (Chattogram, Cumilla, Barishal, Jashore, Bogura); the older spellings are
 * accepted as listed variants. German names use the established German form
 * where one exists (Chittagong).
 */

const city = (
  slug: string,
  native: string,
  translit: string,
  en: string,
  de: string,
  division: string,
  tier: 1 | 2 | 3,
  extra: string[] = [],
  hint?: L10n,
): PlaceItem => ({
  id: `bn:city:${slug}`,
  kind: 'city',
  native,
  translit,
  names: { en, de },
  accepted: [translit, en, de, ...extra],
  countryId: 'BD',
  regionId: `bn:region:${division}`,
  tier,
  hint,
});

export const CITIES: PlaceItem[] = [
  city('dhaka', 'ঢাকা', 'Dhaka', 'Dhaka', 'Dhaka', 'dhaka', 1, [], { de: 'Hauptstadt Bangladeschs', en: 'Capital of Bangladesh' }),
  city('chattogram', 'চট্টগ্রাম', 'Chattogram', 'Chattogram', 'Chittagong', 'chattogram', 1, ['Chittagong', 'Chottogram'], { de: 'Größter Hafen des Landes', en: 'The country’s largest port' }),
  city('khulna', 'খুলনা', 'Khulna', 'Khulna', 'Khulna', 'khulna', 1, [], { de: 'Tor zu den Sundarbans', en: 'Gateway to the Sundarbans' }),
  city('rajshahi', 'রাজশাহী', 'Rajshahi', 'Rajshahi', 'Rajshahi', 'rajshahi', 1, [], { de: 'Am Padma, nahe der indischen Grenze', en: 'On the Padma, near the Indian border' }),
  city('sylhet', 'সিলেট', 'Sylhet', 'Sylhet', 'Sylhet', 'sylhet', 1, ['Silet'], { de: 'Teeanbaugebiet im Nordosten', en: 'Tea country in the north-east' }),
  city('barishal', 'বরিশাল', 'Barishal', 'Barishal', 'Barisal', 'barishal', 1, ['Barisal', 'Borishal']),
  city('rangpur', 'রংপুর', 'Rangpur', 'Rangpur', 'Rangpur', 'rangpur', 1, ['Rongpur']),
  city('mymensingh', 'ময়মনসিংহ', 'Mymensingh', 'Mymensingh', 'Mymensingh', 'mymensingh', 1, ['Moymonsingh', 'Maimansingh', 'Mymensing']),
  city('cumilla', 'কুমিল্লা', 'Cumilla', 'Cumilla', 'Comilla', 'chattogram', 1, ['Comilla', 'Kumilla'], { de: 'An der Fernstraße Dhaka–Chattogram', en: 'On the Dhaka–Chattogram highway' }),
  city('gazipur', 'গাজীপুর', 'Gazipur', 'Gazipur', 'Gazipur', 'dhaka', 1, ['Gajipur']),
  city('narayanganj', 'নারায়ণগঞ্জ', 'Narayanganj', 'Narayanganj', 'Narayanganj', 'dhaka', 1, ['Narayangonj']),
  city('coxs-bazar', 'কক্সবাজার', 'Koksbajar', 'Cox’s Bazar', 'Cox’s Bazar', 'chattogram', 1, ['Coxs Bazar', 'Cox Bazar', 'Coxsbazar', 'Koks Bazar'], { de: 'Längster Naturstrand der Welt', en: 'World’s longest natural beach' }),
  city('bogura', 'বগুড়া', 'Bogura', 'Bogura', 'Bogra', 'rajshahi', 1, ['Bogra']),
  city('jashore', 'যশোর', 'Jashore', 'Jashore', 'Jessore', 'khulna', 1, ['Jessore', 'Joshor', 'Jashor']),
  city('dinajpur', 'দিনাজপুর', 'Dinajpur', 'Dinajpur', 'Dinajpur', 'rangpur', 2),
  city('pabna', 'পাবনা', 'Pabna', 'Pabna', 'Pabna', 'rajshahi', 2),
  city('tangail', 'টাঙ্গাইল', 'Tangail', 'Tangail', 'Tangail', 'dhaka', 2),
  city('kushtia', 'কুষ্টিয়া', 'Kushtia', 'Kushtia', 'Kushtia', 'khulna', 2, ['Kustia']),
  city('faridpur', 'ফরিদপুর', 'Faridpur', 'Faridpur', 'Faridpur', 'dhaka', 2, ['Foridpur']),
  city('noakhali', 'নোয়াখালী', 'Noakhali', 'Noakhali', 'Noakhali', 'chattogram', 2),
  city('feni', 'ফেনী', 'Feni', 'Feni', 'Feni', 'chattogram', 2),
  city('brahmanbaria', 'ব্রাহ্মণবাড়িয়া', 'Brahmanbaria', 'Brahmanbaria', 'Brahmanbaria', 'chattogram', 2, ['Bramhanbaria']),
  city('sirajganj', 'সিরাজগঞ্জ', 'Sirajganj', 'Sirajganj', 'Sirajganj', 'rajshahi', 2, ['Sirajgonj']),
  city('narsingdi', 'নরসিংদী', 'Narsingdi', 'Narsingdi', 'Narsingdi', 'dhaka', 2, ['Norsingdi']),
  city('jamalpur', 'জামালপুর', 'Jamalpur', 'Jamalpur', 'Jamalpur', 'mymensingh', 2),
  city('naogaon', 'নওগাঁ', 'Naogaon', 'Naogaon', 'Naogaon', 'rajshahi', 2, ['Naoga', 'Nowga']),
  city('chandpur', 'চাঁদপুর', 'Chandpur', 'Chandpur', 'Chandpur', 'chattogram', 2),
  city('satkhira', 'সাতক্ষীরা', 'Satkhira', 'Satkhira', 'Satkhira', 'khulna', 2, ['Shatkhira']),
  city('patuakhali', 'পটুয়াখালী', 'Patuakhali', 'Patuakhali', 'Patuakhali', 'barishal', 2),
  city('moulvibazar', 'মৌলভীবাজার', 'Moulvibazar', 'Moulvibazar', 'Moulvibazar', 'sylhet', 2, ['Moulvi Bazar', 'Maulvibazar', 'Moulavibazar']),
  city('habiganj', 'হবিগঞ্জ', 'Habiganj', 'Habiganj', 'Habiganj', 'sylhet', 2, ['Hobiganj']),
  city('sunamganj', 'সুনামগঞ্জ', 'Sunamganj', 'Sunamganj', 'Sunamganj', 'sylhet', 2, ['Sunamgonj']),
  city('kishoreganj', 'কিশোরগঞ্জ', 'Kishoreganj', 'Kishoreganj', 'Kishoreganj', 'dhaka', 2, ['Kishorganj', 'Kishoregonj']),
  city('netrokona', 'নেত্রকোণা', 'Netrokona', 'Netrokona', 'Netrokona', 'mymensingh', 3, ['Netrakona']),
  city('sherpur', 'শেরপুর', 'Sherpur', 'Sherpur', 'Sherpur', 'mymensingh', 3),
  city('thakurgaon', 'ঠাকুরগাঁও', 'Thakurgaon', 'Thakurgaon', 'Thakurgaon', 'rangpur', 3),
  city('panchagarh', 'পঞ্চগড়', 'Panchagarh', 'Panchagarh', 'Panchagarh', 'rangpur', 3, ['Panchagar', 'Ponchogor'], { de: 'Nördlichster Distrikt', en: 'Northernmost district' }),
  city('lalmonirhat', 'লালমনিরহাট', 'Lalmonirhat', 'Lalmonirhat', 'Lalmonirhat', 'rangpur', 3),
  city('kurigram', 'কুড়িগ্রাম', 'Kurigram', 'Kurigram', 'Kurigram', 'rangpur', 3),
  city('gaibandha', 'গাইবান্ধা', 'Gaibandha', 'Gaibandha', 'Gaibandha', 'rangpur', 3),
  city('nilphamari', 'নীলফামারী', 'Nilphamari', 'Nilphamari', 'Nilphamari', 'rangpur', 3, ['Nilfamari']),
  city('saidpur', 'সৈয়দপুর', 'Saidpur', 'Saidpur', 'Saidpur', 'rangpur', 3, ['Syedpur'], { de: 'Flughafen im Nordwesten', en: 'Airport in the north-west' }),
  city('chapai-nawabganj', 'চাঁপাইনবাবগঞ্জ', 'Chapai Nawabganj', 'Chapai Nawabganj', 'Chapai Nawabganj', 'rajshahi', 3, ['Chapainawabganj', 'Nawabganj']),
  city('natore', 'নাটোর', 'Natore', 'Natore', 'Natore', 'rajshahi', 3, ['Nator']),
  city('magura', 'মাগুরা', 'Magura', 'Magura', 'Magura', 'khulna', 3),
  city('jhenaidah', 'ঝিনাইদহ', 'Jhenaidah', 'Jhenaidah', 'Jhenaidah', 'khulna', 3, ['Jhinaidah', 'Jhenidah']),
  city('bagerhat', 'বাগেরহাট', 'Bagerhat', 'Bagerhat', 'Bagerhat', 'khulna', 3),
  city('bhola', 'ভোলা', 'Bhola', 'Bhola', 'Bhola', 'barishal', 3, [], { de: 'Größte Insel des Landes', en: 'The country’s largest island' }),
  city('rangamati', 'রাঙ্গামাটি', 'Rangamati', 'Rangamati', 'Rangamati', 'chattogram', 3, ['Rangamati']),
  city('mongla', 'মোংলা', 'Mongla', 'Mongla', 'Mongla', 'khulna', 3, [], { de: 'Zweitgrößter Seehafen', en: 'Second seaport' }),

  // The remaining district towns (64 districts in total)
  city('munshiganj', 'মুন্সীগঞ্জ', 'Munshiganj', 'Munshiganj', 'Munshiganj', 'dhaka', 3, ['Munshigonj', 'Munsiganj']),
  city('manikganj', 'মানিকগঞ্জ', 'Manikganj', 'Manikganj', 'Manikganj', 'dhaka', 3, ['Manikgonj']),
  city('madaripur', 'মাদারীপুর', 'Madaripur', 'Madaripur', 'Madaripur', 'dhaka', 3),
  city('gopalganj', 'গোপালগঞ্জ', 'Gopalganj', 'Gopalganj', 'Gopalganj', 'dhaka', 3, ['Gopalgonj']),
  city('rajbari', 'রাজবাড়ী', 'Rajbari', 'Rajbari', 'Rajbari', 'dhaka', 3),
  city('shariatpur', 'শরীয়তপুর', 'Shariatpur', 'Shariatpur', 'Shariatpur', 'dhaka', 3, ['Shoriatpur', 'Sariatpur']),
  city('lakshmipur', 'লক্ষ্মীপুর', 'Lakshmipur', 'Lakshmipur', 'Lakshmipur', 'chattogram', 3, ['Laxmipur', 'Lokkhipur', 'Lakhipur']),
  city('khagrachhari', 'খাগড়াছড়ি', 'Khagrachhari', 'Khagrachhari', 'Khagrachhari', 'chattogram', 3, ['Khagrachari'], { de: 'Bergland im Südosten', en: 'Hill Tracts in the south-east' }),
  city('bandarban', 'বান্দরবান', 'Bandarban', 'Bandarban', 'Bandarban', 'chattogram', 3, [], { de: 'Bergland im Südosten', en: 'Hill Tracts in the south-east' }),
  city('joypurhat', 'জয়পুরহাট', 'Joypurhat', 'Joypurhat', 'Joypurhat', 'rajshahi', 3, ['Jaipurhat', 'Joypur Hat']),
  city('chuadanga', 'চুয়াডাঙ্গা', 'Chuadanga', 'Chuadanga', 'Chuadanga', 'khulna', 3),
  city('meherpur', 'মেহেরপুর', 'Meherpur', 'Meherpur', 'Meherpur', 'khulna', 3),
  city('narail', 'নড়াইল', 'Narail', 'Narail', 'Narail', 'khulna', 3, ['Norail']),
  city('pirojpur', 'পিরোজপুর', 'Pirojpur', 'Pirojpur', 'Pirojpur', 'barishal', 3),
  city('jhalokathi', 'ঝালকাঠি', 'Jhalakathi', 'Jhalakathi', 'Jhalakathi', 'barishal', 3, ['Jhalokathi', 'Jhalokati']),
  city('barguna', 'বরগুনা', 'Barguna', 'Barguna', 'Barguna', 'barishal', 3, ['Borguna']),

  // Further large towns
  city('savar', 'সাভার', 'Savar', 'Savar', 'Savar', 'dhaka', 2, ['Shavar'], { de: 'Industriegürtel westlich von Dhaka', en: 'Industrial belt west of Dhaka' }),
  city('tongi', 'টঙ্গী', 'Tongi', 'Tongi', 'Tongi', 'dhaka', 2, ['Tungi']),
  city('ashulia', 'আশুলিয়া', 'Ashulia', 'Ashulia', 'Ashulia', 'dhaka', 3),
  city('bhairab', 'ভৈরব', 'Bhairab', 'Bhairab', 'Bhairab', 'dhaka', 3, ['Bhairab Bazar', 'Voirob'], { de: 'Brücken über die Meghna', en: 'Bridges over the Meghna' }),
  city('sreemangal', 'শ্রীমঙ্গল', 'Sreemangal', 'Sreemangal', 'Sreemangal', 'sylhet', 2, ['Srimangal', 'Srimongol'], { de: 'Teehauptstadt', en: 'Tea capital' }),
  city('kulaura', 'কুলাউড়া', 'Kulaura', 'Kulaura', 'Kulaura', 'sylhet', 3),
  city('teknaf', 'টেকনাফ', 'Teknaf', 'Teknaf', 'Teknaf', 'chattogram', 2, [], { de: 'Südspitze an der Grenze zu Myanmar', en: 'Southern tip at the Myanmar border' }),
  city('ukhia', 'উখিয়া', 'Ukhia', 'Ukhia', 'Ukhia', 'chattogram', 3, ['Ukhiya']),
  city('chakaria', 'চকরিয়া', 'Chakaria', 'Chakaria', 'Chakaria', 'chattogram', 3, ['Chokoria']),
  city('ramu', 'রামু', 'Ramu', 'Ramu', 'Ramu', 'chattogram', 3),
  city('patiya', 'পটিয়া', 'Patiya', 'Patiya', 'Patiya', 'chattogram', 3, ['Potiya', 'Patia']),
  city('sitakunda', 'সীতাকুণ্ড', 'Sitakunda', 'Sitakunda', 'Sitakunda', 'chattogram', 3, ['Sitakundu']),
  city('mirsharai', 'মীরসরাই', 'Mirsharai', 'Mirsharai', 'Mirsharai', 'chattogram', 3, ['Mirsarai', 'Mirshorai']),
  city('ishwardi', 'ঈশ্বরদী', 'Ishwardi', 'Ishwardi', 'Ishwardi', 'rajshahi', 3, ['Ishurdi', 'Iswardi'], { de: 'Bahnknoten, nahe der Hardinge-Brücke', en: 'Rail hub near the Hardinge Bridge' }),
  city('chaumuhani', 'চৌমুহনী', 'Chowmuhani', 'Chowmuhani', 'Chowmuhani', 'chattogram', 3, ['Chaumuhani', 'Choumuhani']),
  city('laksam', 'লাকসাম', 'Laksam', 'Laksam', 'Laksam', 'chattogram', 3, ['Laksham']),
  city('daudkandi', 'দাউদকান্দি', 'Daudkandi', 'Daudkandi', 'Daudkandi', 'chattogram', 3, [], { de: 'An der Fernstraße Dhaka–Chattogram', en: 'On the Dhaka–Chattogram highway' }),
  city('chandina', 'চান্দিনা', 'Chandina', 'Chandina', 'Chandina', 'chattogram', 3),
  city('chhatak', 'ছাতক', 'Chhatak', 'Chhatak', 'Chhatak', 'sylhet', 3, ['Chatak']),
  city('shahjadpur', 'শাহজাদপুর', 'Shahjadpur', 'Shahjadpur', 'Shahjadpur', 'rajshahi', 3, ['Shahzadpur']),
  city('ullapara', 'উল্লাপাড়া', 'Ullapara', 'Ullapara', 'Ullapara', 'rajshahi', 3),
  city('kuakata', 'কুয়াকাটা', 'Kuakata', 'Kuakata', 'Kuakata', 'barishal', 3, [], { de: 'Badestrand an der Südküste', en: 'Beach on the south coast' }),
  city('benapole', 'বেনাপোল', 'Benapole', 'Benapole', 'Benapole', 'khulna', 3, ['Benapol'], { de: 'Wichtigster Grenzübergang nach Indien', en: 'Main border crossing to India' }),
  city('parbatipur', 'পার্বতীপুর', 'Parbatipur', 'Parbatipur', 'Parbatipur', 'rangpur', 3),
  city('gobindaganj', 'গোবিন্দগঞ্জ', 'Gobindaganj', 'Gobindaganj', 'Gobindaganj', 'rangpur', 3, ['Gobindagonj', 'Govindaganj']),
  city('bhanga', 'ভাঙ্গা', 'Bhanga', 'Bhanga', 'Bhanga', 'dhaka', 3, ['Vanga'], { de: 'Knoten der Schnellstraße zur Padma-Brücke', en: 'Expressway hub for the Padma Bridge' }),
  city('mawa', 'মাওয়া', 'Mawa', 'Mawa', 'Mawa', 'dhaka', 3, ['Maowa'], { de: 'Nordende der Padma-Brücke', en: 'North end of the Padma Bridge' }),
  city('elenga', 'এলেঙ্গা', 'Elenga', 'Elenga', 'Elenga', 'dhaka', 3),
  city('mirzapur', 'মির্জাপুর', 'Mirzapur', 'Mirzapur', 'Mirzapur', 'dhaka', 3),
  city('muktagacha', 'মুক্তাগাছা', 'Muktagacha', 'Muktagacha', 'Muktagacha', 'mymensingh', 3, ['Muktagachha']),
  city('trishal', 'ত্রিশাল', 'Trishal', 'Trishal', 'Trishal', 'mymensingh', 3, ['Trisal']),
  city('bhaluka', 'ভালুকা', 'Bhaluka', 'Bhaluka', 'Bhaluka', 'mymensingh', 3),
  city('kaliakair', 'কালিয়াকৈর', 'Kaliakair', 'Kaliakair', 'Kaliakair', 'dhaka', 3, ['Kaliakoir']),
  city('sonargaon', 'সোনারগাঁও', 'Sonargaon', 'Sonargaon', 'Sonargaon', 'dhaka', 3, ['Sonargao', 'Shonargaon'], { de: 'Alte Hauptstadt Bengalens', en: 'Old capital of Bengal' }),
];

const DIVISION: L10n = { de: 'Division (Verwaltungsbezirk)', en: 'Division' };

const division = (slug: string, core: string, translitCore: string, en: string, de: string, extra: string[] = []): PlaceItem => ({
  id: `bn:region:${slug}`,
  kind: 'region',
  native: `${core} বিভাগ`,
  core,
  translit: `${translitCore} Bibhag`,
  names: { en: `${en} Division`, de: `Division ${de}` },
  accepted: [`${translitCore} Bibhag`, translitCore, `${en} Division`, en, `Division ${de}`, de, ...extra],
  countryId: 'BD',
  regionType: 'division',
  tier: 1,
  hint: DIVISION,
});

/** The eight divisions of Bangladesh. */
export const DIVISIONS: PlaceItem[] = [
  division('dhaka', 'ঢাকা', 'Dhaka', 'Dhaka', 'Dhaka'),
  division('chattogram', 'চট্টগ্রাম', 'Chattogram', 'Chattogram', 'Chittagong', ['Chittagong', 'Chittagong Division']),
  division('khulna', 'খুলনা', 'Khulna', 'Khulna', 'Khulna'),
  division('rajshahi', 'রাজশাহী', 'Rajshahi', 'Rajshahi', 'Rajshahi'),
  division('sylhet', 'সিলেট', 'Sylhet', 'Sylhet', 'Sylhet'),
  division('barishal', 'বরিশাল', 'Barishal', 'Barishal', 'Barisal', ['Barisal', 'Barisal Division']),
  division('rangpur', 'রংপুর', 'Rangpur', 'Rangpur', 'Rangpur'),
  division('mymensingh', 'ময়মনসিংহ', 'Mymensingh', 'Mymensingh', 'Mymensingh'),
];

const DISTRICT: L10n = { de: 'Distrikt (জেলা, jela)', en: 'District (জেলা, jela)' };

/**
 * The 64 districts, grouped into map-coherent lessons (division by division,
 * starting in the centre). Each district carries the name of its main town,
 * so names and spellings come from the district town above.
 */
export const DISTRICT_GROUPS: { id: string; title: L10n; slugs: string[] }[] = [
  { id: 'dhaka-1', title: { de: 'Dhaka & Umgebung', en: 'Dhaka & Surroundings' }, slugs: ['dhaka', 'gazipur', 'narayanganj', 'narsingdi', 'munshiganj', 'manikganj', 'tangail', 'kishoreganj'] },
  { id: 'dhaka-2', title: { de: 'Südlich der Padma', en: 'South of the Padma' }, slugs: ['faridpur', 'rajbari', 'madaripur', 'shariatpur', 'gopalganj'] },
  { id: 'chattogram-1', title: { de: 'Cumilla bis Noakhali', en: 'Cumilla to Noakhali' }, slugs: ['cumilla', 'brahmanbaria', 'chandpur', 'feni', 'noakhali', 'lakshmipur'] },
  { id: 'chattogram-2', title: { de: 'Chattogram & Bergland', en: 'Chattogram & the Hills' }, slugs: ['chattogram', 'coxs-bazar', 'rangamati', 'khagrachhari', 'bandarban'] },
  { id: 'northeast', title: { de: 'Sylhet & Mymensingh', en: 'Sylhet & Mymensingh' }, slugs: ['sylhet', 'moulvibazar', 'habiganj', 'sunamganj', 'mymensingh', 'jamalpur', 'sherpur', 'netrokona'] },
  { id: 'rajshahi', title: { de: 'Division Rajshahi', en: 'Rajshahi Division' }, slugs: ['rajshahi', 'chapai-nawabganj', 'naogaon', 'natore', 'bogura', 'joypurhat', 'sirajganj', 'pabna'] },
  { id: 'rangpur', title: { de: 'Division Rangpur', en: 'Rangpur Division' }, slugs: ['rangpur', 'dinajpur', 'thakurgaon', 'panchagarh', 'nilphamari', 'lalmonirhat', 'kurigram', 'gaibandha'] },
  { id: 'khulna-1', title: { de: 'Khulna & Sundarbans', en: 'Khulna & the Sundarbans' }, slugs: ['khulna', 'bagerhat', 'satkhira', 'jashore', 'narail'] },
  { id: 'khulna-2', title: { de: 'Kushtia bis Magura', en: 'Kushtia to Magura' }, slugs: ['kushtia', 'meherpur', 'chuadanga', 'jhenaidah', 'magura'] },
  { id: 'barishal', title: { de: 'Division Barishal', en: 'Barishal Division' }, slugs: ['barishal', 'patuakhali', 'bhola', 'pirojpur', 'jhalokathi', 'barguna'] },
];

const townBySlug = new Map(CITIES.map((c) => [c.id.slice('bn:city:'.length), c]));

export const DISTRICTS: PlaceItem[] = DISTRICT_GROUPS.flatMap((g) =>
  g.slugs.map((slug): PlaceItem => {
    const town = townBySlug.get(slug);
    if (!town) throw new Error(`district town missing: ${slug}`);
    const { translit } = town;
    const { en, de } = town.names;
    return {
      id: `bn:district:${slug}`,
      kind: 'region',
      native: town.native,
      translit,
      names: { en: `${en} District`, de: `Distrikt ${de}` },
      accepted: [...town.accepted, `${en} District`, `${translit} District`, `${translit} Zila`, `${translit} Zilla`, `${translit} Jela`, `Distrikt ${de}`],
      countryId: 'BD',
      regionId: town.regionId,
      regionType: 'district',
      tier: town.tier,
      hint: DISTRICT,
    };
  }),
);
