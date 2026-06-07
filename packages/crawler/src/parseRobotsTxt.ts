export interface ParsedRobotsTxt {
  sitemapUrls: string[];
  blocksAll: boolean;
}

export default function parseRobotsTxt(content: string): ParsedRobotsTxt {
  const lines = content.split(/\r?\n/);
  const sitemapUrls: string[] = [];

  let inWildcardAgent = false;
  let sawWildcardAgent = false;
  let blocksAll = false;

  for (const line of lines) {
    const withoutComment = line.split("#", 1)[0]?.trim() ?? "";
    if (!withoutComment) continue;

    const separatorIndex = withoutComment.indexOf(":");
    if (separatorIndex === -1) continue;

    const key = withoutComment.slice(0, separatorIndex).trim().toLowerCase();
    const value = withoutComment.slice(separatorIndex + 1).trim();

    if (key === "sitemap" && value) {
      sitemapUrls.push(value);
      continue;
    }

    if (key === "user-agent") {
      inWildcardAgent = value === "*";
      if (inWildcardAgent) sawWildcardAgent = true;
      continue;
    }

    if (!inWildcardAgent) continue;
    if (key === "disallow" && value === "/") {
      blocksAll = true;
    }
  }

  return {
    sitemapUrls,
    blocksAll: sawWildcardAgent && blocksAll,
  };
}
