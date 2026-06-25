export interface ProblemLink {
  title: string;
  href: string;
}

export interface ProblemFaq {
  q: string;
  a: string;
}

export interface ProblemArticle {
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
  content: string;
  problemKey: string;
  problemTitle: string;
  whyHappens: string;
  selfCheck: string[];
  whenCall: string[];
  priceHint: string;
  faqs: ProblemFaq[];
  relatedProblems: string[];
  relatedServices: ProblemLink[];
  createdAt: string;
}

export interface ProblemListItem {
  slug: string;
  title: string;
  problemTitle: string;
  href: string;
}
