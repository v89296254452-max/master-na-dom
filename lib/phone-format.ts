/**
 * Маска и валидация российских номеров: `+7 (XXX) XXX-XX-XX`.
 * Используется в лид-формах для нормализации ввода и клиентской валидации.
 */

/** Форматирует произвольный ввод в маску `+7 (999) 999-99-99`. */
export function formatRuPhone(raw: string): string {
  let digits = raw.replace(/\D/g, "");

  // 8XXXXXXXXXX → 7XXXXXXXXXX; ведущая 9 (без кода) → добавляем 7.
  if (digits.startsWith("8")) digits = "7" + digits.slice(1);
  if (digits.startsWith("9")) digits = "7" + digits;
  if (!digits.startsWith("7")) digits = "7" + digits;

  digits = digits.slice(0, 11); // 7 + 10 цифр

  const rest = digits.slice(1); // без кода страны
  let out = "+7";
  if (rest.length > 0) out += " (" + rest.slice(0, 3);
  if (rest.length >= 3) out += ")";
  if (rest.length > 3) out += " " + rest.slice(3, 6);
  if (rest.length > 6) out += "-" + rest.slice(6, 8);
  if (rest.length > 8) out += "-" + rest.slice(8, 10);
  return out;
}

/** Валиден, если ровно 11 цифр и начинается с 7. */
export function isValidRuPhone(value: string): boolean {
  const digits = value.replace(/\D/g, "");
  return digits.length === 11 && digits.startsWith("7");
}
