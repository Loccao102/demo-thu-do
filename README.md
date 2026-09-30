# demo-thu-do — Free Cloud Virtual Try-On

Demo thử quần áo bằng AI theo hướng **cloud-only, không cần nạp API credits**.

## Stack

- Next.js + serverless route.
- Hugging Face public Space: `levihsu/OOTDiffusion`.
- Hugging Face ZeroGPU xử lý inference trên cloud.
- Không cần GPU local.
- Không cần API key trả phí.
- Hỗ trợ:
  - áo / upper-body
  - quần, váy / lower-body
  - đầm / dress

## Free thực tế như thế nào?

Hugging Face ZeroGPU có quota GPU miễn phí theo ngày.

- Không đăng nhập: có quota ZeroGPU dành cho unauthenticated users.
- Tài khoản Hugging Face Free: có quota cao hơn và ưu tiên queue tốt hơn.
- `HF_TOKEN` là **tùy chọn**, không bắt buộc để chạy bản demo.

Không có cam kết SLA: public Space có thể phải xếp hàng hoặc tạm hết quota khi đông người.

## Chạy local

~~~bash
npm install
npm run dev
~~~

Mở http://localhost:3000.

Không cần file env cho lần test đầu.

### Tùy chọn: dùng quota tài khoản Hugging Face Free

Tạo Hugging Face token quyền Read, sau đó:

~~~bash
cp .env.example .env.local
~~~

~~~env
HF_TOKEN=hf_xxx
~~~

Không commit token lên GitHub.

## Deploy Vercel

Import repo vào Vercel và deploy bình thường.

Không cần Environment Variable để chạy ở chế độ unauthenticated.

Nếu muốn dùng quota của tài khoản Hugging Face Free, thêm:

~~~text
HF_TOKEN = hf_xxx
~~~

vào Vercel Environment Variables rồi redeploy.

## Luồng xử lý

1. Người dùng upload ảnh người và ảnh trang phục.
2. Browser resize/compress ảnh lớn.
3. `POST /api/tryon` gửi hai ảnh tới serverless route.
4. Backend dùng Gradio JS Client gọi public Space `levihsu/OOTDiffusion`.
5. Endpoint `/process_dc` chạy Virtual Try-On trên ZeroGPU.
6. Kết quả được trả về và hiển thị ngay trên UI.

## Cấu hình OOTDiffusion dùng trong demo

- 1 ảnh kết quả.
- 20 inference steps để tiết kiệm thời gian GPU.
- Guidance scale 2.
- Random seed.
- Category được map sang Upper-body / Lower-body / Dress.

## Ảnh test tốt

Ảnh người:
- chính diện hoặc lệch nhẹ;
- thấy rõ vùng quần áo cần thay;
- ít vật thể che người.

Ảnh trang phục:
- một sản phẩm duy nhất;
- flat-lay hoặc catalog;
- nền đơn giản;
- chọn đúng loại áo/quần/đầm trong UI.

## Giới hạn

Đây là public research/demo infrastructure, không phải managed production API. Nếu sau này cần website thương mại có SLA, tốc độ ổn định và concurrency cao thì nên chuyển provider trả phí hoặc tự host model.

OOTDiffusion Space hiện dùng giấy phép non-commercial, vì vậy bản tích hợp này phù hợp cho học tập, đồ án và benchmark/demo; cần rà lại giấy phép trước khi dùng thương mại.
