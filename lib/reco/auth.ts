import { getClientSession } from "@/lib/client-auth";

/**
 * Authorization header of the logged-in client for the /reco endpoints, or
 * nothing for an anonymous visitor. Never throws.
 */
export function recoAuthHeaders(): Record<string, string> {
  try {
    const token = getClientSession()?.token;
    return token ? { Authorization: `Bearer ${token}` } : {};
  } catch {
    return {};
  }
}
