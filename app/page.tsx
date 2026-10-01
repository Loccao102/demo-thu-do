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
  type DemoProduct,
  type GarmentPhotoType
} from "@/lib/demo-catalog";

type UploadState = {
  file?: File;
  preview?: string;
  valid?: boolean;
  message?: string;
};

type ProductMode = "catalog" | "upload";
type UploadMode = "upperbody" | "lowerbody" | "dress" | "set";

const categoryLabel: Record<DemoProduct["category"], string> = {
  upperbody: "Áo / khoác",
  lowerbody: "Quần / chân váy",
  dress: "Váy / đầm liền",
  set: "Phối áo + quần/váy"
};

const uploadLabel: Record<UploadMode, string> = {
  upperbody: "Áo / khoác",
  lowerbody: "Quần / chân váy",
  dress: "Váy / đầm liền",
  set: "Phối áo + quần/váy"
};

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_RAW_UPLOAD = 10 * 1024 * 1024;

async function compressImage(file: File, filename: string): Promise<File> {
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

  return new File([blob], filename, { type: "image/jpeg" });
}

async function readImageStats(file: File) {
  const bitmap = await createImageBitmap(file);
  const width = bitmap.width;
  const height = bitmap.height;

  const canvas = document.createElement("canvas");
  canvas.width = 96;
  canvas.height = 96;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });

  let brightness = 128;
  let pixels: Uint8ClampedArray | undefined;

  if (ctx) {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, 96, 96);
    ctx.drawImage(bitmap, 0, 0, 96, 96);
    pixels = ctx.getImageData(0, 0, 96, 96).data;

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
  return { width, height, brightness, pixels };
}

function fileIssues(file: File) {
  const issues: string[] = [];
  if (!ALLOWED_TYPES.includes(file.type)) {
    issues.push("chỉ nhận JPG, PNG hoặc WebP");
  }
  if (file.size > MAX_RAW_UPLOAD) {
    issues.push("file gốc phải nhỏ hơn 10 MB");
  }
  return issues;
}

async function validatePersonImage(file: File) {
  const issues = fileIssues(file);
  if (issues.length) return { ok: false, message: issues.join(" · ") };

  const { width, height, brightness } = await readImageStats(file);
  const portraitRatio = height / width;

  if (Math.min(width, height) < 520) {
    issues.push("ảnh quá nhỏ");
  }
  if (portraitRatio < 1.05 || portraitRatio > 2.25) {
    issues.push("nên dùng ảnh dọc/toàn thân");
  }
  if (brightness < 42) issues.push("ảnh quá tối");
  if (brightness > 235) issues.push("ảnh bị cháy sáng");

  return {
    ok: issues.length === 0,
    message:
      issues.length === 0
        ? `Đạt kiểm tra · ${width}×${height}. Nên có 1 người, thấy rõ vùng cần thay đồ.`
        : `Chưa phù hợp: ${issues.join(" · ")}.`
  };
}

function countLargeComponents(pixels: Uint8ClampedArray) {
  const width = 96;
  const height = 96;
  const border: number[] = [];

  for (let x = 0; x < width; x += 8) {
    border.push(x, (height - 1) * width + x);
  }
  for (let y = 8; y < height - 8; y += 8) {
    border.push(y * width, y * width + width - 1);
  }

  const bg = [0, 1, 2].map(
    (channel) =>
      border.reduce(
        (sum, pixelIndex) => sum + pixels[pixelIndex * 4 + channel],
        0
      ) / border.length
  );

  const mask = new Uint8Array(width * height);
  for (let i = 0; i < mask.length; i += 1) {
    const p = i * 4;
    const dr = pixels[p] - bg[0];
    const dg = pixels[p + 1] - bg[1];
    const db = pixels[p + 2] - bg[2];
    if (
      pixels[p + 3] > 40 &&
      Math.sqrt(dr * dr + dg * dg + db * db) > 48
    ) {
      mask[i] = 1;
    }
  }

  const visited = new Uint8Array(mask.length);
  const minArea = Math.floor(width * height * 0.025);
  let count = 0;

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

    if (area >= minArea) count += 1;
  }

  return count;
}

