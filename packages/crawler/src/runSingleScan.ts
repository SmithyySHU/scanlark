import { runScanForSite } from "./scanService";

async function main(): Promise<void> {
  const [siteId, startUrl] = process.argv.slice(2);

  if (!siteId || !startUrl) {
    console.error("Usage: npm run scan:once -- <siteId> <startUrl>");
    process.exit(1);
  }

  console.log(`Starting scan for site ${siteId}`);
  console.log(`Start URL: ${startUrl}`);

  try {
    const summary = await runScanForSite(siteId, startUrl);
    console.log("Scan completed.");
    console.log(
      `Summary: ${summary.totalLinks} links, ${summary.checkedLinks} checked, ${summary.brokenLinks} broken, ${summary.ignoredLinks} ignored`,
    );
  } catch (error) {
    console.error("Scan failed:", error);
    process.exit(1);
  } finally {
    // Ensure all pending handles are cleared so process can exit
    // This handles any lingering timers or async operations
    process.exit(0);
  }
}

await main();
