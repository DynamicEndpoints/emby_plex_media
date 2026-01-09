import { httpRouter } from "convex/server";
import { createCheckout, createPortal, webhook, syncSubscriptions } from "./stripe";

const http = httpRouter();

// Stripe routes
http.route({
  path: "/stripe/checkout",
  method: "POST",
  handler: createCheckout,
});

http.route({
  path: "/stripe/portal",
  method: "POST",
  handler: createPortal,
});

http.route({
  path: "/stripe/webhook",
  method: "POST",
  handler: webhook,
});

http.route({
  path: "/stripe/sync",
  method: "POST",
  handler: syncSubscriptions,
});

export default http;
