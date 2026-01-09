"use client";

import { useState } from "react";
import { useUser } from "@clerk/nextjs";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle, XCircle, Calendar, Mail, Server, Link2, RefreshCw, CreditCard } from "lucide-react";
import { formatDateTime } from "@/lib/utils";
import { PaymentRequired } from "@/components/payment-required";

export default function MyAccountPage() {
  const { user: clerkUser, isLoaded } = useUser();
  const [isLinking, setIsLinking] = useState(false);
  const [linkResult, setLinkResult] = useState<{ success: boolean; message: string } | null>(null);
  
  const userData = useQuery(
    api.users.getByClerkId,
    clerkUser?.id ? { clerkId: clerkUser.id } : "skip"
  );

  const paymentStatus = useQuery(
    api.payments.getPaymentStatus,
    clerkUser?.id ? { clerkId: clerkUser.id } : "skip"
  );

  const handleLinkAccounts = async () => {
    setIsLinking(true);
    setLinkResult(null);
    
    try {
      const response = await fetch("/api/link-accounts", { method: "POST" });
      const data = await response.json();
      
      if (data.linked) {
        setLinkResult({
          success: true,
          message: `Successfully linked! Found: ${data.results.emby.found ? "Emby" : ""} ${data.results.plex.found ? "Plex" : ""}`.trim(),
        });
        // Reload to show updated data
        window.location.reload();
      } else {
        setLinkResult({
          success: false,
          message: "No existing Emby or Plex accounts found matching your email.",
        });
      }
    } catch (error) {
      setLinkResult({
        success: false,
        message: "Failed to check for existing accounts.",
      });
    } finally {
      setIsLinking(false);
    }
  };

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Check if user needs to pay before showing full access
  const needsPayment = userData && 
    paymentStatus?.paymentStatus !== "active" && 
    paymentStatus?.paymentStatus !== "trialing" && 
    paymentStatus?.paymentStatus !== "free";

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">My Account</h1>
        <p className="text-muted-foreground">
          View your media server access and account details
        </p>
      </div>

      {/* Payment Required Section - shown prominently if needed */}
      {userData && needsPayment && (
        <PaymentRequired 
          paymentStatus={paymentStatus?.paymentStatus}
          stripeCustomerId={paymentStatus?.stripeCustomerId}
        />
      )}

      {/* Payment Status Card - shown when paid */}
      {userData && !needsPayment && (
        <PaymentRequired 
          paymentStatus={paymentStatus?.paymentStatus}
          stripeCustomerId={paymentStatus?.stripeCustomerId}
        />
      )}

      <div className="grid gap-6 md:grid-cols-2">
        {/* Account Status Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-500" />
              Account Status
            </CardTitle>
            <CardDescription>Your current access status</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {userData ? (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Status</span>
                  {userData.isActive && !needsPayment ? (
                    <Badge variant="success">Active</Badge>
                  ) : needsPayment ? (
                    <Badge variant="warning">Payment Required</Badge>
                  ) : (
                    <Badge variant="destructive">Revoked</Badge>
                  )}
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Server Access</span>
                  <Badge variant="outline">
                    {userData.serverAccess.charAt(0).toUpperCase() + userData.serverAccess.slice(1)}
                  </Badge>
                </div>
                {userData.isAutoLinked && (
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Account Type</span>
                    <Badge variant="secondary">
                      <Link2 className="h-3 w-3 mr-1" />
                      Auto-Linked
                    </Badge>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Joined</span>
                  <span className="text-sm">{formatDateTime(userData.createdAt)}</span>
                </div>
              </>
            ) : (
              <div className="text-center py-4">
                <XCircle className="h-12 w-12 text-muted-foreground mx-auto mb-2" />
                <p className="text-muted-foreground">
                  No active membership found.
                </p>
                <p className="text-sm text-muted-foreground mt-1 mb-4">
                  You need an invite code or an existing server account to access media servers.
                </p>
                <Button onClick={handleLinkAccounts} disabled={isLinking}>
                  {isLinking ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Link2 className="mr-2 h-4 w-4" />
                  )}
                  Check for Existing Account
                </Button>
                {linkResult && (
                  <p className={`text-sm mt-2 ${linkResult.success ? "text-green-600" : "text-muted-foreground"}`}>
                    {linkResult.message}
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Profile Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              Profile
            </CardTitle>
            <CardDescription>Your account information</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Name</span>
              <span className="font-medium">
                {clerkUser?.fullName || clerkUser?.firstName || "Not set"}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Email</span>
              <span className="text-sm">
                {clerkUser?.primaryEmailAddress?.emailAddress || "Not set"}
              </span>
            </div>
            {userData?.username && (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Username</span>
                <span className="font-mono text-sm">{userData.username}</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Server Details Card */}
        {userData && (
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Server className="h-5 w-5" />
                Server Details
              </CardTitle>
              <CardDescription>Your media server access details</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2">
                {(userData.serverAccess === "emby" || userData.serverAccess === "both") && (
                  <div className="p-4 rounded-lg border bg-muted/50">
                    <h4 className="font-semibold mb-2 flex items-center gap-2">
                      Emby
                      {userData.embyUserId && <Badge variant="success" className="text-xs">Connected</Badge>}
                    </h4>
                    <div className="space-y-2 text-sm">
                      {userData.embyUserId ? (
                        <>
                          {userData.embyUsername && (
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Username</span>
                              <span className="font-mono">{userData.embyUsername}</span>
                            </div>
                          )}
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">User ID</span>
                            <span className="font-mono">{userData.embyUserId.slice(0, 8)}...</span>
                          </div>
                        </>
                      ) : (
                        <p className="text-muted-foreground">Not connected yet</p>
                      )}
                    </div>
                  </div>
                )}
                {(userData.serverAccess === "plex" || userData.serverAccess === "both") && (
                  <div className="p-4 rounded-lg border bg-muted/50">
                    <h4 className="font-semibold mb-2 flex items-center gap-2">
                      Plex
                      {userData.plexUserId && <Badge variant="success" className="text-xs">Connected</Badge>}
                    </h4>
                    <div className="space-y-2 text-sm">
                      {userData.plexUserId || userData.plexUsername ? (
                        <>
                          {userData.plexUsername && (
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Username</span>
                              <span className="font-mono">{userData.plexUsername}</span>
                            </div>
                          )}
                          {userData.plexEmail && (
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Plex Email</span>
                              <span className="text-xs">{userData.plexEmail}</span>
                            </div>
                          )}
                        </>
                      ) : (
                        <p className="text-muted-foreground">Not connected yet</p>
                      )}
                    </div>
                  </div>
                )}
              </div>
              
              {/* Re-link button for users who want to refresh their linked accounts */}
              {userData.isAutoLinked && (
                <div className="mt-4 pt-4 border-t">
                  <Button variant="outline" size="sm" onClick={handleLinkAccounts} disabled={isLinking}>
                    {isLinking ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCw className="mr-2 h-4 w-4" />
                    )}
                    Refresh Linked Accounts
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Invite Details Card - Only show for users with invite codes */}
        {userData && userData.inviteCode && (
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Invite Details
              </CardTitle>
              <CardDescription>Information about your invitation</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-3">
                <div>
                  <p className="text-sm text-muted-foreground">Invite Code Used</p>
                  <p className="font-mono text-sm mt-1">{userData.inviteCode}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Redeemed On</p>
                  <p className="text-sm mt-1">{formatDateTime(userData.createdAt)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Last Active</p>
                  <p className="text-sm mt-1">
                    {userData.lastSeen ? formatDateTime(userData.lastSeen) : "Never"}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
        
        {/* Auto-Linked Account Info */}
        {userData && userData.isAutoLinked && !userData.inviteCode && (
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Link2 className="h-5 w-5" />
                Account Linked
              </CardTitle>
              <CardDescription>Your account was automatically linked to your existing media server account</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-3">
                <div>
                  <p className="text-sm text-muted-foreground">Link Type</p>
                  <p className="text-sm mt-1">Automatic (Email Match)</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Linked On</p>
                  <p className="text-sm mt-1">{formatDateTime(userData.createdAt)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Last Active</p>
                  <p className="text-sm mt-1">
                    {userData.lastSeen ? formatDateTime(userData.lastSeen) : "Never"}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
