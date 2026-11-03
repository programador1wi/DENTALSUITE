const { readFileSync, readdirSync } = require("node:fs");
const { relative, resolve, sep } = require("node:path");

const projectRoot = resolve(__dirname, "..");
const inventoryPath = resolve(projectRoot, "docs/architecture/god-files-refactor.json");
const inventory = JSON.parse(readFileSync(inventoryPath, "utf8"));
const strict = process.argv.includes("--strict");
const sourceRoots = ["apps/api/src", "apps/web/src", "packages/shared/src"];
const sourceExtensions = new Set([".ts", ".tsx"]);

function filesBelow(directory) {
  const absoluteDirectory = resolve(projectRoot, directory);
  const entries = readdirSync(absoluteDirectory, { withFileTypes: true });
  return entries.flatMap((entry) => {
    const absolutePath = resolve(absoluteDirectory, entry.name);
    if (entry.isDirectory()) return filesBelow(relative(projectRoot, absolutePath));
    return [relative(projectRoot, absolutePath).split(sep).join("/")];
  });
}

function isProductionCandidate(file) {
  if (![...sourceExtensions].some((extension) => file.endsWith(extension))) return false;
  if (/\.(spec|test)\.[cm]?[jt]sx?$/.test(file)) return false;
  if (file.includes("/dto/")) return false;
  if (/(^|\/)(?:.*catalog|.*metric-definition|access-control)\.ts$/.test(file)) return false;
  return true;
}

function lineCount(content) {
  return content.split(/\r?\n/).length;
}

const allFiles = sourceRoots.flatMap(filesBelow).filter(isProductionCandidate);
const largeFiles = allFiles
  .map((file) => ({ file, lines: lineCount(readFileSync(resolve(projectRoot, file), "utf8")) }))
  .filter(({ lines }) => lines > inventory.threshold)
  .sort((left, right) => right.lines - left.lines);
const inventoryByFile = new Map(inventory.files.map((entry) => [entry.file, entry]));
const invalidExceptions = inventory.files.filter(
  (entry) => entry.status === "cohesive-exception" && !entry.reason?.trim()
);
const unknownLargeFiles = largeFiles.filter(({ file }) => !inventoryByFile.has(file));
const unresolvedFiles = strict
  ? largeFiles.filter(({ file }) => {
      const entry = inventoryByFile.get(file);
      return entry?.status !== "cohesive-exception" || !entry.reason?.trim();
    })
  : [];

const legacyDomainDependencies = new Set(inventory.legacyDomainDependencies ?? []);
const allDomainViolations = allFiles.flatMap((file) => {
  if (!file.includes("/domain/")) return [];
  const content = readFileSync(resolve(projectRoot, file), "utf8");
  const forbidden = [...content.matchAll(/^import\s.+?from\s+["']([^"']+)["'];?$/gm)]
    .map((match) => match[1])
    .filter((specifier) =>
      specifier.startsWith("@nestjs/") ||
      specifier === "@prisma/client" ||
      specifier.includes("database/prisma") ||
      specifier === "axios"
    );
  return forbidden.length ? [{ file, forbidden }] : [];
});
const domainViolations = strict
  ? allDomainViolations
  : allDomainViolations.filter(({ file }) => !legacyDomainDependencies.has(file));

console.log(`Architecture audit: ${allFiles.length} production files scanned.`);
console.log(`Files over ${inventory.threshold} lines: ${largeFiles.length}.`);
for (const { file, lines } of largeFiles) {
  const status = inventoryByFile.get(file)?.status ?? "UNTRACKED";
  console.log(`- ${lines} ${status} ${file}`);
}

if (domainViolations.length) {
  console.error("Domain dependency violations:");
  for (const violation of domainViolations) {
    console.error(`- ${violation.file}: ${violation.forbidden.join(", ")}`);
  }
}
if (!strict && allDomainViolations.length !== domainViolations.length) {
  console.warn(`${allDomainViolations.length - domainViolations.length} legacy domain dependency violations remain tracked.`);
}
if (unknownLargeFiles.length) {
  console.error("Untracked production files exceeded the god-file threshold.");
}
if (invalidExceptions.length) {
  console.error("Cohesive exceptions require a concrete reason.");
}
if (unresolvedFiles.length) {
  console.error("Strict audit failed: tracked god files remain unresolved.");
}

if (domainViolations.length || unknownLargeFiles.length || invalidExceptions.length || unresolvedFiles.length) {
  process.exitCode = 1;
}
