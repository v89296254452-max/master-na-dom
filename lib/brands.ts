/**
 * Бренды техники по услугам — для страниц уровня «ремонт {техника} {бренд} {город}»
 * (длинный хвост брендовых запросов). Только реальные, востребованные бренды —
 * включая нишевые/бюджетные марки: по ним конкуренция в выдаче ниже, чем по
 * топ-брендам (Samsung/LG/Bosch), а совокупный спрос всё равно значимый.
 * Модели добавляются отдельно (lib/models.ts) реальными списками, не выдуманными.
 */
export interface Brand {
  slug: string;
  name: string;
}

const B = (name: string, slug?: string): Brand => ({
  name,
  slug: slug || name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
});

export const BRANDS_BY_SERVICE: Record<string, Brand[]> = {
  "remont-holodilnikov": [
    B("Samsung"), B("LG"), B("Bosch"), B("Indesit"), B("Atlant"), B("Beko"),
    B("Liebherr"), B("Haier"), B("Electrolux"), B("Whirlpool"), B("Ariston"),
    B("Candy"), B("Gorenje"), B("Stinol"), B("Nord"),
    B("Pozis"), B("Snaige"), B("Vestfrost"), B("Daewoo"), B("Hotpoint-Ariston", "hotpoint-ariston"),
    B("Vestel"), B("Toshiba"), B("Sharp"), B("Hisense"), B("Midea"),
    B("Zanussi"), B("Bomann"), B("Scandilux"), B("Shivaki"), B("DEXP"), B("Leran"), B("Kraft"),
  ],
  "remont-stiralnyh-mashin": [
    B("Samsung"), B("LG"), B("Bosch"), B("Indesit"), B("Atlant"), B("Beko"),
    B("Electrolux"), B("Ariston"), B("Candy"), B("Whirlpool"), B("Haier"),
    B("Gorenje"), B("Zanussi"), B("Hansa"), B("Vestel"),
    B("Kaiser"), B("LEX"), B("Midea"), B("Daewoo"), B("Elenberg"), B("Rolsen"),
    B("Toshiba"), B("Hotpoint-Ariston", "hotpoint-ariston"), B("Amica"), B("Siemens"), B("Vestfrost"),
  ],
  "remont-pmm": [
    B("Bosch"), B("Electrolux"), B("Siemens"), B("Hansa"), B("Indesit"),
    B("Beko"), B("Midea"), B("Weissgauff"), B("Korting"), B("Maunfeld"),
    B("Krona"), B("Candy"),
    B("Kuppersberg"), B("Kuppersbusch"), B("LEX"), B("Zigmund & Shtain", "zigmund-shtain"),
    B("Franke"), B("Teka"), B("Hyundai"), B("Kaiser"), B("Gorenje"), B("Ariston"),
  ],
  "remont-televizorov": [
    B("Samsung"), B("LG"), B("Sony"), B("Philips"), B("Xiaomi"), B("Haier"),
    B("TCL"), B("Hisense"), B("Toshiba"), B("Panasonic"), B("DEXP"), B("BBK"),
    B("Supra"), B("Telefunken"),
    B("Hyundai"), B("JVC"), B("Sharp"), B("Skyworth"), B("Vityaz"), B("Erisson"),
    B("Shivaki"), B("Akai"), B("Thomson"), B("Grundig"), B("Blaupunkt"), B("Polar"), B("Rolsen"),
  ],
  "remont-kondicionerov": [
    B("Ballu"), B("Electrolux"), B("LG"), B("Samsung"), B("Mitsubishi"),
    B("Daikin"), B("Haier"), B("Gree"), B("Hisense"), B("Panasonic"),
    B("Toshiba"), B("Royal Clima", "royal-clima"),
    B("Midea"), B("Chigo"), B("AUX"), B("Zanussi"), B("Kentatsu"), B("Dantex"),
    B("MDV"), B("Timberk"), B("Roda"), B("Neoclima"), B("Cooper&Hunter", "cooper-hunter"),
    B("Lessar"), B("Fujitsu"), B("Hyundai"),
  ],
  "remont-duhovyh-shkafov": [
    B("Bosch"), B("Electrolux"), B("Siemens"), B("Gorenje"), B("Hansa"),
    B("Maunfeld"), B("Weissgauff"), B("Gefest"), B("Darina"), B("Hotpoint"),
    B("Kuppersberg"), B("Kaiser"), B("LEX"), B("Zigmund & Shtain", "zigmund-shtain"),
    B("Franke"), B("Teka"), B("Whirlpool"), B("Korting"), B("Midea"), B("Ariston"),
  ],
  "remont-varochnyh-panelej": [
    B("Bosch"), B("Electrolux"), B("Siemens"), B("Gorenje"), B("Hansa"),
    B("Maunfeld"), B("Weissgauff"), B("Gefest"), B("Darina"), B("Midea"),
    B("Kuppersberg"), B("Kaiser"), B("LEX"), B("Zigmund & Shtain", "zigmund-shtain"),
    B("Franke"), B("Teka"), B("Hotpoint-Ariston", "hotpoint-ariston"), B("Korting"), B("Simfer"),
  ],
  "remont-kofemashin": [
    B("DeLonghi", "delonghi"), B("Philips"), B("Bosch"), B("Saeco"), B("Krups"),
    B("Jura"), B("Nivona"), B("Melitta"), B("Siemens"), B("Gaggia"),
    B("Bork"), B("Redmond"), B("Polaris"), B("Vitek"), B("Scarlett"), B("Kitfort"),
    B("Caffitaly"), B("Miele"),
  ],
  "remont-vodonagrevatelej": [
    B("Ariston"), B("Thermex"), B("Electrolux"), B("Gorenje"), B("Bosch"),
    B("Timberk"), B("Ballu"), B("Zanussi"), B("Haier"), B("Oasis"),
    B("Polaris"), B("Stiebel Eltron", "stiebel-eltron"), B("AEG"), B("Hyundai"),
    B("Atmor"), B("Kospel"), B("Royal Clima", "royal-clima"),
  ],
};

export function getBrandsForService(serviceSlug: string): Brand[] {
  return BRANDS_BY_SERVICE[serviceSlug] ?? [];
}
