"use client";

import { useState } from "react";
import { useUser } from "@clerk/nextjs";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Plus, Copy, Check, Users, Gift, XCircle } from "lucide-react";
import { formatDateTime, timeAgo } from "@/lib/utils";

export default function MyFriendCodesPage() {
  const { user: clerkUser, isLoaded } = useUser();
  const [createOpen, setCreateOpen] = useState(false);
  const [maxUses, setMaxUses] = useState("1");
  const [expiresIn, setExpiresIn] = useState("7");
  const [isCreating, setIsCreating] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [newlyCreatedCode, setNewlyCreatedCode] = useState<string | null>(null);

  const canGenerate = useQuery(
    api.friendCodes.canGenerateCodes,
    clerkUser?.id ? { clerkId: clerkUser.id } : "skip"
  );

  const myCodes = useQuery(
    api.friendCodes.listByUser,
    clerkUser?.id ? { clerkId: clerkUser.id } : "skip"
  );

  const generateCode = useMutation(api.friendCodes.generate);
  const deactivateCode = useMutation(api.friendCodes.deactivate);

  const handleCreate = async () => {
    if (!clerkUser) return;
    setIsCreating(true);

    try {
      const result = await generateCode({
        clerkId: clerkUser.id,
        email: clerkUser.emailAddresses[0]?.emailAddress || "",
        maxUses: parseInt(maxUses),
        expiresInDays: expiresIn === "never" ? undefined : parseInt(expiresIn),
      });

      setNewlyCreatedCode(result.code);
      setCreateOpen(false);
      setMaxUses("1");
      setExpiresIn("7");
    } catch (error) {
      console.error("Failed to create code:", error);
    } finally {
      setIsCreating(false);
    }
  };

  const handleCopy = async (code: string) => {
    await navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const handleDeactivate = async (codeId: any) => {
    if (!clerkUser) return;
    await deactivateCode({ codeId, clerkId: clerkUser.id });
  };

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const getCodeStatus = (code: any) => {
    if (!code.isActive) return { label: "Deactivated", variant: "secondary" as const };
    if (code.expiresAt && code.expiresAt < Date.now()) return { label: "Expired", variant: "destructive" as const };
    if (code.usedCount >= code.maxUses) return { label: "Used Up", variant: "secondary" as const };
    return { label: "Active", variant: "success" as const };
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Friend Codes</h1>
        <p className="text-muted-foreground">
          Share codes with friends to give them access to the media server
        </p>
      </div>

      {/* Can't generate notice */}
      {canGenerate && !canGenerate.canGenerate && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4 text-muted-foreground">
              <XCircle className="h-8 w-8" />
              <div>
                <p className="font-medium">Cannot Generate Friend Codes</p>
                <p className="text-sm">{canGenerate.reason}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Newly created code highlight */}
      {newlyCreatedCode && (
        <Card className="border-green-500 bg-green-50 dark:bg-green-950/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-green-700 dark:text-green-400">
              <Gift className="h-5 w-5" />
              Code Created!
            </CardTitle>
            <CardDescription>Share this code with your friend</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <code className="text-2xl font-mono font-bold tracking-wider">
                {newlyCreatedCode}
              </code>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleCopy(newlyCreatedCode)}
              >
                {copiedCode === newlyCreatedCode ? (
                  <Check className="h-4 w-4 text-green-500" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setNewlyCreatedCode(null)}
              >
                Dismiss
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats & Create */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">
              {myCodes?.filter((c) => c.isActive).length || 0} active codes
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Gift className="h-5 w-5 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">
              {myCodes?.reduce((sum, c) => sum + c.usedCount, 0) || 0} friends invited
            </span>
          </div>
        </div>

        {canGenerate?.canGenerate && (
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Create Friend Code
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Friend Code</DialogTitle>
                <DialogDescription>
                  Generate a code that your friends can use to sign up
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Maximum Uses</Label>
                  <Select value={maxUses} onValueChange={setMaxUses}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">1 use (single friend)</SelectItem>
                      <SelectItem value="3">3 uses</SelectItem>
                      <SelectItem value="5">5 uses</SelectItem>
                      <SelectItem value="10">10 uses</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Expires In</Label>
                  <Select value={expiresIn} onValueChange={setExpiresIn}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">1 day</SelectItem>
                      <SelectItem value="7">7 days</SelectItem>
                      <SelectItem value="30">30 days</SelectItem>
                      <SelectItem value="90">90 days</SelectItem>
                      <SelectItem value="never">Never</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setCreateOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleCreate} disabled={isCreating}>
                  {isCreating ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Gift className="mr-2 h-4 w-4" />
                  )}
                  Generate Code
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Codes List */}
      <Card>
        <CardHeader>
          <CardTitle>Your Friend Codes</CardTitle>
          <CardDescription>
            Codes you&apos;ve created to share with friends
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Uses</TableHead>
                <TableHead>Expires</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="w-[100px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {myCodes?.map((code) => {
                const status = getCodeStatus(code);
                return (
                  <TableRow key={code._id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <code className="font-mono font-bold">{code.code}</code>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => handleCopy(code.code)}
                        >
                          {copiedCode === code.code ? (
                            <Check className="h-3 w-3 text-green-500" />
                          ) : (
                            <Copy className="h-3 w-3" />
                          )}
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={status.variant}>{status.label}</Badge>
                    </TableCell>
                    <TableCell>
                      {code.usedCount} / {code.maxUses}
                    </TableCell>
                    <TableCell>
                      {code.expiresAt ? (
                        code.expiresAt < Date.now() ? (
                          <span className="text-destructive">Expired</span>
                        ) : (
                          timeAgo(code.expiresAt)
                        )
                      ) : (
                        "Never"
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {timeAgo(code.createdAt)}
                    </TableCell>
                    <TableCell>
                      {code.isActive && code.usedCount < code.maxUses && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeactivate(code._id)}
                        >
                          Deactivate
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
              {(!myCodes || myCodes.length === 0) && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    No friend codes yet. Create one to invite friends!
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
