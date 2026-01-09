"use client";

import { useQuery } from "convex/react";
import { useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api } from "@/convex/_generated/api";
import { StatsCard } from "@/components/stats-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Ticket, Users, UserCheck, Activity, Loader2, DollarSign, CreditCard, RefreshCw } from "lucide-react";
import { formatDateTime, timeAgo } from "@/lib/utils";
import { toast } from "sonner";

export default function DashboardPage() {
  const { user, isLoaded } = useUser();
  const router = useRouter();
  
  const email = user?.emailAddresses[0]?.emailAddress;
  
  const isAdmin = useQuery(
    api.admins.isAdmin,
    user?.id ? { clerkId: user.id, email } : "skip"
  );
  
  const inviteStats = useQuery(api.invites.getStats);
  const userStats = useQuery(api.users.getStats);
  const recentLogs = useQuery(api.notifications.getAuditLogs, { limit: 10 });
  const paymentStats = useQuery(
    api.payments.getPaymentStats,
    user?.id ? { adminClerkId: user.id } : "skip"
  );

  const [isSyncing, setIsSyncing] = useState(false);

  // Get Convex URL from environment
  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL?.replace('.cloud', '.site') || '';

  const handleStripeSync = async () => {
    setIsSyncing(true);
    try {
      const response = await fetch(`${convexUrl}/stripe/sync`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = await response.json();
      
      if (data.success) {
        toast.success(`Synced ${data.synced} subscriptions`);
      } else {
        toast.error(data.error || "Sync failed");
      }
    } catch (error) {
      toast.error("Failed to sync Stripe data");
    } finally {
      setIsSyncing(false);
    }
  };

  // Redirect non-admins to user area
  useEffect(() => {
    if (isLoaded && user && isAdmin === false) {
      router.push("/my-account");
    }
  }, [isLoaded, user, isAdmin, router]);

  if (!isLoaded || isAdmin === undefined) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isAdmin) {
    return null; // Will redirect
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground">
            Overview of your media invite system
          </p>
        </div>
        <Button
          onClick={handleStripeSync}
          disabled={isSyncing}
          variant="outline"
        >
          {isSyncing ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4 mr-2" />
          )}
          Sync Stripe
        </Button>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatsCard
          title="Total Users"
          value={userStats?.totalUsers ?? "-"}
          description={`${userStats?.activeUsers ?? 0} active`}
          icon={<Users className="h-4 w-4" />}
        />
        <StatsCard
          title="Paid Users"
          value={paymentStats?.paidUsers ?? "-"}
          description={`${paymentStats?.pendingUsers ?? 0} pending payment`}
          icon={<CreditCard className="h-4 w-4" />}
        />
        <StatsCard
          title="Active Subscriptions"
          value={paymentStats?.activeSubscriptions ?? "-"}
          description={`$${paymentStats?.mrr ?? 0} MRR`}
          icon={<DollarSign className="h-4 w-4" />}
        />
        <StatsCard
          title="Recent Signups"
          value={userStats?.recentSignups ?? "-"}
          description="Last 7 days"
          icon={<Activity className="h-4 w-4" />}
        />
      </div>

      {/* Server Breakdown */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Server Access</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full bg-orange-500" />
                  <span>Plex Users</span>
                </div>
                <span className="font-bold">{userStats?.plexUsers ?? 0}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full bg-green-500" />
                  <span>Emby Users</span>
                </div>
                <span className="font-bold">{userStats?.embyUsers ?? 0}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Payment Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full bg-green-500" />
                  <span>Paid Users</span>
                </div>
                <span className="font-bold">{paymentStats?.paidUsers ?? 0}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full bg-yellow-500" />
                  <span>Pending Payment</span>
                </div>
                <span className="font-bold">{paymentStats?.pendingUsers ?? 0}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full bg-blue-500" />
                  <span>Free Access</span>
                </div>
                <span className="font-bold">{paymentStats?.freeUsers ?? 0}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Action</TableHead>
                <TableHead>Details</TableHead>
                <TableHead>Time</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recentLogs?.map((log) => (
                <TableRow key={log._id}>
                  <TableCell>
                    <Badge variant="outline">{log.action.replace(/_/g, " ")}</Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {log.actorEmail || log.actorId.slice(0, 8)}
                    {log.details && (
                      <span className="ml-2 text-xs">
                        {JSON.parse(log.details).username ||
                          JSON.parse(log.details).code ||
                          JSON.parse(log.details).email ||
                          ""}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {timeAgo(log.timestamp)}
                  </TableCell>
                </TableRow>
              ))}
              {(!recentLogs || recentLogs.length === 0) && (
                <TableRow>
                  <TableCell colSpan={3} className="text-center text-muted-foreground">
                    No recent activity
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
