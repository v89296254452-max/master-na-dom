import Link from "next/link";
import type { ReactNode } from "react";
import { slugify } from "@/lib/transliterate";

/**
 * Маленький безопасный Markdown-рендер для статей блога.
 * Поддерживает: ##, ###, абзацы, маркированные/нумерованные списки,
 * выделенные блоки (>), ссылки [текст](url) и **жирный**.
 * Без сторонних зависимостей — устойчив к большому числу статей.
 */

function renderInline(text: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const linkRe = /\[([^\]]+)\]\(([^)]+)\)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let i = 0;

  const pushPlain = (chunk: string) => {
    const parts = chunk.split(/\*\*(.+?)\*\*/g);
    parts.forEach((part, idx) => {
      if (!part) return;
      if (idx % 2 === 1) {
        nodes.push(
          <strong key={`${keyPrefix}-b-${i++}`} className="font-semibold text-ink">
            {part}
          </strong>
        );
      } else {
        nodes.push(part);
      }
    });
  };

  while ((match = linkRe.exec(text)) !== null) {
    if (match.index > lastIndex) pushPlain(text.slice(lastIndex, match.index));
    const [, label, href] = match;
    const isInternal = href.startsWith("/");
    if (isInternal) {
      nodes.push(
        <Link
          key={`${keyPrefix}-l-${i++}`}
          href={href}
          className="text-accent font-medium hover:underline"
        >
          {label}
        </Link>
      );
    } else {
      nodes.push(
        <a
          key={`${keyPrefix}-l-${i++}`}
          href={href}
          className="text-accent font-medium hover:underline"
        >
          {label}
        </a>
      );
    }
    lastIndex = linkRe.lastIndex;
  }
  if (lastIndex < text.length) pushPlain(text.slice(lastIndex));

  return nodes;
}

export default function BlogContent({ content }: { content: string }) {
  const lines = content.split("\n");
  const blocks: ReactNode[] = [];
  let i = 0;
  let key = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed) {
      i++;
      continue;
    }

    // H3
    if (trimmed.startsWith("### ")) {
      const text = trimmed.slice(4).trim();
      blocks.push(
        <h3
          key={key++}
          className="text-lg font-semibold text-ink mt-6 mb-2.5 scroll-mt-24"
        >
          {renderInline(text, `h3-${key}`)}
        </h3>
      );
      i++;
      continue;
    }

    // H2
    if (trimmed.startsWith("## ")) {
      const text = trimmed.slice(3).trim();
      blocks.push(
        <h2
          key={key++}
          id={slugify(text)}
          className="text-[1.375rem] font-bold text-ink mt-8 mb-3.5 scroll-mt-24"
        >
          {renderInline(text, `h2-${key}`)}
        </h2>
      );
      i++;
      continue;
    }

    // Выделенный блок (>)
    if (trimmed.startsWith(">")) {
      const quoteLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith(">")) {
        quoteLines.push(lines[i].trim().replace(/^>\s?/, ""));
        i++;
      }
      blocks.push(
        <div
          key={key++}
          className="bg-accent-light border-l-[3px] border-accent rounded-r-lg px-5 py-4 my-5 text-ink"
        >
          {renderInline(quoteLines.join(" "), `q-${key}`)}
        </div>
      );
      continue;
    }

    // Нумерованный список
    if (/^\d+\.\s+/.test(trimmed)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\.\s+/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^\d+\.\s+/, ""));
        i++;
      }
      blocks.push(
        <ol key={key++} className="list-decimal pl-6 my-4 space-y-2 text-ink">
          {items.map((it, idx) => (
            <li key={idx} className="leading-relaxed">
              {renderInline(it, `ol-${key}-${idx}`)}
            </li>
          ))}
        </ol>
      );
      continue;
    }

    // Маркированный список
    if (/^[-*]\s+/.test(trimmed)) {
      const items: string[] = [];
      while (i < lines.length && /^[-*]\s+/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^[-*]\s+/, ""));
        i++;
      }
      blocks.push(
        <ul key={key++} className="list-disc pl-6 my-4 space-y-2 text-ink">
          {items.map((it, idx) => (
            <li key={idx} className="leading-relaxed">
              {renderInline(it, `ul-${key}-${idx}`)}
            </li>
          ))}
        </ul>
      );
      continue;
    }

    // Абзац (собираем подряд идущие строки)
    const paragraph: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() &&
      !lines[i].trim().startsWith("#") &&
      !lines[i].trim().startsWith(">") &&
      !/^[-*]\s+/.test(lines[i].trim()) &&
      !/^\d+\.\s+/.test(lines[i].trim())
    ) {
      paragraph.push(lines[i].trim());
      i++;
    }
    blocks.push(
      <p key={key++} className="leading-[1.75] mb-4 text-ink">
        {renderInline(paragraph.join(" "), `p-${key}`)}
      </p>
    );
  }

  return <div className="blog-content">{blocks}</div>;
}
