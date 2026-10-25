import type { Metadata } from "next";
import { getDictionary } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getDictionary()).privacy.title };
}

export default async function PrivacyPage() {
  const t = await getDictionary();
  const contact = process.env.NEXT_PUBLIC_CONTACT_EMAIL || null;
  return (
    <article className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">{t.privacy.title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t.privacy.updated}</p>
      </header>
      <p>{t.privacy.controller(contact)}</p>
      {t.privacy.sections.map((section) => (
        <section key={section.heading} className="space-y-2">
          <h2 className="text-lg font-semibold">{section.heading}</h2>
          <ul className="list-disc space-y-1 pl-5 text-sm leading-relaxed">
            {section.body.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </section>
      ))}
    </article>
  );
}
