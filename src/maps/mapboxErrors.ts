/** Keep SDK errors useful without copying access tokens from request URLs into the UI. */
export function mapboxErrorMessage(error: unknown, resource: string) {
  const detail = error as { status?: number; message?: string } | undefined;
  const status = detail?.status;
  if (status === 429)
    return `Mapbox is rate-limiting ${resource} (HTTP 429: Too Many Requests). Wait before retrying. If this persists, check your Mapbox account's API limits or contact Mapbox support.`;
  if (status === 401)
    return `Mapbox rejected the ${resource} request (HTTP 401). Check that your public token is valid.`;
  if (status === 403)
    return `Mapbox denied access to ${resource} (HTTP 403). Check your token's permissions, allowed URLs, and account access.`;
  const message = (detail?.message ?? "The request failed.")
    .replace(/https?:\/\/[^\s)]+/g, (url) => url.split("?")[0])
    .replace(/\b(?:pk|sk)\.[A-Za-z0-9_.-]+/g, "[token]");
  return `Mapbox could not load ${resource}${status ? ` (HTTP ${status})` : ""}: ${message}`;
}
