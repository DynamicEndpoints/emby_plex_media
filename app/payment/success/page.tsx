"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle, Loader2 } from "lucide-react";
import Link from "next/link";

function PaymentSuccessContent() {
  const searchParams = useSearchParams();
  const { isLoaded } = useUser();
  const [isProcessing, setIsProcessing] = useState(true);
  const sessionId = searchParams.get("session_id");

  useEffect(() => {
    // Give webhook time to process
    const timer = setTimeout(() => {
      setIsProcessing(false);
    }, 3000);

    return () => clearTimeout(timer);
  }, []);

  if (!isLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
            {isProcessing ? (
              <Loader2 className="h-8 w-8 animate-spin text-green-600" />
            ) : (
              <CheckCircle className="h-8 w-8 text-green-600" />
            )}
          </div>
          <CardTitle className="text-2xl">
            {isProcessing ? "Processing Payment..." : "Payment Successful!"}
          </CardTitle>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          {isProcessing ? (
            <p className="text-muted-foreground">
              Please wait while we confirm your payment...
            </p>
          ) : (
            <>
              <p className="text-muted-foreground">
                Thank you for subscribing to Remote Computer Support! Your media
                server access is now being set up.
              </p>
              {sessionId ? (
                <p className="text-xs text-muted-foreground break-all">
                  Reference: {sessionId}
                </p>
              ) : null}
              <div className="bg-muted rounded-lg p-4 text-sm">
                <p className="font-medium">What&apos;s next?</p>
                <ul className="mt-2 text-left text-muted-foreground space-y-1">
                  <li>• Your account will be activated shortly</li>
                  <li>• You&apos;ll receive login credentials via email</li>
                  <li>• Access your media libraries anytime</li>
                </ul>
              </div>
              <div className="flex flex-col gap-2 pt-4">
                <Button asChild>
                  <Link href="/my-account">Go to My Account</Link>
                </Button>
                <Button variant="outline" asChild>
                  <Link href="/">Back to Home</Link>
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function PaymentSuccessPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      }
    >
      <PaymentSuccessContent />
    </Suspense>
  );
}
