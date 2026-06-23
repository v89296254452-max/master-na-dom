"use client";

import { useCallback, useState } from "react";
import type { VkTask } from "@/lib/vk-task-types";
import {
  normalizeImageAssets,
  VK_IMAGE_ASSET_TYPE_LABELS,
  type VkImageAssetType,
} from "@/lib/vk-image-assets-types";

function CopyPromptButton({
  label,
  value,
  copyKey,
  copiedKey,
  onCopy,
}: {
  label: string;
  value: string;
  copyKey: string;
  copiedKey: string | null;
  onCopy: (text: string, key: string) => void;
}) {
  return (
    <div className="rounded-xl border border-gray-border bg-white p-4">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h4 className="text-sm font-semibold text-navy">{label}</h4>
        <button
          type="button"
          onClick={() => onCopy(value, copyKey)}
          disabled={!value}
          className="rounded-lg border border-gray-border bg-gray-card px-3 py-1.5 text-xs font-medium text-navy hover:bg-white disabled:opacity-50"
        >
          {copiedKey === copyKey ? "Скопировано" : "Копировать промпт"}
        </button>
      </div>
      <p className="whitespace-pre-wrap break-words text-sm text-navy-muted">{value || "—"}</p>
    </div>
  );
}

function ImagePreview({ label, src }: { label: string; src: string }) {
  return (
    <div className="rounded-xl border border-gray-border bg-white p-3">
      <div className="mb-2 text-xs font-medium uppercase tracking-wide text-navy-muted">{label}</div>
      <img src={src} alt={label} className="max-h-48 w-full rounded-lg object-contain bg-gray-card" />
      <p className="mt-2 truncate font-mono text-xs text-navy-muted">{src}</p>
    </div>
  );
}

interface VkTaskImagesBlockProps {
  task: VkTask;
  variant?: "admin" | "operator";
  onTaskUpdated?: (task: VkTask) => void;
}

