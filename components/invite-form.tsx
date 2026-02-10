"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "convex/react";
import { useUser } from "@clerk/nextjs";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Loader2, CheckCircle, XCircle, Copy, Eye, EyeOff, Globe, Server } from "lucide-react";
import { toast } from "sonner";
import { PaymentRequired } from "@/components/payment-required";

interface InviteFormProps {
  code: string;
}

interface ProvisionResult {
  success: boolean;
  results: {
    plex: { success: boolean; message: string; invited: boolean };
    emby: { 
      success: boolean; 
      message: string; 
      userId: string | null; 
      password: string | null;
      useConnect: boolean;
      connectInviteSent: boolean;
    };
  };
  serverType: string;
  connectionInfo: {
    plex: { instructions: string | null } | null;
    emby: { 
      useConnect: boolean;
      connectInstructions: string | null;
      serverUrl: string | null; 
      username: string | null; 
      password: string | null; 
      localInstructions: string | null;
    } | null;
  };
}

type EmbyAuthMethod = "connect" | "local";

export function InviteForm({ code }: InviteFormProps) {
  const router = useRouter();
  const { user, isLoaded: isUserLoaded } = useUser();
  const [username, setUsername] = useState("");
  const [plexEmail, setPlexEmail] = useState("");
  
  // Emby auth options
  const [embyAuthMethod, setEmbyAuthMethod] = useState<EmbyAuthMethod>("connect");
  const [embyConnectEmail, setEmbyConnectEmail] = useState("");
  const [embyUsername, setEmbyUsername] = useState("");
  const [embyPassword, setEmbyPassword] = useState("");
  
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ProvisionResult | null>(null);
  const [embyConnectAvailable, setEmbyConnectAvailable] = useState<boolean | null>(null);

  // Check if invite is valid
  const invite = useQuery(api.invites.getByCode, { code });

  const paymentInfo = useQuery(
    api.payments.getPaymentStatus,
    user?.id ? { clerkId: user.id } : "skip"
  );

  // Check if Emby Connect is available
  useEffect(() => {
    if (invite?.serverType === "emby" || invite?.serverType === "both") {
      fetch("/api/provision")
        .then(res => res.json())
        .then(data => {
          setEmbyConnectAvailable(data.embyConnectAvailable);
          if (!data.embyConnectAvailable) {
            setEmbyAuthMethod("local");
          }
        })
        .catch(() => setEmbyConnectAvailable(false));
    }
  }, [invite?.serverType]);

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard`);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !invite?.isValid) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/provision", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code,
          username,
          plexEmail: invite.serverType !== "emby" ? plexEmail : undefined,
          // Emby Connect
          useEmbyConnect: invite.serverType !== "plex" && embyAuthMethod === "connect",
          embyConnectEmail: invite.serverType !== "plex" && embyAuthMethod === "connect" ? embyConnectEmail : undefined,
          // Emby Local
          embyUsername: invite.serverType !== "plex" && embyAuthMethod === "local" ? embyUsername : undefined,
          embyPassword: invite.serverType !== "plex" && embyAuthMethod === "local" && embyPassword ? embyPassword : undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to provision access");
      }

      if (data.success) {
        setResult(data);
      } else {
        setError(data.error || "Failed to set up access");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to redeem invite");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Loading state
  if (!isUserLoaded || invite === undefined) {
    return (
      <Card className="w-full max-w-md mx-auto">
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  // Invalid invite
  if (!invite) {
    return (
      <Card className="w-full max-w-md mx-auto">
        <CardHeader className="text-center">
          <XCircle className="mx-auto h-12 w-12 text-destructive mb-4" />
          <CardTitle>Invalid Invite</CardTitle>
          <CardDescription>
            This invite code does not exist or has been removed.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  // Expired or used up
  if (!invite.isValid) {
    return (
      <Card className="w-full max-w-md mx-auto">
        <CardHeader className="text-center">
          <XCircle className="mx-auto h-12 w-12 text-destructive mb-4" />
          <CardTitle>Invite Not Available</CardTitle>
          <CardDescription>
            {invite.isExpired
              ? "This invite has expired."
              : invite.isUsedUp
                ? "This invite has reached its maximum uses."
                : "This invite is no longer active."}
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  // Success - show credentials
  if (result?.success) {
    return (
      <Card className="w-full max-w-md mx-auto">
        <CardHeader className="text-center">
          <CheckCircle className="mx-auto h-12 w-12 text-green-500 mb-4" />
          <CardTitle>Welcome! 🎉</CardTitle>
          <CardDescription>
            Your access has been set up. Here&apos;s how to connect:
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Plex Instructions */}
          {result.connectionInfo.plex?.instructions && (
            <div className="space-y-3 p-4 rounded-lg border bg-orange-50 dark:bg-orange-950/20">
              <h3 className="font-semibold flex items-center gap-2">
                <span className="text-xl">📺</span> Plex
              </h3>
              <p className="text-sm text-muted-foreground">
                {result.connectionInfo.plex.instructions}
              </p>
              <ol className="text-sm space-y-1 list-decimal list-inside text-muted-foreground">
                <li>Download the Plex app on your device</li>
                <li>Sign in with your Plex account ({plexEmail})</li>
                <li>Look for the shared server in &quot;More Ways to Watch&quot;</li>
              </ol>
            </div>
          )}

          {/* Emby Instructions - Connect */}
          {result.connectionInfo.emby?.useConnect && (
            <div className="space-y-3 p-4 rounded-lg border bg-green-50 dark:bg-green-950/20">
              <h3 className="font-semibold flex items-center gap-2">
                <Globe className="h-5 w-5" /> Emby Connect
              </h3>
              <p className="text-sm text-muted-foreground">
                {result.connectionInfo.emby.connectInstructions}
              </p>
              <ol className="text-sm space-y-1 list-decimal list-inside text-muted-foreground">
                <li>Check your email ({embyConnectEmail}) for the invitation</li>
                <li>Accept the invitation from Emby</li>
                <li>Download the Emby app on any device</li>
                <li>Sign in with your Emby Connect account</li>
                <li>The server will appear automatically!</li>
              </ol>
            </div>
          )}

          {/* Emby Instructions - Local Account */}
          {result.connectionInfo.emby && !result.connectionInfo.emby.useConnect && (
            <div className="space-y-3 p-4 rounded-lg border bg-green-50 dark:bg-green-950/20">
              <h3 className="font-semibold flex items-center gap-2">
                <Server className="h-5 w-5" /> Emby (Local Account)
              </h3>
              
              <div className="space-y-2">
                {result.connectionInfo.emby.serverUrl && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Server URL:</span>
                    <div className="flex items-center gap-2">
                      <code className="text-xs bg-muted px-2 py-1 rounded max-w-[180px] truncate">
                        {result.connectionInfo.emby.serverUrl}
                      </code>
                      <Button 
                        size="icon" 
                        variant="ghost" 
                        className="h-6 w-6"
                        onClick={() => copyToClipboard(result.connectionInfo.emby!.serverUrl!, "Server URL")}
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                )}
                
                {result.connectionInfo.emby.username && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Username:</span>
                    <div className="flex items-center gap-2">
                      <code className="text-xs bg-muted px-2 py-1 rounded">
                        {result.connectionInfo.emby.username}
                      </code>
                      <Button 
                        size="icon" 
                        variant="ghost" 
                        className="h-6 w-6"
                        onClick={() => copyToClipboard(result.connectionInfo.emby!.username!, "Username")}
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                )}

                {result.connectionInfo.emby.password && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Password:</span>
                    <div className="flex items-center gap-2">
                      <code className="text-xs bg-muted px-2 py-1 rounded">
                        {showPassword ? result.connectionInfo.emby.password : "••••••••"}
                      </code>
                      <Button 
                        size="icon" 
                        variant="ghost" 
                        className="h-6 w-6"
                        onClick={() => setShowPassword(!showPassword)}
                      >
                        {showPassword ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                      </Button>
                      <Button 
                        size="icon" 
                        variant="ghost" 
                        className="h-6 w-6"
                        onClick={() => copyToClipboard(result.connectionInfo.emby!.password!, "Password")}
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                )}
              </div>

              <p className="text-sm text-muted-foreground">
                {result.connectionInfo.emby.localInstructions}
              </p>

              <ol className="text-sm space-y-1 list-decimal list-inside text-muted-foreground">
                <li>Download the Emby app on your device</li>
                <li>Add server manually using the URL above</li>
                <li>Sign in with your username and password</li>
              </ol>
            </div>
          )}
        </CardContent>
        <CardFooter className="flex flex-col gap-2">
          <Button className="w-full" onClick={() => router.push("/my-account")}>
            Go to My Account
          </Button>
          <Button variant="outline" className="w-full" onClick={() => router.push("/help")}>
            Need Help Setting Up?
          </Button>
        </CardFooter>
      </Card>
    );
  }

  // Not signed in
  if (!user) {
    return (
      <Card className="w-full max-w-md mx-auto">
        <CardHeader className="text-center">
          <CardTitle>Sign In Required</CardTitle>
          <CardDescription>
            Please sign in or create an account to redeem this invite.
          </CardDescription>
        </CardHeader>
        <CardFooter className="flex justify-center gap-4">
          <Button asChild>
            <a href={`/sign-in?redirect_url=/invite/${code}`}>Sign In</a>
          </Button>
          <Button variant="outline" asChild>
            <a href={`/sign-up?redirect_url=/invite/${code}`}>Create Account</a>
          </Button>
        </CardFooter>
      </Card>
    );
  }

  // If invite requires payment, gate before showing provisioning form.
  if (invite.requiresPayment === true) {
    const paymentStatus = paymentInfo?.paymentStatus;
    const ok = paymentStatus === "active" || paymentStatus === "trialing" || paymentStatus === "free";

    if (!ok) {
      return (
        <div className="w-full max-w-md mx-auto space-y-4">
          <Card>
            <CardHeader className="text-center">
              <CardTitle>Subscription Required</CardTitle>
              <CardDescription>
                This invite requires an active subscription before we can set up your media access.
              </CardDescription>
            </CardHeader>
          </Card>
          <PaymentRequired
            paymentStatus={paymentStatus}
            stripeCustomerId={paymentInfo?.stripeCustomerId}
          />
        </div>
      );
    }
  }

  // Valid invite - show form
  const serverLabel =
    invite.serverType === "both"
      ? "Plex & Emby"
      : invite.serverType.charAt(0).toUpperCase() + invite.serverType.slice(1);

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader className="text-center">
        <CheckCircle className="mx-auto h-12 w-12 text-green-500 mb-4" />
        <CardTitle>You&apos;re Invited!</CardTitle>
        <CardDescription>
          Complete your profile to get access to {serverLabel}
        </CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-4">
          {error && (
            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={user.primaryEmailAddress?.emailAddress || ""}
              disabled
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="username">Display Name</Label>
            <Input
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="How should we call you?"
              required
            />
          </div>

          {(invite.serverType === "plex" || invite.serverType === "both") && (
            <div className="space-y-2">
              <Label htmlFor="plexEmail">Plex Email</Label>
              <Input
                id="plexEmail"
                type="email"
                value={plexEmail}
                onChange={(e) => setPlexEmail(e.target.value)}
                placeholder="Your Plex account email"
                required={invite.serverType === "plex" || invite.serverType === "both"}
              />
              <p className="text-xs text-muted-foreground">
                The email address for your Plex account. You&apos;ll receive an invite there.
                Don&apos;t have Plex? <a href="https://plex.tv" target="_blank" rel="noopener" className="text-primary hover:underline">Create a free account</a>
              </p>
            </div>
          )}

          {(invite.serverType === "emby" || invite.serverType === "both") && (
            <div className="space-y-4">
              {/* Auth Method Toggle */}
              {embyConnectAvailable !== false && (
                <div className="space-y-2">
                  <Label>How would you like to connect to Emby?</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      type="button"
                      variant={embyAuthMethod === "connect" ? "default" : "outline"}
                      className="flex flex-col h-auto py-3"
                      onClick={() => setEmbyAuthMethod("connect")}
                      disabled={!embyConnectAvailable}
                    >
                      <Globe className="h-5 w-5 mb-1" />
                      <span className="text-xs font-medium">Emby Connect</span>
                      <span className="text-[10px] text-muted-foreground">Recommended</span>
                    </Button>
                    <Button
                      type="button"
                      variant={embyAuthMethod === "local" ? "default" : "outline"}
                      className="flex flex-col h-auto py-3"
                      onClick={() => setEmbyAuthMethod("local")}
                    >
                      <Server className="h-5 w-5 mb-1" />
                      <span className="text-xs font-medium">Local Account</span>
                      <span className="text-[10px] text-muted-foreground">Server-specific</span>
                    </Button>
                  </div>
                </div>
              )}

              {/* Emby Connect Fields */}
              {embyAuthMethod === "connect" && (
                <div className="space-y-2">
                  <Label htmlFor="embyConnectEmail">Emby Connect Email</Label>
                  <Input
                    id="embyConnectEmail"
                    type="email"
                    value={embyConnectEmail}
                    onChange={(e) => setEmbyConnectEmail(e.target.value)}
                    placeholder="Your Emby Connect email"
                    required
                  />
                  <p className="text-xs text-muted-foreground">
                    Enter your Emby Connect account email. You&apos;ll receive an invitation to join the server.
                    Don&apos;t have one? <a href="https://emby.media/connect" target="_blank" rel="noopener" className="text-primary hover:underline">Create free Emby Connect</a>
                  </p>
                </div>
              )}

              {/* Local Account Fields */}
              {embyAuthMethod === "local" && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="embyUsername">Emby Username</Label>
                    <Input
                      id="embyUsername"
                      value={embyUsername}
                      onChange={(e) => setEmbyUsername(e.target.value)}
                      placeholder="Choose your username"
                      required
                    />
                    <p className="text-xs text-muted-foreground">
                      This will be your username for this specific Emby server.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="embyPassword">Password (Optional)</Label>
                    <Input
                      id="embyPassword"
                      type="password"
                      value={embyPassword}
                      onChange={(e) => setEmbyPassword(e.target.value)}
                      placeholder="Leave blank to auto-generate"
                    />
                    <p className="text-xs text-muted-foreground">
                      Choose your password or we&apos;ll generate a secure one for you.
                    </p>
                  </div>
                </>
              )}
            </div>
          )}
        </CardContent>
        <CardFooter>
          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Setting up access...
              </>
            ) : (
              "Complete Setup"
            )}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
