const { createHash } = require("node:crypto");
const { existsSync, readFileSync, readdirSync, writeFileSync } = require("node:fs");
const { relative, resolve, sep } = require("node:path");

const projectRoot = resolve(__dirname, "..");
const baselinePath = resolve(projectRoot, "docs/architecture/route-contract-baseline.json");
const update = process.argv.includes("--update");

function filesBelow(directory) {
  const absoluteDirectory = resolve(projectRoot, directory);
  return readdirSync(absoluteDirectory, { withFileTypes: true }).flatMap((entry) => {
    const absolutePath = resolve(absoluteDirectory, entry.name);
    if (entry.isDirectory()) return filesBelow(relative(projectRoot, absolutePath));
    return [relative(projectRoot, absolutePath).split(sep).join("/")];
  });
}

function normalizedApiRoutes() {
  const controllerFiles = filesBelow("apps/api/src/modules")
    .filter((file) => file.endsWith(".controller.ts"))
    .sort();
  const routes = [];
  for (const file of controllerFiles) {
    const source = readFileSync(resolve(projectRoot, file), "utf8");
    const controller = source.match(/@Controller\(([^)]*)\)/)?.[1]?.trim() ?? "";
    const decorators = [...source.matchAll(/@(Get|Post|Put|Patch|Delete)\(([^)]*)\)/g)];
    for (const match of decorators) routes.push(`${file}|${controller}|${match[1].toUpperCase()}|${match[2].trim()}`);
  }
  return routes;
}

function normalizedWebRoutes() {
  const files = ["apps/web/src/app/routes/router.tsx", "apps/web/src/lib/routes.ts"];
  return files.flatMap((file) => {
    const source = readFileSync(resolve(projectRoot, file), "utf8");
    const paths = [...source.matchAll(/(?:\bpath\s*:|=>)\s*[`"']([^`"']+)[`"']/g)].map((match) => match[1]);
    return paths.map((path) => `${file}|${path}`);
  });
}

function digest(values) {
  return createHash("sha256").update(values.join("\n")).digest("hex");
}

const apiRoutes = normalizedApiRoutes();
const webRoutes = normalizedWebRoutes();
const current = {
  version: 1,
  api: { count: apiRoutes.length, sha256: digest(apiRoutes) },
  web: { count: webRoutes.length, sha256: digest(webRoutes) }
};

if (update || !existsSync(baselinePath)) {
  writeFileSync(baselinePath, `${JSON.stringify(current, null, 2)}\n`, "utf8");
  console.log(`Route contract baseline updated: API ${current.api.count}, web ${current.web.count}.`);
  process.exit(0);
}

const baseline = JSON.parse(readFileSync(baselinePath, "utf8"));
if (JSON.stringify(current) !== JSON.stringify(baseline)) {
  console.error("Route contract changed.");
  console.error(`Expected: ${JSON.stringify(baseline)}`);
  console.error(`Current:  ${JSON.stringify(current)}`);
  process.exit(1);
}
console.log(`Route contracts unchanged: API ${current.api.count}, web ${current.web.count}.`);
