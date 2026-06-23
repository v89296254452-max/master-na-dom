import { NextResponse } from "next/server";
import {
  addVkUnparsedUrls,
  clearVkUnparsedUrls,
  readVkUnparsedUrlsFile,
  removeVkUnparsedUrlsByIds,
} from "@/lib/vk-unparsed-urls";

export async function GET() {
  try {
    const items = readVkUnparsedUrlsFile();
    return NextResponse.json({ success: true, items, count: items.length });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Не удалось загрузить очередь";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const urls = Array.isArray(body.urls)
      ? (body.urls as unknown[]).filter((item): item is string => typeof item === "string")
      : [];

    if (urls.length === 0) {
      return NextResponse.json({ success: false, error: "urls обязателен" }, { status: 400 });
    }

    const added = addVkUnparsedUrls(urls, "manual");
    return NextResponse.json({
      success: true,
      added: added.length,
      items: readVkUnparsedUrlsFile(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Не удалось добавить ссылки";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const ids = Array.isArray(body.ids)
      ? (body.ids as unknown[]).filter((item): item is string => typeof item === "string")
      : [];

    if (body.clear === true) {
      clearVkUnparsedUrls();
      return NextResponse.json({ success: true, items: [], count: 0 });
    }

    if (ids.length === 0) {
      return NextResponse.json({ success: false, error: "ids или clear обязателен" }, { status: 400 });
    }

    const items = removeVkUnparsedUrlsByIds(ids);
    return NextResponse.json({ success: true, items, count: items.length });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Не удалось удалить ссылки";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
