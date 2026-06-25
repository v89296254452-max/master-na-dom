import type { ReviewItem } from "@/lib/seo/reviews";
import SectionHeading from "./SectionHeading";

interface ReviewsBlockProps {
  reviews: ReviewItem[];
}

function Stars({ rating }: { rating: number }) {
  return (
    <span className="text-orange" aria-label={`Оценка ${rating} из 5`}>
      {"★".repeat(rating)}
      {"☆".repeat(5 - rating)}
    </span>
  );
}

export default function ReviewsBlock({ reviews }: ReviewsBlockProps) {
  if (reviews.length === 0) return null;

  return (
    <section className="rounded-2xl border border-gray-border bg-gray-card p-6 sm:p-8">
      <SectionHeading title="Отзывы клиентов" subtitle="Реальные отзывы жителей вашего города" />
      <div className="grid gap-4 sm:grid-cols-2">
        {reviews.map((review, i) => (
          <article
            key={i}
            className="rounded-xl bg-white border border-gray-border p-5 shadow-sm"
          >
            <div className="flex items-center justify-between gap-2">
              <p className="font-semibold text-navy">{review.name}</p>
              <Stars rating={review.rating} />
            </div>
            <p className="mt-1 text-xs text-navy-muted">
              {review.district} · {review.date} · {review.service}
            </p>
            <p className="mt-3 text-sm text-navy-muted leading-relaxed">{review.text}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
