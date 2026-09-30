import { NextRequest, NextResponse } from "next/server";
import { submitTryOn, TryOnCategory } from "@/lib/snapedit";

export const runtime = "nodejs";

const allowedCategories = new Set<TryOnCategory>([
  "upperbody",
  "lowerbody",
  "dress"
]);

const MAX_FILE_BYTES = 2 * 1024 * 1024;

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const person = formData.get("person");
    const garment = formData.get("garment");
    const category = String(formData.get("category") || "upperbody") as TryOnCategory;

    if (!(person instanceof File) || !(garment instanceof File)) {
      return NextResponse.json(
        { error: "Cần đủ ảnh người và ảnh quần áo." },
        { status: 400 }
      );
    }

    if (!allowedCategories.has(category)) {
      return NextResponse.json({ error: "Loại trang phục không hợp lệ." }, { status: 400 });
    }

    if (person.size > MAX_FILE_BYTES || garment.size > MAX_FILE_BYTES) {
      return NextResponse.json(
        { error: "Ảnh sau khi nén phải nhỏ hơn 2 MB mỗi ảnh." },
        { status: 413 }
      );
    }

    const result = await submitTryOn({
      person,
      garment,
      category
    });

    return NextResponse.json({
      jobId: result.job_id,
      status: result.status || "queued",
      creditsUsed: result.credits_used,
      etaSeconds: result.eta_seconds
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Không thể gửi yêu cầu thử đồ.";
    const status = message.includes("SNAPEDIT_API_KEY") ? 503 : 502;
    return NextResponse.json({ error: message }, { status });
  }
}
