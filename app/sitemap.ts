import type { MetadataRoute } from "next";
import { getAllPages } from "@/lib/pages";
import { getAllProblems } from "@/lib/problem";
import { getSiteUrl } from "@/lib/site";

/** Sitemap: коммерческие страницы + раздел типовых проблем */
export const revalidate = 86400;

export default function sitemap(): MetadataRoute.Sitemap {
  const siteUrl = getSiteUrl();
  const pages = getAllPages();
  const problems = getAllProblems();

  return [
    {
      url: siteUrl,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: `${siteUrl}/problem`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.7,
    },
    ...pages
      .filter((page) => page.slug)
      .map((page) => ({
        url: `${siteUrl}/${page.slug}`,
        lastModified: new Date(),
        changeFrequency: "monthly" as const,
        priority: 0.8,
      })),
    ...problems.map((problem) => ({
      url: `${siteUrl}/problem/${problem.slug}`,
      lastModified: new Date(problem.createdAt),
      changeFrequency: "monthly" as const,
      priority: 0.6,
    })),
  ];
}
