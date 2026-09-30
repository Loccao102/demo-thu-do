import { NextRequest, NextResponse } from "next/server";
import { getTryOnJob } from "@/lib/snapedit";

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
      progress: job.progress,
      error: job.error_message
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Không thể lấy kết quả." },
      { status: 502 }
    );
  }
}
