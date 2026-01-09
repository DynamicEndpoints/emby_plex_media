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
  Settings,
  Trash2,
  Shield,
  FolderOpen,
  User,
} from "lucide-react";
import { toast } from "sonner";

interface PlexUser {
  id: string;
  username: string;
  email: string;
  thumb?: string;
}

interface PlexUserDetails {
  id: string;
  username: string;
  email: string;
  thumb?: string;
  libraryIds: string[];
}

interface PlexLibrary {
  id: string;
  name: string;
  type: string;
}

export default function PlexUsersPage() {
  const { user } = useUser();
  const [users, setUsers] = useState<PlexUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  
  // Edit dialog state
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<PlexUserDetails | null>(null);
  const [libraries, setLibraries] = useState<PlexLibrary[]>([]);
  const [selectedLibraries, setSelectedLibraries] = useState<string[]>([]);
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
      const response = await fetch("/api/plex/users");
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
      u.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.email?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const openEditDialog = async (userId: string) => {
    setLoadingUser(true);
    setEditDialogOpen(true);
    
    try {
      const response = await fetch(`/api/plex/users/${userId}`);
      const data = await response.json();
      
      if (data.success) {
        setSelectedUser(data.user);
        setLibraries(data.libraries);
        setSelectedLibraries(data.user.libraryIds || []);
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

  const handleSaveLibraries = async () => {
    if (!selectedUser) return;
    
    setSaving(true);
    try {
      const response = await fetch(`/api/plex/users/${selectedUser.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "updateLibraries",
          libraries: selectedLibraries,
        }),
      });
      
      const data = await response.json();
      if (data.success) {
        toast.success("User libraries updated successfully");
        setEditDialogOpen(false);
      } else {
        toast.error(data.error || "Failed to update user");
      }
    } catch (err) {
      toast.error("Failed to update user");
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveUser = async (userId: string, username: string) => {
    if (!confirm(`Are you sure you want to remove ${username} from your Plex server? They will lose all access.`)) {
      return;
    }

    try {
      const response = await fetch(`/api/plex/users/${userId}`, {
        method: "DELETE",
      });
      
      const data = await response.json();
      if (data.success) {
        toast.success("User removed successfully");
        fetchUsers();
      } else {
        toast.error(data.error || "Failed to remove user");
      }
    } catch (err) {
      toast.error("Failed to remove user");
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
          <h1 className="text-3xl font-bold">Plex Users</h1>
          <p className="text-muted-foreground">
            Manage Plex server shared users directly from here
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
            Plex Shared Users
          </CardTitle>
          <CardDescription>
            {users.length} users with access to your Plex server
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4 mb-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search users..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.map((plexUser) => (
                  <TableRow key={plexUser.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        {plexUser.thumb ? (
                          <img
                            src={plexUser.thumb}
                            alt={plexUser.username}
                            className="h-8 w-8 rounded-full"
                          />
                        ) : (
                          <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
                            <User className="h-4 w-4" />
                          </div>
                        )}
                        <span className="font-medium">{plexUser.username}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-muted-foreground">{plexUser.email || "N/A"}</span>
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openEditDialog(plexUser.id)}>
                            <Settings className="h-4 w-4 mr-2" />
                            Edit Libraries
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => handleRemoveUser(plexUser.id, plexUser.username)}
                            className="text-destructive"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Remove Access
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
                {filteredUsers.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-muted-foreground">
                      {searchQuery ? "No users match your search" : "No shared users found"}
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
            <DialogTitle>Edit User: {selectedUser?.username}</DialogTitle>
            <DialogDescription>
              Configure library access for this user
            </DialogDescription>
          </DialogHeader>

          {loadingUser ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : selectedUser ? (
            <div className="space-y-6">
              {/* User Info */}
              <div className="flex items-center gap-3 p-3 rounded-lg border">
                {selectedUser.thumb ? (
                  <img
                    src={selectedUser.thumb}
                    alt={selectedUser.username}
                    className="h-12 w-12 rounded-full"
                  />
                ) : (
                  <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
                    <User className="h-6 w-6" />
                  </div>
                )}
                <div>
                  <p className="font-medium">{selectedUser.username}</p>
                  <p className="text-sm text-muted-foreground">{selectedUser.email}</p>
                </div>
              </div>

              {/* Library Access */}
              {libraries.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <FolderOpen className="h-4 w-4" />
                    <p className="font-medium">Library Access</p>
                  </div>
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
