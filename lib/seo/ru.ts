/**
 * Мелочи русской грамматики для сниппетов и видимого текста.
 * Данные городов лежат в предложном падеже («Москве», «Владивостоке»), но
 * предлог «в» перед скоплением согласных требует формы «во»: не «в
 * Владивостоке», а «во Владивостоке». Ошибка заметна прямо в title выдачи.
 */

const VOWELS = "аеёиоуыэюяАЕЁИОУЫЭЮЯ";

/** «в» или «во» перед словом (Владивостоке → во, Волгограде → в). */
export function vPrep(word: string): "в" | "во" {
  const w = (word || "").trim();
  if (!w) return "в";
  const first = w[0].toLowerCase();
  const second = w[1];
  if ((first === "в" || first === "ф") && second && !VOWELS.includes(second)) return "во";
  return "в";
}

/** Готовое «в Москве» / «во Владивостоке». */
export function inCity(cityPrep: string): string {
  return `${vPrep(cityPrep)} ${cityPrep}`;
}
