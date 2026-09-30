import { NextRequest, NextResponse } from "next/server";
import {
  tryOnWithOOTDiffusion,
  TryOnCategory
} from "@/lib/huggingface-ootdiffusion";

export const runtime = "nodejs";
export const maxDuration = 300;

const allowedCategories = new Set<TryOnCategory>([
  "upperbody",
  "lowerbody",
  "dress",
  "set"
]);

const MAX_FILE_BYTES = 2 * 1024 * 1024;

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const person = formData.get("person");
    const garment = formData.get("garment");
    const category = String(
      formData.get("category") || "upperbody"
    ) as TryOnCategory;

    if (!(person instanceof File) || !(garment instanceof File)) {
      return NextResponse.json(
        { error: "Cần đủ ảnh người và ảnh quần áo." },
        { status: 400 }
      );
    }

    if (!allowedCategories.has(category)) {
      return NextResponse.json(
        { error: "Loại trang phục không hợp lệ." },
        { status: 400 }
      );
    }

    if (person.size > MAX_FILE_BYTES || garment.size > MAX_FILE_BYTES) {
      return NextResponse.json(
        { error: "Ảnh sau khi nén phải nhỏ hơn 2 MB mỗi ảnh." },
        { status: 413 }
      );
    }

    const result = await tryOnWithOOTDiffusion({
      person,
      garment,
      category
    });

    return NextResponse.json({
      status: "completed",
      outputUrl: result.outputUrl,
      provider: "huggingface-ootdiffusion",
      requestedCategory: category
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Không thể thử đồ.";

    const normalized =
      /quota|gpu|queue|too many|exceeded|rate/i.test(message)
        ? "Hugging Face ZeroGPU đang hết quota hoặc quá tải. Hãy thử lại sau, hoặc cấu hình HF_TOKEN miễn phí để dùng quota tài khoản."
        : message;

    return NextResponse.json({ error: normalized }, { status: 502 });
  }
}
