/**
 * Прямая отправка заявок в партнёрскую CRM "Leads Market" (omni.asy.dev),
 * аккаунт-источник "Сайт Мастер ( Решетников Дмитрий партнер )".
 *
 * Конфиг из env:
 *   OMNI_API_TOKEN=<персональный Bearer-токен из личного кабинета>
 *   OMNI_SOURCE_ID=5460   (source_id "Сайт Мастер"; можно переопределить)
 *
 * Категории (category_id) и отделы (department_id, город × направление
 * "Быт"/"МНЧ") сняты 09.09.2026 через GET /orders/categories и
 * GET /departments/cities этим же токеном — см. деплой-заметку. CRM
 * покрывает не все города сайта (только крупные/средние — ~100 из наших
 * ~150), поэтому resolveDepartment() может вернуть undefined: в этом
 * случае лид просто не уходит в CRM (но продолжает идти в Google Sheets/
 * локальную БД как раньше — это не блокирующая интеграция).
 */

const API_BASE = "https://omni.asy.dev/api";

/** serviceSlug → { category_id, type } (type 1 = техника, 2 = быт.услуги — влияет на выбор отдела Быт/МНЧ). */
const SERVICE_CATEGORY: Record<string, { id: number; type: 1 | 2 }> = {
  kp: { id: 1, type: 1 }, // Компьютеры и ноутбуки
  "remont-televizorov": { id: 2, type: 1 },
  "remont-holodilnikov": { id: 3, type: 1 },
  "remont-stiralnyh-mashin": { id: 4, type: 1 },
  "remont-pmm": { id: 5, type: 1 },
  "remont-varochnyh-panelej": { id: 6, type: 1 },
  "remont-duhovyh-shkafov": { id: 6, type: 1 }, // тот же оффер, что и варочные панели
  "remont-kofemashin": { id: 7, type: 1 },
  "remont-vodonagrevatelej": { id: 19, type: 1 },
  "remont-kondicionerov": { id: 14, type: 1 },
  dezinfekciya: { id: 16, type: 1 },
  santehnik: { id: 12, type: 2 },
  elektrik: { id: 11, type: 2 },
  "remont-okon": { id: 13, type: 2 },
  "master-na-chas": { id: 10, type: 2 },
  klining: { id: 17, type: 2 },
  "sborka-mebeli": { id: 20, type: 2 },
};

/**
 * Резерв (основной путь на деле): production-форма `CallForm.tsx` шлёт не
 * slug, а текстовое название услуги/города прямо из выпадающего списка
 * `lib/offer-catalog.ts` (`OFFER_SERVICE_NAMES` / `OFFER_CITIES`) — slug
 * там указывает на URL страницы (часто city+service вместе), а не на
 * чистый service-slug, так что верхняя карта по факту почти не используется.
 */
const NAME_CATEGORY: Record<string, { id: number; type: 1 | 2 }> = {
  компьютернаяпомощь: SERVICE_CATEGORY.kp,
  ремонттелевизоров: SERVICE_CATEGORY["remont-televizorov"],
  ремонтхолодильников: SERVICE_CATEGORY["remont-holodilnikov"],
  ремонтстиральныхмашин: SERVICE_CATEGORY["remont-stiralnyh-mashin"],
  ремонтпосудомоечныхмашин: SERVICE_CATEGORY["remont-pmm"],
  ремонтварочныхпанелей: SERVICE_CATEGORY["remont-varochnyh-panelej"],
  ремонтдуховыхшкафов: SERVICE_CATEGORY["remont-duhovyh-shkafov"],
  ремонткофемашин: SERVICE_CATEGORY["remont-kofemashin"],
  ремонтводонагревателей: SERVICE_CATEGORY["remont-vodonagrevatelej"],
  ремонткондиционеров: SERVICE_CATEGORY["remont-kondicionerov"],
  дезинфекция: SERVICE_CATEGORY.dezinfekciya,
  сантехник: SERVICE_CATEGORY.santehnik,
  электрик: SERVICE_CATEGORY.elektrik,
  ремонтокон: SERVICE_CATEGORY["remont-okon"],
  мастерначас: SERVICE_CATEGORY["master-na-chas"],
  клининг: SERVICE_CATEGORY.klining,
  сборкамебели: SERVICE_CATEGORY["sborka-mebeli"],
};

