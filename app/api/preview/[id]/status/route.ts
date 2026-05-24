import { NextResponse, type NextRequest } from "next/server";
import { getPreview } from "@/lib/previews";

export const runtime = "nodejs";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const preview = await getPreview(id);
  if (!preview) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({
    id: preview.id,
    status: preview.status,
    watermarkedUrl: preview.watermarkedUrl,
    errorMessage: preview.errorMessage,
  });
}
