import handler from "vinext/server/fetch-handler";
export default {
  async fetch(request: Request, env: Cloudflare.Env, ctx: ExecutionContext) {
    const response = await handler.fetch(request, env, ctx);
    const secured = new Response(response.body, response);
    secured.headers.set("X-Content-Type-Options", "nosniff");
    secured.headers.set("Referrer-Policy", "no-referrer");
    secured.headers.set("X-Robots-Tag", "noindex, nofollow");
    if (
      secured.headers.get("content-type")?.includes("text/html") ||
      new URL(request.url).pathname.startsWith("/api/")
    )
      secured.headers.set("Cache-Control", "private, no-store");
    return secured;
  },
};
