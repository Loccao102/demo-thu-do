import { NextRequest, NextResponse } from "next/server";
import { tryOnWithKolors } from "@/lib/huggingface-kolors";

export const runtime = "nodejs";
export const maxDuration = 120;

const MAX_FILE_BYTES = 2 * 1024 * 1024;

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const person = formData.get("person");
    const garment = formData.get("garment");

    if (!(person instanceof File) || !(garment instanceof File)) {
      return NextResponse.json(
        { error: "Cần đủ ảnh người và ảnh quần áo." },
        { status: 400 }
      );
    }

    if (person.size > MAX_FILE_BYTES || garment.size > MAX_FILE_BYTES) {
      return NextResponse.json(
        { error: "Ảnh sau khi nén phải nhỏ hơn 2 MB mỗi ảnh." },
        { status: 413 }
      );
    }

    const result = await tryOnWithKolors({ person, garment });

    return NextResponse.json({
      status: "completed",
      outputUrl: result.outputUrl,
      seedUsed: result.seedUsed,
      info: result.info,
      provider: "huggingface-kolors"
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Không thể thử đồ.";
    return NextResponse.json(
      {
        error:
          message.includes("Too many users")
            ? "Hugging Face Space đang quá tải. Hãy thử lại sau một lúc."
            : message
      },
      { status: 502 }
    );
  }
}
