import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import { Suspense } from "react";
import { ServiceWorker } from "@/components/service-worker";
import { localePath, LOCALES } from "@/lib/i18n";
import { I18nProvider } from "@/lib/i18n/client";
import { getDictionary, getLocale } from "@/lib/i18n/server";
import { LocaleSwitcher } from "./locale-switcher";
import { UserMenu } from "./user-menu";
import "../globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin", "latin-ext", "cyrillic"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export function generateStaticParams() {
  return LOCALES.map((lang) => ({ lang }));
}

export async function generateMetadata(): Promise<Metadata> {
  const t = await getDictionary();
  return {
    title: { default: "Polyglot Tutor", template: "%s – Polyglot Tutor" },
    description: t.meta.description,
    applicationName: "Polyglot Tutor",
    appleWebApp: { capable: true, title: "Polyglot", statusBarStyle: "default" },
    formatDetection: { telephone: false },
  };
}

export const viewport: Viewport = {
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6f7f9" },
    { media: "(prefers-color-scheme: dark)", color: "#0e1014" },
  ],
};

export default async function RootLayout({ children }: LayoutProps<"/[lang]">) {
  const [locale, t] = await Promise.all([getLocale(), getDictionary()]);
  return (
    <html lang={locale} className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col overflow-x-clip font-sans">
        <I18nProvider locale={locale}>
          <header className="border-b border-line bg-surface">
            {/* on phones the navigation wraps into a second row instead of overflowing the screen */}
            <div className="mx-auto flex w-full max-w-3xl flex-wrap items-center gap-x-3 px-4 pt-[env(safe-area-inset-top)]">
              <Link href={localePath(locale, "/")} className="mr-auto flex h-14 shrink-0 items-center font-semibold tracking-tight">
                Polyglot <span className="ml-1 text-accent">Tutor</span>
              </Link>
              <Suspense>
                <UserMenu />
              </Suspense>
              <Suspense>
                <LocaleSwitcher />
              </Suspense>
            </div>
          </header>
          <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6">{children}</main>
          <footer className="mx-auto w-full max-w-3xl px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] text-xs text-muted-foreground">
            <Link href={localePath(locale, "/privacy")} className="hover:text-foreground">
              {t.footer.privacy}
            </Link>
            {process.env.NEXT_PUBLIC_CONTACT_EMAIL && (
              <>
                {" · "}
                <a href={`mailto:${process.env.NEXT_PUBLIC_CONTACT_EMAIL}`} className="hover:text-foreground">
                  {t.footer.contact}
                </a>
              </>
            )}
          </footer>
          <ServiceWorker />
        </I18nProvider>
      </body>
    </html>
  );
}
