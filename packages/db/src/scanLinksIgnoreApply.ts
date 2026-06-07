import { createHash } from "crypto";
import { ensureConnected } from "./client";
import { sortIgnoreRules } from "./ignoreRules";
import type { IgnoreRule } from "./ignoreRules";
import { validateSafeRegexPattern } from "./validation";

function compileSafeRuleRegex(pattern: string): RegExp | null {
  if (validateSafeRegexPattern(pattern) !== null) return null;
  try {
    return new RegExp(pattern);
  } catch {
    return null;
  }
}

function hashRules(rules: IgnoreRule[]): string {
  const stable = sortIgnoreRules(rules).map((r) => ({
    type: r.rule_type,
    pattern: r.pattern,
  }));
  const json = JSON.stringify(stable);
  return createHash("sha256").update(json).digest("hex");
}

function ignoreReason(rule: IgnoreRule) {
  return `Ignored by rule: ${rule.rule_type} ${rule.pattern}`;
}

const normalizeDomainPattern = (pattern: string) => {
  const trimmed = pattern.trim();
  try {
    const url = new URL(trimmed);
    return url.hostname.toLowerCase();
  } catch {
    const withoutProtocol = trimmed.replace(/^https?:\/\//i, "");
    const hostOnly = withoutProtocol.split("/")[0];
    return hostOnly.toLowerCase();
  }
};

const normalizePathPattern = (pattern: string) => {
  const trimmed = pattern.trim();
  try {
    const url = new URL(trimmed);
    return url.pathname;
  } catch {
    const slashIndex = trimmed.indexOf("/");
    if (slashIndex >= 0) return trimmed.slice(slashIndex);
    return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  }
};

function matchesDomainRule(linkUrl: string, pattern: string): boolean {
  let host = "";
  try {
    const url = new URL(linkUrl);
    host = url.hostname.toLowerCase();
  } catch {
    return false;
  }
  const normalized = normalizeDomainPattern(pattern);
  if (normalized.startsWith("*.")) {
    const suffix = normalized.slice(2);
    return host === suffix || host.endsWith(`.${suffix}`);
  }
  if (normalized.startsWith(".")) {
    const suffix = normalized.slice(1);
    return host === suffix || host.endsWith(`.${suffix}`);
  }
  return host === normalized;
}

function matchesPathPrefixRule(linkUrl: string, pattern: string): boolean {
  let path = "";
  try {
    const url = new URL(linkUrl);
    path = url.pathname;
  } catch {
    return false;
  }
  const normalized = normalizePathPattern(pattern);
  return path.startsWith(normalized);
}

export async function applyIgnoreRulesForScanRun(
  scanRunId: string,
  opts?: { force?: boolean },
): Promise<{ applied: boolean; ignoredCount: number; rulesHash: string }> {
  const client = await ensureConnected();

  const lock = await client.query<{ locked: boolean }>(
    `SELECT pg_try_advisory_lock(hashtext($1)) as locked`,
    [scanRunId],
  );
  if (!lock.rows[0]?.locked) {
    return { applied: false, ignoredCount: 0, rulesHash: "" };
  }

  try {
    const runRes = await client.query<{ site_id: string; user_id: string }>(
      `
        SELECT r.site_id, s.user_id
        FROM scan_runs r
        JOIN sites s ON s.id = r.site_id
        WHERE r.id = $1
      `,
      [scanRunId],
    );
    const siteId = runRes.rows[0]?.site_id;
    const userId = runRes.rows[0]?.user_id;
    if (!siteId || !userId) {
      return { applied: false, ignoredCount: 0, rulesHash: "" };
    }

    const rulesRes = await client.query<IgnoreRule>(
      `
        SELECT id, user_id, site_id, rule_type, pattern, is_enabled, created_at
        FROM ignore_rules
        WHERE user_id = $2
          AND (site_id = $1 OR site_id IS NULL)
          AND is_enabled = true
      `,
      [siteId, userId],
    );

    const rules = sortIgnoreRules(rulesRes.rows);
    const rulesHash = hashRules(rules);

    if (!opts?.force) {
      const stateRes = await client.query<{ rules_hash: string }>(
        `SELECT rules_hash FROM scan_ignore_apply_state WHERE scan_run_id = $1`,
        [scanRunId],
      );
      const existingHash = stateRes.rows[0]?.rules_hash;
      if (existingHash && existingHash === rulesHash) {
        return { applied: false, ignoredCount: 0, rulesHash };
      }
    }

    await client.query(
      `
        UPDATE scan_links
        SET ignored = false,
            ignored_by_rule_id = null,
            ignored_at = null,
            ignore_reason = null,
            ignored_source = 'none'
        WHERE scan_run_id = $1 AND ignored_source = 'rule'
      `,
      [scanRunId],
    );

    let ignoredCount = 0;

    for (const rule of rules) {
      const reason = ignoreReason(rule);
      if (
        rule.rule_type === "domain" ||
        rule.rule_type === "path_prefix" ||
        rule.rule_type === "regex"
      ) {
        const candidates = await client.query<{
          id: string;
          link_url: string;
        }>(
          `
            SELECT id, link_url
            FROM scan_links
            WHERE scan_run_id = $1
              AND ignored_source != 'manual'
              AND ignored = false
          `,
          [scanRunId],
        );
        const ids: string[] = [];
        const regex =
          rule.rule_type === "regex"
            ? compileSafeRuleRegex(rule.pattern)
            : null;
        if (rule.rule_type === "regex" && !regex) continue;
        for (const row of candidates.rows) {
          if (rule.rule_type === "domain") {
            if (!matchesDomainRule(row.link_url, rule.pattern)) continue;
          } else if (rule.rule_type === "path_prefix") {
            if (!matchesPathPrefixRule(row.link_url, rule.pattern)) continue;
          } else if (rule.rule_type === "regex") {
            if (regex) regex.lastIndex = 0;
            if (!regex?.test(row.link_url)) continue;
          }
          ids.push(row.id);
        }
        if (ids.length > 0) {
          const res = await client.query(
            `
              UPDATE scan_links
              SET ignored = true,
                  ignored_source = 'rule',
                  ignored_by_rule_id = $2,
                  ignored_at = now(),
                  ignore_reason = $3
              WHERE id = ANY($1::uuid[])
                AND ignored_source != 'manual'
                AND ignored = false
            `,
            [ids, rule.id, reason],
          );
          ignoredCount += res.rowCount ?? 0;
        }
        continue;
      }
      if (rule.rule_type === "exact") {
        const res = await client.query(
          `
            UPDATE scan_links
            SET ignored = true,
                ignored_source = 'rule',
                ignored_by_rule_id = $2,
                ignored_at = now(),
                ignore_reason = $3
            WHERE scan_run_id = $1
              AND ignored_source != 'manual'
              AND ignored = false
              AND link_url = $4
          `,
          [scanRunId, rule.id, reason, rule.pattern],
        );
        ignoredCount += res.rowCount ?? 0;
      }
      if (rule.rule_type === "contains") {
        const res = await client.query(
          `
            UPDATE scan_links
            SET ignored = true,
                ignored_source = 'rule',
                ignored_by_rule_id = $2,
                ignored_at = now(),
                ignore_reason = $3
            WHERE scan_run_id = $1
              AND ignored_source != 'manual'
              AND ignored = false
              AND link_url ILIKE '%' || $4 || '%'
          `,
          [scanRunId, rule.id, reason, rule.pattern],
        );
        ignoredCount += res.rowCount ?? 0;
      }
      if (rule.rule_type === "status_code") {
        const code = Number(rule.pattern);
        if (!Number.isNaN(code)) {
          const res = await client.query(
            `
              UPDATE scan_links
              SET ignored = true,
                  ignored_source = 'rule',
                  ignored_by_rule_id = $2,
                  ignored_at = now(),
                  ignore_reason = $3
              WHERE scan_run_id = $1
                AND ignored_source != 'manual'
                AND ignored = false
                AND status_code = $4
            `,
            [scanRunId, rule.id, reason, code],
          );
          ignoredCount += res.rowCount ?? 0;
        }
      }
      if (rule.rule_type === "classification") {
        const res = await client.query(
          `
            UPDATE scan_links
            SET ignored = true,
                ignored_source = 'rule',
                ignored_by_rule_id = $2,
                ignored_at = now(),
                ignore_reason = $3
            WHERE scan_run_id = $1
              AND ignored_source != 'manual'
              AND ignored = false
              AND classification = $4
          `,
          [scanRunId, rule.id, reason, rule.pattern],
        );
        ignoredCount += res.rowCount ?? 0;
      }
    }

    await client.query(
      `
        INSERT INTO scan_ignore_apply_state (scan_run_id, last_applied_at, rules_hash)
        VALUES ($1, now(), $2)
        ON CONFLICT (scan_run_id)
        DO UPDATE SET last_applied_at = excluded.last_applied_at, rules_hash = excluded.rules_hash
      `,
      [scanRunId, rulesHash],
    );

    return { applied: true, ignoredCount, rulesHash };
  } finally {
    await client.query(`SELECT pg_advisory_unlock(hashtext($1))`, [scanRunId]);
  }
}
