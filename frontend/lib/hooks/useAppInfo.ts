import useSWR from "swr";
import { API_BASE } from "@/lib/api/backend";
import type { AppInfo } from "@/lib/types";

async function fetchAppInfo(): Promise<AppInfo> {
  const res = await fetch(`${API_BASE}/api/v1/app-info`);
  if (!res.ok) throw new Error(`App info ${res.status}`);
  return res.json();
}

/** Version, data folder and whether a newer release is out. The server checks PyPI daily. */
export function useAppInfo() {
  const { data, error, isLoading } = useSWR<AppInfo>("app-info", fetchAppInfo, {
    revalidateOnFocus: false,
    refreshInterval: 60 * 60 * 1000,
  });
  return { info: data, error, isLoading };
}