async function validateGarmentImage(
  file: File,
  photoType: GarmentPhotoType
) {
  const issues = fileIssues(file);
  if (issues.length) return { ok: false, message: issues.join(" · ") };

  const { width, height, brightness, pixels } = await readImageStats(file);

  if (Math.min(width, height) < 420) issues.push("ảnh garment quá nhỏ");
  if (brightness < 35) issues.push("ảnh quá tối");
  if (brightness > 245) issues.push("ảnh bị cháy sáng");

  if (photoType === "flat-lay" && pixels) {
    const components = countLargeComponents(pixels);
    if (components === 0) {
      issues.push("không thấy garment nổi bật trên nền");
    }
    if (components > 1) {
      issues.push("ảnh có vẻ chứa nhiều món; mỗi ô chỉ nhận đúng 1 món");
    }
  }

  if (photoType === "model") {
    const portraitRatio = height / width;
    if (portraitRatio < 0.8 || portraitRatio > 2.5) {
      issues.push("ảnh on-model/mannequin nên là ảnh dọc");
    }
  }

  return {
    ok: issues.length === 0,
    message:
      issues.length === 0
        ? `Đạt kiểm tra · ${width}×${height} · ${photoType}.`
        : `Không gửi lên AI: ${issues.join(" · ")}.`
  };
}

function UploadBox({
  title,
  state,
  onChange
}: {
  title: string;
  state: UploadState;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <label className={"garmentDropzone " + (state.valid === false ? "invalid" : "")}>
      {state.preview ? (
        <img src={state.preview} alt={title} />
      ) : (
        <div>
          <span className="uploadIcon">衣</span>
          <strong>{title}</strong>
          <small>JPG, PNG, WebP · 1 món duy nhất</small>
        </div>
      )}
      <input
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={onChange}
      />
      <span className="dropzoneAction">
        {state.preview ? "Đổi ảnh" : "Chọn ảnh"}
      </span>
    </label>
  );
}

