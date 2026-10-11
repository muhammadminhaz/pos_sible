import type { Metadata } from "next";
import { SITE } from "@/lib/site";
import { ContactLine, LegalPage, type LegalSection } from "@/features/legal/LegalPage";

export const metadata: Metadata = {
  title: "Privacy policy",
  description: `How ${SITE.name} collects, uses and protects your shop's data.`,
  alternates: { canonical: "/privacy" },
};

// ponytail: written from what the code does today; have a lawyer review it before launch and bump the date on every change.
const sections: LegalSection[] = [
  {
    id: "collect",
    title: "What we collect",
    body: (
      <>
        <p><strong>Account details.</strong> Your business name, your name, and the usernames and roles of the staff you add.</p>
        <p><strong>Your shop&apos;s records.</strong> Everything you enter or import: products, stock, sales, purchases, expenses, accounts, customers and suppliers.</p>
        <p><strong>Usage.</strong> Page views counted by Vercel Web Analytics, which uses no cookies and reports totals, not people. Our servers also keep short technical logs (such as IP address and browser) to keep the service secure and working.</p>
      </>
    ),
  },
  {
    id: "customers",
    title: "Your customers' data",
    body: (
      <p>When you record a customer or supplier, you decide what goes in and why. We store and process it only to run {SITE.name} for you. You are responsible for having a fair reason to keep it, and for telling your customers if the law asks you to.</p>
    ),
  },
  {
    id: "use",
    title: "How we use it",
    body: (
      <ul>
        <li>To run the service: checkout, stock, accounts, reports and receipts.</li>
        <li>To find opportunities, goals and forecasts for your shop, from your shop&apos;s own records only. We never use one shop&apos;s data to advise another.</li>
        <li>To keep accounts secure, fix problems and answer you when you write to us.</li>
      </ul>
    ),
  },
  {
    id: "never",
    title: "What we never do",
    body: <p>We do not sell your data, show you ads, or share your records with other shops. Each shop&apos;s data is kept apart from every other shop&apos;s.</p>,
  },
  {
    id: "cookies",
    title: "Cookies and browser storage",
    body: (
      <>
        <p>We set one cookie: your sign-in. It cannot be read by scripts on the page, and it lasts until you close the browser unless you choose to stay signed in.</p>
        <p>The public demo keeps a sample shop in your own browser. Nothing from it is sent to us, and it is deleted when you leave the demo.</p>
      </>
    ),
  },
  {
    id: "storage",
    title: "Where your data lives",
    body: <p>The website is served by Vercel. Your shop&apos;s records are stored in a database on servers we run with a cloud hosting provider. These providers process data only to host {SITE.name}. Data travels over encrypted HTTPS connections.</p>,
  },
  {
    id: "security",
    title: "How we protect it",
    body: (
      <ul>
        <li>Passwords are stored as scrypt hashes, never in plain text.</li>
        <li>Repeated failed sign-ins are slowed down.</li>
        <li>Staff only see the parts of the app their role allows.</li>
      </ul>
    ),
  },
  {
    id: "rights",
    title: "Your choices",
    body: (
      <ul>
        <li><strong>See and export.</strong> Every list in the app exports to CSV.</li>
        <li><strong>Correct.</strong> Edit any record, or ask us to fix your account details.</li>
        <li><strong>Delete.</strong> Ask us to close your account and we will delete your shop&apos;s data, except what the law requires us to keep.</li>
      </ul>
    ),
  },
  {
    id: "retention",
    title: "How long we keep it",
    body: <p>As long as your account is open. If your subscription lapses, your data is kept so you can pick up where you left off, until you ask us to delete it.</p>,
  },
  {
    id: "changes",
    title: "Changes to this policy",
    body: <p>If we change how we handle your data, we will update this page and its date. For big changes we will tell account owners before they take effect.</p>,
  },
  {
    id: "contact",
    title: "Contact",
    body: <p>Questions about your data? <ContactLine />.</p>,
  },
];

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy policy"
      updated="11 October 2026"
      intro={<p>{SITE.name} holds your shop&apos;s numbers so it can help you run and grow the shop. This page says, in plain words, what we collect, why, and what you can ask us to do with it.</p>}
      sections={sections}
    />
  );
}
