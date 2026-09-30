# demo-thu-do — Cloud Virtual Try-On

Demo thử quần áo bằng AI theo hướng **100% cloud**:

- Frontend + serverless API: Next.js, phù hợp Vercel Hobby.
- AI Virtual Try-On: PixelAPI.
- Không cần GPU local, Python server hay model chạy trên máy.
- API key chỉ nằm ở server (`PIXELAPI_KEY`), không gửi xuống browser.
- Frontend tự nén ảnh để giảm payload trước khi đi qua serverless function.

## Vì sao chọn PixelAPI cho bản thử nghiệm

PixelAPI có endpoint Virtual Try-On nhận ảnh người + ảnh quần áo, hỗ trợ:

- `upperbody`: áo, jacket, hoodie...
- `lowerbody`: quần, váy...
- `dress`: đầm / full-body garment.

Tại thời điểm dựng demo, tài khoản mới có trial credits và REST API free trong 24 giờ, không cần thẻ. Đây là **free trial để benchmark**, không phải free tier vĩnh viễn.

## Chạy local

1. Tạo API key tại https://pixelapi.dev/app
2. Copy file env:

~~~bash
cp .env.example .env.local
~~~

3. Điền:

~~~env
PIXELAPI_KEY=your_key_here
~~~

4. Cài và chạy:

~~~bash
npm install
npm run dev
~~~

Mở http://localhost:3000

## Deploy Vercel Hobby

Import repo này vào Vercel, sau đó thêm Environment Variable:

~~~text
PIXELAPI_KEY = <API key từ PixelAPI>
~~~

Deploy lại. Không đặt key vào biến `NEXT_PUBLIC_*`.

## Luồng xử lý

1. Browser nhận hai file ảnh.
2. Ảnh lớn được resize/compress trên client để phù hợp serverless free tier.
3. `POST /api/tryon` nhận file và chuyển sang base64 ở server.
4. Server gọi `POST https://api.pixelapi.dev/v1/virtual-tryon`.
5. Frontend poll `GET /api/tryon/{jobId}`.
6. Server poll provider và trả URL/base64 kết quả khi job hoàn tất.

## Gợi ý ảnh để test

Ảnh người:
- Thấy rõ torso với áo.
- Thấy từ gối trở lên nếu thử quần / dress.
- Chính diện hoặc lệch nhẹ 3/4.
- Tránh tay che gần hết phần thân.

Ảnh quần áo:
- Một sản phẩm duy nhất.
- Flat-lay / ảnh catalog càng rõ càng tốt.
- Nền sạch, ít vật thể khác.

## Lưu ý

Trial của cloud AI có quota/thời hạn. Mục tiêu repo này là tách UI khỏi provider để có thể thay PixelAPI bằng Perfect Corp, FASHN, Google VTO hoặc provider khác về sau mà không phải viết lại trải nghiệm upload/result.
