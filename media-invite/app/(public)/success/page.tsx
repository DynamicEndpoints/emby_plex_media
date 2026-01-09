import Link from "next/link";
import { CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface SuccessPageProps {
  searchParams: {
    server?: string;
  };
}

export default function SuccessPage({ searchParams }: SuccessPageProps) {
  const serverType = searchParams.server || "plex";

  const getInstructions = () => {
    switch (serverType) {
      case "plex":
        return {
          title: "Plex",
          steps: [
            "Download the Plex app for your device",
            "Sign in with your Plex account",
            "The server should appear in your sidebar",
            "If you don't see it, check your email for the invite",
          ],
          downloadUrl: "https://www.plex.tv/apps/",
        };
      case "emby":
        return {
          title: "Emby",
          steps: [
            "Download the Emby app for your device",
            "Add a new server connection",
            "Use the server address provided by the admin",
            "Sign in with your credentials",
          ],
          downloadUrl: "https://emby.media/download.html",
        };
      case "both":
        return {
          title: "Plex & Emby",
          steps: [
            "Download both Plex and Emby apps",
            "For Plex: Sign in and the server should appear",
            "For Emby: Add the server and sign in",
            "Check your email for any additional instructions",
          ],
          downloadUrl: "https://www.plex.tv/apps/",
        };
      default:
        return {
          title: "Media Server",
          steps: ["Check your email for connection instructions"],
          downloadUrl: "#",
        };
    }
  };

  const instructions = getInstructions();

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-background to-muted p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CheckCircle className="mx-auto h-16 w-16 text-green-500 mb-4" />
          <CardTitle className="text-2xl">Welcome Aboard! 🎬</CardTitle>
          <CardDescription>
            Your account has been set up successfully. You now have access to {instructions.title}.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg bg-muted p-4">
            <h3 className="font-medium mb-2">Getting Started:</h3>
            <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
              {instructions.steps.map((step, index) => (
                <li key={index}>{step}</li>
              ))}
            </ol>
          </div>

          <Button className="w-full" asChild>
            <a href={instructions.downloadUrl} target="_blank" rel="noopener noreferrer">
              Download {serverType === "both" ? "Apps" : "App"}
            </a>
          </Button>
        </CardContent>
        <CardFooter className="flex justify-center">
          <p className="text-sm text-muted-foreground">
            Questions?{" "}
            <Link href="/" className="text-primary hover:underline">
              Contact Support
            </Link>
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}

export const metadata = {
  title: "Welcome | Media Invite",
  description: "Your account has been set up successfully.",
};
