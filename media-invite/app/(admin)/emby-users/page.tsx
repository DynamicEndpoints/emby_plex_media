"use client";

import { useState, useEffect } from "react";
import { useUser } from "@clerk/nextjs";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Loader2,
  RefreshCw,
  Search,
  MoreHorizontal,
  UserCheck,
  UserX,
  Settings,
  Trash2,
  Shield,
  Tv,
  FolderOpen,
  Wifi,
} from "lucide-react";
import { toast } from "sonner";
import { formatDateTime, timeAgo } from "@/lib/utils";

interface EmbyUser {
  id: string;
  name: string;
  isAdmin: boolean;
  isDisabled: boolean;
  lastLoginDate?: string;
  lastActivityDate?: string;
  hasPassword: boolean;
}

interface EmbyUserDetails {
  id: string;
  name: string;
  isAdmin: boolean;
  isDisabled: boolean;
  enableAllFolders: boolean;
  enabledFolders: string[];
  enableLiveTvAccess: boolean;
  enableLiveTvManagement: boolean;
  enableRemoteAccess: boolean;
  lastLoginDate?: string;
  lastActivityDate?: string;
  hasPassword: boolean;
}

interface EmbyLibrary {
  id: string;
  name: string;
  type: string;
}

export default function EmbyUsersPage() {
  const { user } = useUser();
  const [users, setUsers] = useState<EmbyUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  
  // Edit dialog state
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<EmbyUserDetails | null>(null);
  const [libraries, setLibraries] = useState<EmbyLibrary[]>([]);
  const [hasLiveTv, setHasLiveTv] = useState(false);
  const [selectedLibraries, setSelectedLibraries] = useState<string[]>([]);
  const [enableAllFolders, setEnableAllFolders] = useState(false);
  const [enableLiveTv, setEnableLiveTv] = useState(false);
  const [enableRemoteAccess, setEnableRemoteAccess] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadingUser, setLoadingUser] = useState(false);

  const isAdmin = useQuery(
    api.admins.isAdmin,
    user?.id ? { clerkId: user.id, email: user.primaryEmailAddress?.emailAddress } : "skip"
  );

  const fetchUsers = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/emby/users");
      const data = await response.json();
      if (data.success) {
        setUsers(data.users);
      } else {
        setError(data.error || "Failed to fetch users");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to connect");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const filteredUsers = users.filter(
    (u) =>
      u.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const openEditDialog = async (userId: string) => {
    setLoadingUser(true);
    setEditDialogOpen(true);
    
    try {
      const response = await fetch(`/api/emby/users/${userId}`);
      const data = await response.json();
      
      if (data.success) {
        setSelectedUser(data.user);
        setLibraries(data.libraries);
        setHasLiveTv(data.hasLiveTv);
        setSelectedLibraries(data.user.enabledFolders || []);
        setEnableAllFolders(data.user.enableAllFolders);
        setEnableLiveTv(data.user.enableLiveTvAccess);
        setEnableRemoteAccess(data.user.enableRemoteAccess);
      } else {
        toast.error(data.error || "Failed to load user");
        setEditDialogOpen(false);
      }
    } catch (err) {
      toast.error("Failed to load user details");
      setEditDialogOpen(false);
    } finally {
      setLoadingUser(false);
    }
  };

  const handleToggleAccess = async (userId: string, enable: boolean) => {
    try {
      const response = await fetch(`/api/emby/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: enable ? "enable" : "disable" }),
      });
      
      const data = await response.json();
      if (data.success) {
        toast.success(`User ${enable ? "enabled" : "disabled"} successfully`);
        fetchUsers();
      } else {
        toast.error(data.error || "Failed to update user");
      }
    } catch (err) {
      toast.error("Failed to update user");
    }
  };

  const handleSaveLibraries = async () => {
    if (!selectedUser) return;
    
    setSaving(true);
    try {
      // Update libraries
      const libResponse = await fetch(`/api/emby/users/${selectedUser.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "updateLibraries",
          libraries: enableLiveTv ? [...selectedLibraries, "__livetv__"] : selectedLibraries,
          enableAllFolders,
        }),
      });
      
      const libData = await libResponse.json();
      if (!libData.success) {
        throw new Error(libData.error);
      }

      // Update remote access
      const policyResponse = await fetch(`/api/emby/users/${selectedUser.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "updatePolicy",
          enableLiveTv,
          enableRemoteAccess,
        }),
      });

      const policyData = await policyResponse.json();
      if (!policyData.success) {
        throw new Error(policyData.error);
      }

      toast.success("User updated successfully");
      setEditDialogOpen(false);
      fetchUsers();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save changes");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteUser = async (userId: string, username: string) => {
    if (!confirm(`Are you sure you want to delete "${username}" from Emby? This cannot be undone.`)) {
      return;
    }

    try {
      const response = await fetch(`/api/emby/users/${userId}`, {
        method: "DELETE",
      });
      
      const data = await response.json();
      if (data.success) {
        toast.success("User deleted successfully");
        fetchUsers();
      } else {
        toast.error(data.error || "Failed to delete user");
      }
    } catch (err) {
      toast.error("Failed to delete user");
    }
  };

  const toggleLibrary = (libraryId: string) => {
    setSelectedLibraries((prev) =>
      prev.includes(libraryId)
        ? prev.filter((id) => id !== libraryId)
        : [...prev, libraryId]
    );
  };

  // Show loading while checking admin status
  if (isAdmin === undefined) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Deny access if not admin
  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-muted-foreground">Access denied. Admin privileges required.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Emby Users</h1>
          <p className="text-muted-foreground">
            Manage Emby server users directly from here
          </p>
        </div>
        <Button onClick={fetchUsers} disabled={loading} variant="outline">
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {error && (
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <p className="text-destructive">{error}</p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Emby Server Users
          </CardTitle>
          <CardDescription>
            {users.length} users on the Emby server
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4 mb-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search users..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Username</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Last Active</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.map((embyUser) => (
                  <TableRow key={embyUser.id}>
                    <TableCell className="font-medium">
                      {embyUser.name}
                      {!embyUser.hasPassword && (
                        <Badge variant="outline" className="ml-2 text-xs">
                          No Password
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {embyUser.isDisabled ? (
                        <Badge variant="destructive">Disabled</Badge>
                      ) : (
                        <Badge variant="success">Active</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {embyUser.isAdmin ? (
                        <Badge variant="secondary">
                          <Shield className="h-3 w-3 mr-1" />
                          Admin
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">User</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {embyUser.lastActivityDate
                        ? timeAgo(new Date(embyUser.lastActivityDate))
                        : "Never"}
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openEditDialog(embyUser.id)}>
                            <Settings className="h-4 w-4 mr-2" />
                            Edit Access
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          {embyUser.isDisabled ? (
                            <DropdownMenuItem
                              onClick={() => handleToggleAccess(embyUser.id, true)}
                            >
                              <UserCheck className="h-4 w-4 mr-2" />
                              Enable User
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem
                              onClick={() => handleToggleAccess(embyUser.id, false)}
                              disabled={embyUser.isAdmin}
                            >
                              <UserX className="h-4 w-4 mr-2" />
                              Disable User
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => handleDeleteUser(embyUser.id, embyUser.name)}
                            className="text-destructive"
                            disabled={embyUser.isAdmin}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete User
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
                {filteredUsers.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground">
                      {searchQuery ? "No users match your search" : "No users found"}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Edit User Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit User: {selectedUser?.name}</DialogTitle>
            <DialogDescription>
              Configure library access and permissions for this user
            </DialogDescription>
          </DialogHeader>

          {loadingUser ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : selectedUser ? (
            <div className="space-y-6">
              {/* Status */}
              <div className="flex items-center justify-between p-3 rounded-lg border">
                <div>
                  <p className="font-medium">Account Status</p>
                  <p className="text-sm text-muted-foreground">
                    {selectedUser.isDisabled ? "User is disabled" : "User is active"}
                  </p>
                </div>
                <Badge variant={selectedUser.isDisabled ? "destructive" : "success"}>
                  {selectedUser.isDisabled ? "Disabled" : "Active"}
                </Badge>
              </div>

              {/* Remote Access */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Wifi className="h-4 w-4" />
                  <div>
                    <p className="font-medium">Remote Access</p>
                    <p className="text-sm text-muted-foreground">
                      Allow access from outside the network
                    </p>
                  </div>
                </div>
                <Checkbox
                  checked={enableRemoteAccess}
                  onCheckedChange={(checked) => setEnableRemoteAccess(!!checked)}
                />
              </div>

              {/* Live TV Access */}
              {hasLiveTv && (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Tv className="h-4 w-4" />
                    <div>
                      <p className="font-medium">Live TV Access</p>
                      <p className="text-sm text-muted-foreground">
                        Access to live TV channels and DVR
                      </p>
                    </div>
                  </div>
                  <Checkbox
                    checked={enableLiveTv}
                    onCheckedChange={(checked) => setEnableLiveTv(!!checked)}
                  />
                </div>
              )}

              {/* All Libraries */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FolderOpen className="h-4 w-4" />
                  <div>
                    <p className="font-medium">Access All Libraries</p>
                    <p className="text-sm text-muted-foreground">
                      Grant access to all current and future libraries
                    </p>
                  </div>
                </div>
                <Checkbox
                  checked={enableAllFolders}
                  onCheckedChange={(checked) => setEnableAllFolders(!!checked)}
                />
              </div>

              {/* Individual Libraries */}
              {!enableAllFolders && libraries.length > 0 && (
                <div className="space-y-2">
                  <p className="font-medium">Library Access</p>
                  <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto">
                    {libraries.map((lib) => (
                      <div
                        key={lib.id}
                        className="flex items-center space-x-2 p-2 rounded border"
                      >
                        <Checkbox
                          id={`lib-${lib.id}`}
                          checked={selectedLibraries.includes(lib.id)}
                          onCheckedChange={() => toggleLibrary(lib.id)}
                        />
                        <label
                          htmlFor={`lib-${lib.id}`}
                          className="text-sm cursor-pointer flex-1"
                        >
                          {lib.name}
                          <span className="text-xs text-muted-foreground ml-1">
                            ({lib.type})
                          </span>
                        </label>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : null}

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveLibraries} disabled={saving || loadingUser}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
