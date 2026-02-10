"use client";

import { useState, useEffect } from "react";
import { useMutation } from "convex/react";
import { useUser } from "@clerk/nextjs";
import { api } from "@/convex/_generated/api";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Loader2, Copy, Check, FolderOpen, Tv } from "lucide-react";

interface Library {
  id: string;
  name: string;
  type: string;
}

interface Feature {
  id: string;
  name: string;
  type: string;
  description: string;
}

export function CreateInviteDialog() {
  const { user } = useUser();
  const [open, setOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [createdCode, setCreatedCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Libraries state
  const [embyLibraries, setEmbyLibraries] = useState<Library[]>([]);
  const [embyFeatures, setEmbyFeatures] = useState<Feature[]>([]);
  const [loadingLibraries, setLoadingLibraries] = useState(false);
  const [selectedLibraries, setSelectedLibraries] = useState<string[]>([]);
  const [selectedFeatures, setSelectedFeatures] = useState<string[]>([]);

  // Form state
  const [email, setEmail] = useState("");
  const [maxUses, setMaxUses] = useState("1");
  const [serverType, setServerType] = useState<"plex" | "emby" | "both">("emby");
  const [expiresIn, setExpiresIn] = useState("never");
  const [notes, setNotes] = useState("");
  const [requiresPayment, setRequiresPayment] = useState(true);

  const createInvite = useMutation(api.invites.create);

  // Fetch libraries when dialog opens or server type changes
  useEffect(() => {
    if (open && (serverType === "emby" || serverType === "both")) {
      fetchEmbyLibraries();
    }
  }, [open, serverType]);

  const fetchEmbyLibraries = async () => {
    setLoadingLibraries(true);
    try {
      const response = await fetch("/api/emby/libraries");
      const data = await response.json();
      if (data.success) {
        setEmbyLibraries(data.libraries);
        setEmbyFeatures(data.features || []);
        // Select all libraries by default
        setSelectedLibraries(data.libraries.map((l: Library) => l.id));
        // Don't select features by default
        setSelectedFeatures([]);
      }
    } catch (error) {
      console.error("Failed to fetch libraries:", error);
    } finally {
      setLoadingLibraries(false);
    }
  };

  const toggleLibrary = (id: string) => {
    setSelectedLibraries(prev => 
      prev.includes(id) 
        ? prev.filter(l => l !== id)
        : [...prev, id]
    );
  };

  const toggleFeature = (id: string) => {
    setSelectedFeatures(prev => 
      prev.includes(id) 
        ? prev.filter(f => f !== id)
        : [...prev, id]
    );
  };

  const selectAllLibraries = () => {
    setSelectedLibraries(embyLibraries.map(l => l.id));
  };

  const deselectAllLibraries = () => {
    setSelectedLibraries([]);
  };

  const handleCreate = async () => {
    if (!user) return;

    setIsCreating(true);
    try {
      // Calculate expiration
      let expiresAt: number | undefined;
      if (expiresIn !== "never") {
        const hours = parseInt(expiresIn);
        expiresAt = Date.now() + hours * 60 * 60 * 1000;
      }

      const result = await createInvite({
        email: email || undefined,
        maxUses: parseInt(maxUses),
        expiresAt,
        serverType,
        libraries: [...selectedLibraries, ...selectedFeatures].length > 0 
          ? [...selectedLibraries, ...selectedFeatures] 
          : undefined,
        notes: notes || undefined,
        requiresPayment,
        createdBy: user.id,
      });

      setCreatedCode(result.code);
    } catch (error) {
      console.error("Failed to create invite:", error);
    } finally {
      setIsCreating(false);
    }
  };

  const handleCopy = async () => {
    if (!createdCode) return;
    const url = `${window.location.origin}/invite/${createdCode}`;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleClose = () => {
    setOpen(false);
    // Reset form after dialog closes
    setTimeout(() => {
      setCreatedCode(null);
      setEmail("");
      setMaxUses("1");
      setServerType("emby");
      setExpiresIn("never");
      setNotes("");
      setRequiresPayment(true);
      setCopied(false);
      setSelectedLibraries([]);
      setSelectedFeatures([]);
    }, 200);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Create Invite
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        {createdCode ? (
          <>
            <DialogHeader>
              <DialogTitle>Invite Created! 🎉</DialogTitle>
              <DialogDescription>
                Share this link with the person you want to invite.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="flex items-center gap-2">
                <Input
                  value={`${typeof window !== "undefined" ? window.location.origin : ""}/invite/${createdCode}`}
                  readOnly
                  className="font-mono text-sm"
                />
                <Button size="icon" variant="outline" onClick={handleCopy}>
                  {copied ? (
                    <Check className="h-4 w-4 text-green-500" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
              <p className="text-sm text-muted-foreground">
                Invite code: <span className="font-mono font-bold">{createdCode}</span>
              </p>
            </div>
            <DialogFooter>
              <Button onClick={handleClose}>Done</Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Create New Invite</DialogTitle>
              <DialogDescription>
                Generate an invite code to share with someone.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="email">Restrict to Email (optional)</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="user@example.com"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="maxUses">Max Uses</Label>
                  <Select value={maxUses} onValueChange={setMaxUses}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">1 use</SelectItem>
                      <SelectItem value="5">5 uses</SelectItem>
                      <SelectItem value="10">10 uses</SelectItem>
                      <SelectItem value="25">25 uses</SelectItem>
                      <SelectItem value="100">100 uses</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="serverType">Server</Label>
                  <Select
                    value={serverType}
                    onValueChange={(v) => setServerType(v as typeof serverType)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="plex">Plex</SelectItem>
                      <SelectItem value="emby">Emby</SelectItem>
                      <SelectItem value="both">Both</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="expires">Expires</Label>
                <Select value={expiresIn} onValueChange={setExpiresIn}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="never">Never</SelectItem>
                    <SelectItem value="24">24 hours</SelectItem>
                    <SelectItem value="72">3 days</SelectItem>
                    <SelectItem value="168">1 week</SelectItem>
                    <SelectItem value="720">30 days</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Notes (optional)</Label>
                <Input
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g., Friend from work"
                />
              </div>

              <div className="flex items-center justify-between rounded-lg border p-3">
                <div className="space-y-0.5">
                  <Label>Require Subscription</Label>
                  <p className="text-xs text-muted-foreground">
                    When enabled, the invite can only be redeemed by users with an active subscription.
                  </p>
                </div>
                <Checkbox
                  checked={requiresPayment}
                  onCheckedChange={(v) => setRequiresPayment(v === true)}
                />
              </div>

              {/* Library Selection */}
              {(serverType === "emby" || serverType === "both") && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="flex items-center gap-2">
                      <FolderOpen className="h-4 w-4" />
                      Libraries to Share
                    </Label>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={selectAllLibraries}
                        className="text-xs h-7"
                      >
                        All
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={deselectAllLibraries}
                        className="text-xs h-7"
                      >
                        None
                      </Button>
                    </div>
                  </div>
                  {loadingLibraries ? (
                    <div className="flex items-center justify-center py-4">
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                      <span className="ml-2 text-sm text-muted-foreground">Loading libraries...</span>
                    </div>
                  ) : embyLibraries.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-2">
                      No libraries found. Configure Emby in Settings.
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {/* Features like LiveTV */}
                      {embyFeatures.length > 0 && (
                        <div className="border rounded-md p-2 bg-muted/30">
                          <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
                            <Tv className="h-3 w-3" />
                            Special Features
                          </p>
                          <div className="space-y-1">
                            {embyFeatures.map((feature) => (
                              <label
                                key={feature.id}
                                className={`flex items-center gap-2 p-2 rounded-md cursor-pointer hover:bg-muted transition-colors ${
                                  selectedFeatures.includes(feature.id) ? "bg-muted" : ""
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={selectedFeatures.includes(feature.id)}
                                  onChange={() => toggleFeature(feature.id)}
                                  className="rounded border-gray-300"
                                />
                                <div>
                                  <span className="text-sm font-medium">{feature.name}</span>
                                  <p className="text-xs text-muted-foreground">{feature.description}</p>
                                </div>
                              </label>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      {/* Regular Libraries */}
                      <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto border rounded-md p-2">
                        {embyLibraries.map((library) => (
                          <label
                            key={library.id}
                            className={`flex items-center gap-2 p-2 rounded-md cursor-pointer hover:bg-muted transition-colors ${
                              selectedLibraries.includes(library.id) ? "bg-muted" : ""
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={selectedLibraries.includes(library.id)}
                              onChange={() => toggleLibrary(library.id)}
                              className="rounded border-gray-300"
                            />
                            <span className="text-sm truncate">{library.name}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground">
                    {selectedLibraries.length} of {embyLibraries.length} libraries selected
                  </p>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreate} disabled={isCreating}>
                {isCreating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  "Create Invite"
                )}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
