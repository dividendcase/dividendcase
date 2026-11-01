/** Ways to reach the project: GitHub's issue forms (.github/ISSUE_TEMPLATE), or email. */
const REPO = "https://github.com/dividendcase/dividendcase";

/** For people who'd rather not use GitHub; mail to it lands in a Resend inbox. */
export const FEEDBACK_EMAIL = "feedback@dividendcase.com";

function system(installMethod?: string | null): string {
  if (typeof navigator === "undefined") return "";
  const ua = navigator.userAgent;
  const os = /Windows/i.test(ua) ? "Windows" : /Mac OS X|Macintosh/i.test(ua) ? "macOS" : /Linux/i.test(ua) ? "Linux" : "";
  // The browser's system is the host's, which is also where Docker runs
  const how = installMethod === "docker" ? "Docker" : "uv";
  return os ? `${os}, installed with ${how}` : "";
}

/** The bug form, with the version, operating system and install method filled in. */
export function bugReportUrl(version?: string | null, installMethod?: string | null): string {
  const q = new URLSearchParams({ template: "bug_report.yml" });
  if (version) q.set("version", version);
  const sys = system(installMethod);
  if (sys) q.set("system", sys);
  return `${REPO}/issues/new?${q}`;
}

export function ideaUrl(): string {
  return `${REPO}/issues/new?template=idea.yml`;
}

export const FEEDBACK_URL = `${REPO}/issues/new/choose`;

/** A new email to FEEDBACK_EMAIL, with the version and system below the space to write in. */
export function feedbackMailto(version?: string | null, installMethod?: string | null): string {
  const about = [version ? `DividendCase ${version}` : "DividendCase", system(installMethod)].filter(Boolean).join(", ");
  // Spelled out: URLSearchParams writes spaces as "+", which mail apps show as they are
  return `mailto:${FEEDBACK_EMAIL}?subject=${encodeURIComponent("DividendCase feedback")}&body=${encodeURIComponent(`\n\n\n${about}`)}`;
}
