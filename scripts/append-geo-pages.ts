import path from "path";
import { findExcelFile, loadGeoPagesFromExcel } from "../lib/geo-import";
import { appendPagesToCsv } from "../lib/page-generator";
import { getAllPages } from "../lib/pages";

const CSV_PATH = path.join(process.cwd(), "data", "pages.csv");

function main() {
  const existingPages = getAllPages();
  const existingSlugs = new Set(existingPages.map((page) => page.slug));
  const rowsBefore = existingPages.length;

  const excelPath = findExcelFile();
  console.log(`Читаю Excel: ${excelPath}`);

  const { pages: generatedPages, excelRowsFound, skippedSheets } =
    loadGeoPagesFromExcel(excelPath);

  if (skippedSheets > 0) {
    console.log(`Пропущено листов без телефона: ${skippedSheets}`);
  }

  const newPages = [];
  let duplicatesSkipped = 0;

  for (const page of generatedPages) {
    if (existingSlugs.has(page.slug)) {
      duplicatesSkipped++;
      continue;
    }

    newPages.push(page);
    existingSlugs.add(page.slug);
  }

  const added = appendPagesToCsv(newPages, CSV_PATH);
  const rowsAfter = rowsBefore + added;

  console.log(`Было строк в pages.csv: ${rowsBefore}`);
  console.log(`Строк найдено в Excel: ${excelRowsFound}`);
  console.log(`Новых страниц добавлено: ${added}`);
  console.log(`Дублей пропущено: ${duplicatesSkipped}`);
  console.log(`Итого строк в pages.csv: ${rowsAfter}`);
  console.log(`Файл: ${CSV_PATH}`);
}

main();
