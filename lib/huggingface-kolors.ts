import { Client, handle_file } from "@gradio/client";

const SPACE = "Kwai-Kolors/Kolors-Virtual-Try-On";

function toBlob(file: File) {
  return file.arrayBuffer().then(
    (buffer) => new Blob([buffer], { type: file.type || "image/jpeg" })
  );
}

function extractUrl(value: unknown): string | undefined {
  if (typeof value === "string") return value;

  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    for (const key of ["url", "path", "download_url"]) {
      const candidate = obj[key];
      if (typeof candidate === "string" && candidate.startsWith("http")) {
        return candidate;
      }
    }
  }

  return undefined;
}

export async function tryOnWithKolors(input: {
  person: File;
  garment: File;
}) {
  const [personBlob, garmentBlob] = await Promise.all([
    toBlob(input.person),
    toBlob(input.garment)
  ]);

  const app = await Client.connect(SPACE);

  const result = await app.predict("/tryon", [
    handle_file(personBlob),
    handle_file(garmentBlob),
    0,
    true
  ]);

  const data = (result as { data?: unknown[] }).data || [];
  const outputUrl = extractUrl(data[0]);

  if (!outputUrl) {
    const info = typeof data[2] === "string" ? data[2] : "";
    throw new Error(
      info || "Hugging Face Space không trả ảnh kết quả. Có thể Space đang quá tải."
    );
  }

  return {
    outputUrl,
    seedUsed: data[1],
    info: typeof data[2] === "string" ? data[2] : undefined
  };
}
