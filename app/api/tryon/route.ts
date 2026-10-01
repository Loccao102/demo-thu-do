import { NextRequest, NextResponse } from "next/server";
import {
  getDemoPerson,
  getDemoProduct,
  type GarmentAsset,
  type GarmentPhotoType,
  type TryOnCategory
} from "@/lib/demo-catalog";
import { tryOnWithFashn } from "@/lib/huggingface-fashn";

export const runtime = "nodejs";
export const maxDuration = 300;

const MAX_FILE_BYTES = 2 * 1024 * 1024;
const TRUSTED_ASSET_PREFIX =
  "https://huggingface.co/spaces/fashn-ai/fashn-vton-1.5/resolve/main/assets/examples/";

const uploadCategories = new Set<TryOnCategory>([
  "upperbody",
  "lowerbody",
  "dress",
  "set"
]);

const photoTypes = new Set<GarmentPhotoType>(["flat-lay", "model"]);

async function remoteFile(url: string, fallbackName: string) {
  if (!url.startsWith(TRUSTED_ASSET_PREFIX)) {
    throw new Error("Asset demo không thuộc nguồn đã tin cậy.");
  }

  const response = await fetch(url, { cache: "force-cache" });
  if (!response.ok) throw new Error("Không tải được asset demo.");

  const blob = await response.blob();
  if (blob.size > 4 * 1024 * 1024) {
    throw new Error("Asset demo vượt quá giới hạn.");
  }

  return new File([blob], fallbackName, {
    type: blob.type || "image/jpeg"
  });
}

async function assetToFile(asset: GarmentAsset, name: string) {
  return {
    file: await remoteFile(asset.url, name),
    photoType: asset.photoType
  };
}

function readPhotoType(value: FormDataEntryValue | null): GarmentPhotoType {
  const photoType = String(value || "flat-lay") as GarmentPhotoType;
  if (!photoTypes.has(photoType)) {
    throw new Error("Kiểu ảnh garment không hợp lệ.");
  }
  return photoType;
}

function checkFile(file: File | null, label: string) {
  if (!(file instanceof File) || file.size === 0) {
    throw new Error(`Thiếu ${label}.`);
  }
  if (file.size > MAX_FILE_BYTES) {
    throw new Error(`${label} sau khi tối ưu phải nhỏ hơn 2 MB.`);
  }
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
    throw new Error(`${label} phải là JPG, PNG hoặc WebP.`);
  }
  return file;
}

async function resolvePerson(formData: FormData) {
  const uploadedPerson = formData.get("person");
  if (uploadedPerson instanceof File && uploadedPerson.size > 0) {
    return checkFile(uploadedPerson, "ảnh người");
  }

  const personId = String(formData.get("personId") || "");
  const demoPerson = getDemoPerson(personId);
  if (!demoPerson) {
    throw new Error("Hãy chọn ảnh mẫu hoặc tải ảnh người lên.");
  }

  return remoteFile(demoPerson.url, `${demoPerson.id}.png`);
}

async function runCatalog(formData: FormData, person: File) {
  const productId = String(formData.get("productId") || "");
  const product = getDemoProduct(productId);

  if (!product || !product.tryOnEnabled) {
    throw new Error("Sản phẩm này chưa được chuẩn hóa cho Try-On demo.");
  }

  if ("main" in product.assets) {
    const garment = await assetToFile(
      product.assets.main,
      `${product.id}-garment.jpg`
    );

    const result = await tryOnWithFashn({
      person,
      category: product.category,
      garment: garment.file,
      garmentPhotoType: garment.photoType
    });

    return {
      ...result,
      category: product.category,
      photoType: garment.photoType,
      productId: product.id
    };
  }

  const [top, bottom] = await Promise.all([
    assetToFile(product.assets.top, `${product.id}-top.jpg`),
    assetToFile(product.assets.bottom, `${product.id}-bottom.jpg`)
  ]);

  const result = await tryOnWithFashn({
    person,
    category: "set",
    topGarment: top.file,
    topPhotoType: top.photoType,
    bottomGarment: bottom.file,
    bottomPhotoType: bottom.photoType
  });

  return {
    ...result,
    category: "set" as const,
    productId: product.id
  };
}

async function runUpload(formData: FormData, person: File) {
  const category = String(formData.get("category") || "") as TryOnCategory;
  if (!uploadCategories.has(category)) {
    throw new Error("Loại garment upload không hợp lệ.");
  }

  if (category === "set") {
    const topGarment = checkFile(
      formData.get("topGarment") instanceof File
        ? (formData.get("topGarment") as File)
        : null,
      "ảnh áo/khoác"
    );
    const bottomGarment = checkFile(
      formData.get("bottomGarment") instanceof File
        ? (formData.get("bottomGarment") as File)
        : null,
      "ảnh quần/chân váy"
    );

    const topPhotoType = readPhotoType(formData.get("topPhotoType"));
    const bottomPhotoType = readPhotoType(formData.get("bottomPhotoType"));

    const result = await tryOnWithFashn({
      person,
      category: "set",
      topGarment,
      topPhotoType,
      bottomGarment,
      bottomPhotoType
    });

    return {
      ...result,
      category: "set" as const,
      photoType: `${topPhotoType} + ${bottomPhotoType}`
    };
  }

  const garment = checkFile(
    formData.get("garment") instanceof File
      ? (formData.get("garment") as File)
      : null,
    "ảnh garment"
  );
  const garmentPhotoType = readPhotoType(formData.get("photoType"));

  const result = await tryOnWithFashn({
    person,
    category,
    garment,
    garmentPhotoType
  });

  return {
    ...result,
    category,
    photoType: garmentPhotoType
  };
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const mode = String(formData.get("mode") || "catalog");
    const person = await resolvePerson(formData);

    const result =
      mode === "upload"
        ? await runUpload(formData, person)
        : await runCatalog(formData, person);

    return NextResponse.json({
      status: "completed",
      outputUrl: result.outputUrl,
      intermediateUrl: result.intermediateUrl,
      provider: "huggingface-fashn-vton-1.5",
      category: result.category,
      photoType: result.photoType,
      mode: result.mode,
      productId: "productId" in result ? result.productId : undefined
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Không thể thử đồ.";

    const normalized =
      /quota|gpu|queue|too many|exceeded|rate/i.test(message)
        ? "Hugging Face ZeroGPU đang hết quota hoặc quá tải. Hãy thử lại sau hoặc cấu hình HF_TOKEN miễn phí."
        : message;

    const badRequest =
      /Thiếu|không hợp lệ|phải là|nhỏ hơn|Hãy chọn|chưa được chuẩn hóa/.test(
        normalized
      );

    return NextResponse.json(
      { error: normalized },
      { status: badRequest ? 400 : 502 }
    );
  }
}
