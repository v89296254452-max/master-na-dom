/**
 * Передача заявок в партнёрскую CRM ServiceLead (newapi.ru), аккаунт 11801.
 * Метод `lead` с точными offer_id + city_id (из кабинета). is_pm=false (не ЧМ).
 * Конфиг из env:
 *   LEADS_API_IDP=...           (токен партнёра)
 *   LEADS_API_BASE=https://newapi.ru  (или https://testapi.ru)
 * Если LEADS_API_IDP не задан — отправка выключена.
 */

/** serviceSlug → offer_id (обычные офферы, НЕ частный мастер). */
const SERVICE_OFFER: Record<string, number> = {
  kp: 1,                          // Компьютерная помощь
  "remont-televizorov": 168,      // Телевизоры
  "remont-kondicionerov": 126,    // Кондиционер
  "remont-vodonagrevatelej": 104, // Ремонт водонагревателей
  "remont-varochnyh-panelej": 27, // Ремонт варочных панелей
  "remont-duhovyh-shkafov": 28,   // Ремонт духовых шкафов
  "remont-kofemashin": 68,        // Ремонт кофемашин
  "remont-holodilnikov": 2,       // Ремонт холодильников
  "remont-pmm": 3,                // Ремонт посудомоек
  "remont-stiralnyh-mashin": 4,   // Ремонт стиральных машин
  santehnik: 14,                  // Сантехник
  elektrik: 15,                   // Электрик
  "remont-okon": 60,              // Ремонт и обслуживание окон
  "master-na-chas": 16,           // Мелкий бытовой ремонт
  // TODO: дезинфекция, клининг и сборка мебели — офферы есть в листе партнёрки
  // (ДЕЗ / КЛН / МБ), но offer_id из кабинета ServiceLead ещё не получены.
  // Без них заявка уходит только в вебхук, в CRM не пробрасывается.
};

/** Название города → city_id (Список городов в API, кабинет ServiceLead). */
const CITY_ID: Record<string, number> = {
  абакан: 164, альметьевск: 103, архангельск: 50, астрахань: 32, балаково: 119,
  барнаул: 24, белгород: 42, благовещенск: 123, брянск: 48, "великийновгород": 55,
  владивосток: 33, владимир: 71, волгоград: 17, волгодонск: 152, вологда: 58,
  воронеж: 18, дзержинск: 108, екатеринбург: 3, елец: 116, иваново: 39, иркутск: 30,
  казань: 10, калининград: 27, калуга: 40, камышин: 142, кемерово: 25, киров: 61,
  "комсомольскнаамуре": 122, кострома: 59, краснодар: 14, красноярск: 8, курск: 41,
  липецк: 43, магнитогорск: 23, "минеральныеводы": 181, москва: 36, мурманск: 45,
  невинномысск: 137, нефтеюганск: 133, нижневартовск: 121, нижнекамск: 171,
  "нижнийновгород": 1, "нижнийтагил": 69, новокузнецк: 26, новомосковск: 135,
  новороссийск: 95, новосибирск: 4, новочеркасск: 153, октябрьский: 139, омск: 7,
  орел: 37, оренбург: 19, орск: 118, первоуральск: 102, пермь: 9, петрозаводск: 54,
  псков: 57, пятигорск: 129, "ростовнадону": 13, рязань: 34, самара: 2,
  "санктпетербург": 0, саранск: 65, саратов: 12, севастополь: 38, симферополь: 51,
  смоленск: 63, сочи: 28, ставрополь: 62, "старыйоскол": 96, сургут: 70,
  сыктывкар: 163, таганрог: 66, тамбов: 79, тверь: 29, тольятти: 11, томск: 16,
  тула: 49, тюмень: 6, "уланудэ": 160, ульяновск: 22, уфа: 15, хабаровск: 47,
  "хантымансийск": 149, чебоксары: 46, челябинск: 5, череповец: 60, чита: 161,
  ярославль: 31,
};

/** Резерв: offer_id по названию услуги (форма шлёт название, не слаг). */
const NAME_OFFER: Record<string, number> = {
  "компьютернаяпомощь": 1, "ремонттелевизоров": 168, "ремонткондиционеров": 126,
  "ремонтводонагревателей": 104, "ремонтварочныхпанелей": 27, "ремонтдуховыхшкафов": 28,
  "ремонткофемашин": 68, "ремонтхолодильников": 2, "ремонтпосудомоечныхмашин": 3,
  "ремонтстиральныхмашин": 4, "сантехник": 14, "электрик": 15,
  "ремонтокон": 60, "мастерначас": 16,
};

function resolveOffer(serviceSlug?: string, service?: string): number | undefined {
  if (serviceSlug && SERVICE_OFFER[serviceSlug]) return SERVICE_OFFER[serviceSlug];
  const key = (service || "").toLowerCase().replace(/ё/g, "е").replace(/[\s-]/g, "").trim();
  if (NAME_OFFER[key]) return NAME_OFFER[key];
  if (key.includes("мастернач")) return 16;
  return undefined;
}

function normCity(city: string): string {
  return (city || "").toLowerCase().replace(/ё/g, "е").replace(/[\s-]/g, "").trim();
}

function normalizePhone(phone: string): string {
  let d = (phone || "").replace(/\D/g, "");
  if (d.length === 11 && d.startsWith("8")) d = "7" + d.slice(1);
  if (d.length === 10) d = "7" + d;
  return d;
}

export interface PartnerLeadInput {
  name: string;
  phone: string;
  service?: string;
  serviceSlug?: string;
  city?: string;
  description?: string;
  clickid?: string;
  /** Наш внутренний ID лида — партнёрка эхом вернёт его в постбэке ({sub_id1}),
   *  так мы связываем «заявка на сайте» ↔ «статус/выкуп в CRM». */
  subId1?: string;
}

export interface PartnerLeadResult {
  sent: boolean;
  status?: number;
  offerId?: number;
  cityId?: number;
  duplicate?: boolean;
  error?: string;
}

export async function sendLeadToPartner(input: PartnerLeadInput): Promise<PartnerLeadResult> {
  const idp = process.env.LEADS_API_IDP;
  if (!idp) return { sent: false, error: "LEADS_API_IDP не задан" };
  const base = process.env.LEADS_API_BASE || "https://newapi.ru";

  const offerId = resolveOffer(input.serviceSlug, input.service);
  if (!offerId) return { sent: false, error: `нет offer_id для «${input.serviceSlug || input.service}»` };
  const cityId = input.city ? CITY_ID[normCity(input.city)] : undefined;

  const payload: Record<string, unknown> = {
    offer_id: offerId,
    branch_id: 0,
    phones: [normalizePhone(input.phone)],
    name: (input.name || "Клиент").slice(0, 50),
    is_pm: false,
    is_call: true,
    description: (input.description || "").slice(0, 254),
  };
  if (cityId !== undefined) payload.city_id = cityId;
  if (input.clickid) payload.clickid = input.clickid.slice(0, 200);
  if (input.subId1) payload.sub_id1 = input.subId1.slice(0, 200);

  const url = `${base}/lead?source=partner&idp=${encodeURIComponent(idp)}`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    // 204 — принят, 202 — дубль, 400 — ошибка
    return {
      sent: res.status === 204 || res.status === 202,
      status: res.status,
      offerId,
      cityId,
      duplicate: res.status === 202,
      error: res.status >= 400 ? `HTTP ${res.status}` : undefined,
    };
  } catch (e) {
    return { sent: false, offerId, cityId, error: e instanceof Error ? e.message : "network" };
  }
}
