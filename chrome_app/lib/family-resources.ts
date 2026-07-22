import type { QuantNewsAdapter, ResourceCategory, ResourceLink } from './family-types';

function resourceLink(
  id: string,
  category: ResourceCategory,
  title: string,
  url: string,
  tags: string[]
): ResourceLink {
  return {
    id,
    category,
    title,
    url,
    description: 'Оригінальне джерело правил Quant RP. Текст правил не копіюється в застосунок.',
    tags,
    source: 'Quant RP forum',
    isPinned: category === 'general',
    updatedAt: '2026-07-07T00:00:00.000Z'
  };
}

export const QUANT_RP_RESOURCE_LINKS: ResourceLink[] = [
  resourceLink('general-rules', 'general', 'Загальні правила Quant RP', 'https://forum.quant5.com.ua/index.php?/topic/17-загальні-правила/#comment-25', ['rules', 'server']),
  resourceLink('crime-general', 'crime', 'Загальні правила кримінальних структур', 'https://forum.quant5.com.ua/index.php?/topic/68-загальні-правила-кримінальних-структур/', ['crime']),
  resourceLink('crime-title-territories', 'crime', 'Титульні території кримінальних організацій', 'https://forum.quant5.com.ua/index.php?/topic/567-титульні-території-кримінальних-організацій/', ['crime', 'territories']),
  resourceLink('crime-robbery-kidnapping', 'crime', 'Правила пограбувань та викрадень', 'https://forum.quant5.com.ua/index.php?/topic/43-правила-пограбувань-та-викрадень/', ['crime', 'robbery']),
  resourceLink('crime-case-van', 'crime', 'Правила Кейсу та Фургону', 'https://forum.quant5.com.ua/index.php?/topic/1625-правила-кейсу-та-фургону/', ['crime', 'case', 'van']),
  resourceLink('crime-vzg-vzh-vza', 'crime', 'Правила ВЗГ/ВЗХ/ВЗА', 'https://forum.quant5.com.ua/index.php?/topic/42-правила-взгвзхвза/', ['crime', 'events']),
  resourceLink('crime-judgement-night', 'crime', 'Правила Судної ночі', 'https://forum.quant5.com.ua/index.php?/topic/113-правила-судної-ночі/', ['crime', 'event']),
  resourceLink('crime-green-zones', 'crime', 'Правила Зелених Зон', 'https://forum.quant5.com.ua/index.php?/topic/84-правила-зелених-зон/#comment-147', ['crime', 'green-zone']),
  resourceLink('crime-interrogations', 'crime', 'Правила допитів для кримінальних структур', 'https://forum.quant5.com.ua/index.php?/topic/1398-правила-допитів-для-кримінальних-структур/', ['crime', 'interrogation']),
  resourceLink('crime-materials', 'crime', 'Правила доставки/перехоплення матеріалів', 'https://forum.quant5.com.ua/index.php?/topic/3522-правила-доставкиперехоплення-матеріалів/', ['crime', 'materials']),
  resourceLink('captures-business-war', 'captures_business', 'Війна за бізнес', 'https://forum.quant5.com.ua/index.php?/topic/541-війна-за-бізнес/', ['business', 'war']),
  resourceLink('captures-territories', 'captures_business', 'Захоплення територій', 'https://forum.quant5.com.ua/index.php?/topic/540-захоплення-територій/', ['captures', 'territories']),
  resourceLink('government-general', 'government', 'Загальні правила для державних структур', 'https://forum.quant5.com.ua/index.php?/topic/67-загальні-правила-для-державних-структур/', ['government']),
  resourceLink('government-behavior', 'government', 'Регламент поведінки працівників державних структур', 'https://forum.quant5.com.ua/index.php?/topic/296-регламент-поведінки-працівників-державних-структур/', ['government', 'behavior']),
  resourceLink('law-procedure', 'codes_laws', 'Процесуальний кодекс штату Quant', 'https://forum.quant5.com.ua/index.php?/topic/52-процесуальний-кодекс-штату-quant/', ['law', 'code']),
  resourceLink('law-administrative', 'codes_laws', 'Адміністративний кодекс', 'https://forum.quant5.com.ua/index.php?/topic/154-адміністративний-кодекс-штату-quant/', ['law', 'code']),
  resourceLink('law-criminal', 'codes_laws', 'Кримінальний кодекс', 'https://forum.quant5.com.ua/index.php?/topic/153-кримінальний-кодекс-штату-quant/', ['law', 'code']),
  resourceLink('law-labor', 'codes_laws', 'Трудовий кодекс', 'https://forum.quant5.com.ua/index.php?/topic/1586-трудовий-кодекс/', ['law', 'code']),
  resourceLink('law-road', 'codes_laws', 'Дорожній кодекс', 'https://forum.quant5.com.ua/index.php?/topic/444-дорожній-кодекс/', ['law', 'road']),
  resourceLink('law-ethics', 'codes_laws', 'Етичний кодекс', 'https://forum.quant5.com.ua/index.php?/topic/10-етичний-кодекс/', ['law', 'ethics']),
  resourceLink('law-court', 'codes_laws', 'Судовий кодекс', 'https://forum.quant5.com.ua/index.php?/topic/325-судовий-кодекс/', ['law', 'court']),
  resourceLink('law-constitution', 'codes_laws', 'Конституція штату Quant', 'https://forum.quant5.com.ua/index.php?/topic/53-конституція-штату-quant/', ['law', 'constitution']),
  resourceLink('law-weapons', 'codes_laws', 'Закон про обіг зброї на території штату', 'https://forum.quant5.com.ua/index.php?/topic/150-закон-про-обіг-зброї-на-території-штату/', ['law', 'weapons']),
  resourceLink('law-closed-areas', 'codes_laws', 'Закон про закриті та охороняємі території', 'https://forum.quant5.com.ua/index.php?/topic/25-закон-про-закриті-та-охороняємі-території/', ['law', 'territories']),
  resourceLink('law-interrogations', 'codes_laws', 'Правила допитів', 'https://forum.quant5.com.ua/index.php?/topic/297-правила-допитів/', ['law', 'interrogation']),
  resourceLink('statute-fib', 'statutes', 'Статут FIB', 'https://forum.quant5.com.ua/index.php?/topic/5268-статут-fib/', ['statute', 'fib']),
  resourceLink('statute-lspd', 'statutes', 'Статут LSPD', 'https://forum.quant5.com.ua/index.php?/topic/4929-cтатут-los-santos-police-department/', ['statute', 'lspd']),
  resourceLink('statute-ng', 'statutes', 'Статут NG', 'https://forum.quant5.com.ua/index.php?/topic/5410-внутрішній-статут-national-guard/', ['statute', 'ng']),
  resourceLink('statute-ems', 'statutes', 'Статут EMS', 'https://forum.quant5.com.ua/index.php?/topic/5235-статут-ems/', ['statute', 'ems']),
  resourceLink('statute-liv', 'statutes', 'Статут LIV', 'https://forum.quant5.com.ua/index.php?/topic/4452-статут-lifeinvader/', ['statute', 'lifeinvader'])
];

export const QUANT_NEWS_PROVIDER: QuantNewsAdapter = {
  sourceName: 'Quant Discord news',
  sourceUrl: 'https://discordapp.com/channels/981163624980680714/981254995435458590',
  status: 'planned',
  loadLatest: async () => []
};
