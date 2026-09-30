import { Client, handle_file } from "@gradio/client";

const SPACE = "fashn-ai/fashn-vton-1.5";

export type TryOnCategory = "upperbody" | "lowerbody" | "dress" | "set";

type FashnCategory = "tops" | "bottoms" | "one-pieces";

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

function hfClientOptions() {
  const token = process.env.HF_TOKEN?.trim();
  const hfToken =
    token && token.startsWith("hf_")
      ? (token as `hf_${string}`)
      : undefined;

  return hfToken ? { token: hfToken } : undefined;
}

async function runFashn(input: {
  person: Blob;
  garment: Blob;
  category: FashnCategory;
}) {
  const app = await Client.connect(SPACE, hfClientOptions());

  const result = await app.predict("/try_on", [
    handle_file(input.person),
    handle_file(input.garment),
    input.category,
    "flat-lay",
    30,
    1.5,
    42,
    true
  ]);

  const data = (result as { data?: unknown[] }).data || [];
  const outputUrl = extractUrl(data[0]);

  if (!outputUrl) {
    throw new Error(
      "FASHN VTON không trả ảnh kết quả. ZeroGPU có thể đang quá tải hoặc hết quota."
    );
  }

  return outputUrl;
}

async function urlToBlob(url: string) {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) {
    throw new Error("Không tải được ảnh trung gian từ FASHN VTON.");
  }
  return response.blob();
}

export async function tryOnWithFashn(input: {
  person: File;
  garment?: File;
  topGarment?: File;
  bottomGarment?: File;
  category: TryOnCategory;
}) {
  const personBlob = await asBlob(input.person);

  if (input.category === "set") {
    if (!input.topGarment || !input.bottomGarment) {
      throw new Error("Set cần topGarment và bottomGarment riêng.");
    }

    const [topBlob, bottomBlob] = await Promise.all([
      asBlob(input.topGarment),
      asBlob(input.bottomGarment)
    ]);

    const topUrl = await runFashn({
      person: personBlob,
      garment: topBlob,
      category: "tops"
    });

    const personWithTop = await urlToBlob(topUrl);

    const finalUrl = await runFashn({
      person: personWithTop,
      garment: bottomBlob,
      category: "bottoms"
    });

    return {
      outputUrl: finalUrl,
      intermediateUrl: topUrl,
      mode: "set-two-pass-split" as const
    };
  }

  if (!input.garment) {
    throw new Error("Thiếu ảnh garment.");
  }

  const garmentBlob = await asBlob(input.garment);

  const category: FashnCategory =
    input.category === "upperbody"
      ? "tops"
      : input.category === "lowerbody"
        ? "bottoms"
        : "one-pieces";

  const outputUrl = await runFashn({
    person: personBlob,
    garment: garmentBlob,
    category
  });

  return {
    outputUrl,
    mode: "single-pass" as const
  };
}
