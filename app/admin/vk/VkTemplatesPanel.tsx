"use client";

import { useCallback, useEffect, useState } from "react";
import type {
  VkContentTemplatesStore,
  VkGroupContentTemplates,
  VkTemplateGroupLabel,
} from "@/lib/vk-content-templates-types";
import { VK_TEMPLATE_GROUP_LABELS, VK_TEMPLATE_VARIABLES } from "@/lib/vk-content-templates-types";

const TEMPLATE_SECTIONS: {
  key: keyof VkGroupContentTemplates;
  label: string;
  rows: number;
}[] = [
  { key: "descriptions", label: "Описания (descriptions)", rows: 4 },
  { key: "pinnedPosts", label: "Закреплённые посты (pinnedPosts)", rows: 5 },
  { key: "posts", label: "Посты (posts)", rows: 5 },
];

function cloneStore(store: VkContentTemplatesStore): VkContentTemplatesStore {
  return JSON.parse(JSON.stringify(store)) as VkContentTemplatesStore;
}

function ensureFiveItems(items: string[]): string[] {
  const next = [...items];
  while (next.length < 5) {
    next.push("");
  }
  return next.slice(0, 5);
}

export default function VkTemplatesPanel() {
  const [templates, setTemplates] = useState<VkContentTemplatesStore | null>(null);
  const [selectedGroup, setSelectedGroup] = useState<VkTemplateGroupLabel>("КП");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const loadTemplates = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/vk-content-templates");
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || "Не удалось загрузить шаблоны");
      }

      setTemplates(cloneStore(data.templates as VkContentTemplatesStore));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка загрузки");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  function updateTemplate(
    group: VkTemplateGroupLabel,
    section: keyof VkGroupContentTemplates,
    index: number,
    value: string
  ) {
    setTemplates((prev) => {
      if (!prev) return prev;
      const next = cloneStore(prev);
      const items = ensureFiveItems([...next[group][section]]);
      items[index] = value;
      next[group][section] = items;
      return next;
    });
  }

  async function handleSave() {
    if (!templates) return;

    setSaving(true);
    setError(null);
    setMessage(null);

    try {
      const res = await fetch("/api/vk-content-templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ templates }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || "Не удалось сохранить");
      }

      setTemplates(cloneStore(data.templates as VkContentTemplatesStore));
      setMessage("Шаблоны сохранены");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка сохранения");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="rounded-xl border border-gray-border bg-gray-card px-6 py-12 text-center text-navy-muted">
        Загрузка шаблонов...
      </div>
    );
  }

  if (!templates) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 px-6 py-12 text-center text-red-700">
        {error || "Шаблоны недоступны"}
      </div>
    );
  }

  const groupTemplates = templates[selectedGroup];

  return (
    <div className="space-y-5">
      {(error || message) && (
        <div
          className={`rounded-xl border px-4 py-3 text-sm ${
            error ? "border-red-200 bg-red-50 text-red-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"
          }`}
        >
          {error || message}
        </div>
      )}

      <section className="rounded-xl border border-gray-border bg-white p-4 sm:p-5">
        <h2 className="text-lg font-semibold text-navy">Шаблоны контента VK</h2>
        <p className="mt-2 text-sm text-navy-muted">
          Переменные: {VK_TEMPLATE_VARIABLES.join(", ")}
        </p>

        <div className="mt-4 inline-flex rounded-xl border border-gray-border bg-gray-card p-1">
          {VK_TEMPLATE_GROUP_LABELS.map((group) => (
            <button
              key={group}
              type="button"
              onClick={() => setSelectedGroup(group)}
              className={`rounded-lg px-4 py-2 text-sm font-medium ${
                selectedGroup === group ? "bg-navy text-white" : "text-navy hover:bg-white"
              }`}
            >
              {group}
            </button>
          ))}
        </div>
      </section>

      {TEMPLATE_SECTIONS.map((section) => {
        const items = ensureFiveItems(groupTemplates[section.key]);

        return (
          <section key={section.key} className="rounded-xl border border-gray-border bg-white p-4 sm:p-5">
            <h3 className="text-base font-semibold text-navy">{section.label}</h3>
            <div className="mt-4 space-y-3">
              {items.map((value, index) => (
                <label key={`${section.key}-${index}`} className="block text-sm">
                  <span className="mb-1 block text-xs font-medium text-navy-muted">
                    Шаблон {index + 1}
                  </span>
                  <textarea
                    value={value}
                    onChange={(e) => updateTemplate(selectedGroup, section.key, index, e.target.value)}
                    rows={section.rows}
                    className="w-full rounded-lg border border-gray-border px-3 py-2 font-mono text-sm outline-none focus:border-orange focus:ring-2 focus:ring-orange/20"
                  />
                </label>
              ))}
            </div>
          </section>
        );
      })}

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="rounded-lg bg-navy px-5 py-2.5 text-sm font-medium text-white hover:bg-navy-light disabled:opacity-50"
        >
          {saving ? "Сохранение..." : "Сохранить шаблоны"}
        </button>
        <button
          type="button"
          onClick={loadTemplates}
          disabled={saving}
          className="rounded-lg border border-gray-border bg-white px-5 py-2.5 text-sm font-medium text-navy hover:bg-gray-card disabled:opacity-50"
        >
          Отменить изменения
        </button>
      </div>
    </div>
  );
}
