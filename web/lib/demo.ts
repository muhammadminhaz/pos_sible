import { DEMO_FLAG } from "@/lib/data/api/mode";
import { DEMO_DB_KEY, useDB } from "@/lib/data/store/db";
import { removeStoredDb } from "@/lib/data/store/storage";

/** Marks this tab as the demo with a fresh shop, then reloads so every module picks the local data layer. False if storage is blocked. */
export async function enterDemo(): Promise<boolean> {
  await removeStoredDb(DEMO_DB_KEY);
  try {
    sessionStorage.setItem(DEMO_FLAG, "1");
    if (sessionStorage.getItem(DEMO_FLAG) !== "1") return false;
  } catch {
    return false;
  }
  location.reload();
  return true;
}

/** Ends the demo: forgets the sign-in, drops the shop (also wiped on the next normal load) and goes back to the welcome page. */
export async function exitDemo(): Promise<void> {
  useDB.persist.clearStorage();
  try {
    sessionStorage.removeItem(DEMO_FLAG);
    sessionStorage.removeItem("posible:demo:session");
  } catch { /* storage blocked */ }
  await removeStoredDb(DEMO_DB_KEY);
  // A full load on purpose: the data mode is read once per page load.
  // eslint-disable-next-line @next/next/no-location-assign-relative-destination
  location.assign("/welcome");
}
