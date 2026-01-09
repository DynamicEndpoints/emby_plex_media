"use client";

import { useEffect, useState } from "react";
import { useUser } from "@clerk/nextjs";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Shield, Loader2, CheckCircle } from "lucide-react";

export default function AdminSetupPage() {
  const { user, isLoaded } = useUser();
  const router = useRouter();
  const [isInitializing, setIsInitializing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const adminList = useQuery(api.admins.list);
  const initializeOwner = useMutation(api.admins.initializeOwner);

  // If there are already admins, redirect
  useEffect(() => {
    if (adminList && adminList.length > 0) {
      router.push("/");
    }
  }, [adminList, router]);

  const handleBecomeOwner = async () => {
    if (!user) return;

    setIsInitializing(true);
    setError(null);

    try {
      await initializeOwner({
        clerkId: user.id,
        email: user.emailAddresses[0]?.emailAddress || "",
        name: user.firstName
          ? `${user.firstName} ${user.lastName || ""}`.trim()
          : user.emailAddresses[0]?.emailAddress || "Owner",
      });

      // Redirect to dashboard after successful initialization
      router.push("/dashboard");
    } catch (err) {
      console.error("Failed to initialize owner:", err);
      setError("Failed to initialize. There may already be an owner.");
    } finally {
      setIsInitializing(false);
    }
  };

  if (!isLoaded || adminList === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user) {
    router.push("/sign-in");
    return null;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-background to-muted p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
            <Shield className="h-8 w-8 text-primary" />
          </div>
          <CardTitle className="text-2xl">Welcome to Media Invite</CardTitle>
          <CardDescription>
            This appears to be a fresh installation. Set yourself up as the owner to get started.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="bg-muted/50 rounded-lg p-4 space-y-2">
            <p className="text-sm font-medium">You will be signed in as:</p>
            <div className="flex items-center gap-3">
              {user.imageUrl && (
                <img
                  src={user.imageUrl}
                  alt=""
                  className="w-10 h-10 rounded-full"
                />
              )}
              <div>
                <p className="font-medium">
                  {user.firstName
                    ? `${user.firstName} ${user.lastName || ""}`.trim()
                    : "User"}
                </p>
                <p className="text-sm text-muted-foreground">
                  {user.emailAddresses[0]?.emailAddress}
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <h3 className="font-medium text-sm">As the owner, you will be able to:</h3>
            <ul className="text-sm text-muted-foreground space-y-2">
              <li className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-500" />
                Create and manage invites
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-500" />
                View and manage all users
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-500" />
                Configure Plex/Emby server settings
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-500" />
                Add or remove other administrators
              </li>
            </ul>
          </div>

          {error && (
            <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-lg">
              {error}
            </div>
          )}

          <Button
            className="w-full"
            size="lg"
            onClick={handleBecomeOwner}
            disabled={isInitializing}
          >
            {isInitializing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Setting up...
              </>
            ) : (
              <>
                <Shield className="mr-2 h-4 w-4" />
                Become Owner
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
