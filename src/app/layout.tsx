import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Providers } from "@/components/providers";
import { APP_CONFIG, PWA_CONFIG } from "@/lib/config";
import { WhatsNewDialog } from "@/components/whats-new-dialog";
import { SidebarProvider, Toaster } from "@fossapp/ui";

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
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/favicon.svg', type: 'image/svg+xml' },
      { url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
      { url: '/favicon-48x48.png', sizes: '48x48', type: 'image/png' },
    ],
    apple: '/apple-touch-icon.png',
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
          <SidebarProvider>
            {children}
            <WhatsNewDialog />
            <Toaster richColors position="top-right" />
          </SidebarProvider>
        </Providers>
      </body>
    </html>
  );
}
