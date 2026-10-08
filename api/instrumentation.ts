/** Runs once when the server starts: begins the job that keeps currency rates fresh. */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") (await import("./lib/server/rates")).startRateJob();
}
