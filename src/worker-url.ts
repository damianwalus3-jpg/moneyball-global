/** Resolve source-adapter relative URLs against the production Rebuilt Worker. */
export function resolveWorkerFetchUrl(input: string | URL, base: string): string {
  return new URL(input instanceof URL ? input.toString() : input, base).toString();
}
