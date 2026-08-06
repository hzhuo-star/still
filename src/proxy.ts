import { clerkMiddleware } from "@clerk/nextjs/server";

/** Clerk session middleware for routes matched by the proxy configuration. */
const proxy = clerkMiddleware();

export default proxy;

/** Routes that should receive Clerk session context. */
export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
    "/__clerk/(.*)",
  ],
};
