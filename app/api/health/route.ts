import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({
    ok: true,
    provider: "huggingface-ootdiffusion",
    configured: true,
    billingRequired: false,
    authenticated: Boolean(process.env.HF_TOKEN)
  });
}
