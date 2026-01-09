"use client";

import { useState } from "react";
import { useUser } from "@clerk/nextjs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CreditCard, Loader2, CheckCircle, AlertCircle, ExternalLink } from "lucide-react";

interface PaymentRequiredProps {
  paymentStatus?: string;
  stripeCustomerId?: string;
  onPaymentInitiated?: () => void;
}

export function PaymentRequired({ 
  paymentStatus, 
  stripeCustomerId,
  onPaymentInitiated 
}: PaymentRequiredProps) {
  const { user } = useUser();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubscribe = async () => {
    if (!user) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: user.primaryEmailAddress?.emailAddress,
          name: user.fullName || user.username,
          clerkId: user.id,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to create checkout session");
      }

      // Redirect to Stripe Checkout
      if (data.url) {
        window.location.href = data.url;
      }

      onPaymentInitiated?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setIsLoading(false);
    }
  };

  const handleManageSubscription = async () => {
    if (!stripeCustomerId) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/stripe/portal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customerId: stripeCustomerId }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to create portal session");
      }

      if (data.url) {
        window.location.href = data.url;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusBadge = () => {
    switch (paymentStatus) {
      case "active":
        return <Badge variant="success">Active</Badge>;
      case "trialing":
        return <Badge variant="secondary">Trial</Badge>;
      case "past_due":
        return <Badge variant="warning">Past Due</Badge>;
      case "canceled":
        return <Badge variant="destructive">Canceled</Badge>;
      case "free":
        return <Badge variant="outline">Free Access</Badge>;
      default:
        return <Badge variant="secondary">Payment Required</Badge>;
    }
  };

  // If already paid/active, show management options
  if (paymentStatus === "active" || paymentStatus === "trialing" || paymentStatus === "free") {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Subscription
            </CardTitle>
            {getStatusBadge()}
          </div>
          <CardDescription>
            {paymentStatus === "free" 
              ? "You have free access to the media server."
              : "Your subscription is active. Manage your billing below."}
          </CardDescription>
        </CardHeader>
        {stripeCustomerId && paymentStatus !== "free" && (
          <CardContent>
            <Button 
              variant="outline" 
              onClick={handleManageSubscription}
              disabled={isLoading}
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <ExternalLink className="h-4 w-4 mr-2" />
              )}
              Manage Subscription
            </Button>
          </CardContent>
        )}
      </Card>
    );
  }

  // If past due, show warning and resubscribe option
  if (paymentStatus === "past_due") {
    return (
      <Card className="border-yellow-500">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-yellow-500" />
              Payment Past Due
            </CardTitle>
            {getStatusBadge()}
          </div>
          <CardDescription>
            Your payment is past due. Please update your payment method to continue accessing the media server.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}
          <Button 
            onClick={handleManageSubscription}
            disabled={isLoading || !stripeCustomerId}
          >
            {isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Update Payment Method
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Default: show subscribe prompt
  return (
    <Card className="border-primary">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Subscribe to Access
          </CardTitle>
          {getStatusBadge()}
        </div>
        <CardDescription>
          A subscription is required to access the media server. Subscribe now to unlock your access.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="bg-muted rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-semibold">Remote Computer Support</p>
              <p className="text-sm text-muted-foreground">Monthly subscription</p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold">$30</p>
              <p className="text-sm text-muted-foreground">/month</p>
            </div>
          </div>
          <ul className="mt-4 space-y-2 text-sm">
            <li className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-500" />
              Full access to media libraries
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-500" />
              Stream from anywhere
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-500" />
              Cancel anytime
            </li>
          </ul>
        </div>

        {error && (
          <p className="text-sm text-destructive">{error}</p>
        )}

        <Button 
          onClick={handleSubscribe} 
          disabled={isLoading}
          className="w-full"
          size="lg"
        >
          {isLoading ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Redirecting to checkout...
            </>
          ) : (
            <>
              <CreditCard className="h-4 w-4 mr-2" />
              Subscribe Now - $30/month
            </>
          )}
        </Button>

        <p className="text-xs text-center text-muted-foreground">
          Secure payment powered by Stripe. Cancel anytime.
        </p>
      </CardContent>
    </Card>
  );
}