export default function Home() {
  const [selectedPersonId, setSelectedPersonId] = useState(demoPeople[0].id);
  const [customPerson, setCustomPerson] = useState<UploadState>({});
  const [productMode, setProductMode] = useState<ProductMode>("catalog");
  const [selectedProductId, setSelectedProductId] = useState(demoProducts[0].id);

  const [uploadMode, setUploadMode] = useState<UploadMode>("upperbody");
  const [singleGarment, setSingleGarment] = useState<UploadState>({});
  const [topGarment, setTopGarment] = useState<UploadState>({});
  const [bottomGarment, setBottomGarment] = useState<UploadState>({});
  const [singlePhotoType, setSinglePhotoType] =
    useState<GarmentPhotoType>("flat-lay");
  const [topPhotoType, setTopPhotoType] =
    useState<GarmentPhotoType>("flat-lay");
  const [bottomPhotoType, setBottomPhotoType] =
    useState<GarmentPhotoType>("flat-lay");

  const [status, setStatus] = useState<
    "idle" | "validating" | "processing" | "done" | "error"
  >("idle");
  const [statusText, setStatusText] = useState("Chọn người thử và trang phục.");
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
  const personReady = !customPerson.file || customPerson.valid === true;

  const garmentReady =
    productMode === "catalog"
      ? true
      : uploadMode === "set"
        ? topGarment.valid === true && bottomGarment.valid === true
        : singleGarment.valid === true;

  const canSubmit =
    personReady &&
    garmentReady &&
    !["validating", "processing"].includes(status);

  useEffect(() => {
    fetch("/api/health")
      .then((response) => response.json())
      .then((data) => setProviderReady(Boolean(data.configured)))
      .catch(() => setProviderReady(false));
  }, []);

  useEffect(() => {
    return () => {
      [
        customPerson.preview,
        singleGarment.preview,
        topGarment.preview,
        bottomGarment.preview
      ].forEach((url) => {
        if (url) URL.revokeObjectURL(url);
      });
    };
  }, [
    customPerson.preview,
    singleGarment.preview,
    topGarment.preview,
    bottomGarment.preview
  ]);

  function resetResult(message: string) {
    setResult(undefined);
    setIntermediate(undefined);
    setStatus("idle");
    setStatusText(message);
  }

  function chooseSamplePerson(personId: string) {
    if (customPerson.preview) URL.revokeObjectURL(customPerson.preview);
    setCustomPerson({});
    setSelectedPersonId(personId);
    resetResult("Ảnh mẫu đã được kiểm chứng cho demo.");
  }

  async function pickCustomPerson(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    if (customPerson.preview) URL.revokeObjectURL(customPerson.preview);
    const preview = URL.createObjectURL(file);
    setCustomPerson({ file, preview });
    setStatus("validating");
    setStatusText("Đang kiểm tra ảnh người...");

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
        message: "Không đọc được ảnh."
      });
      setStatus("error");
      setStatusText("Không đọc được ảnh người.");
    }
  }

  function makeGarmentPicker(
    setter: React.Dispatch<React.SetStateAction<UploadState>>,
    current: UploadState,
    photoType: GarmentPhotoType,
    label: string
  ) {
    return async (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      if (current.preview) URL.revokeObjectURL(current.preview);
      const preview = URL.createObjectURL(file);
      setter({ file, preview });
      setStatus("validating");
      setStatusText(`Đang kiểm tra ${label}...`);

      try {
        const validation = await validateGarmentImage(file, photoType);
        setter({
          file,
          preview,
          valid: validation.ok,
          message: validation.message
        });
        setStatus(validation.ok ? "idle" : "error");
        setStatusText(validation.message);
      } catch {
        setter({
          file,
          preview,
          valid: false,
          message: "Không đọc được ảnh garment."
        });
        setStatus("error");
        setStatusText("Không đọc được ảnh garment.");
      }
    };
  }

  async function revalidate(
    state: UploadState,
    setter: React.Dispatch<React.SetStateAction<UploadState>>,
    photoType: GarmentPhotoType
  ) {
    if (!state.file) return;
    setStatus("validating");
    const validation = await validateGarmentImage(state.file, photoType);
    setter((current) => ({
      ...current,
      valid: validation.ok,
      message: validation.message
    }));
    setStatus(validation.ok ? "idle" : "error");
    setStatusText(validation.message);
    setResult(undefined);
  }

  function setMode(mode: UploadMode) {
    setUploadMode(mode);
    resetResult(
      mode === "set"
        ? "Phối bộ: upload riêng áo và quần/chân váy."
        : `${uploadLabel[mode]}: upload đúng 1 garment.`
    );
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!canSubmit) return;

    try {
      setStatus("processing");
      setResult(undefined);
      setIntermediate(undefined);
      setStatusText(
        productMode === "catalog"
          ? "Đang gửi catalog chuẩn hóa lên FASHN VTON..."
          : uploadMode === "set"
            ? "Đang phối 2 pass: áo → quần/chân váy..."
            : `Đang thử ${uploadLabel[uploadMode]} bằng FASHN VTON...`
      );

      const form = new FormData();
      form.append("mode", productMode);

      if (customPerson.file) {
        form.append(
          "person",
          await compressImage(customPerson.file, "person-upload.jpg")
        );
      } else {
        form.append("personId", selectedPerson.id);
      }

      if (productMode === "catalog") {
        form.append("productId", selectedProduct.id);
      } else if (uploadMode === "set") {
        if (!topGarment.file || !bottomGarment.file) {
          throw new Error("Cần đủ ảnh áo và quần/chân váy.");
        }

        form.append("category", "set");
        form.append(
          "topGarment",
          await compressImage(topGarment.file, "top-upload.jpg")
        );
        form.append(
          "bottomGarment",
          await compressImage(bottomGarment.file, "bottom-upload.jpg")
        );
        form.append("topPhotoType", topPhotoType);
        form.append("bottomPhotoType", bottomPhotoType);
      } else {
        if (!singleGarment.file) throw new Error("Chưa có ảnh garment.");

        form.append("category", uploadMode);
        form.append(
          "garment",
          await compressImage(singleGarment.file, "garment-upload.jpg")
        );
        form.append("photoType", singlePhotoType);
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
          ? "Hoàn tất · phối áo + quần/chân váy bằng 2 pass."
          : `Hoàn tất · ${productMode === "catalog" ? categoryLabel[selectedProduct.category] : uploadLabel[uploadMode]}.`
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
            <small>FASHN VTON + input guardrails</small>
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
          <p className="eyebrow">GUARDED VIRTUAL TRY-ON</p>
          <h1>Upload được thật.<br />Nhưng có luật chơi rõ ràng.</h1>
          <p className="subtitle">
            FASHN VTON vẫn là engine chính. Hệ thống chặn input xấu trước khi
            inference và hỗ trợ áo, quần/chân váy, váy/đầm liền hoặc phối riêng
            áo + quần/chân váy bằng 2 pass.
          </p>
        </div>
        <div className="demoRule">
          <strong>Lưu ý để kết quả đẹp</strong>
          <span>Ảnh người: 1 người, ánh sáng đủ, rõ vùng cần thay.</span>
          <span>Mỗi ô garment chỉ chứa đúng 1 món.</span>
          <span>Không dùng collage hoặc ảnh có nhiều món chồng nhau.</span>
          <span>Visual try-on không cam kết size/fit thực tế.</span>
        </div>
      </section>

      <form onSubmit={onSubmit}>
        <section className="demoStep">
          <div className="stepHeading">
            <div>
              <span className="step">01</span>
              <div>
                <h2>Chọn người thử</h2>
                <p>Ảnh không đạt điều kiện cơ bản sẽ bị chặn trước khi gọi AI.</p>
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
                <span>{customPerson.message || selectedPerson.note}</span>
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
          <div className="stepHeading productHeading">
            <div>
              <span className="step">02</span>
              <div>
                <h2>Chọn trang phục</h2>
                <p>Catalog mẫu hoặc tự upload garment của bạn.</p>
              </div>
            </div>

            <div className="modeSwitch">
              <button
                type="button"
                className={productMode === "catalog" ? "active" : ""}
                onClick={() => {
                  setProductMode("catalog");
                  resetResult("Đang dùng catalog mẫu đã chuẩn hóa.");
                }}
              >
                Catalog chuẩn
              </button>
              <button
                type="button"
                className={productMode === "upload" ? "active" : ""}
                onClick={() => {
                  setProductMode("upload");
                  resetResult("Upload mode: chọn loại garment rồi tải ảnh.");
                }}
              >
                Upload garment
              </button>
            </div>
          </div>

          {productMode === "catalog" ? (
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
                  onClick={() => {
                    setSelectedProductId(product.id);
                    resetResult("Sản phẩm mẫu đã có metadata chuẩn hóa.");
                  }}
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
          ) : (
            <div className="uploadWorkspace">
              <div className="uploadModeTabs">
                {(["upperbody", "lowerbody", "dress", "set"] as UploadMode[]).map(
                  (mode) => (
                    <button
                      type="button"
                      key={mode}
                      className={uploadMode === mode ? "active" : ""}
                      onClick={() => setMode(mode)}
                    >
                      {uploadLabel[mode]}
                    </button>
                  )
                )}
              </div>

              <div className="guardrailNotice">
                <strong>Guardrail upload</strong>
                <span>
                  {uploadMode === "set"
                    ? "Mỗi ô chỉ nhận 1 món: áo ở ô trái, quần/chân váy ở ô phải."
                    : "Ảnh garment chỉ nên chứa đúng 1 món tương ứng với loại đã chọn."}
                </span>
              </div>

              {uploadMode === "set" ? (
                <div className="dualUploadGrid">
                  <div className="uploadColumn">
                    <UploadBox
                      title="Áo / khoác"
                      state={topGarment}
                      onChange={makeGarmentPicker(
                        setTopGarment,
                        topGarment,
                        topPhotoType,
                        "ảnh áo"
                      )}
                    />
                    <div className="photoTypeRow">
                      {(["flat-lay", "model"] as GarmentPhotoType[]).map((type) => (
                        <button
                          type="button"
                          key={type}
                          className={topPhotoType === type ? "active" : ""}
                          onClick={() => {
                            setTopPhotoType(type);
                            void revalidate(topGarment, setTopGarment, type);
                          }}
                        >
                          {type === "flat-lay" ? "Flat-lay" : "On-model"}
                        </button>
                      ))}
                    </div>
                    <small className={topGarment.valid === false ? "fileHint invalid" : "fileHint"}>
                      {topGarment.message || "Chọn đúng 1 áo/khoác."}
                    </small>
                  </div>

                  <div className="uploadColumn">
                    <UploadBox
                      title="Quần / chân váy"
                      state={bottomGarment}
                      onChange={makeGarmentPicker(
                        setBottomGarment,
                        bottomGarment,
                        bottomPhotoType,
                        "ảnh quần/chân váy"
                      )}
                    />
                    <div className="photoTypeRow">
                      {(["flat-lay", "model"] as GarmentPhotoType[]).map((type) => (
                        <button
                          type="button"
                          key={type}
                          className={bottomPhotoType === type ? "active" : ""}
                          onClick={() => {
                            setBottomPhotoType(type);
                            void revalidate(bottomGarment, setBottomGarment, type);
                          }}
                        >
                          {type === "flat-lay" ? "Flat-lay" : "On-model"}
                        </button>
                      ))}
                    </div>
                    <small className={bottomGarment.valid === false ? "fileHint invalid" : "fileHint"}>
                      {bottomGarment.message || "Chọn đúng 1 quần hoặc chân váy."}
                    </small>
                  </div>
                </div>
              ) : (
                <div className="singleUploadLayout">
                  <UploadBox
                    title={uploadLabel[uploadMode]}
                    state={singleGarment}
                    onChange={makeGarmentPicker(
                      setSingleGarment,
                      singleGarment,
                      singlePhotoType,
                      "ảnh garment"
                    )}
                  />

                  <div className="uploadSettings">
                    <strong>Kiểu ảnh garment</strong>
                    <div className="photoTypeRow">
                      {(["flat-lay", "model"] as GarmentPhotoType[]).map((type) => (
                        <button
                          type="button"
                          key={type}
                          className={singlePhotoType === type ? "active" : ""}
                          onClick={() => {
                            setSinglePhotoType(type);
                            void revalidate(
                              singleGarment,
                              setSingleGarment,
                              type
                            );
                          }}
                        >
                          {type === "flat-lay"
                            ? "Flat-lay / nền trơn"
                            : "On-model / mannequin"}
                        </button>
                      ))}
                    </div>

                    <div
                      className={
                        singleGarment.valid === false
                          ? "validationBox invalid"
                          : singleGarment.valid
                            ? "validationBox valid"
                            : "validationBox"
                      }
                    >
                      <strong>
                        {singleGarment.valid === false
                          ? "Ảnh đang bị chặn"
                          : singleGarment.valid
                            ? "Ảnh đạt guardrail"
                            : "Chưa có garment"}
                      </strong>
                      <span>
                        {singleGarment.message ||
                          "Hệ thống sẽ kiểm tra trước khi gửi sang FASHN."}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </section>

        <section className="runPanel">
          <div>
            <span className={"statusPill " + status}>
              {status === "processing"
                ? "ĐANG XỬ LÝ"
                : status === "validating"
                  ? "ĐANG KIỂM TRA"
                  : status === "done"
                    ? "HOÀN TẤT"
                    : status === "error"
                      ? "ĐANG CHẶN"
                      : "SẴN SÀNG"}
            </span>
            <strong>
              {productMode === "catalog"
                ? selectedProduct.name
                : uploadLabel[uploadMode]}
            </strong>
            <p>{statusText}</p>
          </div>
          <button className="generate" type="submit" disabled={!canSubmit}>
            <span>
              {status === "processing"
                ? "FASHN đang thử đồ..."
                : !canSubmit
                  ? "Ảnh chưa đạt điều kiện"
                  : "Thử đồ bằng AI"}
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
              <p>Visual try-on 2D/2.5D; không đại diện chính xác cho size/fit thực tế.</p>
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
                <small>Chọn người + garment rồi bấm “Thử đồ bằng AI”.</small>
              </div>
            )}
          </div>
        </div>

        {intermediate && (
          <details className="debugDetails">
            <summary>Xem pass áo trước khi phối quần/chân váy</summary>
            <img src={intermediate} alt="Kết quả pass áo" />
          </details>
        )}
      </section>

      <footer>
        <span>CloudFit guarded demo</span>
        <span>FASHN VTON v1.5 · ZeroGPU · upload guardrails</span>
      </footer>
    </main>
  );
}
