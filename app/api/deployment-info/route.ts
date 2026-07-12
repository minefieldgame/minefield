import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    service: "minefield",
    version: "1.0.0",
    commit: process.env.MINEFIELD_BUILD_COMMIT || "local",
    branch: process.env.MINEFIELD_BUILD_BRANCH || "local",
    amplifyJobId: process.env.MINEFIELD_BUILD_JOB_ID || "local",
    builtAt: process.env.MINEFIELD_BUILD_TIME || "local",
    nodeEnvironment: process.env.NODE_ENV
  }, {
    headers: { "Cache-Control": "no-store" }
  });
}
