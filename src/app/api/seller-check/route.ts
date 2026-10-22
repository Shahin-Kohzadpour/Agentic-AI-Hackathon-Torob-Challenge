import { NextRequest, NextResponse } from "next/server";
import { startSellerCheckJob, getSellerCheckJob, setJudgeScenarioOverride, judgeScenarioOverride } from "@/lib/services/seller-simulator";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, offerId, shopName, sellerTitle, priceToman, isBackup, scenario } = body;

    if (action === "override_scenario") {
      setJudgeScenarioOverride(scenario);
      return NextResponse.json({ success: true, current_override: judgeScenarioOverride });
    }

    if (!offerId || !shopName) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const job = startSellerCheckJob(offerId, shopName, sellerTitle || "", Number(priceToman || 0), Boolean(isBackup));
    return NextResponse.json(job);
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const jobId = searchParams.get("jobId");
  if (!jobId) {
    return NextResponse.json({ error: "Missing jobId" }, { status: 400 });
  }
  const job = getSellerCheckJob(jobId);
  return NextResponse.json(job || { error: "Job not found" });
}
