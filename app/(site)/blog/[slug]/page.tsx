import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import BlogContent from "@/components/blog/BlogContent";
import InArticleCTA from "@/components/blog/InArticleCTA";
import ServiceCTA from "@/components/blog/ServiceCTA";
import SiteScripts from "@/components/promaster/SiteScripts";
import { getAllPosts, getPostBySlug, getRelatedPosts, getToc, getFaq } from "@/lib/blog-posts";
import { getSiteUrl } from "@/lib/site";
import { phoneForService } from "@/lib/phones";
import { PHOTO_SERVICES } from "@/lib/service-icons";
import { BLOG_AUTHOR } from "@/lib/company";

export const revalidate = 86400;
export const dynamicParams = true;
export const dynamic = "force-static"; // метадата в <head> (Яндекс)

interface PageProps { params: Promise<{ slug: string }>; }

export function generateStaticParams() {
  return getAllPosts().map((p) => ({ slug: p.slug }));
}

function coverFor(serviceSlug: string): string {
  return serviceSlug && PHOTO_SERVICES.has(serviceSlug) ? `/images/promaster/${serviceSlug}.jpg` : "/images/promaster/hero.jpg";
}
function formatDate(iso: string): string {
  try { return new Date(iso).toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" }); } catch { return ""; }
}
function readMinutes(body: string): number {
  const w = (body || "").replace(/<[^>]+>/g, " ").trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(w / 170));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  if (!post) return { title: "Статья не найдена" };
  const siteUrl = getSiteUrl();
  const url = `${siteUrl}/blog/${post.slug}`;
  return {
    title: post.title,
    description: post.description,
    alternates: { canonical: url },
    openGraph: { title: post.title, description: post.description, url, type: "article", locale: "ru_RU", siteName: "ПроМастер", publishedTime: post.datePublished },
  };
}

export default async function BlogPostPage({ params }: PageProps) {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  if (!post) notFound();

  const siteUrl = getSiteUrl();
  const url = `${siteUrl}/blog/${post.slug}`;
  const toc = getToc(post.content);
  const faq = getFaq(post.content);
  const related = getRelatedPosts(post.slug, 3);
  const postServiceSlug = (post as unknown as { serviceSlug?: string }).serviceSlug || "";
  const cover = coverFor(postServiceSlug);
  const ctaPhone = phoneForService(postServiceSlug);
  const minutes = readMinutes(post.content);

  const [beforeCta, afterCta] = post.content.includes("[[CTA]]") ? post.content.split("[[CTA]]") : [post.content, ""];

  const articleSchema = {
    "@context": "https://schema.org", "@type": "Article", headline: post.h1.slice(0, 110), description: post.description,
    datePublished: post.datePublished, dateModified: post.datePublished,
    author: {
      "@type": "Person",
      name: BLOG_AUTHOR.name,
      jobTitle: BLOG_AUTHOR.role,
      worksFor: { "@type": "Organization", name: "ПроМастер" },
      description: BLOG_AUTHOR.bio,
    },
    publisher: { "@type": "Organization", name: "ПроМастер", logo: { "@type": "ImageObject", url: `${siteUrl}/logo.png` } },
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
  };
  const faqSchema = faq.length > 0 ? { "@context": "https://schema.org", "@type": "FAQPage", mainEntity: faq.map((f) => ({ "@type": "Question", name: f.question, acceptedAnswer: { "@type": "Answer", text: f.answer } })) } : null;

  return (
    <main>
      <SiteScripts />
      {postServiceSlug && (
        <span id="pm-offer-data" data-service={post.service} data-service-slug={postServiceSlug} hidden />
      )}
      <span id="pm-page-phone" data-href={ctaPhone.href} data-display={ctaPhone.display} hidden />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }} />
      {faqSchema && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />}

      {/* COVER */}
      <div className="article-cover" style={{ backgroundImage: `url(${cover})` }}>
        <div className="wrap-abs"><div className="inner">
          <span className="amono">{post.categoryName}</span>
          <h1 style={{ marginTop: 10 }}>{post.h1}</h1>
          <div className="bmeta" style={{ color: "rgba(255,255,255,.8)", marginTop: 14 }}>
            <span>{BLOG_AUTHOR.name}, {BLOG_AUTHOR.role}</span><span className="dot" style={{ background: "rgba(255,255,255,.6)" }} />
            {post.datePublished && <span>{formatDate(post.datePublished)}</span>}<span className="dot" style={{ background: "rgba(255,255,255,.6)" }} /><span>{minutes} мин чтения</span>
          </div>
        </div></div>
      </div>

      <div className="wrap" style={{ paddingTop: 34 }}>
        <nav className="crumbs" style={{ marginBottom: 20 }}>
          <Link href="/">Главная</Link><span>/</span><Link href="/blog">Блог</Link><span>/</span><b>{post.categoryName}</b>
        </nav>
        <div style={{ display: "grid", gap: 40, gridTemplateColumns: "minmax(0,1fr) 300px" }} className="article-layout">
          <article className="prose" style={{ minWidth: 0 }}>
            <BlogContent content={beforeCta} />
            <InArticleCTA serviceSlug={postServiceSlug} />
            {afterCta && <BlogContent content={afterCta} />}
            <ServiceCTA service={post.service} serviceSlug={postServiceSlug} />

            {related.length > 0 && (
              <section style={{ marginTop: 44 }}>
                <h2>Похожие статьи</h2>
                <div className="bgrid" style={{ marginTop: 18 }}>
                  {related.map((p) => (
                    <Link className="bcard" href={`/blog/${p.slug}`} key={p.slug}>
                      <div className="bcard-img" style={{ backgroundImage: `url(${coverFor((p as unknown as { serviceSlug?: string }).serviceSlug || "")})` }}><span className="cat">{p.categoryName}</span></div>
                      <div className="bcard-body"><h3>{p.h1}</h3></div>
                    </Link>
                  ))}
                </div>
              </section>
            )}
          </article>

          <aside className="article-aside" style={{ position: "relative" }}>
            <div style={{ position: "sticky", top: 90, display: "grid", gap: 18 }}>
              {toc.length > 0 && (
                <nav style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 16, padding: 20 }}>
                  <p style={{ fontSize: 13, fontWeight: 800, textTransform: "uppercase", letterSpacing: ".06em", color: "var(--faint)" }}>Содержание</p>
                  <ul style={{ listStyle: "none", margin: "12px 0 0", padding: 0, display: "grid", gap: 9 }}>
                    {toc.map((item) => (<li key={item.id}><a href={`#${item.id}`} style={{ fontSize: 14, color: "var(--muted)" }} className="toc-a">{item.text}</a></li>))}
                  </ul>
                </nav>
              )}
              <div className="article-cta" style={{ margin: 0, padding: 24, textAlign: "left" }}>
                <h3 style={{ fontSize: 18 }}>Нужен мастер?</h3>
                <p style={{ marginTop: 8, fontSize: 14 }}>Бесплатная диагностика и гарантия на работы.</p>
                <a className="btn btn-accent" href={ctaPhone.href} style={{ width: "100%", marginTop: 16 }}>Вызвать мастера</a>
                <a href={ctaPhone.href} style={{ display: "block", textAlign: "center", marginTop: 10, fontWeight: 800, color: "#fff" }}>{ctaPhone.display}</a>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}
