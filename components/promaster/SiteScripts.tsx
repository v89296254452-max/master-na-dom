"use client";

import { useEffect } from "react";
import { captureAttribution } from "@/lib/attribution";

/**
 * Клиентское «прогрессивное усиление» для редизайна: работает поверх
 * server-rendered разметки (контент в HTML для SEO), навешивает поведение —
 * появление блоков на скролле, счётчики, сжатие шапки, прогресс-бар,
 * калькулятор цены, фильтр городов, фон героя, jitter «онлайн».
 * Все селекторы опциональны — если элемента нет на странице, просто пропускаем.
 */
export default function SiteScripts() {
  useEffect(() => {
    document.documentElement.classList.add("js");
    captureAttribution(); // first-touch UTM/yclid → cookie для атрибуции заявок
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    let revealFallback: ReturnType<typeof setTimeout> | undefined;
    let cleanupReveal: (() => void) | undefined;

    // header shrink + scroll progress
    const hdr = document.getElementById("pm-hdr");
    const prog = document.getElementById("pm-prog");
    const onScroll = () => {
      const y = window.scrollY;
      hdr?.classList.toggle("small", y > 40);
      if (prog) {
        const h = document.documentElement.scrollHeight - window.innerHeight;
        prog.style.width = (h > 0 ? (y / h) * 100 : 0) + "%";
      }
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();

    // reveal on scroll + counters (пуленепробиваемо: контент НИКОГДА не остаётся
    // невидимым — IntersectionObserver для анимации + rAF-фолбэк по позиции,
    // который не «промахивается» при быстром скролле, + жёсткий таймаут-разблок).
    const items = Array.from(document.querySelectorAll<HTMLElement>(".rv, .stg"));
    const pending = new Set(items);

    const reveal = (el: HTMLElement) => {
      if (!pending.has(el)) return;
      pending.delete(el);
      el.classList.add("in");
      if (el.querySelector("[data-to]")) countUp(el);
    };

    // если анимация выключена — показать всё сразу
    if (reduce) {
      items.forEach(reveal);
    } else {
      const io = new IntersectionObserver(
        (entries) => entries.forEach((e) => { if (e.isIntersecting) reveal(e.target as HTMLElement); }),
        // rootMargin снизу — блок появляется чуть раньше, чем войдёт в экран
        { threshold: 0.01, rootMargin: "0px 0px 12% 0px" }
      );
      items.forEach((el) => io.observe(el));

      // Фолбэк №1: на каждом кадре скролла показываем всё, что уже в зоне видимости.
      // getBoundingClientRect сверяется с ТЕКУЩЕЙ позицией — не пропускает блоки
      // при быстром пролистывании / восстановлении скролла / переходе по якорю.
      let raf = 0;
      const sweep = () => {
        raf = 0;
        const vh = window.innerHeight;
        pending.forEach((el) => {
          const r = el.getBoundingClientRect();
          if (r.top < vh * 1.05 && r.bottom > -vh * 0.2) reveal(el);
        });
        if (!pending.size) {
          window.removeEventListener("scroll", onRevealScroll);
          window.removeEventListener("resize", onRevealScroll);
          io.disconnect();
        }
      };
      const onRevealScroll = () => { if (!raf) raf = requestAnimationFrame(sweep); };
      window.addEventListener("scroll", onRevealScroll, { passive: true });
      window.addEventListener("resize", onRevealScroll, { passive: true });
      sweep(); // сразу показать то, что видно при загрузке

      // Фолбэк №2 (страховка): через 2.5с показать всё, что осталось скрытым,
      // что бы ни случилось с observer/скроллом — контент не должен пропадать.
      revealFallback = setTimeout(() => items.forEach(reveal), 2500);
      cleanupReveal = () => {
        window.removeEventListener("scroll", onRevealScroll);
        window.removeEventListener("resize", onRevealScroll);
        io.disconnect();
      };
    }

    function countUp(scope: HTMLElement) {
      scope.querySelectorAll<HTMLElement>("[data-to]").forEach((el) => {
        const to = parseFloat(el.dataset.to || "0");
        const dec = +(el.dataset.dec || 0);
        const suf = el.dataset.suf || "";
        if (reduce) {
          el.textContent = (dec ? to.toFixed(dec) : to.toLocaleString("ru")) + suf;
          return;
        }
        let s: number | null = null;
        const dur = 1200;
        const step = (t: number) => {
          s = s ?? t;
          const p = Math.min((t - s) / dur, 1);
          const eased = 1 - Math.pow(1 - p, 3);
          const v = to * eased;
          el.textContent = (dec ? v.toFixed(dec) : Math.round(v).toLocaleString("ru")) + suf;
          if (p < 1) requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
      });
    }

    // hero-фон теперь рендерится на сервере (inline style, см. lib/hero-bg.ts) —
    // JS-установка убрана, чтобы LCP не ждал выполнения скрипта.

    // online jitter
    const online = document.getElementById("pm-online");
    let jitter: ReturnType<typeof setInterval> | undefined;
    if (online) {
      jitter = setInterval(() => {
        let v = +(online.textContent || "0") + (Math.random() < 0.5 ? -1 : 1);
        v = Math.max(38, Math.min(54, v));
        online.textContent = String(v);
      }, 3200);
    }

    // city search filter
    const citySearch = document.getElementById("pm-city-search") as HTMLInputElement | null;
    if (citySearch) {
      const cards = Array.from(document.querySelectorAll<HTMLElement>(".ccard"));
      citySearch.addEventListener("input", () => {
        const q = citySearch.value.trim().toLowerCase();
        cards.forEach((c) => {
          const name = (c.dataset.city || c.textContent || "").toLowerCase();
          c.style.display = !q || name.includes(q) ? "" : "none";
        });
      });
    }

    // Коллтрекинг: если страница указала номер направления (#pm-page-phone),
    // подставляем его во все .js-phone (шапка/футер).
    const pagePhone = document.getElementById("pm-page-phone");
    if (pagePhone) {
      const href = pagePhone.dataset.href;
      const display = pagePhone.dataset.display;
      if (href && display) {
        document.querySelectorAll<HTMLAnchorElement>("a.js-phone").forEach((a) => {
          a.href = href;
          a.textContent = display;
        });
        // только href (кнопки с иконкой/текстом — текст не трогаем)
        document.querySelectorAll<HTMLAnchorElement>("a.js-phone-href").forEach((a) => {
          a.href = href;
        });
      }
    }

    // Метрика: цель «клик по телефону»
    const YM_ID = 110026692;
    const ym = (goal: string) => {
      const w = window as unknown as { ym?: (id: number, m: string, t: string) => void };
      if (typeof w.ym === "function") w.ym(YM_ID, "reachGoal", goal);
    };
    const onCall = (e: Event) => {
      const t = (e.target as HTMLElement)?.closest?.('a[href^="tel:"]');
      if (t) ym("call_click");
    };
    document.addEventListener("click", onCall);

    // Метрика: цель «скролл 75%»
    let fired75 = false;
    const onScrollGoal = () => {
      const h = document.documentElement.scrollHeight - window.innerHeight;
      if (!fired75 && h > 0 && window.scrollY / h > 0.75) { fired75 = true; ym("scroll_75"); }
    };
    window.addEventListener("scroll", onScrollGoal, { passive: true });

    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("scroll", onScrollGoal);
      document.removeEventListener("click", onCall);
      cleanupReveal?.();
      if (revealFallback) clearTimeout(revealFallback);
      if (jitter) clearInterval(jitter);
    };
  }, []);

  return null;
}
