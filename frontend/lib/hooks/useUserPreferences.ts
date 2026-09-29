import { useRef, useEffect } from "react";
import useSWR, { useSWRConfig } from "swr";
import { getUserPreferences, updateUserPreference } from "@/lib/api/backend";
import type { UserPreferences, UserPreferencesUpdate } from "@/lib/types";

const DEFAULT_PREFERENCES: UserPreferences = {
  default_benchmark: "SP500",
  date_format: "DD/MM/YYYY",
  watchlist_collapsed: false,
  check_for_updates: true,
  home_currency: null,
  tax_residence: null,
  screener_markets: null,
  setup_completed_at: null,
  withholding_overrides: {},
};


/** The preferences after `updates`, as the server will store them (null removes an override). */
function applyUpdates(current: UserPreferences, updates: UserPreferencesUpdate): UserPreferences {
  const { withholding_overrides, complete_setup, ...rest } = updates;
  const next: UserPreferences = { ...current, ...rest };
  if (withholding_overrides) {
    const merged = { ...current.withholding_overrides };
    for (const [country, rate] of Object.entries(withholding_overrides)) {
      if (rate == null) delete merged[country];
      else merged[country] = rate;
    }
    next.withholding_overrides = merged;
  }
  if (complete_setup && !current.setup_completed_at) next.setup_completed_at = new Date().toISOString();
  return next;
}

export function useUserPreferences() {
  const { data, error, isLoading, mutate } = useSWR<UserPreferences>(
    "user-preferences",
    async () => {
      return getUserPreferences();
    },
    { revalidateOnFocus: false, dedupingInterval: 60000 }
  );

  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pending = useRef<UserPreferencesUpdate>({});
  const { mutate: globalMutate } = useSWRConfig();

  // Clear pending debounce on unmount to prevent state updates after unmount
  useEffect(() => {
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, []);

  const updatePreference = (updates: UserPreferencesUpdate) => {
    // Optimistic update is immediate so the UI responds without delay.
    // Functional updater reads latest SWR cache, avoiding stale closure
    // when multiple preferences are changed in quick succession.
    mutate((current) => applyUpdates(current ?? DEFAULT_PREFERENCES, updates), false);

    // API call is debounced 500ms so rapid changes coalesce; changes to different
    // settings inside that window are merged, not dropped
    pending.current = {
      ...pending.current,
      ...updates,
      // Several overrides changed in quick succession all get saved
      ...(updates.withholding_overrides
        ? { withholding_overrides: { ...pending.current.withholding_overrides, ...updates.withholding_overrides } }
        : {}),
    };
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(async () => {
      const toSave = pending.current;
      pending.current = {};
      const updated = await updateUserPreference(toSave);
      mutate(updated);
      if (toSave.withholding_overrides || toSave.tax_residence) {
        // After-tax figures depend on these
        globalMutate((key) =>
          Array.isArray(key) ? ["withholding", "income-calendar"].includes(key[0]) : key === "income-calendar"
        );
      }
      if (toSave.check_for_updates !== undefined) {
        // The server checks (or forgets) right away; pick the answer up shortly after
        setTimeout(() => globalMutate("app-info"), 3000);
      }
    }, 500);
  };

  /** Save straight away (no debounce) and wait for the server, e.g. at the end of setup. */
  const savePreferences = async (updates: UserPreferencesUpdate) => {
    const updated = await updateUserPreference(updates);
    mutate(updated, false);
    return updated;
  };

  return {
    preferences: data ?? DEFAULT_PREFERENCES,
    savePreferences,
    /** True once the real preferences have arrived (not the defaults above) */
    loaded: !!data,
    isLoading,
    error,
    updatePreference,
  };
}
