import { generateDzenArticles, getTargetCities } from "../lib/dzen-generator";
import { getAllPages } from "../lib/pages";
import { getDzenArticlesPath, writeDzenArticlesFile } from "../lib/dzen-storage";
import { DZEN_CITY_LIMIT, DZEN_TARGET_SERVICE_SLUGS } from "../lib/dzen-types";

function main() {
  const pages = getAllPages();
  const cities = getTargetCities(pages);
  const timestamp = new Date().toISOString();
  const articles = generateDzenArticles();

  writeDzenArticlesFile({
    generatedAt: timestamp,
    articles,
  });

  const byService = articles.reduce<Record<string, number>>((acc, article) => {
    acc[article.service] = (acc[article.service] ?? 0) + 1;
    return acc;
  }, {});

  const sample = articles[0];
  const bodyLengths = articles.map((article) => article.body.length);
  const minBody = Math.min(...bodyLengths);
  const maxBody = Math.max(...bodyLengths);

  console.log(`Сгенерировано статей для Яндекс Дзена: ${articles.length}`);
  console.log(`Города (${cities.length}/${DZEN_CITY_LIMIT}): ${cities.join(", ")}`);
  console.log(`Услуги: ${DZEN_TARGET_SERVICE_SLUGS.join(", ")}`);
  console.log("По услугам:", byService);
  console.log(`Длина body: min ${minBody}, max ${maxBody} символов`);
  console.log(`Файл: ${getDzenArticlesPath()}`);

  if (sample) {
    console.log(`Пример: ${sample.title}`);
    console.log(`targetUrl: ${sample.targetUrl}`);
    console.log(`status: ${sample.status}`);
  }

  const invalid = articles.filter(
    (article) =>
      article.status !== "draft" ||
      !article.title ||
      !article.subtitle ||
      !article.body ||
      !article.cta ||
      article.tags.length === 0 ||
      !article.targetUrl ||
      !article.service ||
      !article.city ||
      !article.phone ||
      !article.slug
  );

  if (invalid.length > 0) {
    throw new Error(`Некорректные статьи: ${invalid.length}`);
  }
}

main();
