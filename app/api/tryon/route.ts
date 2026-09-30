import { NextRequest, NextResponse } from "next/server";
import {
  tryOnWithFashn,
  TryOnCategory
} from "@/lib/huggingface-fashn";

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
    const topGarment = formData.get("topGarment");
    const bottomGarment = formData.get("bottomGarment");
    const category = String(
      formData.get("category") || "upperbody"
    ) as TryOnCategory;

    if (!(person instanceof File)) {
      return NextResponse.json(
        { error: "Thiếu ảnh người." },
        { status: 400 }
      );
    }

    if (
      category === "set"
        ? !(topGarment instanceof File) || !(bottomGarment instanceof File)
        : !(garment instanceof File)
    ) {
      return NextResponse.json(
        {
          error:
            category === "set"
              ? "Set cần ảnh áo và ảnh quần đã tách riêng."
              : "Thiếu ảnh quần áo."
        },
        { status: 400 }
      );
    }

    if (!allowedCategories.has(category)) {
      return NextResponse.json(
        { error: "Loại trang phục không hợp lệ." },
        { status: 400 }
      );
    }

    const filesToCheck = [
      person,
      garment instanceof File ? garment : null,
      topGarment instanceof File ? topGarment : null,
      bottomGarment instanceof File ? bottomGarment : null
    ].filter((file): file is File => Boolean(file));

    if (filesToCheck.some((file) => file.size > MAX_FILE_BYTES)) {
      return NextResponse.json(
        { error: "Ảnh sau khi nén phải nhỏ hơn 2 MB mỗi ảnh." },
        { status: 413 }
      );
    }

    const result = await tryOnWithFashn({
      person,
      garment: garment instanceof File ? garment : undefined,
      topGarment: topGarment instanceof File ? topGarment : undefined,
      bottomGarment: bottomGarment instanceof File ? bottomGarment : undefined,
      category
    });

    return NextResponse.json({
      status: "completed",
      outputUrl: result.outputUrl,
      provider: "huggingface-fashn-vton-1.5",
      requestedCategory: category,
      mode: result.mode,
      intermediateUrl: result.intermediateUrl
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
