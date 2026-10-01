"use client";

import {
  ChangeEvent,
  FormEvent,
  useEffect,
  useMemo,
  useState
} from "react";
import {
  demoPeople,
  demoProducts,
  type DemoProduct
} from "@/lib/demo-catalog";

type UploadState = {
  file?: File;
  preview?: string;
  valid?: boolean;
  message?: string;
};

const categoryLabel: Record<DemoProduct["category"], string> = {
  upperbody: "Áo / khoác",
  lowerbody: "Quần / váy",
  dress: "One-piece",
  set: "Set 2 món"
};

async function compressImage(file: File): Promise<File> {
  const bitmap = await createImageBitmap(file);
  const maxDimension = 1600;
  const ratio = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * ratio));
  const height = Math.max(1, Math.round(bitmap.height * ratio));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close();
    throw new Error("Trình duyệt không hỗ trợ xử lý ảnh.");
  }

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (value) =>
        value ? resolve(value) : reject(new Error("Không thể tối ưu ảnh.")),
      "image/jpeg",
      0.9
    );
  });

  return new File([blob], "person-demo.jpg", { type: "image/jpeg" });
}

async function validatePersonImage(file: File) {
  const bitmap = await createImageBitmap(file);
  const width = bitmap.width;
  const height = bitmap.height;
  const ratio = height / width;

  const sampleCanvas = document.createElement("canvas");
  sampleCanvas.width = 64;
  sampleCanvas.height = 64;
  const ctx = sampleCanvas.getContext("2d", { willReadFrequently: true });

  let brightness = 128;
  if (ctx) {
    ctx.drawImage(bitmap, 0, 0, 64, 64);
    const pixels = ctx.getImageData(0, 0, 64, 64).data;
    let total = 0;
    for (let i = 0; i < pixels.length; i += 4) {
      total +=
        pixels[i] * 0.2126 +
        pixels[i + 1] * 0.7152 +
        pixels[i + 2] * 0.0722;
    }
    brightness = total / (pixels.length / 4);
  }
  bitmap.close();

  const issues: string[] = [];
  if (Math.max(width, height) < 720) {
    issues.push("độ phân giải hơi thấp");
  }
  if (ratio < 1.05 || ratio > 2.25) {
    issues.push("ảnh nên là portrait/toàn thân");
  }
  if (brightness < 42) {
    issues.push("ảnh quá tối");
  }
  if (brightness > 235) {
    issues.push("ảnh bị cháy sáng");
  }

  return {
    ok: issues.length === 0,
    message:
      issues.length === 0
        ? `Đạt kiểm tra cơ bản · ${width}×${height} · ưu tiên ảnh 1 người, thấy rõ toàn thân`
        : `Chưa phù hợp cho demo: ${issues.join(", ")}.`
  };
}

