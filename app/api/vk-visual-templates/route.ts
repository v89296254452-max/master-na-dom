import { NextResponse } from "next/server";
import {
  ensureVkVisualTemplatesFile,
  normalizeVkVisualTemplates,
  readVkVisualTemplatesFile,
  writeVkVisualTemplatesFile,
} from "@/lib/vk-visual-templates";

export async function GET() {
  try {
    const templates = ensureVkVisualTemplatesFile();
    return NextResponse.json({ success: true, templates });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Не удалось загрузить визуальные шаблоны";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const templates = normalizeVkVisualTemplates(body.templates ?? body);

    writeVkVisualTemplatesFile(templates);

    return NextResponse.json({
      success: true,
      templates: readVkVisualTemplatesFile(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Не удалось сохранить визуальные шаблоны";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
