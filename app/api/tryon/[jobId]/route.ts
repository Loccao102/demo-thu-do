import { NextRequest, NextResponse } from "next/server";
import { getTryOnJob } from "@/lib/pixelapi";

export const runtime = "nodejs";

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ jobId: string }> }
) {
  try {
    const { jobId } = await context.params;
    const job = await getTryOnJob(jobId);

    return NextResponse.json({
      status: job.status,
      outputUrl: job.output_url,
      resultBase64: job.output_url ? undefined : job.result_image_b64,
      inferenceTimeMs: job.inference_time_ms,
      error: job.error_message || job.detail
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Không thể lấy kết quả." },
      { status: 502 }
    );
  }
}
