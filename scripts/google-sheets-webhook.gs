/**
 * Google Apps Script для приёма лидов в Google Sheets.
 *
 * Установка:
 * 1. Создайте Google Таблицу с листом "Leads"
 * 2. Первая строка — заголовки:
 *    createdAt | name | phone | problem | city | service | slug | source | userAgent | ip
 * 3. Extensions → Apps Script → вставьте этот код
 * 4. Project Settings → Script Properties → добавьте LEAD_SECRET со
 *    значением из .env.local сайта (LEADS_WEBHOOK_SECRET) — это общий
 *    секрет, который проверяется ниже.
 * 5. Deploy → New deployment → Web app
 *    - Execute as: Me
 *    - Who has access: Anyone
 * 6. Скопируйте URL вида https://script.google.com/macros/s/XXXX/exec
 * 7. Вставьте в .env.local:
 *    LEADS_WEBHOOK_URL=https://script.google.com/macros/s/XXXX/exec
 *    LEADS_WEBHOOK_SECRET=<то же значение, что в Script Properties>
 *
 * Зачем секрет и валидация: URL вебхука публичный (Anyone with the link).
 * Без проверки секрета кто угодно, узнавший этот URL, может POST'ить сюда
 * произвольные данные напрямую, в обход всех проверок на сайте (honeypot,
 * rate-limit, валидация телефона) — именно так в таблицу попадали заявки с
 * 7-значным "телефоном" и битой кодировкой имени.
 */

function isValidRuPhone_(phone) {
  var d = String(phone || "").replace(/\D/g, "");
  if (d.length === 11 && d.charAt(0) === "8") d = "7" + d.slice(1);
  return d.length === 11 && d.charAt(0) === "7";
}

function isSaneName_(name) {
  var letters = String(name || "").match(/[a-zA-Zа-яА-ЯёЁ]/g);
  return !!letters && letters.length >= 2;
}

function hasReplacementChar_(value) {
  return String(value || "").indexOf("�") !== -1;
}

function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);

    var expectedSecret = PropertiesService.getScriptProperties().getProperty("LEAD_SECRET");
    if (expectedSecret && data.secret !== expectedSecret) {
      return ContentService
        .createTextOutput(JSON.stringify({ success: false, error: "forbidden" }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    if (
      !isValidRuPhone_(data.phone) ||
      !isSaneName_(data.name) ||
      hasReplacementChar_(data.name) ||
      hasReplacementChar_(data.city) ||
      hasReplacementChar_(data.service) ||
      hasReplacementChar_(data.problem)
    ) {
      // Тихо отвечаем "успех", чтобы не подсказывать ботам, что именно
      // отсеивается — но строку в таблицу не пишем.
      return ContentService
        .createTextOutput(JSON.stringify({ success: true, skipped: true }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Leads");

    if (!sheet) {
      sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    }

    sheet.appendRow([
      data.createdAt || new Date().toISOString(),
      data.name || "",
      data.phone || "",
      data.problem || "",
      data.city || "",
      data.service || "",
      data.slug || "",
      data.source || "",
      data.userAgent || "",
      data.ip || "",
    ]);

    return ContentService
      .createTextOutput(JSON.stringify({ success: true }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService
      .createTextOutput(JSON.stringify({ success: false, error: String(error) }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
