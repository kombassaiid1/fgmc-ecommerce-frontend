export function register(): void {
  if (process.env.NODE_ENV !== "production" || process.env.NEXT_RUNTIME === "edge") {
    return;
  }

  if (!process.env.BACKEND_API_URL?.trim()) {
    throw new Error(
      "BACKEND_API_URL est obligatoire au démarrage : utilisez le DNS interne Dokploy du backend NestJS.",
    );
  }
  if (
    !process.env.NEXT_PUBLIC_BACKEND_API_URL?.trim() &&
    !process.env.NEXT_PUBLIC_API_URL?.trim()
  ) {
    throw new Error(
      "Configurez NEXT_PUBLIC_BACKEND_API_URL ou NEXT_PUBLIC_API_URL avec le domaine public du backend (Build Args).",
    );
  }
  if (!process.env.NEXT_PUBLIC_SITE_URL?.trim()) {
    throw new Error(
      "NEXT_PUBLIC_SITE_URL est obligatoire et doit contenir le domaine public du frontend (Build Arg).",
    );
  }
}