export default function Home() {
  const [selectedPersonId, setSelectedPersonId] = useState(demoPeople[0].id);
  const [customPerson, setCustomPerson] = useState<UploadState>({});
  const [selectedProductId, setSelectedProductId] = useState(demoProducts[0].id);
  const [status, setStatus] = useState<
    "idle" | "validating" | "processing" | "done" | "error"
  >("idle");
  const [statusText, setStatusText] = useState(
    "Chọn người mẫu và một sản phẩm đã chuẩn hóa."
  );
  const [result, setResult] = useState<string>();
  const [intermediate, setIntermediate] = useState<string>();
  const [providerReady, setProviderReady] = useState<boolean | null>(null);

  const selectedProduct = useMemo(
    () =>
      demoProducts.find((product) => product.id === selectedProductId) ||
      demoProducts[0],
    [selectedProductId]
  );

  const selectedPerson = useMemo(
    () =>
      demoPeople.find((person) => person.id === selectedPersonId) ||
      demoPeople[0],
    [selectedPersonId]
  );

  const personPreview = customPerson.preview || selectedPerson.url;
  const canSubmit =
    Boolean(selectedProduct) &&
    !["validating", "processing"].includes(status) &&
    (!customPerson.file || customPerson.valid === true);

  useEffect(() => {
    fetch("/api/health")
      .then((response) => response.json())
      .then((data) => setProviderReady(Boolean(data.configured)))
      .catch(() => setProviderReady(false));
  }, []);

  useEffect(() => {
    return () => {
      if (customPerson.preview) {
        URL.revokeObjectURL(customPerson.preview);
      }
    };
  }, [customPerson.preview]);

  function chooseSamplePerson(personId: string) {
    if (customPerson.preview) URL.revokeObjectURL(customPerson.preview);
    setCustomPerson({});
    setSelectedPersonId(personId);
    setResult(undefined);
    setIntermediate(undefined);
    setStatus("idle");
    setStatusText("Ảnh mẫu đã được kiểm chứng cho demo.");
  }

  async function pickCustomPerson(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    if (customPerson.preview) URL.revokeObjectURL(customPerson.preview);
    const preview = URL.createObjectURL(file);
    setCustomPerson({ file, preview });
    setResult(undefined);
    setIntermediate(undefined);
    setStatus("validating");
    setStatusText("Đang kiểm tra chất lượng ảnh người...");

    try {
      const validation = await validatePersonImage(file);
      setCustomPerson({
        file,
        preview,
        valid: validation.ok,
        message: validation.message
      });
      setStatus(validation.ok ? "idle" : "error");
      setStatusText(validation.message);
    } catch {
      setCustomPerson({
        file,
        preview,
        valid: false,
        message: "Không đọc được ảnh. Hãy chọn JPG/PNG/WebP khác."
      });
      setStatus("error");
      setStatusText("Không đọc được ảnh.");
    }
  }

  function chooseProduct(productId: string) {
    setSelectedProductId(productId);
    setResult(undefined);
    setIntermediate(undefined);
    setStatus("idle");
    setStatusText("Sản phẩm đã có metadata Try-On chuẩn hóa sẵn.");
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!canSubmit) return;

    try {
      setStatus("processing");
      setStatusText(
        selectedProduct.category === "set"
          ? "Đang thử set theo 2 pass: top → bottom..."
          : "Đang tạo ảnh thử đồ ở chế độ demo-quality..."
      );
      setResult(undefined);
      setIntermediate(undefined);

      const form = new FormData();
      form.append("productId", selectedProduct.id);

      if (customPerson.file) {
        const personFile = await compressImage(customPerson.file);
        form.append("person", personFile);
      } else {
        form.append("personId", selectedPerson.id);
      }

      const response = await fetch("/api/tryon", {
        method: "POST",
        body: form
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Không thể tạo ảnh thử đồ.");
      }

      if (!data.outputUrl) {
        throw new Error("AI hoàn tất nhưng không trả ảnh kết quả.");
      }

      setResult(data.outputUrl);
      setIntermediate(data.intermediateUrl);
      setStatus("done");
      setStatusText(
        data.category === "set"
          ? "Hoàn tất · set dùng 2 asset đã tách sẵn và 2-pass."
          : `Hoàn tất · ${categoryLabel[selectedProduct.category]} · metadata đã khóa trước khi inference.`
      );
    } catch (error) {
      setStatus("error");
      setStatusText(
        error instanceof Error ? error.message : "Đã xảy ra lỗi."
      );
    }
  }

  return (
    <main className="demoShell">
      <header className="demoTopbar">
        <div className="brand">
          <span className="brandMark">CF</span>
          <div>
            <strong>CloudFit Try-On</strong>
            <small>Controlled demo pipeline</small>
          </div>
        </div>

        <div className={"provider " + (providerReady ? "ready" : "")}>
          <span className="dot" />
          {providerReady === null
            ? "Đang kiểm tra"
            : providerReady
              ? "FASHN VTON ZeroGPU sẵn sàng"
              : "Provider chưa sẵn sàng"}
        </div>
      </header>

      <section className="demoHero">
        <div>
          <p className="eyebrow">DEMO-READY VIRTUAL TRY-ON</p>
          <h1>Ít case hơn.<br />Kết quả ổn định hơn.</h1>
          <p className="subtitle">
            Demo chỉ chạy với catalog đã chuẩn hóa metadata, đúng category và
            đúng photo type. Set được tách asset trước, không đoán lại lúc khách bấm Try-On.
          </p>
        </div>
        <div className="demoRule">
          <strong>Nguyên tắc demo</strong>
          <span>Ảnh mẫu + sản phẩm chuẩn hóa = luồng an toàn nhất.</span>
          <span>Upload ảnh thật vẫn hỗ trợ, nhưng phải vượt kiểm tra cơ bản.</span>
        </div>
      </section>

      <form onSubmit={onSubmit}>
        <section className="demoStep">
          <div className="stepHeading">
            <div>
              <span className="step">01</span>
              <div>
                <h2>Chọn người thử</h2>
                <p>Ảnh mẫu được ưu tiên để live demo không phụ thuộc chất lượng upload.</p>
              </div>
            </div>
            <label className="uploadPersonButton">
              + Tải ảnh của bạn
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={pickCustomPerson}
              />
            </label>
          </div>

          <div className="personLayout">
            <div className="personPreview">
              <img src={personPreview} alt="Người được chọn để thử đồ" />
              <div className="personPreviewMeta">
                <strong>{customPerson.file ? "Ảnh của bạn" : selectedPerson.name}</strong>
                <span>
                  {customPerson.message ||
                    (customPerson.file
                      ? "Đang kiểm tra..."
                      : selectedPerson.note)}
                </span>
              </div>
            </div>

            <div className="samplePeople">
              {demoPeople.map((person) => (
                <button
                  type="button"
                  key={person.id}
                  className={
                    !customPerson.file && selectedPersonId === person.id
                      ? "samplePerson active"
                      : "samplePerson"
                  }
                  onClick={() => chooseSamplePerson(person.id)}
                >
                  <img src={person.url} alt={person.name} />
                  <span>{person.name}</span>
                </button>
              ))}
            </div>
          </div>
        </section>

        <section className="demoStep">
          <div className="stepHeading">
            <div>
              <span className="step">02</span>
              <div>
                <h2>Chọn sản phẩm demo</h2>
                <p>
                  Chỉ sản phẩm có <code>tryOnEnabled</code> và asset chuẩn hóa mới xuất hiện.
                </p>
              </div>
            </div>
            <span className="safeBadge">DEMO SAFE CATALOG</span>
          </div>

          <div className="productGrid">
            {demoProducts.map((product) => (
              <button
                type="button"
                key={product.id}
                className={
                  selectedProductId === product.id
                    ? "productCard active"
                    : "productCard"
                }
                onClick={() => chooseProduct(product.id)}
              >
                <div className="productImage">
                  <img src={product.previewUrl} alt={product.name} />
                  <span>{product.badge}</span>
                </div>
                <div className="productInfo">
                  <strong>{product.name}</strong>
                  <small>{product.subtitle}</small>
                  <div>
                    <span>{categoryLabel[product.category]}</span>
                    <span>
                      {"main" in product.assets
                        ? product.assets.main.photoType
                        : "top + bottom"}
                    </span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </section>

        <section className="runPanel">
          <div>
            <span className={"statusPill " + status}>
              {status === "processing"
                ? "ĐANG XỬ LÝ"
                : status === "done"
                  ? "HOÀN TẤT"
                  : status === "error"
                    ? "CẦN KIỂM TRA"
                    : "SẴN SÀNG"}
            </span>
            <strong>{selectedProduct.name}</strong>
            <p>{statusText}</p>
          </div>
          <button className="generate" type="submit" disabled={!canSubmit}>
            <span>
              {status === "processing" ? "AI đang thử đồ..." : "Thử đồ bằng AI"}
            </span>
            <span className="arrow">→</span>
          </button>
        </section>
      </form>

      <section className="resultSection">
        <div className="stepHeading">
          <div>
            <span className="step">03</span>
            <div>
              <h2>Kết quả</h2>
              <p>Đây là visual try-on, không phải công cụ xác định size/fit thực tế.</p>
            </div>
          </div>
        </div>

        <div className="resultCompare">
          <div className="compareCard">
            <span>BEFORE</span>
            <img src={personPreview} alt="Ảnh trước khi thử đồ" />
          </div>

          <div className="compareCard result">
            <span>AFTER</span>
            {result ? (
              <img src={result} alt="Kết quả thử đồ bằng AI" />
            ) : (
              <div className="resultPlaceholder">
                <div className="orb" />
                <strong>Kết quả sẽ xuất hiện ở đây</strong>
                <small>Chọn người + sản phẩm rồi bấm “Thử đồ bằng AI”.</small>
              </div>
            )}
          </div>
        </div>

        {intermediate && (
          <details className="debugDetails">
            <summary>Xem pass trung gian của set</summary>
            <img src={intermediate} alt="Kết quả pass top của set" />
          </details>
        )}
      </section>

      <footer>
        <span>CloudFit controlled demo</span>
        <span>FASHN VTON v1.5 · ZeroGPU · standardized catalog</span>
      </footer>
    </main>
  );
}
