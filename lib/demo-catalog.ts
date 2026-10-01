export type TryOnCategory = "upperbody" | "lowerbody" | "dress" | "set";
export type GarmentPhotoType = "model" | "flat-lay";

export type GarmentAsset = {
  url: string;
  photoType: GarmentPhotoType;
};

export type DemoProduct = {
  id: string;
  name: string;
  subtitle: string;
  category: TryOnCategory;
  tryOnEnabled: true;
  previewUrl: string;
  badge: string;
  assets:
    | { main: GarmentAsset }
    | { top: GarmentAsset; bottom: GarmentAsset };
};

export type DemoPerson = {
  id: string;
  name: string;
  note: string;
  url: string;
};

const HF_EXAMPLES =
  "https://huggingface.co/spaces/fashn-ai/fashn-vton-1.5/resolve/main/assets/examples";

export const demoPeople: DemoPerson[] = [
  {
    id: "person-0",
    name: "Mẫu A",
    note: "Ảnh toàn thân chuẩn",
    url: `${HF_EXAMPLES}/person0.png`
  },
  {
    id: "person-2",
    name: "Mẫu B",
    note: "Pose đứng rõ cơ thể",
    url: `${HF_EXAMPLES}/person2.png`
  },
  {
    id: "person-3",
    name: "Mẫu C",
    note: "Ánh sáng và framing tốt",
    url: `${HF_EXAMPLES}/person3.png`
  },
  {
    id: "person-5",
    name: "Mẫu D",
    note: "Phù hợp thử bottoms",
    url: `${HF_EXAMPLES}/person5.png`
  }
];

export const demoProducts: DemoProduct[] = [
  {
    id: "dress-model-01",
    name: "One-piece Editorial",
    subtitle: "Một món liền thân · ảnh garment đang mặc trên model",
    category: "dress",
    tryOnEnabled: true,
    previewUrl: `${HF_EXAMPLES}/garment1.jpeg`,
    badge: "Đã chuẩn hóa",
    assets: {
      main: {
        url: `${HF_EXAMPLES}/garment1.jpeg`,
        photoType: "model"
      }
    }
  },
  {
    id: "top-flat-01",
    name: "Top Studio",
    subtitle: "Áo · flat-lay chuẩn cho VTO",
    category: "upperbody",
    tryOnEnabled: true,
    previewUrl: `${HF_EXAMPLES}/garment3.jpeg`,
    badge: "Đã chuẩn hóa",
    assets: {
      main: {
        url: `${HF_EXAMPLES}/garment3.jpeg`,
        photoType: "flat-lay"
      }
    }
  },
  {
    id: "top-model-01",
    name: "Top On-model",
    subtitle: "Áo · garment đang được mặc",
    category: "upperbody",
    tryOnEnabled: true,
    previewUrl: `${HF_EXAMPLES}/garment2.webp`,
    badge: "Đã chuẩn hóa",
    assets: {
      main: {
        url: `${HF_EXAMPLES}/garment2.webp`,
        photoType: "model"
      }
    }
  },
  {
    id: "bottom-flat-01",
    name: "Bottom Studio",
    subtitle: "Quần / váy · flat-lay",
    category: "lowerbody",
    tryOnEnabled: true,
    previewUrl: `${HF_EXAMPLES}/garment5.jpeg`,
    badge: "Đã chuẩn hóa",
    assets: {
      main: {
        url: `${HF_EXAMPLES}/garment5.jpeg`,
        photoType: "flat-lay"
      }
    }
  },
  {
    id: "set-demo-01",
    name: "Set Mix & Match",
    subtitle: "Set 2 món · top và bottom đã tách sẵn trước khi demo",
    category: "set",
    tryOnEnabled: true,
    previewUrl: `${HF_EXAMPLES}/garment7.jpg`,
    badge: "2-pass chuẩn hóa",
    assets: {
      top: {
        url: `${HF_EXAMPLES}/garment7.jpg`,
        photoType: "flat-lay"
      },
      bottom: {
        url: `${HF_EXAMPLES}/garment5.jpeg`,
        photoType: "flat-lay"
      }
    }
  }
];

export function getDemoProduct(productId: string) {
  return demoProducts.find((product) => product.id === productId);
}

export function getDemoPerson(personId: string) {
  return demoPeople.find((person) => person.id === personId);
}
