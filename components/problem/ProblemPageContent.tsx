import Link from "next/link";
import type { ProblemArticle } from "@/lib/problem-types";
import { getProblemPhone, getProblemPhoneHref, getRelatedProblems, getRelatedServicesForProblem } from "@/lib/problem";
import { BRAND } from "@/lib/service-templates";
import FaqSection from "@/components/service/FaqSection";
import SectionHeading from "@/components/service/SectionHeading";

interface ProblemPageContentProps {
  problem: ProblemArticle;
}

export default function ProblemPageContent({ problem }: ProblemPageContentProps) {
  const phone = getProblemPhone(problem);
  const phoneHref = getProblemPhoneHref(problem);
  const relatedProblems = getRelatedProblems(problem, 6);
  const relatedServices = getRelatedServicesForProblem(problem, 5);
  const faqs = problem.faqs.map((f) => ({ question: f.q, answer: f.a }));

  return (
    <div className="space-y-8">
      <header>
        <p className="text-sm font-medium text-orange">
          {problem.service} · {problem.city}
        </p>
        <h1 className="mt-2 text-3xl font-bold text-navy sm:text-4xl">{problem.title}</h1>
        <p className="mt-3 text-lg text-navy-muted leading-relaxed">{problem.description}</p>
      </header>

      <section className="rounded-2xl border border-gray-border bg-white p-6 sm:p-8">
        <SectionHeading title="Почему возникает" />
        <p className="text-navy-muted leading-relaxed">{problem.whyHappens}</p>
      </section>

      <section className="rounded-2xl border border-gray-border bg-gray-card p-6 sm:p-8">
        <SectionHeading title="Что можно проверить самостоятельно" />
        <ul className="space-y-2">
          {problem.selfCheck.map((item) => (
            <li key={item} className="flex gap-2 text-navy-muted">
              <span className="text-orange">✓</span>
              {item}
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-2xl border border-gray-border bg-white p-6 sm:p-8">
        <SectionHeading title="Когда вызывать мастера" />
        <ul className="space-y-2">
          {problem.whenCall.map((item) => (
            <li key={item} className="flex gap-2 text-navy-muted">
              <span className="text-orange">•</span>
              {item}
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-2xl border border-orange/30 bg-orange/5 p-6 sm:p-8">
        <SectionHeading title="Стоимость решения" />
        <p className="text-navy font-medium">{problem.priceHint}</p>
        <p className="mt-2 text-sm text-navy-muted">
          Точную цену мастер называет после осмотра. Диагностика бесплатна при выполнении работ.
        </p>
      </section>

      <FaqSection faqs={faqs} />

      {relatedProblems.length > 0 && (
        <section className="rounded-2xl border border-gray-border bg-gray-card p-6 sm:p-8">
          <SectionHeading title="Похожие проблемы" />
          <ul className="grid gap-2 sm:grid-cols-2">
            {relatedProblems.map((item) => (
              <li key={item.href}>
                <Link href={item.href} className="text-navy hover:text-orange font-medium">
                  {item.title}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {relatedServices.length > 0 && (
        <section className="rounded-2xl border border-gray-border bg-white p-6 sm:p-8">
          <SectionHeading title="Похожие услуги" subtitle={`${BRAND} в ${problem.cityPrepositional}`} />
          <ul className="space-y-2">
            {relatedServices.map((item) => (
              <li key={item.href}>
                <Link href={item.href} className="text-orange hover:underline font-medium">
                  {item.title}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="rounded-2xl bg-navy p-6 sm:p-8 text-white">
        <h2 className="text-2xl font-bold">Вызвать мастера</h2>
        <p className="mt-3 text-white/80">
          Нужен {problem.service.toLowerCase()} в {problem.cityPrepositional}? Перейдите на страницу услуги или
          позвоните — заявки принимаем 24/7.
        </p>
        <Link
          href={problem.targetUrl}
          className="mt-5 inline-flex items-center justify-center rounded-xl bg-orange px-8 py-4 font-semibold text-white hover:bg-orange-dark transition-colors"
        >
          Вызвать мастера
        </Link>
        <p className="mt-5">
          Телефон:{" "}
          <a href={phoneHref} className="text-2xl font-bold hover:text-orange transition-colors">
            {phone}
          </a>
        </p>
      </section>
    </div>
  );
}