/**
 * Точечные расхождения между названием города на сайте (`OFFER_CITIES` в
 * lib/offer-catalog.ts) и названием отдела в CRM. Известный случай: сайт
 * использует официальное "Ростов-на-Дону", у партнёра отдел просто "Ростов".
 * Остальные ~150 городов сайта нормализуются 1:1; города, которых нет ни
 * здесь, ни в DEPT_*, просто не покрыты этой CRM (см. комментарий выше).
 */
const CITY_ALIAS: Record<string, string> = {
  ростовнадону: "ростов",

  // Города-спутники/районы без своего отдела в CRM — привязаны к ближайшему
  // городу, где отдел РЕАЛЬНО есть (см. DEPT_BYT/DEPT_MNCH/DEPT_BARE выше).
  // Основано на географической близости (агломерация/соседний район), НЕ
  // подтверждено фактическим радиусом выезда мастеров партнёра — при жалobах
  // на конкретный город стоит проверить и точечно скорректировать.
  // Москва
  балашиха: "москва",
  люберцы: "москва",
  // Санкт-Петербург (включая районы в черте города и ближайший Ленобласть)
  всеволожск: "санктпетербург",
  сертолово: "санктпетербург",
  колпино: "санктпетербург",
  пушкин: "санктпетербург",
  павловск: "санктпетербург",
  петергоф: "санктпетербург",
  сестрорецк: "санктпетербург",
  мурино: "санктпетербург",
  кудрово: "санктпетербург",
  ломоносов: "санктпетербург",
  бугры: "санктпетербург",
  // Екатеринбург
  верхняяпышма: "екатеринбург",
  березовский: "екатеринбург",
  первоуральск: "екатеринбург",
  среднеуральск: "екатеринбург",
  арамиль: "екатеринбург",
  // Калининград
  зеленоградск: "калининград",
  гвардейск: "калининград",
  светлый: "калининград",
  светлогорск: "калининград",
  балтийск: "калининград",
  // Ростов-на-Дону
  аксай: "ростов",
  батайск: "ростов",
  азов: "ростов",
  новочеркасск: "ростов",
  // Прочие агломерации (один ближайший покрытый город)
  богородск: "нижнийновгород",
  чапаевск: "самара",
  волжский: "волгоград",
  ангарск: "иркутск",
  шелехов: "иркутск",
  топки: "кемерово",
  калтан: "новокузнецк",
  осинники: "новокузнецк",
  прокопьевск: "новокузнецк",
  новоалтайск: "барнаул",
  бердск: "новосибирск",
  волжск: "йошкарола",
  новоульяновск: "ульяновск",
  салават: "стерлитамак",
  ишимбай: "стерлитамак",
  дивногорск: "красноярск",
  сосновоборск: "красноярск",
  краснокамск: "пермь",
  михайловск: "ставрополь",
  семилуки: "воронеж",
  грязи: "липецк",
  новомосковск: "тула",
  щекино: "тула",
  тутаев: "ярославль",
  лихославль: "тверь",
  рыбное: "рязань",
  коркино: "челябинск",
  цивильск: "чебоксары",
  менделеевск: "набережныечелны",
  зеленодольск: "казань",
  камызяк: "астрахань",
  жигулевск: "тольятти",
  октябрьск: "сызрань",
  адыгейск: "краснодар",
  устьлабинск: "краснодар",
  // Крым и Севастополь
  балаклава: "севастополь",
  бахчисарай: "симферополь",
  евпатория: "симферополь",
  саки: "симферополь",
  белогорск: "симферополь",
};

