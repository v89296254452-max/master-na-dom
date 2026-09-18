import Link from "next/link";
import type { BlogPost } from "@/lib/blog-posts";

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("ru-RU", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  } catch {
    return "";
  }
}

export default function BlogCard({ post }: { post: BlogPost }) {
  return (
    <Link
      href={`/blog/${post.slug}`}
      className="group flex flex-col bg-surface border border-border rounded-xl p-5 transition-shadow hover:shadow-md"
    >
      <span className="self-start text-xs font-semibold text-accent bg-accent-light rounded-full px-2.5 py-1">
        {post.categoryName}
      </span>
      <h3 className="mt-3 text-base font-semibold text-ink leading-snug group-hover:text-accent transition-colors">
        {post.h1}
      </h3>
      <p className="mt-2 text-sm text-muted line-clamp-2 flex-1">
        {post.description}
      </p>
      <div className="mt-4 flex items-center gap-3 text-xs text-faint">
        <span className="inline-flex items-center gap-1">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="9" />
            <path d="M12 7v5l3 2" />
          </svg>
          {post.readTime} мин
        </span>
        <span>{formatDate(post.datePublished)}</span>
        <span className="ml-auto text-accent font-medium group-hover:underline">
          Читать →
        </span>
      </div>
    </Link>
  );
}
