import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Providers } from "@/components/providers";
import { APP_CONFIG, PWA_CONFIG } from "@/lib/config";
import { WhatsNewDialog } from "@/components/whats-new-dialog";

export const metadata: Metadata = {
  title: APP_CONFIG.APP_NAME,
  description: APP_CONFIG.APP_DESCRIPTION,
  manifest: "/api/manifest", // Dynamic manifest from centralized config
  metadataBase: APP_CONFIG.isProduction
    ? new URL(APP_CONFIG.PRODUCTION_URL)
    : undefined,
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: APP_CONFIG.APP_SHORT_NAME,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: PWA_CONFIG.themeColor.light },
    { media: "(prefers-color-scheme: dark)", color: PWA_CONFIG.themeColor.dark }
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased">
        <Providers>
          {children}
          <WhatsNewDialog />
        </Providers>
      </body>
    </html>
  );
}
