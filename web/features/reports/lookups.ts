"use client";

import { useLookups } from "@/lib/data/hooks/lookups";

type Option = { value: string; label: string };
const opt = (xs: { id: string; name: string }[] | undefined): Option[] => (xs ?? []).map((x) => ({ value: x.id, label: x.name }));

export const useContactGroupsLookup = () => opt(useLookups().data?.customerGroups);
export const useCategoryLookup = () => opt(useLookups().data?.categories.filter((c) => !c.parentId));
export const useBrandLookup = () => opt(useLookups().data?.brands);
export const useUnitLookup = () => (useLookups().data?.units ?? []).map((u) => ({ value: u.id, label: `${u.name} (${u.shortName})` }));
export const useUserLookup = () => (useLookups().data?.users ?? []).map((u) => ({ value: u.id, label: `${u.firstName} ${u.lastName}`.trim() }));
