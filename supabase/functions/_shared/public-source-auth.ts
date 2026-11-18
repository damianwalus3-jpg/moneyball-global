/** Prefer the same-project service-role key for internal Edge Function calls. */
export function selectPublicSourceApiKey(serviceRoleKey: string, anonKey: string): string {
  return serviceRoleKey.trim() || anonKey.trim();
}
