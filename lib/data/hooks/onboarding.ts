"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { onboardingService, type OnboardingInput } from "@/lib/data/services/onboarding";

const KEY = ["onboarding"] as const;

/** `onboarding` is undefined until the first answer arrives, so the wizard never flashes up before we know. */
export function useOnboardingState() {
  const q = useQuery({ queryKey: KEY, queryFn: onboardingService.state });
  return { loaded: q.isSuccess, onboarding: q.data?.onboarding, checklist: q.data?.checklist ?? null };
}

export function useOnboardingActions() {
  const qc = useQueryClient();
  // A fresh shop replaces the whole database, so drop every cached query; small changes only touch the checklist.
  const everything = () => qc.invalidateQueries();
  const checklist = () => qc.invalidateQueries({ queryKey: KEY });
  return {
    complete: useMutation({ mutationFn: (i: OnboardingInput) => onboardingService.complete(i), onSuccess: everything }),
    skip: useMutation({ mutationFn: () => onboardingService.skip(), onSuccess: everything }),
    dismissChecklist: () => onboardingService.patch({ checklistDismissed: true }).then(checklist),
    showChecklist: () => onboardingService.patch({ checklistDismissed: false }).then(checklist),
    visit: (step: string) => onboardingService.visit(step).then(checklist),
    restart: () => onboardingService.restart().then(checklist),
  };
}
