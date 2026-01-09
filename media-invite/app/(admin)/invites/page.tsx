"use client";

import { useQuery, useMutation } from "convex/react";
import { useUser } from "@clerk/nextjs";
import { api } from "@/convex/_generated/api";
import { CreateInviteDialog } from "@/components/create-invite-dialog";
import { Button } from "@/components/ui/button";
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
} from "@/components/ui/dropdown-menu";
import { Copy, MoreHorizontal, Ban, RefreshCw, Trash2, Check } from "lucide-react";
import { formatDateTime } from "@/lib/utils";
import { useState } from "react";
import { Id } from "@/convex/_generated/dataModel";

export default function InvitesPage() {
  const { user } = useUser();
  const invites = useQuery(api.invites.list, {});
  const deactivate = useMutation(api.invites.deactivate);
  const reactivate = useMutation(api.invites.reactivate);
  const remove = useMutation(api.invites.remove);

  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const handleCopy = async (code: string) => {
    const url = `${window.location.origin}/invite/${code}`;
    await navigator.clipboard.writeText(url);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const handleDeactivate = async (id: Id<"invites">) => {
    if (!user) return;
    await deactivate({ id, adminId: user.id });
  };

  const handleReactivate = async (id: Id<"invites">) => {
    if (!user) return;
    await reactivate({ id, adminId: user.id });
  };

  const handleDelete = async (id: Id<"invites">) => {
    if (!user) return;
    if (confirm("Are you sure you want to delete this invite?")) {
      await remove({ id, adminId: user.id });
    }
  };

  const getStatusBadge = (invite: any) => {
    if (!invite.isActive) {
      return <Badge variant="secondary">Deactivated</Badge>;
    }
    if (invite.isExpired) {
      return <Badge variant="destructive">Expired</Badge>;
    }
    if (invite.isUsedUp) {
      return <Badge variant="warning">Used Up</Badge>;
    }
    return <Badge variant="success">Active</Badge>;
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Invites</h1>
          <p className="text-muted-foreground">
            Create and manage invite codes
          </p>
        </div>
        <CreateInviteDialog />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Invites</CardTitle>
          <CardDescription>
            {invites?.length ?? 0} total invite codes
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Server</TableHead>
                <TableHead>Uses</TableHead>
                <TableHead>Restricted To</TableHead>
                <TableHead>Expires</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invites?.map((invite) => (
                <TableRow key={invite._id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <code className="font-mono text-sm">{invite.code}</code>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-6 w-6"
                        onClick={() => handleCopy(invite.code)}
                      >
                        {copiedCode === invite.code ? (
                          <Check className="h-3 w-3 text-green-500" />
                        ) : (
                          <Copy className="h-3 w-3" />
                        )}
                      </Button>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {invite.serverType.charAt(0).toUpperCase() +
                        invite.serverType.slice(1)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {invite.usedCount} / {invite.maxUses}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {invite.email || "-"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {invite.expiresAt
                      ? formatDateTime(invite.expiresAt)
                      : "Never"}
                  </TableCell>
                  <TableCell>{getStatusBadge(invite)}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDateTime(invite.createdAt)}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleCopy(invite.code)}>
                          <Copy className="mr-2 h-4 w-4" />
                          Copy Link
                        </DropdownMenuItem>
                        {invite.isActive ? (
                          <DropdownMenuItem
                            onClick={() => handleDeactivate(invite._id)}
                          >
                            <Ban className="mr-2 h-4 w-4" />
                            Deactivate
                          </DropdownMenuItem>
                        ) : (
                          <DropdownMenuItem
                            onClick={() => handleReactivate(invite._id)}
                          >
                            <RefreshCw className="mr-2 h-4 w-4" />
                            Reactivate
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem
                          onClick={() => handleDelete(invite._id)}
                          className="text-destructive"
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
              {(!invites || invites.length === 0) && (
                <TableRow>
                  <TableCell
                    colSpan={8}
                    className="text-center text-muted-foreground py-8"
                  >
                    No invites yet. Create your first invite to get started.
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
