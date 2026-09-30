"use client";

import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";

type Category = "upperbody" | "lowerbody" | "dress" | "set";
type UploadState = {
  file?: File;
  preview?: string;
};

const categoryLabels: Record<Category, string> = {
  upperbody: "Áo / khoác",
  lowerbody: "Quần / váy",
  dress: "Đầm / full-body",
  set: "Bộ đồ / Set"
};

async function compressImage(file: File): Promise<File> {
  if (file.size <= 1.35 * 1024 * 1024) return file;

  const bitmap = await createImageBitmap(file);
  const maxDimension = 1400;
  const ratio = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * ratio));
  const height = Math.max(1, Math.round(bitmap.height * ratio));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Trình duyệt không hỗ trợ xử lý ảnh.");

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (value) => value ? resolve(value) : reject(new Error("Không thể nén ảnh.")),
      "image/jpeg",
      0.84
    );
  });

  return new File([blob], file.name.replace(/\.[^.]+$/, "") + ".jpg", {
    type: "image/jpeg"
  });
}

async function detectGarmentCategory(file: File): Promise<Category | null> {
  const normalizedName = file.name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  const setKeywords = [
    "set",
    "bo-do",
    "bo_",
    "combo",
    "pijama",
    "pyjama",
    "pajama",
    "sleepwear",
    "matching",
    "co-ord",
    "coord"
  ];

  if (setKeywords.some((keyword) => normalizedName.includes(keyword))) {
    return "set";
  }

  // Heuristic cho ảnh catalog nền sáng: nếu có >= 2 vùng trang phục lớn tách rời
  // (ví dụ áo + quần) thì tự nhận là set. Không gọi thêm API/AI nên vẫn free.
  try {
    const bitmap = await createImageBitmap(file);
    const target = 112;
    const scale = Math.min(1, target / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(24, Math.round(bitmap.width * scale));
    const height = Math.max(24, Math.round(bitmap.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) {
      bitmap.close();
      return null;
    }

    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();

    const image = ctx.getImageData(0, 0, width, height);
    const pixels = image.data;

    const cornerIndexes = [
      0,
      (width - 1) * 4,
      ((height - 1) * width) * 4,
      ((height - 1) * width + width - 1) * 4
    ];

    const bg = [0, 1, 2].map((channel) =>
      cornerIndexes.reduce((sum, index) => sum + pixels[index + channel], 0) /
      cornerIndexes.length
    );

    const mask = new Uint8Array(width * height);
    for (let i = 0; i < width * height; i += 1) {
      const p = i * 4;
      const dr = pixels[p] - bg[0];
      const dg = pixels[p + 1] - bg[1];
      const db = pixels[p + 2] - bg[2];
      const distance = Math.sqrt(dr * dr + dg * dg + db * db);
      const alpha = pixels[p + 3];
      if (alpha > 40 && distance > 52) mask[i] = 1;
    }

    const visited = new Uint8Array(mask.length);
    const minArea = Math.max(28, Math.floor(width * height * 0.035));
    let largeComponents = 0;

    for (let start = 0; start < mask.length; start += 1) {
      if (!mask[start] || visited[start]) continue;

      const queue = [start];
      visited[start] = 1;
      let area = 0;

      for (let q = 0; q < queue.length; q += 1) {
        const current = queue[q];
        area += 1;
        const x = current % width;
        const y = Math.floor(current / width);

        const neighbors = [
          x > 0 ? current - 1 : -1,
          x + 1 < width ? current + 1 : -1,
          y > 0 ? current - width : -1,
          y + 1 < height ? current + width : -1
        ];

        for (const next of neighbors) {
          if (next >= 0 && mask[next] && !visited[next]) {
            visited[next] = 1;
            queue.push(next);
          }
        }
      }

      if (area >= minArea) {
        largeComponents += 1;
        if (largeComponents >= 2) return "set";
      }
    }
  } catch {
    // Không chặn upload nếu browser không hỗ trợ hoặc ảnh khó phân tích.
  }

  return null;
}

export default function Home() {
  const [person, setPerson] = useState<UploadState>({});
  const [garment, setGarment] = useState<UploadState>({});
  const [category, setCategory] = useState<Category>("upperbody");
  const [status, setStatus] = useState<"idle" | "compressing" | "queued" | "processing" | "done" | "error">("idle");
  const [statusText, setStatusText] = useState("");
  const [result, setResult] = useState<string>();
  const [providerReady, setProviderReady] = useState<boolean | null>(null);

  useEffect(() => {
    fetch("/api/health")
      .then((r) => r.json())
      .then((data) => setProviderReady(Boolean(data.configured)))
      .catch(() => setProviderReady(false));
  }, []);

  useEffect(() => {
    return () => {
      if (person.preview) URL.revokeObjectURL(person.preview);
      if (garment.preview) URL.revokeObjectURL(garment.preview);
    };
  }, [person.preview, garment.preview]);

  const canSubmit = Boolean(person.file && garment.file) &&
    !["compressing", "queued", "processing"].includes(status);

  const statusLabel = useMemo(() => {
    if (status === "compressing") return "Đang tối ưu ảnh...";
    if (status === "queued") return "Đã vào hàng đợi AI...";
    if (status === "processing") return "AI đang thay đồ...";
    if (status === "done") return "Hoàn tất";
    if (status === "error") return "Có lỗi";
    return "Sẵn sàng";
  }, [status]);

  function pickFile(
    setter: React.Dispatch<React.SetStateAction<UploadState>>
  ) {
    return (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;
      setter((old) => {
        if (old.preview) URL.revokeObjectURL(old.preview);
        return { file, preview: URL.createObjectURL(file) };
      });
      setResult(undefined);
      setStatus("idle");
      setStatusText("");
    };
  }

  function pickGarmentFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setGarment((old) => {
      if (old.preview) URL.revokeObjectURL(old.preview);
      return { file, preview: URL.createObjectURL(file) };
    });

    setResult(undefined);
    setStatus("idle");
    setStatusText("Đang tự nhận diện loại trang phục...");

    void detectGarmentCategory(file).then((detected) => {
      if (detected === "set") {
        setCategory("set");
        setStatusText("Đã nhận diện ảnh có nhiều món: tự chuyển sang Bộ đồ / Set.");
      } else {
        setStatusText("");
      }
    });
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!person.file || !garment.file) return;

    try {
      setStatus("compressing");
      setStatusText("Giảm kích thước để phù hợp serverless free tier.");
      setResult(undefined);

      const [personFile, garmentFile] = await Promise.all([
        compressImage(person.file),
        compressImage(garment.file)
      ]);

      const form = new FormData();
      form.append("person", personFile);
      form.append("garment", garmentFile);
      form.append("category", category);

      const response = await fetch("/api/tryon", {
        method: "POST",
        body: form
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Không thể bắt đầu thử đồ.");
      }

      if (!data.outputUrl) {
        throw new Error("Cloud AI hoàn tất nhưng không trả ảnh kết quả.");
      }

      setResult(data.outputUrl);
      setStatus("done");
      setStatusText(
        category === "set"
          ? "Hoàn tất · Set được xử lý 2 pass: áo → quần."
          : "Hoàn tất trên FASHN VTON ZeroGPU."
      );
    } catch (error) {
      setStatus("error");
      setStatusText(error instanceof Error ? error.message : "Đã xảy ra lỗi.");
    }
  }

  return (
    <main className="shell">
      <header className="topbar">
        <div className="brand">
          <span className="brandMark">CF</span>
          <span>CloudFit Lab</span>
        </div>
        <div className={"provider " + (providerReady ? "ready" : "")}>
          <span className="dot" />
          {providerReady === null
            ? "Đang kiểm tra API"
            : providerReady
              ? "FASHN VTON ZeroGPU sẵn sàng"
              : "Cloud provider chưa sẵn sàng"}
        </div>
      </header>

      <section className="hero">
        <div>
          <p className="eyebrow">CLOUD VIRTUAL TRY-ON</p>
          <h1>Thử quần áo bằng AI,<br />không cần GPU local.</h1>
          <p className="subtitle">
            Demo cloud-only: ảnh được gửi qua serverless backend tới FASHN VTON v1.5 chạy trên Hugging Face ZeroGPU. Không cần nạp API credits.
          </p>
        </div>
        <div className="trialNote">
          <strong>FREE CLOUD MODE</strong>
          <span>Không cần API key để chạy thử. HF_TOKEN miễn phí chỉ là tùy chọn để có quota ZeroGPU theo tài khoản và ưu tiên queue tốt hơn.</span>
        </div>
      </section>

      <form className="workspace" onSubmit={onSubmit}>
        <section className="panel inputPanel">
          <div className="panelHead">
            <div>
              <span className="step">01</span>
              <h2>Ảnh đầu vào</h2>
            </div>
            <span className="hint">JPG · PNG · WebP</span>
          </div>

          <div className="uploadGrid">
            <label className={"dropzone " + (person.preview ? "hasImage" : "")}>
              {person.preview ? (
                <img src={person.preview} alt="Ảnh người dùng" />
              ) : (
                <div className="empty">
                  <span className="bigIcon">人</span>
                  <strong>Ảnh người</strong>
                  <small>Toàn thân hoặc ít nhất thấy rõ vùng cần thay đồ</small>
                </div>
              )}
              <input type="file" accept="image/jpeg,image/png,image/webp" onChange={pickFile(setPerson)} />
              <span className="change">Chọn ảnh người</span>
            </label>

            <label className={"dropzone " + (garment.preview ? "hasImage" : "")}>
              {garment.preview ? (
                <img src={garment.preview} alt="Ảnh trang phục" />
              ) : (
                <div className="empty">
                  <span className="bigIcon">衣</span>
                  <strong>Ảnh quần áo</strong>
                  <small>Ảnh sản phẩm rõ, nền sạch sẽ cho kết quả tốt hơn</small>
                </div>
              )}
              <input type="file" accept="image/jpeg,image/png,image/webp" onChange={pickGarmentFile} />
              <span className="change">Chọn ảnh quần áo</span>
            </label>
          </div>

          <div className="controls">
            <span className="controlLabel">Loại trang phục</span>
            <div className="segment">
              {(Object.keys(categoryLabels) as Category[]).map((item) => (
                <button
                  type="button"
                  key={item}
                  className={category === item ? "active" : ""}
                  onClick={() => setCategory(item)}
                >
                  {categoryLabels[item]}
                </button>
              ))}
            </div>
          </div>

          <button className="generate" type="submit" disabled={!canSubmit}>
            <span>{["queued", "processing", "compressing"].includes(status) ? "Đang xử lý" : "Thử đồ bằng AI"}</span>
            <span className="arrow">→</span>
          </button>
        </section>

        <section className="panel resultPanel">
          <div className="panelHead">
            <div>
              <span className="step">02</span>
              <h2>Kết quả</h2>
            </div>
            <span className={"status " + status}>{statusLabel}</span>
          </div>

          <div className="resultStage">
            {result ? (
              <img src={result} alt="Kết quả AI virtual try-on" />
            ) : (
              <div className="resultEmpty">
                <div className="orb" />
                <strong>Kết quả sẽ xuất hiện ở đây</strong>
                <span>Hai ảnh → cloud AI → một ảnh mặc thử</span>
              </div>
            )}
          </div>

          <div className="statusLine">
            <span>{statusText || "Chọn hai ảnh để bắt đầu."}</span>
            {result && (
              <a href={result} target="_blank" rel="noreferrer">Mở ảnh gốc ↗</a>
            )}
          </div>
        </section>
      </form>

      <footer>
        <span>CloudFit experiment</span>
        <span>Next.js serverless · Hugging Face ZeroGPU · FASHN VTON v1.5</span>
      </footer>
    </main>
  );
}
