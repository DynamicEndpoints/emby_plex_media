"use client";

import { useEffect, useMemo, useState } from "react";
import { useUser } from "@clerk/nextjs";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Trash2, Plus, Save } from "lucide-react";
import { formatDateTime } from "@/lib/utils";

export default function IptvPlansPage() {
  const { user } = useUser();

  const plans = useQuery(api.iptv.listPlans, { provider: "xtremeui" });
  const upsertPlan = useMutation(api.iptv.adminUpsertPlan);
  const deletePlan = useMutation(api.iptv.adminDeletePlan);

  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [bouquetIdsRaw, setBouquetIdsRaw] = useState("");
  const [selectedBouquetIds, setSelectedBouquetIds] = useState<string[]>([]);
  const [durationDays, setDurationDays] = useState<string>("");
  const [stripePriceId, setStripePriceId] = useState("");

  const [packagesLoading, setPackagesLoading] = useState(false);
  const [packagesError, setPackagesError] = useState<string>("");
  const [packages, setPackages] = useState<Array<{ id: string; name: string; bouquetIds?: string[] }>>([]);

  const resetForm = () => {
    setEditingId(null);
    setName("");
    setDescription("");
    setBouquetIdsRaw("");
    setSelectedBouquetIds([]);
    setDurationDays("");
    setStripePriceId("");
  };

  const manualBouquetIds = useMemo(() => {
    const items = bouquetIdsRaw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    return items.length ? items : undefined;
  }, [bouquetIdsRaw]);

  const bouquetIds = useMemo(() => {
    const combined = new Set<string>([...selectedBouquetIds, ...(manualBouquetIds || [])]);
    const list = Array.from(combined).filter(Boolean);
    return list.length ? list : undefined;
  }, [selectedBouquetIds, manualBouquetIds]);

  const packageMap = useMemo(() => {
    return new Map(packages.map((p) => [p.id, p]));
  }, [packages]);

  const handleEdit = (plan: any) => {
    setEditingId(String(plan._id));
    setName(plan.name || "");
    setDescription(plan.description || "");
    setSelectedBouquetIds((plan.bouquetIds || []).map(String));
    setBouquetIdsRaw("");
    setDurationDays(plan.durationDays ? String(plan.durationDays) : "");
    setStripePriceId(plan.stripePriceId || "");
    setOpen(true);
  };

  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    const fetchPackages = async () => {
      setPackagesLoading(true);
      setPackagesError("");
      try {
        const res = await fetch("/api/iptv/packages", { method: "GET" });
        const data = await res.json();
        if (!res.ok || !data?.success) {
          throw new Error(data?.error || "Failed to fetch packages");
        }
        if (!cancelled) {
          const normalized = Array.isArray(data.packages) ? data.packages : [];
          setPackages(normalized);
        }
      } catch (e) {
        if (!cancelled) {
          setPackagesError(e instanceof Error ? e.message : "Failed to fetch packages");
          setPackages([]);
        }
      } finally {
        if (!cancelled) setPackagesLoading(false);
      }
    };

    fetchPackages();

    return () => {
      cancelled = true;
    };
  }, [open]);

  const handleSave = async () => {
    if (!user) return;
    if (!name.trim()) return;

    const days = durationDays.trim() ? Number(durationDays) : undefined;

    try {
      await upsertPlan({
        adminClerkId: user.id,
        id: editingId ? (editingId as any) : undefined,
        provider: "xtremeui",
        name: name.trim(),
        description: description.trim() || undefined,
        bouquetIds,
        durationDays: Number.isFinite(days as any) ? (days as any) : undefined,
        stripePriceId: stripePriceId.trim() || undefined,
      });

      setOpen(false);
      resetForm();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed to save plan");
    }
  };

  const handleDelete = async (id: string) => {
    if (!user) return;
    if (!confirm("Delete this IPTV plan?")) return;

    try {
      await deletePlan({ adminClerkId: user.id, id: id as any });
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed to delete plan");
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">IPTV Plans</h1>
          <p className="text-muted-foreground">
            Configure packages (bouquets) users can upgrade/downgrade to
          </p>
        </div>

        <Dialog
          open={open}
          onOpenChange={(v) => {
            setOpen(v);
            if (!v) resetForm();
          }}
        >
          <DialogTrigger asChild>
            <Button onClick={() => setOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              New Plan
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingId ? "Edit Plan" : "Create Plan"}</DialogTitle>
              <DialogDescription>
                Plans drive bouquet assignment and self-service upgrades.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input id="name" value={name} onChange={(e) => setName(e.target.value)} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description (optional)</Label>
                <Input
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label>Bouquet Packages</Label>
                <div className="flex flex-wrap gap-2">
                  {selectedBouquetIds.length ? (
                    selectedBouquetIds.map((id) => {
                      const pkg = packageMap.get(id);
                      return (
                        <Badge key={id} variant="outline">
                          {pkg?.name || `ID ${id}`}
                        </Badge>
                      );
                    })
                  ) : (
                    <span className="text-sm text-muted-foreground">No packages selected</span>
                  )}
                </div>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" type="button">
                      Select Packages
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="max-h-64 overflow-auto">
                    <DropdownMenuLabel>Available Packages</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {packagesLoading ? (
                      <DropdownMenuItem disabled>Loading...</DropdownMenuItem>
                    ) : packagesError ? (
                      <DropdownMenuItem disabled>{packagesError}</DropdownMenuItem>
                    ) : packages.length === 0 ? (
                      <DropdownMenuItem disabled>No packages found</DropdownMenuItem>
                    ) : (
                      packages.map((pkg) => (
                        <DropdownMenuCheckboxItem
                          key={pkg.id}
                          checked={selectedBouquetIds.includes(pkg.id)}
                          onCheckedChange={(checked) => {
                            setSelectedBouquetIds((prev) =>
                              checked
                                ? Array.from(new Set([...prev, pkg.id]))
                                : prev.filter((id) => id !== pkg.id)
                            );
                          }}
                        >
                          {pkg.name} <span className="ml-2 text-xs text-muted-foreground">({pkg.id})</span>
                        </DropdownMenuCheckboxItem>
                      ))
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>

                <div className="space-y-2">
                  <Label htmlFor="bouquets">Custom Bouquet IDs (optional)</Label>
                  <Input
                    id="bouquets"
                    value={bouquetIdsRaw}
                    onChange={(e) => setBouquetIdsRaw(e.target.value)}
                    placeholder="1, 2, 7"
                  />
                  <p className="text-xs text-muted-foreground">
                    Use this only if your panel does not return packages from the API.
                  </p>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="durationDays">Duration Days (optional)</Label>
                  <Input
                    id="durationDays"
                    value={durationDays}
                    onChange={(e) => setDurationDays(e.target.value)}
                    placeholder="30"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="stripePriceId">Stripe Price ID (optional)</Label>
                  <Input
                    id="stripePriceId"
                    value={stripePriceId}
                    onChange={(e) => setStripePriceId(e.target.value)}
                    placeholder="price_..."
                  />
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button onClick={handleSave} disabled={!user || !name.trim()}>
                <Save className="mr-2 h-4 w-4" />
                Save
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Plans</CardTitle>
          <CardDescription>{plans?.length ?? 0} plans configured</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Bouquets</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead>Stripe</TableHead>
                <TableHead>Updated</TableHead>
                <TableHead className="w-[140px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(plans || []).map((p: any) => (
                <TableRow key={p._id}>
                  <TableCell>
                    <div className="font-medium">{p.name}</div>
                    {p.description && (
                      <div className="text-xs text-muted-foreground">{p.description}</div>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {(p.bouquetIds || []).length ? (p.bouquetIds || []).join(", ") : "-"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {p.durationDays ? `${p.durationDays} days` : "-"}
                  </TableCell>
                  <TableCell>
                    {p.stripePriceId ? (
                      <Badge variant="outline">{p.stripePriceId}</Badge>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {p.updatedAt ? formatDateTime(p.updatedAt) : "-"}
                  </TableCell>
                  <TableCell className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => handleEdit(p)}>
                      Edit
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleDelete(String(p._id))}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {(!plans || plans.length === 0) && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    No plans yet. Create one to enable user upgrades/downgrades.
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
