import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, extname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const sourceRoot = join(projectRoot, "src");
const baselinePath = join(projectRoot, "scripts", "ui-audit-baseline.json");

const rules = {
  hardcodedHex: /#[0-9a-fA-F]{3,8}\b/g,
  arbitraryPixelWidth: /(?:min-|max-)?w-\[\d+px\]/g,
  horizontalOverflow: /overflow-x-(?:auto|scroll)/g,
  globalAggressiveWrap: /body\s*\{[^}]*overflow-wrap\s*:\s*anywhere/gs,
  earlyDesktopTable: /hidden\s+(?:sm|md|lg):block[^>]*>[\s\S]{0,180}<table/g,
  largeRadius: /rounded-(?:xl|2xl|3xl)/g,
  decorativeShadow: /shadow-(?:lg|xl|2xl)/g,
  decorativeGradient: /bg-gradient-(?:to|from)/g
};

function walk(directory) {
  return readdirSync(directory).flatMap((name) => {
    const path = join(directory, name);
    const stat = statSync(path);
    if (stat.isDirectory()) return walk(path);
    if (![".ts", ".tsx", ".css"].includes(extname(path))) return [];
    if (/\.(?:test|spec)\.[jt]sx?$/.test(path)) return [];
    return [path];
  });
}

const files = walk(sourceRoot);
const totals = Object.fromEntries(Object.keys(rules).map((rule) => [rule, 0]));
const byFile = [];

for (const file of files) {
  const content = readFileSync(file, "utf8");
  const counts = {};
  for (const [rule, pattern] of Object.entries(rules)) {
    const count = content.match(pattern)?.length ?? 0;
    totals[rule] += count;
    if (count) counts[rule] = count;
  }
  const unmarkedHorizontalOverflow = content
    .split(/\r?\n/)
    .filter((line) => /overflow-x-(?:auto|scroll)/.test(line) && !/data-responsive-overflow/.test(line)).length;
  totals.unmarkedHorizontalOverflow = (totals.unmarkedHorizontalOverflow ?? 0) + unmarkedHorizontalOverflow;
  if (unmarkedHorizontalOverflow) counts.unmarkedHorizontalOverflow = unmarkedHorizontalOverflow;
  if (Object.keys(counts).length) {
    byFile.push({ file: relative(projectRoot, file).replaceAll("\\", "/"), counts });
  }
}

const router = readFileSync(join(sourceRoot, "app", "routes", "router.tsx"), "utf8");
const routeCount = router.match(/\bpath:\s*["']/g)?.length ?? 0;
const baseline = JSON.parse(readFileSync(baselinePath, "utf8"));
const regressions = Object.entries(totals).filter(([rule, count]) => count > (baseline[rule] ?? 0));
const forbidden = ["globalAggressiveWrap", "earlyDesktopTable"].filter((rule) => totals[rule] > 0);

console.log(`UI audit: ${files.length} source files, ${routeCount} route declarations.`);
console.table(totals);

if (process.argv.includes("--details")) {
  const highestSignal = byFile
    .map((entry) => ({ ...entry, total: Object.values(entry.counts).reduce((sum, count) => sum + count, 0) }))
    .sort((left, right) => right.total - left.total)
    .slice(0, 20);
  console.table(highestSignal.map(({ file, total, counts }) => ({ file, total, ...counts })));
}

if (regressions.length || forbidden.length) {
  console.error("UI audit found pattern counts above the accepted baseline:");
  for (const [rule, count] of regressions) {
    console.error(`- ${rule}: ${count} (baseline ${baseline[rule] ?? 0})`);
  }
  for (const rule of forbidden) {
    console.error(`- ${rule}: ${totals[rule]} (must remain 0)`);
  }
  process.exitCode = 1;
} else {
  console.log("UI audit passed: no audited pattern increased above baseline.");
}
