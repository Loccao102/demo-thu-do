import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({
    ok: true,
    provider: "snapedit",
    configured: Boolean(process.env.SNAPEDIT_API_KEY)
  });
}
