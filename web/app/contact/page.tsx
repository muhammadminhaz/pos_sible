import type { Metadata } from "next";
import { SITE } from "@/lib/site";
import { ContactPage } from "@/features/contact/ContactPage";

export const metadata: Metadata = {
  title: "Contact Us",
  description: `Book a call or email the ${SITE.name} team. We set up your shop's account after a short call.`,
  alternates: { canonical: "/contact" },
};

export default async function Contact({ searchParams }: PageProps<"/contact">) {
  const { plan, topic } = await searchParams;
  return <ContactPage plan={typeof plan === "string" ? plan : undefined} topic={typeof topic === "string" ? topic : undefined} />;
}
