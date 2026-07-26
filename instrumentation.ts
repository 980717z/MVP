// Next.js instrumentation — server-side error alerting. onRequestError fires
// for uncaught errors in server components, route handlers, and the render
// pipeline. We email the owner (deduped) so a prod 500 surfaces before a
// merchant notices. lib/alert is imported lazily so the edge runtime (which
// can't send email) never pulls it in.

export async function onRequestError(
  err: unknown,
  request: { path?: string; method?: string },
  context: { routeType?: string; routePath?: string },
): Promise<void> {
  try {
    const { alertError } = await import("./lib/alert");
    await alertError("server", err, {
      path: request?.path ?? "",
      method: request?.method ?? "",
      route: context?.routePath ?? "",
      routeType: context?.routeType ?? "",
    });
  } catch {
    /* never let instrumentation throw */
  }
}
