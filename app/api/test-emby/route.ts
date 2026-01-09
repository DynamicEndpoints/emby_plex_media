import { NextRequest, NextResponse } from "next/server";
import { EmbyClient } from "@/lib/emby";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { url, apiKey } = body;

    if (!url || !apiKey) {
      return NextResponse.json(
        { error: "Missing URL or API key" },
        { status: 400 }
      );
    }

    const client = new EmbyClient({ url, apiKey });
    const connected = await client.testConnection();

    if (connected) {
      const serverInfo = await client.getServerInfo();
      return NextResponse.json({ 
        success: true, 
        serverName: serverInfo.ServerName,
        version: serverInfo.Version
      });
    } else {
      return NextResponse.json(
        { success: false, error: "Could not connect to Emby server" },
        { status: 400 }
      );
    }
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Connection failed" },
      { status: 500 }
    );
  }
}
