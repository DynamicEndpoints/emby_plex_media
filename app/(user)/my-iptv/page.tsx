"use client";

import { useMemo, useState } from "react";
import { useUser } from "@clerk/nextjs";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { PaymentRequired } from "@/components/payment-required";
import { Loader2, RefreshCw, KeyRound, Copy, Tv, ArrowUpDown } from "lucide-react";

function statusBadge(status?: string) {
  if (!status) return <Badge variant="secondary">Not set</Badge>;
  if (status === "active") return <Badge variant="success">Active</Badge>;
  if (status === "pending") return <Badge variant="secondary">Pending</Badge>;
  if (status === "suspended") return <Badge variant="destructive">Suspended</Badge>;
  return <Badge variant="secondary">{status}</Badge>;
}

export default function MyIptvPage() {
  const { user } = useUser();
  const clerkId = user?.id;

  const payment = useQuery(api.payments.getPaymentStatus, clerkId ? { clerkId } : "skip");
  const configStatus = useQuery(api.iptv.getConfigStatus);
  const account = useQuery(api.iptv.getMyAccount, clerkId ? { clerkId } : "skip");
  const plans = useQuery(api.iptv.listPlans, { provider: "xtremeui" });
  const jobs = useQuery(api.jobs.listMyJobs, clerkId ? { clerkId, limit: 20 } : "skip");

  const requestProvision = useMutation(api.iptv.requestProvision);
  const requestSync = useMutation(api.iptv.requestSync);
  const requestChangePassword = useMutation(api.iptv.requestChangePassword);
  const requestChangePlan = useMutation(api.iptv.requestChangePlan);

  const [isWorking, setIsWorking] = useState(false);
  const [desiredUsername, setDesiredUsername] = useState<string>("");
  const [newPassword, setNewPassword] = useState<string>("");
  const [selectedPlanId, setSelectedPlanId] = useState<string>("");

  const isPaid = useMemo(() => {
    const s = payment?.paymentStatus;
    return s === "active" || s === "trialing" || s === "free";
  }, [payment?.paymentStatus]);

  const isIptvConfigured = configStatus?.configured !== false;

  const handleCopy = async (text?: string) => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // ignore
    }
  };

  const handleProvision = async () => {
    if (!clerkId) return;
    setIsWorking(true);
    try {
      await requestProvision({
        clerkId,
        desiredUsername: desiredUsername.trim() || undefined,
        planId: selectedPlanId ? (selectedPlanId as any) : undefined,
      });
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed to provision IPTV");
    } finally {
      setIsWorking(false);
    }
  };

  const handleSync = async () => {
    if (!clerkId) return;
    setIsWorking(true);
    try {
      await requestSync({ clerkId });
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed to sync IPTV");
    } finally {
      setIsWorking(false);
    }
  };

  const handleChangePassword = async () => {
    if (!clerkId) return;
    setIsWorking(true);
    try {
      await requestChangePassword({ clerkId, newPassword });
      setNewPassword("");
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed to change password");
    } finally {
      setIsWorking(false);
    }
  };

  const handleChangePlan = async () => {
    if (!clerkId || !selectedPlanId) return;
    setIsWorking(true);
    try {
      await requestChangePlan({ clerkId, planId: selectedPlanId as any });
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed to change plan");
    } finally {
      setIsWorking(false);
    }
  };

  if (!user) {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>My IPTV</CardTitle>
            <CardDescription>Please sign in to manage IPTV.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">My IPTV</h1>
          <p className="text-muted-foreground">Self-service IPTV provisioning and management</p>
        </div>
        <Button
          variant="outline"
          onClick={handleSync}
          disabled={isWorking || !isPaid || !account || !isIptvConfigured}
        >
          {isWorking ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="mr-2 h-4 w-4" />
          )}
          Sync
        </Button>
      </div>

      <PaymentRequired paymentStatus={payment?.paymentStatus} stripeCustomerId={payment?.stripeCustomerId || undefined} />

      {configStatus?.configured === false && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">IPTV Not Configured</CardTitle>
            <CardDescription>
              An admin still needs to configure Xtreme UI in Settings before provisioning can work.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Missing: {(configStatus.missing || []).join(", ") || "unknown"}
            </p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <Tv className="h-5 w-5" />
              Account
            </CardTitle>
            {statusBadge(account?.status)}
          </div>
          <CardDescription>
            {account ? "Your IPTV account details." : "No IPTV account yet. Provision one when you’re paid/free."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!account && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="desiredUsername">Desired username (optional)</Label>
                <Input
                  id="desiredUsername"
                  value={desiredUsername}
                  onChange={(e) => setDesiredUsername(e.target.value)}
                  placeholder="leave blank to auto-generate"
                  disabled={!isPaid}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="plan">Plan (optional)</Label>
                <select
                  id="plan"
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                  value={selectedPlanId}
                  onChange={(e) => setSelectedPlanId(e.target.value)}
                  disabled={!isPaid || !isIptvConfigured}
                >
                  <option value="">Default</option>
                  {(plans || []).map((p: any) => (
                    <option key={p._id} value={p._id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>

              <Button onClick={handleProvision} disabled={!isPaid || !isIptvConfigured || isWorking}>
                {isWorking ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Tv className="mr-2 h-4 w-4" />
                )}
                Provision IPTV
              </Button>
            </div>
          )}

          {account && (
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Username</Label>
                <div className="flex gap-2">
                  <Input value={account.username} readOnly />
                  <Button variant="outline" size="icon" onClick={() => handleCopy(account.username)}>
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label>M3U URL</Label>
                <div className="flex gap-2">
                  <Input value={account.m3uUrl || ""} readOnly placeholder="Not generated yet" />
                  <Button variant="outline" size="icon" onClick={() => handleCopy(account.m3uUrl)} disabled={!account.m3uUrl}>
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label>Upgrade / Downgrade</Label>
                <div className="flex flex-col gap-2 md:flex-row">
                  <select
                    className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                    value={selectedPlanId || (account.planId || "")}
                    onChange={(e) => setSelectedPlanId(e.target.value)}
                    disabled={!isPaid || !isIptvConfigured}
                  >
                    <option value="">No plan</option>
                    {(plans || []).map((p: any) => (
                      <option key={p._id} value={p._id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                  <Button
                    onClick={handleChangePlan}
                    disabled={!isPaid || !isIptvConfigured || isWorking || !selectedPlanId}
                  >
                    {isWorking ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <ArrowUpDown className="mr-2 h-4 w-4" />
                    )}
                    Change Plan
                  </Button>
                </div>
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="newPassword">Change password</Label>
                <div className="flex flex-col gap-2 md:flex-row">
                  <Input
                    id="newPassword"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="New password (min 8 chars)"
                    disabled={!isPaid || !isIptvConfigured}
                    type="password"
                  />
                  <Button
                    onClick={handleChangePassword}
                    disabled={!isPaid || !isIptvConfigured || isWorking || newPassword.length < 8}
                  >
                    {isWorking ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <KeyRound className="mr-2 h-4 w-4" />
                    )}
                    Update
                  </Button>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Recent Jobs</CardTitle>
          <CardDescription>Background automation status (provision/renew/suspend/sync)</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {(jobs || []).length === 0 ? (
              <p className="text-sm text-muted-foreground">No jobs yet.</p>
            ) : (
              <div className="space-y-2">
                {(jobs || []).map((j: any) => (
                  <div key={j._id} className="flex items-center justify-between rounded-md border p-3">
                    <div>
                      <div className="text-sm font-medium">{j.type}</div>
                      <div className="text-xs text-muted-foreground">
                        {j.status} · attempts {j.attempts}/{j.maxAttempts}
                        {j.lastError ? ` · ${j.lastError}` : ""}
                      </div>
                    </div>
                    <Badge variant={j.status === "succeeded" ? "success" : j.status === "failed" ? "destructive" : "secondary"}>
                      {j.status}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
