import Link from "next/link";
import { getPostsByService } from "@/lib/blog-posts";
import BlogCard from "./blog/BlogCard";
import SectionHeading from "./service/SectionHeading";

interface BlogLinksSectionProps {
  serviceSlug: string;
  city?: string;
}

export default function BlogLinksSection({ serviceSlug }: BlogLinksSectionProps) {
  const posts = getPostsByService(serviceSlug).slice(0, 3);
  if (posts.length === 0) {
    return null;
  }

  return (
    <section className="bg-bg px-6 py-10">
      <div className="mx-auto max-w-[1100px]">
        <SectionHeading
          title="Полезные статьи"
          subtitle="Советы мастеров ПроМастер"
        />
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {posts.map((post) => (
            <BlogCard key={post.slug} post={post} />
          ))}
        </div>
        <div className="mt-6">
          <Link
            href={`/blog?service=${serviceSlug}`}
            className="inline-flex items-center gap-1 font-semibold text-accent hover:underline"
          >
            Все статьи →
          </Link>
        </div>
      </div>
    </section>
  );
}
