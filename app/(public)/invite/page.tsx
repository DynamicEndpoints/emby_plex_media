"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function InviteEntryPage() {
  const router = useRouter();
  const [code, setCode] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const normalized = code.trim().toUpperCase();
    if (!normalized) return;
    router.push(`/invite/${encodeURIComponent(normalized)}`);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-background to-muted p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle>Redeem an Invite</CardTitle>
          <CardDescription>
            Enter your invite code to start setup.
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="inviteCode">Invite Code</Label>
              <Input
                id="inviteCode"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="ABC123XYZ"
                autoCapitalize="characters"
                autoCorrect="off"
              />
            </div>
          </CardContent>
          <CardFooter>
            <Button type="submit" className="w-full" disabled={!code.trim()}>
              Continue
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
