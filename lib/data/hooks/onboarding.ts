"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useDB } from "@/lib/data/store/db";
import { checklistStatus, onboardingService, type OnboardingInput } from "@/lib/data/services/onboarding";

export function useOnboardingState() {
  const meta = useDB((s) => s.db?.meta.onboarding);
  const db = useDB((s) => s.db);
  return { onboarding: meta, checklist: db ? checklistStatus(db) : null };
}

export function useOnboardingActions() {
  const qc = useQueryClient();
  // Everything in the app may change (a fresh shop replaces the whole database), so drop all cached queries.
  const refresh = () => qc.invalidateQueries();
  return {
    complete: useMutation({ mutationFn: (i: OnboardingInput) => onboardingService.complete(i), onSuccess: refresh }),
    skip: useMutation({ mutationFn: () => onboardingService.skip(), onSuccess: refresh }),
    dismissChecklist: () => onboardingService.patch({ checklistDismissed: true }),
    showChecklist: () => onboardingService.patch({ checklistDismissed: false }),
    visit: (step: string) => onboardingService.visit(step),
    restart: () => onboardingService.restart(),
  };
}
