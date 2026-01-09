import { NextRequest, NextResponse } from "next/server";
import { PlexClient } from "@/lib/plex";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { url, token } = body;

    if (!url || !token) {
      return NextResponse.json(
        { error: "Missing URL or token" },
        { status: 400 }
      );
    }

    const client = new PlexClient({ url, token });
    const connected = await client.testConnection();

    if (connected) {
      const serverInfo = await client.getServerInfo();
      return NextResponse.json({ 
        success: true, 
        serverName: serverInfo.name,
        version: serverInfo.version
      });
    } else {
      return NextResponse.json(
        { success: false, error: "Could not connect to Plex server" },
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