// Снято 09.09.2026 из GET /departments/cities (127 отделов). "Быт" — техника
// (type 1), "МНЧ" — бытовые услуги (type 2). DEPT_BARE — города с одним
// общим отделом на оба направления (используется как fallback).
const DEPT_BYT: Record<string, number> = {
  астрахань: 108, балахна: 79, барнаул: 110, бор: 67, великийновгород: 139,
  волгоград: 50, воронеж: 48, дзержинск: 68, екатеринбург: 25, ижевск: 12,
  иркутск: 95, казань: 3, калининград: 37, кемерово: 146, киров: 5,
  кировочепецк: 64, кострома: 140, краснодар: 52, красноярск: 46, кстово: 78,
  липецк: 62, москва: 107, мурманск: 127, набережныечелны: 33, нижнекамск: 75,
  нижнийновгород: 9, новокузнецк: 144, новокуйбышевск: 71, новосибирск: 40,
  новочебоксарск: 65, омск: 44, оренбург: 21, пенза: 13, пермь: 27,
  петрозаводск: 143, ростов: 56, рязань: 122, самара: 17, санктпетербург: 84,
  саратов: 15, ставрополь: 54, сызрань: 153, тверь: 112, тольятти: 19,
  томск: 147, тула: 38, тюмень: 42, ульяновск: 10, уфа: 22, челябинск: 29,
  энгельс: 70, ярославль: 11,
};

const DEPT_MNCH: Record<string, number> = {
  астрахань: 131, барнаул: 98, брянск: 157, волгоград: 51, воронеж: 49,
  екатеринбург: 26, елабуга: 99, ижевск: 24, иркутск: 97, казань: 4,
  калининград: 90, кемерово: 102, киров: 6, копейск: 74, краснодар: 53,
  красноярск: 47, липецк: 86, москва: 126, набережныечелны: 34, нижнекамск: 76,
  нижнийновгород: 96, новокузнецк: 101, новосибирск: 41, омск: 45,
  оренбург: 85, пенза: 14, пермь: 28, ростов: 57, рязань: 129, самара: 18,
  санктпетербург: 89, саратов: 16, сочи: 128, ставрополь: 55, сургут: 92,
  сызрань: 93, тверь: 133, тольятти: 20, томск: 113, тула: 114, тюмень: 43,
  уланудэ: 132, ульяновск: 106, уфа: 23, челябинск: 30, энгельс: 88,
  ярославль: 91,
};

const DEPT_BARE: Record<string, number> = {
  архангельск: 145, балаково: 152, белгород: 141, владимир: 120, вологда: 160,
  иваново: 39, йошкарола: 109, калуга: 138, курган: 148, курск: 130,
  магнитогорск: 81, нижнийтагил: 100, новороссийск: 136, новочебоксарск: 94,
  одинцово: 142, октябрьский: 150, орел: 125, севастополь: 115,
  симферополь: 116, смоленск: 151, стерлитамак: 72, сыктывкар: 149,
  таганрог: 105, тамбов: 111, чебоксары: 8,
};

/**
 * CRM ждёт `appointment_date` в формате `Y-m-d H:i` (не ISO 8601!) и строго
 * больше текущего момента. Берём "сейчас + 30 минут" по МСК (Europe/Moscow,
 * без перехода на летнее время — фиксированный UTC+3).
 */
