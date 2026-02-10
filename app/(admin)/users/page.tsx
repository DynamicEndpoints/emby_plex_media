"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { useUser } from "@clerk/nextjs";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MoreHorizontal, Ban, RefreshCw, Trash2, Search, Loader2, Users, Server, Shield, UserX, DollarSign, Gift } from "lucide-react";
import { formatDateTime, timeAgo } from "@/lib/utils";
import { Id } from "@/convex/_generated/dataModel";

interface EmbyUser {
  id: string;
  name: string;
  isAdmin: boolean;
  isDisabled: boolean;
  lastLoginDate?: string;
  lastActivityDate?: string;
  hasPassword: boolean;
}

export default function UsersPage() {
  const { user: adminUser } = useUser();
  const [searchQuery, setSearchQuery] = useState("");
  const [embyUsers, setEmbyUsers] = useState<EmbyUser[]>([]);
  const [embyLoading, setEmbyLoading] = useState(false);
  const [embyError, setEmbyError] = useState<string | null>(null);

  const users = useQuery(api.users.list, {});
  const searchResults = useQuery(
    api.users.search,
    searchQuery.length >= 2 ? { query: searchQuery } : "skip"
  );
  const iptvPlans = useQuery(api.iptv.listPlans, { provider: "xtremeui" });
  const revoke = useMutation(api.users.revoke);
  const restore = useMutation(api.users.restore);
  const remove = useMutation(api.users.remove);
  const markUserAsFree = useMutation(api.payments.markUserAsFree);
  const adminSetIptvPlan = useMutation(api.iptv.adminSetPlanForUser);

  const [iptvSelections, setIptvSelections] = useState<Record<string, string>>({});

  const displayedUsers = searchQuery.length >= 2 ? searchResults : users;

  // Fetch Emby users
  const fetchEmbyUsers = async () => {
    setEmbyLoading(true);
    setEmbyError(null);
    try {
      const response = await fetch("/api/emby/users");
      const data = await response.json();
      if (data.success) {
        setEmbyUsers(data.users);
      } else {
        setEmbyError(data.error || "Failed to fetch Emby users");
      }
    } catch (err) {
      setEmbyError(err instanceof Error ? err.message : "Failed to connect");
    } finally {
      setEmbyLoading(false);
    }
  };

  useEffect(() => {
    fetchEmbyUsers();
  }, []);

  const handleRevoke = async (id: Id<"users">) => {
    if (!adminUser) return;
    if (confirm("Are you sure you want to revoke this user's access?")) {
      await revoke({ id, adminId: adminUser.id });
    }
  };

  const handleRestore = async (id: Id<"users">) => {
    if (!adminUser) return;
    await restore({ id, adminId: adminUser.id });
  };

  const handleDelete = async (id: Id<"users">) => {
    if (!adminUser) return;
    if (
      confirm(
        "Are you sure you want to permanently delete this user? This cannot be undone."
      )
    ) {
      await remove({ id, adminId: adminUser.id });
    }
  };

  const formatEmbyDate = (dateStr?: string) => {
    if (!dateStr) return "Never";
    try {
      return new Date(dateStr).toLocaleDateString();
    } catch {
      return "Unknown";
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Users</h1>
        <p className="text-muted-foreground">
          View and manage users across your media servers
        </p>
      </div>

      <Tabs defaultValue="invited" className="space-y-4">
        <TabsList>
          <TabsTrigger value="invited" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Invited Users ({users?.length ?? 0})
          </TabsTrigger>
          <TabsTrigger value="emby" className="flex items-center gap-2">
            <Server className="h-4 w-4" />
            Emby Server ({embyUsers.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="invited">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Invited Users</CardTitle>
                  <CardDescription>
                    Users who redeemed invite codes
                  </CardDescription>
                </div>
                <div className="relative w-64">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Search users..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Server Access</TableHead>
                    <TableHead>Payment</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Joined</TableHead>
                    <TableHead>IPTV Plan</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {displayedUsers?.map((user) => (
                    <TableRow key={user._id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{user.username}</div>
                          <div className="text-sm text-muted-foreground">
                            {user.email}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <Badge variant="outline">
                            {user.serverAccess.charAt(0).toUpperCase() +
                              user.serverAccess.slice(1)}
                          </Badge>
                          {user.plexUsername && (
                            <div className="text-xs text-muted-foreground">
                              Plex: {user.plexUsername}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {user.paymentStatus === "active" ? (
                          <Badge variant="success">Paid</Badge>
                        ) : user.paymentStatus === "free" ? (
                          <Badge variant="outline">Free</Badge>
                        ) : user.paymentStatus === "past_due" ? (
                          <Badge variant="warning">Past Due</Badge>
                        ) : user.paymentStatus === "trialing" ? (
                          <Badge variant="secondary">Trial</Badge>
                        ) : (
                          <Badge variant="destructive">Unpaid</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <code className="text-xs font-mono">{user.inviteCode}</code>
                      </TableCell>
                      <TableCell>
                        {user.isActive ? (
                          <Badge variant="success">Active</Badge>
                        ) : (
                          <Badge variant="destructive">Revoked</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatDateTime(user.createdAt)}
                  </TableCell>
                      <TableCell className="text-muted-foreground">
                        {user.lastSeen ? timeAgo(user.lastSeen) : "Never"}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <select
                            className="w-full min-w-[160px] rounded-md border bg-background px-2 py-1.5 text-sm"
                            value={iptvSelections[user._id] || ""}
                            onChange={(e) =>
                              setIptvSelections((prev) => ({
                                ...prev,
                                [user._id]: e.target.value,
                              }))
                            }
                          >
                            <option value="">Select plan</option>
                            {(iptvPlans || []).map((plan) => (
                              <option key={plan._id} value={plan._id}>
                                {plan.name}
                              </option>
                            ))}
                          </select>
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={!adminUser?.id || !iptvSelections[user._id]}
                            onClick={async () => {
                              if (!adminUser?.id) return;
                              const planId = iptvSelections[user._id];
                              if (!planId) return;
                              try {
                                await adminSetIptvPlan({
                                  adminClerkId: adminUser.id,
                                  userId: user._id,
                                  planId: planId as any,
                                });
                              } catch (e) {
                                alert(e instanceof Error ? e.message : "Failed to apply IPTV plan");
                              }
                            }}
                          >
                            Apply
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {user.isActive ? (
                              <DropdownMenuItem
                                onClick={() => handleRevoke(user._id)}
                              >
                                <Ban className="mr-2 h-4 w-4" />
                                Revoke Access
                              </DropdownMenuItem>
                            ) : (
                              <DropdownMenuItem
                                onClick={() => handleRestore(user._id)}
                              >
                                <RefreshCw className="mr-2 h-4 w-4" />
                                Restore Access
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />
                            {user.paymentStatus !== "free" && (
                              <DropdownMenuItem
                                onClick={async () => {
                                  if (!adminUser?.id) return;
                                  await markUserAsFree({
                                    userId: user._id,
                                    adminClerkId: adminUser.id,
                                  });
                                }}
                              >
                                <Gift className="mr-2 h-4 w-4" />
                                Grant Free Access
                              </DropdownMenuItem>
                            )}
                            {user.paymentStatus === "free" && (
                              <DropdownMenuItem disabled>
                                <Gift className="mr-2 h-4 w-4 text-green-500" />
                                Has Free Access
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => handleDelete(user._id)}
                              className="text-destructive"
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Delete User
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                  {(!displayedUsers || displayedUsers.length === 0) && (
                    <TableRow>
                      <TableCell
                        colSpan={9}
                        className="text-center text-muted-foreground py-8"
                      >
                        {searchQuery.length >= 2
                          ? "No users found matching your search."
                          : "No users yet. Share invite codes to get started."}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="emby">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Emby Server Users</CardTitle>
                  <CardDescription>
                    All users currently on your Emby server
                  </CardDescription>
                </div>
                <Button 
                  variant="outline" 
                  onClick={fetchEmbyUsers}
                  disabled={embyLoading}
                >
                  {embyLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <RefreshCw className="h-4 w-4 mr-2" />
                  )}
                  Refresh
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {embyError ? (
                <div className="text-center py-8 text-muted-foreground">
                  <p className="text-destructive">{embyError}</p>
                  <p className="text-sm mt-2">
                    Make sure Emby is configured in Settings.
                  </p>
                </div>
              ) : embyLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Username</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Password</TableHead>
                      <TableHead>Last Login</TableHead>
                      <TableHead>Last Activity</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {embyUsers.map((embyUser) => (
                      <TableRow key={embyUser.id}>
                        <TableCell>
                          <div className="font-medium">{embyUser.name}</div>
                        </TableCell>
                        <TableCell>
                          {embyUser.isAdmin ? (
                            <Badge className="bg-amber-500 hover:bg-amber-600">
                              <Shield className="h-3 w-3 mr-1" />
                              Admin
                            </Badge>
                          ) : (
                            <Badge variant="secondary">User</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {embyUser.isDisabled ? (
                            <Badge variant="destructive">
                              <UserX className="h-3 w-3 mr-1" />
                              Disabled
                            </Badge>
                          ) : (
                            <Badge variant="success">Active</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {embyUser.hasPassword ? (
                            <Badge variant="outline">Set</Badge>
                          ) : (
                            <Badge variant="secondary">None</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {formatEmbyDate(embyUser.lastLoginDate)}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {formatEmbyDate(embyUser.lastActivityDate)}
                        </TableCell>
                      </TableRow>
                    ))}
                    {embyUsers.length === 0 && (
                      <TableRow>
                        <TableCell
                          colSpan={6}
                          className="text-center text-muted-foreground py-8"
                        >
                          No users found on Emby server.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
