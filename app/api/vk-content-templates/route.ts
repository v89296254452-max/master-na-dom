import { NextResponse } from "next/server";
import {
  ensureVkContentTemplatesFile,
  normalizeVkContentTemplates,
  readVkContentTemplatesFile,
  writeVkContentTemplatesFile,
} from "@/lib/vk-content-templates";

export async function GET() {
  try {
    const templates = ensureVkContentTemplatesFile();
    return NextResponse.json({ success: true, templates });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Не удалось загрузить шаблоны";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const templates = normalizeVkContentTemplates(body.templates ?? body);

    writeVkContentTemplatesFile(templates);

    return NextResponse.json({
      success: true,
      templates: readVkContentTemplatesFile(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Не удалось сохранить шаблоны";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
