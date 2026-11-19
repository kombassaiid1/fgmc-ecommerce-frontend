/** Loads a script or stylesheet once and resolves when it is ready. Used for the third-party Colissimo widget parts. */
const loading = new Map<string, Promise<void>>();

export function loadScript(src: string): Promise<void> {
  const known = loading.get(src);
  if (known) return known;
  const promise = new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      loading.delete(src);
      reject(new Error(`Impossible de charger ${new URL(src).hostname}.`));
    };
    document.head.appendChild(script);
  });
  loading.set(src, promise);
  return promise;
}

export function loadStyle(href: string): Promise<void> {
  const known = loading.get(href);
  if (known) return known;
  const promise = new Promise<void>((resolve, reject) => {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = href;
    link.onload = () => resolve();
    link.onerror = () => {
      loading.delete(href);
      reject(new Error(`Impossible de charger ${new URL(href).hostname}.`));
    };
    document.head.appendChild(link);
  });
  loading.set(href, promise);
  return promise;
}
