"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { useUser } from "@clerk/nextjs";
import { api } from "@/convex/_generated/api";
import { SETTINGS_KEYS } from "@/lib/constants";
import { useAdminCheck } from "@/hooks/use-role-check";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { Loader2, Save, Eye, EyeOff, CheckCircle, XCircle, Shield, UserPlus, Trash2 } from "lucide-react";
import { toast } from "sonner";

export default function SettingsPage() {
  const { user } = useUser();
  const { isOwner } = useAdminCheck();
  const settings = useQuery(api.settings.getAll);
  const setSettings = useMutation(api.settings.setMany);
  
  // Admin management
  const adminList = useQuery(api.admins.list);
  const addAdmin = useMutation(api.admins.add);
  const removeAdmin = useMutation(api.admins.remove);

  const [isSaving, setIsSaving] = useState(false);
  const [showPlexToken, setShowPlexToken] = useState(false);
  const [showEmbyKey, setShowEmbyKey] = useState(false);
  const [showXtremeUiKey, setShowXtremeUiKey] = useState(false);
  const [showWebhookSecret, setShowWebhookSecret] = useState(false);
  const [showSmtpPass, setShowSmtpPass] = useState(false);
  
  // Add admin dialog state
  const [addAdminOpen, setAddAdminOpen] = useState(false);
  const [newAdminEmail, setNewAdminEmail] = useState("");
  const [newAdminName, setNewAdminName] = useState("");
  const [newAdminClerkId, setNewAdminClerkId] = useState("");
  const [isAddingAdmin, setIsAddingAdmin] = useState(false);
  const [adminToDelete, setAdminToDelete] = useState<string | null>(null);

  // Form state
  const [plexUrl, setPlexUrl] = useState("");
  const [plexToken, setPlexToken] = useState("");
  const [embyUrl, setEmbyUrl] = useState("");
  const [embyApiKey, setEmbyApiKey] = useState("");
  const [xtremeUiUrl, setXtremeUiUrl] = useState("");
  const [xtremeUiApiKey, setXtremeUiApiKey] = useState("");
  const [xtremeUiStreamBaseUrl, setXtremeUiStreamBaseUrl] = useState("");
  const [webhookUrl, setWebhookUrl] = useState("");
  const [webhookSecret, setWebhookSecret] = useState("");
  
  // SMTP settings
  const [smtpHost, setSmtpHost] = useState("");
  const [smtpPort, setSmtpPort] = useState("587");
  const [smtpSecure, setSmtpSecure] = useState(false);
  const [smtpUser, setSmtpUser] = useState("");
  const [smtpPass, setSmtpPass] = useState("");
  const [emailFrom, setEmailFrom] = useState("");
  const [emailFromName, setEmailFromName] = useState("");

  // Connection test states
  const [plexStatus, setPlexStatus] = useState<"idle" | "testing" | "success" | "error">("idle");
  const [embyStatus, setEmbyStatus] = useState<"idle" | "testing" | "success" | "error">("idle");
  const [xtremeUiStatus, setXtremeUiStatus] = useState<"idle" | "testing" | "success" | "error">("idle");
  const [smtpStatus, setSmtpStatus] = useState<"idle" | "testing" | "success" | "error">("idle");
  const [xtremeUiError, setXtremeUiError] = useState<string>("");
  const [xtremeUiHint, setXtremeUiHint] = useState<string>("");

  // Load settings from Convex database
  useEffect(() => {
    if (settings) {
      setPlexUrl(settings[SETTINGS_KEYS.PLEX_URL] || "");
      setPlexToken(settings[SETTINGS_KEYS.PLEX_TOKEN] || "");
      setEmbyUrl(settings[SETTINGS_KEYS.EMBY_URL] || "");
      setEmbyApiKey(settings[SETTINGS_KEYS.EMBY_API_KEY] || "");
      setXtremeUiUrl(settings[SETTINGS_KEYS.XTREME_UI_URL] || "");
      setXtremeUiApiKey(settings[SETTINGS_KEYS.XTREME_UI_API_KEY] || "");
      setXtremeUiStreamBaseUrl(settings[SETTINGS_KEYS.XTREME_UI_STREAM_BASE_URL] || "");
      setWebhookUrl(settings[SETTINGS_KEYS.WEBHOOK_URL] || "");
      setWebhookSecret(settings[SETTINGS_KEYS.WEBHOOK_SECRET] || "");
      setSmtpHost(settings[SETTINGS_KEYS.SMTP_HOST] || "");
      setSmtpPort(settings[SETTINGS_KEYS.SMTP_PORT] || "587");
      setSmtpSecure(settings[SETTINGS_KEYS.SMTP_SECURE] === "true");
      setSmtpUser(settings[SETTINGS_KEYS.SMTP_USER] || "");
      setSmtpPass(settings[SETTINGS_KEYS.SMTP_PASS] || "");
      setEmailFrom(settings[SETTINGS_KEYS.EMAIL_FROM] || "");
      setEmailFromName(settings[SETTINGS_KEYS.EMAIL_FROM_NAME] || "");
    }
  }, [settings]);

  const handleSavePlex = async () => {
    if (!user) return;
    setIsSaving(true);
    try {
      await setSettings({
        settings: [
          { key: SETTINGS_KEYS.PLEX_URL, value: plexUrl },
          { key: SETTINGS_KEYS.PLEX_TOKEN, value: plexToken },
        ],
        adminId: user.id,
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveEmby = async () => {
    if (!user) return;
    setIsSaving(true);
    try {
      await setSettings({
        settings: [
          { key: SETTINGS_KEYS.EMBY_URL, value: embyUrl },
          { key: SETTINGS_KEYS.EMBY_API_KEY, value: embyApiKey },
        ],
        adminId: user.id,
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveXtremeUi = async () => {
    if (!user) return;
    setIsSaving(true);
    try {
      await setSettings({
        settings: [
          { key: SETTINGS_KEYS.XTREME_UI_URL, value: xtremeUiUrl },
          { key: SETTINGS_KEYS.XTREME_UI_API_KEY, value: xtremeUiApiKey },
          { key: SETTINGS_KEYS.XTREME_UI_STREAM_BASE_URL, value: xtremeUiStreamBaseUrl },
        ],
        adminId: user.id,
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveWebhook = async () => {
    if (!user) return;
    setIsSaving(true);
    try {
      await setSettings({
        settings: [
          { key: SETTINGS_KEYS.WEBHOOK_URL, value: webhookUrl },
          { key: SETTINGS_KEYS.WEBHOOK_SECRET, value: webhookSecret },
        ],
        adminId: user.id,
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveEmail = async () => {
    if (!user) return;
    setIsSaving(true);
    try {
      await setSettings({
        settings: [
          { key: SETTINGS_KEYS.SMTP_HOST, value: smtpHost },
          { key: SETTINGS_KEYS.SMTP_PORT, value: smtpPort },
          { key: SETTINGS_KEYS.SMTP_SECURE, value: smtpSecure.toString() },
          { key: SETTINGS_KEYS.SMTP_USER, value: smtpUser },
          { key: SETTINGS_KEYS.SMTP_PASS, value: smtpPass },
          { key: SETTINGS_KEYS.EMAIL_FROM, value: emailFrom },
          { key: SETTINGS_KEYS.EMAIL_FROM_NAME, value: emailFromName },
        ],
        adminId: user.id,
      });
    } finally {
      setIsSaving(false);
    }
  };

  const testPlexConnection = async () => {
    setPlexStatus("testing");
    try {
      const response = await fetch("/api/test-plex", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: plexUrl, token: plexToken }),
      });
      const data = await response.json();
      setPlexStatus(data.success ? "success" : "error");
    } catch {
      setPlexStatus("error");
    }
  };

  const testEmbyConnection = async () => {
    setEmbyStatus("testing");
    try {
      const response = await fetch("/api/test-emby", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: embyUrl, apiKey: embyApiKey }),
      });
      const data = await response.json();
      setEmbyStatus(data.success ? "success" : "error");
    } catch {
      setEmbyStatus("error");
    }
  };

  const testXtremeUiConnection = async () => {
    setXtremeUiStatus("testing");
    setXtremeUiError("");
    setXtremeUiHint("");
    try {
      const response = await fetch("/api/test-xtremeui", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: xtremeUiUrl,
          apiKey: xtremeUiApiKey,
          streamBaseUrl: xtremeUiStreamBaseUrl,
        }),
      });
      const data = await response.json();
      setXtremeUiStatus(data.success ? "success" : "error");
      if (data.success) {
        toast.success("Xtreme UI connection successful");
      } else {
        const msg = data.error || "Xtreme UI connection failed";
        setXtremeUiError(msg);
        if (typeof data.hint === "string" && data.hint) {
          setXtremeUiHint(data.hint);
        }
        toast.error(msg);
      }
    } catch {
      setXtremeUiStatus("error");
      setXtremeUiError("Request failed");
      toast.error("Xtreme UI connection test failed");
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="text-muted-foreground">
          Configure your media servers and integrations
        </p>
      </div>

      <Tabs defaultValue="plex" className="space-y-4">
        <TabsList>
          <TabsTrigger value="plex">Plex</TabsTrigger>
          <TabsTrigger value="emby">Emby</TabsTrigger>
          <TabsTrigger value="xtremeui">Xtreme UI</TabsTrigger>
          <TabsTrigger value="webhooks">Webhooks</TabsTrigger>
          <TabsTrigger value="email">Email</TabsTrigger>
          {isOwner && <TabsTrigger value="admins">Admins</TabsTrigger>}
        </TabsList>

        <TabsContent value="plex">
          <Card>
            <CardHeader>
              <CardTitle>Plex Configuration</CardTitle>
              <CardDescription>
                Connect your Plex Media Server to automatically invite users
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="plexUrl">Server URL</Label>
                <Input
                  id="plexUrl"
                  value={plexUrl}
                  onChange={(e) => setPlexUrl(e.target.value)}
                  placeholder="http://localhost:32400"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="plexToken">Plex Token</Label>
                <div className="flex gap-2">
                  <Input
                    id="plexToken"
                    type={showPlexToken ? "text" : "password"}
                    value={plexToken}
                    onChange={(e) => setPlexToken(e.target.value)}
                    placeholder="Your Plex token"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setShowPlexToken(!showPlexToken)}
                  >
                    {showPlexToken ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Find your token at app.plex.tv → Settings → Account → XML
                </p>
              </div>

              <div className="flex items-center gap-4">
                <Button onClick={handleSavePlex} disabled={isSaving}>
                  {isSaving ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="mr-2 h-4 w-4" />
                  )}
                  Save
                </Button>
                <Button
                  variant="outline"
                  onClick={testPlexConnection}
                  disabled={!plexUrl || !plexToken || plexStatus === "testing"}
                >
                  {plexStatus === "testing" ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : plexStatus === "success" ? (
                    <CheckCircle className="mr-2 h-4 w-4 text-green-500" />
                  ) : plexStatus === "error" ? (
                    <XCircle className="mr-2 h-4 w-4 text-red-500" />
                  ) : null}
                  Test Connection
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="emby">
          <Card>
            <CardHeader>
              <CardTitle>Emby Configuration</CardTitle>
              <CardDescription>
                Connect your Emby Media Server to automatically create users
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="embyUrl">Server URL</Label>
                <Input
                  id="embyUrl"
                  value={embyUrl}
                  onChange={(e) => setEmbyUrl(e.target.value)}
                  placeholder="http://localhost:8096"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="embyApiKey">API Key</Label>
                <div className="flex gap-2">
                  <Input
                    id="embyApiKey"
                    type={showEmbyKey ? "text" : "password"}
                    value={embyApiKey}
                    onChange={(e) => setEmbyApiKey(e.target.value)}
                    placeholder="Your Emby API key"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setShowEmbyKey(!showEmbyKey)}
                  >
                    {showEmbyKey ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Generate an API key in Emby Dashboard → Advanced → API Keys
                </p>
              </div>

              <div className="flex items-center gap-4">
                <Button onClick={handleSaveEmby} disabled={isSaving}>
                  {isSaving ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="mr-2 h-4 w-4" />
                  )}
                  Save
                </Button>
                <Button
                  variant="outline"
                  onClick={testEmbyConnection}
                  disabled={!embyUrl || !embyApiKey || embyStatus === "testing"}
                >
                  {embyStatus === "testing" ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : embyStatus === "success" ? (
                    <CheckCircle className="mr-2 h-4 w-4 text-green-500" />
                  ) : embyStatus === "error" ? (
                    <XCircle className="mr-2 h-4 w-4 text-red-500" />
                  ) : null}
                  Test Connection
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="xtremeui">
          <Card>
            <CardHeader>
              <CardTitle>Xtreme UI Configuration</CardTitle>
              <CardDescription>
                Configure your IPTV panel integration (used for line creation, renewals, and self-service)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="xtremeUiUrl">Panel URL</Label>
                <Input
                  id="xtremeUiUrl"
                  value={xtremeUiUrl}
                  onChange={(e) => setXtremeUiUrl(e.target.value)}
                  placeholder="https://your-panel.example"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="xtremeUiStreamBaseUrl">Stream Base URL</Label>
                <Input
                  id="xtremeUiStreamBaseUrl"
                  value={xtremeUiStreamBaseUrl}
                  onChange={(e) => setXtremeUiStreamBaseUrl(e.target.value)}
                  placeholder="https://your-stream.example"
                />
                <p className="text-xs text-muted-foreground">
                  Optional. Used to generate M3U URLs (defaults to Panel URL if empty).
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="xtremeUiApiKey">API Key</Label>
                <div className="flex gap-2">
                  <Input
                    id="xtremeUiApiKey"
                    type={showXtremeUiKey ? "text" : "password"}
                    value={xtremeUiApiKey}
                    onChange={(e) => setXtremeUiApiKey(e.target.value)}
                    placeholder="Your panel API key"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setShowXtremeUiKey(!showXtremeUiKey)}
                  >
                    {showXtremeUiKey ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Button onClick={handleSaveXtremeUi} disabled={isSaving}>
                  {isSaving ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="mr-2 h-4 w-4" />
                  )}
                  Save
                </Button>

                <Button
                  variant="outline"
                  onClick={testXtremeUiConnection}
                  disabled={!xtremeUiUrl || !xtremeUiApiKey || xtremeUiStatus === "testing"}
                >
                  {xtremeUiStatus === "testing" ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : xtremeUiStatus === "success" ? (
                    <CheckCircle className="mr-2 h-4 w-4 text-green-500" />
                  ) : xtremeUiStatus === "error" ? (
                    <XCircle className="mr-2 h-4 w-4 text-red-500" />
                  ) : null}
                  Test Connection
                </Button>
              </div>

              {xtremeUiStatus === "error" && xtremeUiError ? (
                <div className="space-y-1">
                  <p className="text-sm text-red-600">{xtremeUiError}</p>
                  {xtremeUiHint ? (
                    <p className="text-sm text-muted-foreground">{xtremeUiHint}</p>
                  ) : null}
                </div>
              ) : null}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="webhooks">
          <Card>
            <CardHeader>
              <CardTitle>Webhook Configuration</CardTitle>
              <CardDescription>
                Send notifications to external services when events occur
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="webhookUrl">Webhook URL</Label>
                <Input
                  id="webhookUrl"
                  value={webhookUrl}
                  onChange={(e) => setWebhookUrl(e.target.value)}
                  placeholder="https://your-webhook-endpoint.com/webhook"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="webhookSecret">Webhook Secret (optional)</Label>
                <div className="flex gap-2">
                  <Input
                    id="webhookSecret"
                    type={showWebhookSecret ? "text" : "password"}
                    value={webhookSecret}
                    onChange={(e) => setWebhookSecret(e.target.value)}
                    placeholder="Secret for signing webhooks"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setShowWebhookSecret(!showWebhookSecret)}
                  >
                    {showWebhookSecret ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Used to sign webhook payloads for verification
                </p>
              </div>

              <Button onClick={handleSaveWebhook} disabled={isSaving}>
                {isSaving ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Save className="mr-2 h-4 w-4" />
                )}
                Save
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="email">
          <Card>
            <CardHeader>
              <CardTitle>SMTP Configuration</CardTitle>
              <CardDescription>
                Configure your SMTP server for sending email notifications
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="smtpHost">SMTP Host</Label>
                  <Input
                    id="smtpHost"
                    value={smtpHost}
                    onChange={(e) => setSmtpHost(e.target.value)}
                    placeholder="smtp.yourdomain.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="smtpPort">Port</Label>
                  <Input
                    id="smtpPort"
                    value={smtpPort}
                    onChange={(e) => setSmtpPort(e.target.value)}
                    placeholder="587"
                  />
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="smtpSecure"
                  checked={smtpSecure}
                  onChange={(e) => setSmtpSecure(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300"
                />
                <Label htmlFor="smtpSecure">Use SSL/TLS (port 465)</Label>
              </div>

              <div className="space-y-2">
                <Label htmlFor="smtpUser">Username</Label>
                <Input
                  id="smtpUser"
                  value={smtpUser}
                  onChange={(e) => setSmtpUser(e.target.value)}
                  placeholder="your-smtp-username"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="smtpPass">Password</Label>
                <div className="flex gap-2">
                  <Input
                    id="smtpPass"
                    type={showSmtpPass ? "text" : "password"}
                    value={smtpPass}
                    onChange={(e) => setSmtpPass(e.target.value)}
                    placeholder="your-smtp-password"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setShowSmtpPass(!showSmtpPass)}
                  >
                    {showSmtpPass ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="emailFrom">From Email</Label>
                  <Input
                    id="emailFrom"
                    type="email"
                    value={emailFrom}
                    onChange={(e) => setEmailFrom(e.target.value)}
                    placeholder="invites@yourdomain.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="emailFromName">From Name (optional)</Label>
                  <Input
                    id="emailFromName"
                    value={emailFromName}
                    onChange={(e) => setEmailFromName(e.target.value)}
                    placeholder="Media Invite"
                  />
                </div>
              </div>

              <div className="flex items-center gap-4">
                <Button onClick={handleSaveEmail} disabled={isSaving}>
                  {isSaving ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="mr-2 h-4 w-4" />
                  )}
                  Save
                </Button>
                <Button
                  variant="outline"
                  onClick={async () => {
                    setSmtpStatus("testing");
                    try {
                      // Test SMTP by calling an API route
                      const res = await fetch("/api/test-smtp", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          host: smtpHost,
                          port: parseInt(smtpPort),
                          secure: smtpSecure,
                          user: smtpUser,
                          pass: smtpPass,
                        }),
                      });
                      setSmtpStatus(res.ok ? "success" : "error");
                    } catch {
                      setSmtpStatus("error");
                    }
                  }}
                  disabled={!smtpHost || !smtpUser || smtpStatus === "testing"}
                >
                  {smtpStatus === "testing" ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : smtpStatus === "success" ? (
                    <CheckCircle className="mr-2 h-4 w-4 text-green-500" />
                  ) : smtpStatus === "error" ? (
                    <XCircle className="mr-2 h-4 w-4 text-red-500" />
                  ) : null}
                  Test Connection
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Admins Tab - Only visible to owners */}
        {isOwner && (
          <TabsContent value="admins">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Administrator Management</CardTitle>
                    <CardDescription>
                      Manage who has administrative access to Media Invite
                    </CardDescription>
                  </div>
                  <Dialog open={addAdminOpen} onOpenChange={setAddAdminOpen}>
                    <DialogTrigger asChild>
                      <Button>
                        <UserPlus className="mr-2 h-4 w-4" />
                        Add Admin
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Add New Administrator</DialogTitle>
                        <DialogDescription>
                          Add a new administrator. They must have an account on this system.
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4 py-4">
                        <div className="space-y-2">
                          <Label htmlFor="newAdminClerkId">Clerk User ID</Label>
                          <Input
                            id="newAdminClerkId"
                            placeholder="user_..."
                            value={newAdminClerkId}
                            onChange={(e) => setNewAdminClerkId(e.target.value)}
                          />
                          <p className="text-xs text-muted-foreground">
                            The Clerk user ID of the person to make admin
                          </p>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="newAdminEmail">Email</Label>
                          <Input
                            id="newAdminEmail"
                            type="email"
                            placeholder="admin@example.com"
                            value={newAdminEmail}
                            onChange={(e) => setNewAdminEmail(e.target.value)}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="newAdminName">Display Name</Label>
                          <Input
                            id="newAdminName"
                            placeholder="John Doe"
                            value={newAdminName}
                            onChange={(e) => setNewAdminName(e.target.value)}
                          />
                        </div>
                      </div>
                      <DialogFooter>
                        <Button
                          variant="outline"
                          onClick={() => setAddAdminOpen(false)}
                        >
                          Cancel
                        </Button>
                        <Button
                          onClick={async () => {
                            if (!user || !newAdminClerkId || !newAdminEmail) return;
                            setIsAddingAdmin(true);
                            try {
                              await addAdmin({
                                clerkId: newAdminClerkId,
                                email: newAdminEmail,
                                name: newAdminName || newAdminEmail,
                                role: "admin",
                                addedBy: user.id,
                              });
                              setAddAdminOpen(false);
                              setNewAdminClerkId("");
                              setNewAdminEmail("");
                              setNewAdminName("");
                            } catch (error) {
                              console.error("Failed to add admin:", error);
                            } finally {
                              setIsAddingAdmin(false);
                            }
                          }}
                          disabled={!newAdminClerkId || !newAdminEmail || isAddingAdmin}
                        >
                          {isAddingAdmin ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          ) : (
                            <Shield className="mr-2 h-4 w-4" />
                          )}
                          Add Administrator
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Added</TableHead>
                      <TableHead className="w-[100px]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {adminList?.map((admin) => (
                      <TableRow key={admin._id}>
                        <TableCell className="font-medium">
                          {admin.name}
                          {admin.clerkId === user?.id && (
                            <span className="ml-2 text-xs text-muted-foreground">(you)</span>
                          )}
                        </TableCell>
                        <TableCell>{admin.email}</TableCell>
                        <TableCell>
                          <Badge variant={admin.role === "owner" ? "default" : "secondary"}>
                            {admin.role === "owner" ? (
                              <>
                                <Shield className="mr-1 h-3 w-3" />
                                Owner
                              </>
                            ) : (
                              "Admin"
                            )}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {new Date(admin.createdAt).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          {admin.role !== "owner" && (
                            <Dialog
                              open={adminToDelete === admin._id}
                              onOpenChange={(open) => setAdminToDelete(open ? admin._id : null)}
                            >
                              <DialogTrigger asChild>
                                <Button variant="ghost" size="sm">
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                              </DialogTrigger>
                              <DialogContent>
                                <DialogHeader>
                                  <DialogTitle>Remove Administrator</DialogTitle>
                                  <DialogDescription>
                                    Are you sure you want to remove {admin.name} as an administrator?
                                    They will no longer have access to the admin area.
                                  </DialogDescription>
                                </DialogHeader>
                                <DialogFooter>
                                  <Button
                                    variant="outline"
                                    onClick={() => setAdminToDelete(null)}
                                  >
                                    Cancel
                                  </Button>
                                  <Button
                                    variant="destructive"
                                    onClick={async () => {
                                      if (!user) return;
                                      try {
                                        await removeAdmin({
                                          adminId: admin._id,
                                          removedBy: user.id,
                                        });
                                        setAdminToDelete(null);
                                      } catch (error) {
                                        console.error("Failed to remove admin:", error);
                                      }
                                    }}
                                  >
                                    Remove Admin
                                  </Button>
                                </DialogFooter>
                              </DialogContent>
                            </Dialog>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                    {(!adminList || adminList.length === 0) && (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground">
                          No administrators found
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
