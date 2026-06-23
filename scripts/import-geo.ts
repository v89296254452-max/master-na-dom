import { writePagesCsv } from "../lib/page-generator";
import { findExcelFile, loadGeoPagesFromExcel } from "../lib/geo-import";

function main() {
  const excelPath = findExcelFile();
  console.log(`Читаю файл: ${excelPath}`);

  const { pages, excelRowsFound, skippedSheets } = loadGeoPagesFromExcel(excelPath);

  for (const group of [
    { phone: "+7 (986) 089-07-04", label: "КП" },
    { phone: "+7 (969) 999-24-97", label: "БТ" },
    { phone: "+7 (984) 333-32-49", label: "МнЧ" },
  ]) {
    const count = pages.filter((p) => p.phone === group.phone).length;
    if (count > 0) {
      console.log(`  ${group.label}: ${count} страниц`);
    }
  }

  if (skippedSheets > 0) {
    console.warn(`\nПропущено листов: ${skippedSheets}`);
  }

  console.log(`\nИтого: ${pages.length} страниц, строк в Excel: ${excelRowsFound}`);
  const count = writePagesCsv(pages);
  console.log(`Сохранено ${count} страниц → data/pages.csv`);
}

main();
