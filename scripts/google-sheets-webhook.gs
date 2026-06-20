/**
 * Google Apps Script для приёма лидов в Google Sheets.
 *
 * Установка:
 * 1. Создайте Google Таблицу с листом "Leads"
 * 2. Первая строка — заголовки:
 *    createdAt | name | phone | problem | city | service | slug | source | userAgent | ip
 * 3. Extensions → Apps Script → вставьте этот код
 * 4. Deploy → New deployment → Web app
 *    - Execute as: Me
 *    - Who has access: Anyone
 * 5. Скопируйте URL вида https://script.google.com/macros/s/XXXX/exec
 * 6. Вставьте в .env.local:
 *    LEADS_WEBHOOK_URL=https://script.google.com/macros/s/XXXX/exec
 */

function doPost(e) {
  try {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Leads");

    if (!sheet) {
      sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    }

    var data = JSON.parse(e.postData.contents);

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
