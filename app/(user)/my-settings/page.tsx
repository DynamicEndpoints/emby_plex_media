"use client";

import { useUser } from "@clerk/nextjs";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, ExternalLink, Shield, Bell, User } from "lucide-react";

export default function MySettingsPage() {
  const { user: clerkUser, isLoaded } = useUser();

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="text-muted-foreground">
          Manage your account preferences
        </p>
      </div>

      <div className="grid gap-6">
        {/* Profile Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Profile Settings
            </CardTitle>
            <CardDescription>
              Manage your personal information
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Account Profile</p>
                <p className="text-sm text-muted-foreground">
                  Update your name, email, and profile picture
                </p>
              </div>
              <Button
                variant="outline"
                onClick={() => {
                  // Open Clerk user profile
                  if (typeof window !== "undefined") {
                    window.open("https://accounts.clerk.dev/user", "_blank");
                  }
                }}
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                Manage Profile
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Security Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Security
            </CardTitle>
            <CardDescription>
              Manage your account security settings
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Password</p>
                <p className="text-sm text-muted-foreground">
                  Change your account password
                </p>
              </div>
              <Button
                variant="outline"
                onClick={() => {
                  if (typeof window !== "undefined") {
                    window.open("https://accounts.clerk.dev/user/security", "_blank");
                  }
                }}
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                Change Password
              </Button>
            </div>
            <div className="border-t pt-4 flex items-center justify-between">
              <div>
                <p className="font-medium">Two-Factor Authentication</p>
                <p className="text-sm text-muted-foreground">
                  Add an extra layer of security to your account
                </p>
              </div>
              <Button
                variant="outline"
                onClick={() => {
                  if (typeof window !== "undefined") {
                    window.open("https://accounts.clerk.dev/user/security", "_blank");
                  }
                }}
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                Configure 2FA
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Help & Support */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              Help & Support
            </CardTitle>
            <CardDescription>
              Get help with your media access
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-4 rounded-lg bg-muted/50">
              <h4 className="font-medium mb-2">Need Help?</h4>
              <p className="text-sm text-muted-foreground mb-3">
                If you&apos;re having trouble accessing your media or have questions about your account, 
                please contact the server administrator.
              </p>
              <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                <li>Can&apos;t connect to the server? Check your network connection</li>
                <li>Missing libraries? Contact the admin for access</li>
                <li>Playback issues? Try a different quality setting</li>
              </ul>
            </div>
          </CardContent>
        </Card>

        {/* Account Info */}
        <Card>
          <CardHeader>
            <CardTitle>Account Information</CardTitle>
            <CardDescription>Your account details</CardDescription>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <dt className="text-muted-foreground">Email</dt>
                <dd className="font-medium">
                  {clerkUser?.primaryEmailAddress?.emailAddress || "Not set"}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Name</dt>
                <dd className="font-medium">
                  {clerkUser?.fullName || clerkUser?.firstName || "Not set"}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Account Created</dt>
                <dd className="font-medium">
                  {clerkUser?.createdAt
                    ? new Date(clerkUser.createdAt).toLocaleDateString()
                    : "Unknown"}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Account ID</dt>
                <dd className="font-mono text-xs">
                  {clerkUser?.id?.slice(0, 16)}...
                </dd>
              </div>
            </dl>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
