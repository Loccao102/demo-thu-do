"use client";

import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";

type Category = "upperbody" | "lowerbody" | "dress";
type UploadState = {
  file?: File;
  preview?: string;
};

const categoryLabels: Record<Category, string> = {
  upperbody: "Áo / khoác",
  lowerbody: "Quần / váy",
  dress: "Đầm / full-body"
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

  async function poll(jobId: string) {
    for (let attempt = 0; attempt < 60; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 3000));
      const response = await fetch("/api/tryon/" + encodeURIComponent(jobId), {
        cache: "no-store"
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Không lấy được trạng thái xử lý.");
      }

      if (data.status === "completed") {
        const image = data.outputUrl;
        if (!image) throw new Error("API hoàn tất nhưng không trả ảnh kết quả.");
        setResult(image);
        setStatus("done");
        setStatusText(
          typeof data.progress === "number"\n            ? "Hoàn tất · " + Math.round(data.progress * 100) + "%\n"\n            : "Ảnh đã được tạo trên cloud."
        );
        return;
      }

      if (data.status === "failed") {
        throw new Error(data.error || "AI không tạo được ảnh. Hãy thử ảnh khác.");
      }

      setStatus(data.status === "processing" ? "processing" : "queued");
      setStatusText("Job " + jobId.slice(0, 8) + "…");
    }

    throw new Error("Job xử lý quá lâu. Hãy thử lại sau.");
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

      setStatus("queued");
      setStatusText(
        data.etaSeconds
          ? "Ước tính khoảng " + data.etaSeconds + " giây."
          : "Đã gửi ảnh lên AI cloud."
      );
      await poll(data.jobId);
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
              ? "SnapEdit đã kết nối"
              : "Chưa cấu hình API key"}
        </div>
      </header>

      <section className="hero">
        <div>
          <p className="eyebrow">CLOUD VIRTUAL TRY-ON</p>
          <h1>Thử quần áo bằng AI,<br />không cần GPU local.</h1>
          <p className="subtitle">
            Demo cloud-only: ảnh được gửi qua serverless backend tới Virtual Try-On API,
            API key không xuất hiện ở trình duyệt.
          </p>
        </div>
        <div className="trialNote">
          <strong>Free-trial mode</strong>
          <span>SnapEdit cấp free credits khi đăng ký và không yêu cầu thẻ. Demo đang dùng Normal mode để tiết kiệm credit.</span>
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
              <input type="file" accept="image/jpeg,image/png,image/webp" onChange={pickFile(setGarment)} />
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
        <span>Next.js serverless · SnapEdit VTON · no local GPU</span>
      </footer>
    </main>
  );
}
