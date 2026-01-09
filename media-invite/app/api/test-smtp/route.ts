import { NextRequest, NextResponse } from "next/server";
import { verifySmtpConnection } from "@/lib/notifications";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { host, port, secure, user, pass } = body;

    if (!host || !user) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const result = await verifySmtpConnection({
      host,
      port: port || 587,
      secure: secure || false,
      user,
      pass: pass || "",
      from: "",
    });

    if (result.success) {
      return NextResponse.json({ success: true });
    } else {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      );
    }
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
