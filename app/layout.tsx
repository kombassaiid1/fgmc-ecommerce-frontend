import type { Metadata } from "next";
import { getSiteSeo } from "@/lib/site-seo";
import { toOgSafeImageUrl } from "@/lib/metadata";
import { Oswald } from "next/font/google";
import "@shopify/polaris/build/esm/styles.css";
import "./globals.css";
import { TopNavBar } from "@/components/client/top-navbar";
import { ReactQueryProvider } from "@/components/providers/react-query-provider";
import { ClientVisitTracker } from "@/components/providers/client-visit-tracker";
import { RecoTracker } from "@/components/providers/reco-tracker";
import { SiteFooter } from "@/components/footer/site-footer";
import { SplashScreen } from "@/components/splash/splash-screen";
import { Toaster } from "@/components/ui/sonner";

const oswald = Oswald({
  variable: "--font-oswald",
  subsets: ["latin"],
});

/**
 * The metadata of every page that does not say otherwise, from « Paramètres de la boutique »:
 * the default title and description, the keywords, the favicon, the sharing image and whether search engines may index the shop.
 * Pages add their own title: « Titre de la page | Nom de la boutique ».
 */
export async function generateMetadata(): Promise<Metadata> {
  const seo = await getSiteSeo();
  const title = seo.metaTitle || seo.siteName;
  const description = seo.metaDescription || undefined;
  const image = seo.ogImage ? toOgSafeImageUrl(seo.ogImage) : null;
  const icon = seo.favicon ?? "/favicon.ico";

  let metadataBase: URL | undefined;
  try {
    metadataBase = new URL(process.env.NEXT_PUBLIC_SITE_URL || seo.siteUrl || "");
  } catch {
    metadataBase = undefined;
  }

  return {
    ...(metadataBase ? { metadataBase } : {}),
    title: { default: title, template: `%s | ${seo.siteName}` },
    description,
    applicationName: seo.siteName,
    keywords: seo.keywords.length > 0 ? seo.keywords : undefined,
    icons: { icon, shortcut: icon, apple: icon },
    robots: seo.indexable ? { index: true, follow: true } : { index: false, follow: false },
    openGraph: {
      type: "website",
      siteName: seo.siteName,
      title,
      description,
      ...(seo.locale ? { locale: seo.locale } : {}),
      ...(image ? { images: [{ url: image.url, width: 1200, height: 630, type: image.type }] } : {}),
    },
    twitter: { card: image ? "summary_large_image" : "summary", title, description, ...(image ? { images: [image.url] } : {}) },
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const seo = await getSiteSeo();
  // « fr_TN » → « fr »: the language of the page, for browsers and search engines.
  const lang = seo.locale?.split(/[_-]/)[0]?.toLowerCase() || "fr";
  return (
    <html lang={lang} className={`${oswald.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        {/* A visitor who already saw the opening sequence in this session does not see it again, not even for a frame. */}
        <script dangerouslySetInnerHTML={{ __html: `try{if(sessionStorage.getItem("fgmc-splash-seen")==="1")document.documentElement.setAttribute("data-splash","seen")}catch(e){}` }} />
      </head>
      <body className="min-h-screen! flex flex-col bg-[#F2F5FA]!">
        <SplashScreen />
        <ReactQueryProvider>
          <main className="flex-1!">
            <TopNavBar />
            {children}
          </main>
          <SiteFooter />
          <Toaster />
          <RecoTracker />
          <ClientVisitTracker />
        </ReactQueryProvider>
      </body>
    </html>
  );
}
