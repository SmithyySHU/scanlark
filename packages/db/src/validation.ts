const EMAIL_MAX_LENGTH = 254;
const EMAIL_LOCAL_MAX_LENGTH = 64;
const EMAIL_ALLOWED_LOCAL = new Set([
  "!",
  "#",
  "$",
  "%",
  "&",
  "'",
  "*",
  "+",
  "-",
  "/",
  "=",
  "?",
  "^",
  "_",
  "`",
  "{",
  "|",
  "}",
  "~",
  ".",
]);

function isAsciiLetterOrDigit(char: string) {
  const code = char.charCodeAt(0);
  return (
    (code >= 48 && code <= 57) ||
    (code >= 65 && code <= 90) ||
    (code >= 97 && code <= 122)
  );
}

function isAllowedLocalChar(char: string) {
  return isAsciiLetterOrDigit(char) || EMAIL_ALLOWED_LOCAL.has(char);
}

function isValidDomainLabel(label: string) {
  if (!label || label.length > 63) return false;
  if (!isAsciiLetterOrDigit(label[0])) return false;
  if (!isAsciiLetterOrDigit(label[label.length - 1])) return false;
  for (const char of label) {
    if (!isAsciiLetterOrDigit(char) && char !== "-") return false;
  }
  return true;
}

export function isValidEmailAddress(value: string) {
  if (value.length === 0 || value.length > EMAIL_MAX_LENGTH) return false;
  if (/\s/.test(value)) return false;

  const atIndex = value.indexOf("@");
  if (atIndex <= 0 || atIndex !== value.lastIndexOf("@")) return false;

  const local = value.slice(0, atIndex);
  const domain = value.slice(atIndex + 1);
  if (!local || !domain) return false;
  if (local.length > EMAIL_LOCAL_MAX_LENGTH) return false;
  if (local.startsWith(".") || local.endsWith(".") || local.includes("..")) {
    return false;
  }
  for (const char of local) {
    if (!isAllowedLocalChar(char)) return false;
  }

  const labels = domain.split(".");
  if (labels.length < 2) return false;
  for (const label of labels) {
    if (!isValidDomainLabel(label)) return false;
  }

  return true;
}

function isPotentiallyUnsafeRegex(pattern: string) {
  if (pattern.length === 0 || pattern.length > 256) return true;
  if (pattern.includes("(?<") || pattern.includes("\\1")) return true;

  let inClass = false;
  let escaped = false;
  let depth = 0;
  const groupHasQuantifier: boolean[] = [];

  for (let index = 0; index < pattern.length; index += 1) {
    const char = pattern[index];

    if (escaped) {
      escaped = false;
      continue;
    }
    if (char === "\\") {
      escaped = true;
      continue;
    }
    if (char === "[") {
      if (!inClass) inClass = true;
      continue;
    }
    if (char === "]") {
      if (inClass) inClass = false;
      continue;
    }
    if (inClass) continue;

    if (char === "(") {
      const next = pattern[index + 1];
      if (next === "?") {
        const modifier = pattern[index + 2];
        if (modifier !== ":" && modifier !== "=" && modifier !== "!") {
          return true;
        }
      }
      depth += 1;
      groupHasQuantifier.push(false);
      continue;
    }
    if (char === ")") {
      const groupUsedQuantifier = groupHasQuantifier.pop() ?? false;
      depth = Math.max(0, depth - 1);
      const next = pattern[index + 1];
      const groupIsRepeated =
        next === "*" ||
        next === "+" ||
        next === "?" ||
        next === "{";
      if (groupUsedQuantifier && groupIsRepeated) {
        return true;
      }
      continue;
    }

    const isQuantifier =
      char === "*" || char === "+" || char === "?" || char === "{";
    if (isQuantifier && depth > 0 && groupHasQuantifier.length > 0) {
      groupHasQuantifier[groupHasQuantifier.length - 1] = true;
    }
  }

  return false;
}

export function validateSafeRegexPattern(pattern: string): string | null {
  if (isPotentiallyUnsafeRegex(pattern)) {
    return "Regex pattern uses unsupported or unsafe constructs";
  }
  return null;
}
