export interface BlogArticle {
  id: string;
  slug: string;
  title: string;
  description: string;
  service: string;
  serviceSlug: string;
  city: string;
  cityPrepositional: string;
  targetUrl: string;
  phone: string;
  tags: string[];
  content: string;
  createdAt: string;
}

export interface BlogArticleLink {
  title: string;
  href: string;
}
