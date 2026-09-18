"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

export interface BlogItem {
  slug: string;
  title: string;
  description: string;
  category: string;
  categoryName: string;
  minutes: number;
  date: string;
  cover: string;
}

const ARR = <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>;

export default function BlogCatalog({ items, categories }: { items: BlogItem[]; categories: { slug: string; name: string }[] }) {
  const [cat, setCat] = useState("");
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    return items.filter((p) => (!cat || p.category === cat) && (!query || (p.title + " " + p.description).toLowerCase().includes(query)));
  }, [items, cat, q]);

  const featured = filtered[0];
  const rest = filtered.slice(1);

  return (
    <>
      <div className="blog-filter">
        <div className="wrap">
          <div className="bf-tabs">
            <button className={`bf-tab${!cat ? " active" : ""}`} onClick={() => setCat("")}>Все</button>
            {categories.map((c) => (
              <button key={c.slug} className={`bf-tab${cat === c.slug ? " active" : ""}`} onClick={() => setCat(c.slug)}>{c.name}</button>
            ))}
          </div>
          <div className="bf-search">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="7" /><path d="M21 21l-4-4" /></svg>
            <input type="text" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Поиск по статьям" />
          </div>
        </div>
      </div>

      <div className="blog-body"><div className="wrap">
        {!featured && <div className="bcard-empty">Ничего не нашлось. Попробуйте другой запрос.</div>}

        {featured && (
          <Link className="bfeat" href={`/blog/${featured.slug}`}>
            <div className="bfeat-img" style={{ backgroundImage: `url(${featured.cover})` }}><span className="cat">{featured.categoryName}</span></div>
            <div className="bfeat-body">
              <div className="bmeta">{featured.date && <span>{featured.date}</span>}{featured.date && <span className="dot" />}<span>{featured.minutes} мин чтения</span></div>
              <h2>{featured.title}</h2>
              <p>{featured.description}</p>
              <span className="bfeat-more">Читать статью {ARR}</span>
            </div>
          </Link>
        )}

        {rest.length > 0 && (
          <div className="bgrid">
            {rest.map((p) => (
              <Link className="bcard" href={`/blog/${p.slug}`} key={p.slug}>
                <div className="bcard-img" style={{ backgroundImage: `url(${p.cover})` }}><span className="cat">{p.categoryName}</span></div>
                <div className="bcard-body">
                  <div className="bmeta">{p.date && <span>{p.date}</span>}{p.date && <span className="dot" />}<span>{p.minutes} мин</span></div>
                  <h3>{p.title}</h3>
                  <p>{p.description}</p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div></div>
    </>
  );
}