export default function VkTaskImagesBlock({
  task,
  variant = "admin",
  onTaskUpdated,
}: VkTaskImagesBlockProps) {
  const imageAssets = normalizeImageAssets(task.imageAssets);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [externalType, setExternalType] = useState<VkImageAssetType>("avatar");
  const [externalUrl, setExternalUrl] = useState("");

  const prefix = `img-${task.id}`;

  const handleCopy = useCallback(async (text: string, key: string) => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      window.setTimeout(() => setCopiedKey((current) => (current === key ? null : current)), 1500);
    } catch {
      setError("Не удалось скопировать в буфер обмена");
    }
  }, []);

  async function handleGeneratePrompts() {
    setGenerating(true);
    setError(null);
    setMessage(null);

    try {
      const res = await fetch("/api/vk-images/generate-prompts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId: task.id }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || "Не удалось сгенерировать промпты");
      }

      onTaskUpdated?.(data.task as VkTask);
      setMessage("Промпты сгенерированы и сохранены в задаче");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка генерации промптов");
    } finally {
      setGenerating(false);
    }
  }

  async function handleSaveExternal() {
    setSaving(true);
    setError(null);
    setMessage(null);

    try {
      const res = await fetch("/api/vk-images/save-external", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taskId: task.id,
          type: externalType,
          imageUrl: externalUrl.trim(),
        }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || "Не удалось сохранить изображение");
      }

      onTaskUpdated?.(data.task as VkTask);
      setExternalUrl("");
      setMessage(`Изображение сохранено (${VK_IMAGE_ASSET_TYPE_LABELS[externalType]})`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка сохранения изображения");
    } finally {
      setSaving(false);
    }
  }

  const hasPreviews =
    Boolean(imageAssets.avatarPath) ||
    Boolean(imageAssets.coverPath) ||
    imageAssets.postImagePaths.length > 0;

  return (
    <div className="space-y-4">
      {variant === "admin" ? (
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handleGeneratePrompts}
            disabled={generating}
            className="rounded-xl bg-navy px-4 py-2.5 text-sm font-semibold text-white hover:bg-navy/90 disabled:opacity-50"
          >
            {generating ? "Генерация..." : "Сгенерировать промпты"}
          </button>
          <span className="text-sm text-navy-muted">taskId: {task.id}</span>
        </div>
      ) : (
        <h3 className="text-sm font-semibold uppercase tracking-wide text-navy-muted">Изображения</h3>
      )}

      {(error || message) && (
        <div
          className={`rounded-xl border px-4 py-3 text-sm ${
            error ? "border-red-200 bg-red-50 text-red-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"
          }`}
        >
          {error || message}
        </div>
      )}

      <CopyPromptButton
        label="Промпт аватара"
        value={imageAssets.avatarPrompt}
        copyKey={`${prefix}-avatar`}
        copiedKey={copiedKey}
        onCopy={handleCopy}
      />

      <CopyPromptButton
        label="Промпт обложки"
        value={imageAssets.coverPrompt}
        copyKey={`${prefix}-cover`}
        copiedKey={copiedKey}
        onCopy={handleCopy}
      />

      <div className="space-y-3">
        <h4 className="text-sm font-semibold text-navy">Промпты постов</h4>
        {imageAssets.postImagePrompts.length > 0 ? (
          imageAssets.postImagePrompts.map((prompt, index) => (
            <CopyPromptButton
              key={`${prefix}-post-${index}`}
              label={`Пост #${index + 1}`}
              value={prompt}
              copyKey={`${prefix}-post-${index}`}
              copiedKey={copiedKey}
              onCopy={handleCopy}
            />
          ))
        ) : (
          <p className="text-sm text-navy-muted">Промпты постов ещё не сгенерированы</p>
        )}
      </div>

      {hasPreviews ? (
        <div className="space-y-3">
          <h4 className="text-sm font-semibold text-navy">Превью</h4>
          <div className="grid gap-3 md:grid-cols-2">
            {imageAssets.avatarPath ? (
              <ImagePreview label="Аватар" src={imageAssets.avatarPath} />
            ) : null}
            {imageAssets.coverPath ? (
              <ImagePreview label="Обложка" src={imageAssets.coverPath} />
            ) : null}
            {imageAssets.postImagePaths.map((src, index) => (
              <ImagePreview key={`${prefix}-preview-post-${index}`} label={`Пост #${index + 1}`} src={src} />
            ))}
          </div>
        </div>
      ) : variant === "operator" ? (
        <p className="text-sm text-navy-muted">Файлы изображений ещё не сохранены</p>
      ) : null}

      {variant === "admin" ? (
        <section className="rounded-xl border border-gray-border bg-gray-card p-4 sm:p-5">
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-navy-muted">
            Добавить внешнюю картинку
          </h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-navy-muted">taskId</label>
              <input
                type="text"
                value={task.id}
                readOnly
                className="w-full rounded-lg border border-gray-border bg-white px-3 py-2 text-sm text-navy-muted"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-navy-muted">type</label>
              <select
                value={externalType}
                onChange={(e) => setExternalType(e.target.value as VkImageAssetType)}
                className="w-full rounded-lg border border-gray-border bg-white px-3 py-2 text-sm outline-none focus:border-orange focus:ring-2 focus:ring-orange/20"
              >
                {(Object.keys(VK_IMAGE_ASSET_TYPE_LABELS) as VkImageAssetType[]).map((type) => (
                  <option key={type} value={type}>
                    {VK_IMAGE_ASSET_TYPE_LABELS[type]}
                  </option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-medium text-navy-muted">imageUrl</label>
              <input
                type="url"
                value={externalUrl}
                onChange={(e) => setExternalUrl(e.target.value)}
                placeholder="https://..."
                className="w-full rounded-lg border border-gray-border bg-white px-3 py-2 text-sm outline-none focus:border-orange focus:ring-2 focus:ring-orange/20"
              />
            </div>
          </div>
          <button
            type="button"
            onClick={handleSaveExternal}
            disabled={saving || !externalUrl.trim()}
            className="mt-4 rounded-xl bg-orange px-4 py-2.5 text-sm font-semibold text-white hover:bg-orange-dark disabled:opacity-50"
          >
            {saving ? "Сохранение..." : "Сохранить картинку"}
          </button>
        </section>
      ) : null}
    </div>
  );
}
