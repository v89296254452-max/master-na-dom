import { ImageResponse } from "next/og";
import { getPageBySlug } from "@/lib/pages";
import { buildOgImageContent, size, contentType, alt } from "@/lib/seo/og-image";

export { size, contentType, alt };

interface Props {
  params: Promise<{ slug: string }>;
}

export default async function OgImage({ params }: Props) {
  const { slug } = await params;
  const page = getPageBySlug(slug);

  if (!page) {
    return new ImageResponse(
      (
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "#1a2b4a",
            color: "white",
            fontSize: 48,
            fontWeight: 700,
          }}
        >
          ПроМастер
        </div>
      ),
      { ...size }
    );
  }

  return buildOgImageContent(page);
}
