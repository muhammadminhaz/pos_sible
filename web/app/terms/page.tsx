import type { Metadata } from "next";
import Link from "next/link";
import { SITE } from "@/lib/site";
import content from "@/features/landing/content.json";
import { ContactLine, LegalPage, type LegalSection } from "@/features/legal/LegalPage";

export const metadata: Metadata = {
  title: "Terms of service",
  description: `The terms for using ${SITE.name}.`,
  alternates: { canonical: "/terms" },
};

type Plan = { id: string; label: string; price: number; usersLabel: string };
const plans = (content.sections.find((s) => s.id === "pricing") as unknown as { plans: Plan[] }).plans;

// ponytail: written from what the product does today; have a lawyer review it before launch and bump the date on every change.
const sections: LegalSection[] = [
  {
    id: "agreement",
    title: "The agreement",
    body: <p>By creating an account or using {SITE.name}, you agree to these terms on behalf of your business. If you do not agree, please do not use the service.</p>,
  },
  {
    id: "service",
    title: "The service",
    body: <p>{SITE.name} is point of sale, inventory and accounting software for retail shops, with an intelligence layer that suggests what to restock, who to win back and which dues to collect. We may improve, change or add features over time.</p>,
  },
  {
    id: "accounts",
    title: "Your account and staff",
    body: (
      <ul>
        <li>Keep passwords private. You are responsible for what happens under your account and your staff&apos;s accounts.</li>
        <li>Give each staff member only the role they need, and remove people who leave.</li>
        <li>Tell us straight away if you think someone has got into your account.</li>
      </ul>
    ),
  },
  {
    id: "data",
    title: "Your data stays yours",
    body: (
      <p>You own everything you put into {SITE.name}. You let us store and process it only to provide the service to you, as described in our <Link href="/privacy">privacy policy</Link>. You can export it as CSV at any time.</p>
    ),
  },
  {
    id: "plans",
    title: "Plans and payment",
    body: (
      <>
        <ul>
          {plans.map((p) => (
            <li key={p.id}><strong>{p.label}</strong>: ৳{p.price.toLocaleString("en-IN")} a month, {p.usersLabel.toLowerCase()}.</li>
          ))}
        </ul>
        <p>Pay by bKash or bank transfer. Your account is switched on when payment arrives. If a subscription lapses, the app is locked until it is renewed; your data is kept meanwhile. Prices may change, and we will tell you before a new price applies to you.</p>
      </>
    ),
  },
  {
    id: "use",
    title: "Fair use",
    body: (
      <ul>
        <li>Use {SITE.name} only for lawful business.</li>
        <li>Do not try to reach other shops&apos; data, break the service&apos;s security, or overload it.</li>
        <li>Do not resell or copy the service without our written permission.</li>
      </ul>
    ),
  },
  {
    id: "advice",
    title: "Suggestions are not advice",
    body: <p>Opportunities, goals and forecasts are calculated from your own records and can be wrong. They are suggestions, not financial, tax or legal advice. You decide what to do with them, and you remain responsible for your books, VAT and tax filings.</p>,
  },
  {
    id: "availability",
    title: "Availability",
    body: <p>We work to keep {SITE.name} running and your data safe, but the service is provided as is, and there may be interruptions for maintenance or reasons outside our control. Export your records regularly if your business depends on having a copy.</p>,
  },
  {
    id: "liability",
    title: "Limits of liability",
    body: <p>As far as the law allows, we are not liable for lost profits or indirect losses, and our total liability for any claim is limited to what you paid us in the three months before it arose.</p>,
  },
  {
    id: "ending",
    title: "Ending the service",
    body: <p>You can stop using {SITE.name} at any time and ask us to delete your data. We may suspend or close an account that breaks these terms or is not paid for, and will tell you first where we reasonably can.</p>,
  },
  {
    id: "law",
    title: "Governing law",
    body: <p>These terms are governed by the laws of Bangladesh, and the courts of Dhaka have jurisdiction over any dispute.</p>,
  },
  {
    id: "changes",
    title: "Changes to these terms",
    body: <p>We will post changes here and update the date. For changes that matter, we will tell account owners before they take effect. Using the service after that means you accept them.</p>,
  },
  {
    id: "contact",
    title: "Contact",
    body: <p>Questions about these terms? <ContactLine />.</p>,
  },
];

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms of service"
      updated="11 October 2026"
      intro={<p>The rules for using {SITE.name}, in plain words: what we provide, what you are responsible for, and how payment works.</p>}
      sections={sections}
    />
  );
}
