import { Client, handle_file } from "@gradio/client";

const SPACE = "levihsu/OOTDiffusion";

export type TryOnCategory = "upperbody" | "lowerbody" | "dress" | "set";

function categoryLabel(category: TryOnCategory) {
  if (category === "upperbody") return "Upper-body";
  if (category === "lowerbody") return "Lower-body";
  // OOTDiffusion không có category "set" riêng; giữ category set ở app/API
  // và dùng full-body mode của model để xử lý ảnh bộ đồ.
  if (category === "set") return "Dress";
  return "Dress";
}

function extractUrl(value: unknown): string | undefined {
  if (typeof value === "string") {
    return value.startsWith("http") ? value : undefined;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const found = extractUrl(item);
      if (found) return found;
    }
    return undefined;
  }

  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    for (const key of ["url", "path", "download_url", "image"]) {
      const found = extractUrl(obj[key]);
      if (found) return found;
    }
  }

  return undefined;
}

async function asBlob(file: File) {
  const bytes = await file.arrayBuffer();
  return new Blob([bytes], { type: file.type || "image/jpeg" });
}

export async function tryOnWithOOTDiffusion(input: {
  person: File;
  garment: File;
  category: TryOnCategory;
}) {
  const [personBlob, garmentBlob] = await Promise.all([
    asBlob(input.person),
    asBlob(input.garment)
  ]);

  const token = process.env.HF_TOKEN?.trim();
  const hfToken =
    token && token.startsWith("hf_")
      ? (token as `hf_${string}`)
      : undefined;

  const app = await Client.connect(
    SPACE,
    hfToken ? { token: hfToken } : undefined
  );

  const result = await app.predict("/process_dc", {
    vton_img: handle_file(personBlob),
    garm_img: handle_file(garmentBlob),
    category: categoryLabel(input.category),
    n_samples: 1,
    n_steps: 20,
    image_scale: 2,
    seed: -1
  });

  const data = (result as { data?: unknown[] }).data || [];
  const outputUrl = extractUrl(data[0]);

  if (!outputUrl) {
    throw new Error(
      "OOTDiffusion không trả ảnh kết quả. ZeroGPU có thể đang hết quota hoặc quá tải."
    );
  }

  return { outputUrl };
}
