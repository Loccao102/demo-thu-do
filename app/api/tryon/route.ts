import { NextRequest, NextResponse } from "next/server";
import {
  getDemoPerson,
  getDemoProduct,
  type GarmentAsset
} from "@/lib/demo-catalog";
import { tryOnWithFashn } from "@/lib/huggingface-fashn";

export const runtime = "nodejs";
export const maxDuration = 300;

const MAX_FILE_BYTES = 2 * 1024 * 1024;
const TRUSTED_ASSET_PREFIX =
  "https://huggingface.co/spaces/fashn-ai/fashn-vton-1.5/resolve/main/assets/examples/";

async function remoteFile(url: string, fallbackName: string) {
  if (!url.startsWith(TRUSTED_ASSET_PREFIX)) {
    throw new Error("Asset demo không thuộc nguồn đã tin cậy.");
  }

  const response = await fetch(url, { cache: "force-cache" });
  if (!response.ok) {
    throw new Error("Không tải được asset demo.");
  }

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

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const productId = String(formData.get("productId") || "");
    const personId = String(formData.get("personId") || "");
    const uploadedPerson = formData.get("person");

    const product = getDemoProduct(productId);
    if (!product || !product.tryOnEnabled) {
      return NextResponse.json(
        { error: "Sản phẩm này chưa được chuẩn hóa cho Try-On demo." },
        { status: 400 }
      );
    }

    let person: File;

    if (uploadedPerson instanceof File && uploadedPerson.size > 0) {
      if (uploadedPerson.size > MAX_FILE_BYTES) {
        return NextResponse.json(
          { error: "Ảnh người sau khi tối ưu phải nhỏ hơn 2 MB." },
          { status: 413 }
        );
      }
      person = uploadedPerson;
    } else {
      const demoPerson = getDemoPerson(personId);
      if (!demoPerson) {
        return NextResponse.json(
          { error: "Hãy chọn ảnh mẫu hoặc tải ảnh người lên." },
          { status: 400 }
        );
      }
      person = await remoteFile(demoPerson.url, `${demoPerson.id}.png`);
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

      return NextResponse.json({
        status: "completed",
        outputUrl: result.outputUrl,
        provider: "huggingface-fashn-vton-1.5",
        productId: product.id,
        category: product.category,
        photoType: garment.photoType,
        mode: result.mode
      });
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

    return NextResponse.json({
      status: "completed",
      outputUrl: result.outputUrl,
      intermediateUrl: result.intermediateUrl,
      provider: "huggingface-fashn-vton-1.5",
      productId: product.id,
      category: product.category,
      mode: result.mode
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Không thể thử đồ.";

    const normalized =
      /quota|gpu|queue|too many|exceeded|rate/i.test(message)
        ? "Hugging Face ZeroGPU đang hết quota hoặc quá tải. Hãy thử lại sau hoặc cấu hình HF_TOKEN miễn phí."
        : message;

    return NextResponse.json({ error: normalized }, { status: 502 });
  }
}
