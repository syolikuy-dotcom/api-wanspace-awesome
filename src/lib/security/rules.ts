/** Aturan statis untuk mendeteksi scanner/bot jahat. Murah (regex) sehingga aman di middleware. */

export const BAD_UA =
  /(sqlmap|nikto|nmap|masscan|zgrab|acunetix|nessus|dirbuster|gobuster|wpscan|havij|fimap|jorgee|zmeu|nuclei|openvas|burpcollaborator|metasploit)/i;

export const PROBE_PATH =
  /(^|\/)(\.env|\.git|\.svn|\.hg|\.DS_Store|\.aws|\.ssh|id_rsa|wp-admin|wp-login|wp-content|wp-includes|xmlrpc\.php|phpmyadmin|phpinfo|cgi-bin|actuator|vendor\/phpunit|eval-stdin|admin\.php|shell\.php|backup\.(zip|sql|tar|gz)|config\.(php|yml|yaml|json))/i;

export const HONEYPOT_API = /^\/api\/(admin|debug|internal|private|secret|secrets|config|env|backup|console)(\/|$)/i;

export const TRAVERSAL = /(\.\.[\\/]|%2e%2e|%00|\\x00)/i;

export const MAX_URL_LENGTH = 4096;

export type Verdict = { ok: true } | { ok: false; status: number; reason: string; strike: boolean };

export function inspect(pathname: string, search: string, ua: string, method: string): Verdict {
  if (pathname.length + search.length > MAX_URL_LENGTH) {
    return { ok: false, status: 414, reason: "uri_too_long", strike: false };
  }
  if (TRAVERSAL.test(pathname) || TRAVERSAL.test(search)) {
    return { ok: false, status: 400, reason: "bad_request", strike: true };
  }
  if (PROBE_PATH.test(pathname) || HONEYPOT_API.test(pathname)) {
    return { ok: false, status: 404, reason: "not_found", strike: true };
  }
  if (BAD_UA.test(ua)) {
    return { ok: false, status: 403, reason: "forbidden", strike: true };
  }
  if (pathname.startsWith("/api") && method !== "GET" && method !== "HEAD" && method !== "OPTIONS") {
    return { ok: false, status: 405, reason: "method_not_allowed", strike: false };
  }
  return { ok: true };
}
