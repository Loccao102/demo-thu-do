# demo-thu-do — Controlled Virtual Try-On Demo

Bản demo này ưu tiên **độ ổn định khi trình diễn** thay vì cố hỗ trợ mọi ảnh đầu vào.

## Luồng demo

1. Chọn một ảnh người mẫu đã được kiểm chứng hoặc upload ảnh người thật.
2. Nếu upload ảnh thật, frontend kiểm tra cơ bản:
   - độ phân giải;
   - portrait ratio;
   - độ sáng.
3. Chọn sản phẩm trong **Demo Safe Catalog**.
4. Backend chỉ nhận `productId`, sau đó tự lấy metadata/asset đã chuẩn hóa.
5. Gọi FASHN VTON v1.5 trên Hugging Face ZeroGPU.
6. Hiển thị Before / After.

## Catalog Try-On

Metadata nằm tại:

`lib/demo-catalog.ts`

Mỗi sản phẩm có:

- `tryOnEnabled`
- category: `upperbody | lowerbody | dress | set`
- đúng `photoType: model | flat-lay`
- asset garment đã khóa sẵn.

Set không còn được tách trong lúc khách bấm Try-On. Set demo dùng **top asset + bottom asset đã tách sẵn**, sau đó chạy:

`person -> tops -> intermediate -> bottoms -> final`

## Provider

- FASHN VTON v1.5
- Hugging Face public ZeroGPU Space
- `HF_TOKEN` là tùy chọn.
- Single garment dùng 40 sampling steps.
- Set dùng 30 + 30 steps để cân bằng chất lượng và thời gian.

## Chạy local

~~~bash
npm install
npm run dev
~~~

Không cần env để thử public quota.

Có thể thêm:

~~~env
HF_TOKEN=hf_xxx
~~~

để dùng quota của tài khoản Hugging Face.

## Deploy Vercel

Import repository vào Vercel và deploy như Next.js bình thường.

Route Try-On có:

~~~ts
export const maxDuration = 300;
~~~

## Lưu ý demo

- Nên dùng ảnh mẫu để live demo ổn định nhất.
- Upload thật vẫn hỗ trợ nhưng nên là ảnh 1 người, toàn thân, đủ sáng.
- Chức năng này là **visual try-on**, không đại diện cho độ vừa size thực tế.
- Public ZeroGPU có thể queue/rate-limit; production thực tế nên dùng managed API hoặc self-host.