function formatAppointmentDate(minutesAhead = 30): string {
  const shifted = new Date(Date.now() + minutesAhead * 60_000 + 3 * 3_600_000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${shifted.getUTCFullYear()}-${pad(shifted.getUTCMonth() + 1)}-${pad(shifted.getUTCDate())} ${pad(shifted.getUTCHours())}:${pad(shifted.getUTCMinutes())}`;
}

function norm(s: string): string {
  return (s || "").toLowerCase().replace(/ё/g, "е").replace(/[\s-]/g, "").trim();
}

function resolveCategory(serviceSlug?: string, service?: string): { id: number; type: 1 | 2 } | undefined {
  if (serviceSlug && SERVICE_CATEGORY[serviceSlug]) return SERVICE_CATEGORY[serviceSlug];
  const key = norm(service || "");
  if (!key) return undefined;
  if (NAME_CATEGORY[key]) return NAME_CATEGORY[key];
  // Бренд-страницы шлют "Ремонт стиральных машин Bosch" и т.п. — точного
  // совпадения нет, но название начинается с базовой услуги. Берём самое
  // длинное совпадение по префиксу, чтобы не спутать смежные категории.
  let best: { id: number; type: 1 | 2 } | undefined;
  let bestLen = 0;
  for (const [name, cat] of Object.entries(NAME_CATEGORY)) {
    if (key.startsWith(name) && name.length > bestLen) {
      best = cat;
      bestLen = name.length;
    }
  }
  return best;
}

function resolveDepartment(city: string | undefined, type: 1 | 2): number | undefined {
  let key = norm(city || "");
  if (!key) return undefined;
  key = CITY_ALIAS[key] ?? key;
  const primary = type === 1 ? DEPT_BYT[key] : DEPT_MNCH[key];
  return primary ?? DEPT_BARE[key];
}

export interface OmniLeadInput {
  name: string;
  /** Уже нормализованный номер, 11 цифр, начинается с 7. */
  phone: string;
  problem?: string;
  city?: string;
  service?: string;
  serviceSlug?: string;
}

export interface OmniLeadResult {
  sent: boolean;
  status?: number;
  orderId?: string;
  categoryId?: number;
  departmentId?: number;
  error?: string;
}

export async function sendLeadToOmni(input: OmniLeadInput): Promise<OmniLeadResult> {
  const token = process.env.OMNI_API_TOKEN;
  if (!token) return { sent: false, error: "OMNI_API_TOKEN не задан" };

  const category = resolveCategory(input.serviceSlug, input.service);
  if (!category) {
    return { sent: false, error: `нет category_id для «${input.serviceSlug || input.service || "-"}»` };
  }

  const departmentId = resolveDepartment(input.city, category.type);
  if (!departmentId) {
    // CRM не покрывает этот город (у неё ~100 городов, у нас ~150) —
    // это ожидаемо, не ошибка. Лид всё равно уходит в Sheets/локальную БД.
    return { sent: false, categoryId: category.id, error: `нет department_id для города «${input.city || "-"}»` };
  }

  const sourceId = process.env.OMNI_SOURCE_ID || "5460";
  const city = (input.city || "").trim();
  const noteParts = [
    input.problem?.trim(),
    "Адрес уточнить у клиента по телефону — форма на сайте адрес не запрашивает.",
  ].filter(Boolean);

  const payload = {
    name: (input.name || "Клиент").slice(0, 50),
    phone: input.phone,
    note: noteParts.join(". ").slice(0, 1000),
    category_id: category.id,
    factor: 2, // "Для партнёров значение всегда 2 (отзыв)" — из документации API
    address: city || "уточнить по телефону",
    appointment_date: formatAppointmentDate(),
    source_id: String(sourceId),
    department_id: String(departmentId),
  };

  try {
    const res = await fetch(`${API_BASE}/orders`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });
    const json = (await res.json().catch(() => ({}))) as { order_id?: string; message?: string };
    return {
      sent: res.status === 201,
      status: res.status,
      orderId: json.order_id,
      categoryId: category.id,
      departmentId,
      error: res.status !== 201 ? json.message || `HTTP ${res.status}` : undefined,
    };
  } catch (e) {
    return {
      sent: false,
      categoryId: category.id,
      departmentId,
      error: e instanceof Error ? e.message : "network",
    };
  }
}
