"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { findNavTrail } from "@/lib/nav";

export function Breadcrumbs() {
  const t = useTranslations("nav");
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const { group, item } = findNavTrail(pathname, search ? `?${search}` : "");
  if (!group) return null;

  return (
    <Breadcrumb className="min-w-0" aria-label={t("breadcrumb")}>
      <BreadcrumbList className="flex-nowrap">
        <BreadcrumbItem className="hidden sm:inline-flex">
          {item ? (
            <span className="text-muted-foreground">{t(group.key)}</span>
          ) : (
            <BreadcrumbPage>{t(group.key)}</BreadcrumbPage>
          )}
        </BreadcrumbItem>
        {item && (
          <>
            <BreadcrumbSeparator className="hidden sm:inline-flex" />
            <BreadcrumbItem className="min-w-0">
              {pathname === item.href.split("?")[0] ? (
                <BreadcrumbPage className="truncate">{t(item.key)}</BreadcrumbPage>
              ) : (
                <BreadcrumbLink asChild>
                  <Link href={item.href} className="truncate">
                    {t(item.key)}
                  </Link>
                </BreadcrumbLink>
              )}
            </BreadcrumbItem>
          </>
        )}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
