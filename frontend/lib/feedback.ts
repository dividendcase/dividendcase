/** Links to the project's GitHub issue forms (.github/ISSUE_TEMPLATE). */
const REPO = "https://github.com/dividendcase/dividendcase";

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
