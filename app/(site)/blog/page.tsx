import type { Metadata } from "next";
import { getAllPosts, BLOG_CATEGORIES } from "@/lib/blog-posts";
import { getSiteUrl } from "@/lib/site";
import BlogCatalog, { type BlogItem } from "@/components/blog/BlogCatalog";
import SiteScripts from "@/components/promaster/SiteScripts";
import { PHOTO_SERVICES } from "@/lib/service-icons";

export const revalidate = 86400;

export async function generateMetadata(): Promise<Metadata> {
  const siteUrl = getSiteUrl();
  return {
    title: "Блог о ремонте и обслуживании техники — советы мастеров | ПроМастер",
    description: "Советы мастеров, инструкции по ремонту, разбор поломок и ответы на частые вопросы о технике и доме. Читайте, чтобы починить самому или понять, когда звать мастера.",
    alternates: { canonical: `${siteUrl}/blog` },
  };
}

const FALLBACK_COVERS = ["work-faucet", "work-panel", "work-washer", "hero"];

function coverFor(serviceSlug: string, i: number): string {
  if (serviceSlug && PHOTO_SERVICES.has(serviceSlug)) return `/images/promaster/${serviceSlug}.jpg`;
  return `/images/promaster/${FALLBACK_COVERS[i % FALLBACK_COVERS.length]}.jpg`;
}
function readMinutes(body: string): number {
  const w = (body || "").replace(/<[^>]+>/g, " ").trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(w / 170));
}

export default function BlogIndexPage() {
  const posts = getAllPosts();
  const items: BlogItem[] = posts.map((p, i) => ({
    slug: p.slug,
    title: p.title,
    description: p.description || "",
    category: p.category,
    categoryName: p.categoryName,
    minutes: readMinutes(p.content),
    date: p.datePublished ? new Date(p.datePublished).toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" }) : "",
    cover: coverFor((p as unknown as { serviceSlug?: string }).serviceSlug || "", i),
  }));

  return (
    <main>
      <SiteScripts />
      <section className="blog-head"><div className="wrap">
        <span className="blog-mono">Блог<span className="ln" />{items.length} материалов</span>
        <h1>О ремонте и технике — по делу</h1>
        <p>Советы мастеров, разбор поломок и честные инструкции: что можно починить самому, а когда лучше вызвать специалиста.</p>
      </div></section>
      <BlogCatalog items={items} categories={BLOG_CATEGORIES} />
    </main>
  );
}
