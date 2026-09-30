# demo-thu-do — Cloud Virtual Try-On

Demo thử quần áo bằng AI theo hướng **100% cloud**:

- Frontend + serverless API: Next.js, phù hợp Vercel Hobby.
- AI Virtual Try-On: SnapEdit.
- Không cần GPU local, Python server hay model chạy trên máy.
- API key chỉ nằm ở server (`SNAPEDIT_API_KEY`), không gửi xuống browser.
- Frontend tự nén ảnh để giảm payload trước khi đi qua serverless function.

## Provider hiện tại: SnapEdit

PixelAPI đã tạm dừng cấp API key mới, nên repo chuyển provider mặc định sang SnapEdit.

SnapEdit Virtual Try-On nhận ảnh người + ảnh quần áo và hỗ trợ:

- `upper`: áo, jacket, hoodie...
- `lower`: quần, váy...
- `full`: đầm / full-body garment.
- Normal / HD / Ultra. Demo mặc định dùng Normal để tiết kiệm free credits.

Theo tài liệu SnapEdit hiện tại, tài khoản mới nhận free credits và không cần thẻ để bắt đầu. Đây là **free tier/trial để benchmark**, quota có thể thay đổi theo chính sách của provider.

## Chạy local

1. Đăng ký tại https://snapedit.app/dashboard
2. Tạo API key trong Dashboard → API Keys.
3. Copy file env:

~~~bash
cp .env.example .env.local
~~~

4. Điền:

~~~env
SNAPEDIT_API_KEY=sk-snap-...
~~~

5. Cài và chạy:

~~~bash
npm install
npm run dev
~~~

Mở http://localhost:3000

## Deploy Vercel Hobby

Import repo này vào Vercel, sau đó thêm Environment Variable:

~~~text
SNAPEDIT_API_KEY = sk-snap-...
~~~

Redeploy. Không đặt key vào biến `NEXT_PUBLIC_*`.

## Luồng xử lý

1. Browser nhận hai file ảnh.
2. Ảnh lớn được resize/compress trên client để phù hợp serverless free tier.
3. `POST /api/tryon` nhận file.
4. Server gọi `POST https://api.snapedit.app/v1/images/try-on` với `model_image`, `cloth_image`, `cloth_type`.
5. SnapEdit trả `task_id`.
6. Frontend poll `GET /api/tryon/{jobId}`; backend gọi `GET /v1/images/try-on/tasks/{task_id}`.
7. Khi task hoàn tất, server trả URL ảnh kết quả.

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

Free credits của cloud AI có quota và chính sách có thể thay đổi. Repo tách provider khỏi UI để có thể đổi sang Perfect Corp, FASHN, Google VTO hoặc provider khác mà không phải viết lại trải nghiệm upload/result.
