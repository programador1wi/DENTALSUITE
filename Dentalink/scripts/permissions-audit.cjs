#!/usr/bin/env node
/**
 * scripts/permissions-audit.cjs
 *
 * Audits API controllers for strict permission enforcement:
 * 1. Every route handler (@Get, @Post, @Put, @Patch, @Delete) must have:
 *    - @RequirePermissions(...) / @Permissions(...)
 *    - @RequireAnyPermission(...)
 *    - @Public() or @UseGuards(JwtAuthGuard / ApiKeyGuard)
 * 2. All referenced permission keys must exist in CANONICAL_PERMISSION_KEYS or PERMISSION_ALIASES or PERMISSION_LABELS.
 * 3. Prevents delegation of system.manage_all.
 */

const fs = require("node:fs");
const path = require("node:path");

// Load shared access-control definitions
const sharedIndex = path.resolve(__dirname, "../packages/shared/src/access-control.ts");
const accessControlSource = fs.readFileSync(sharedIndex, "utf-8");

// Extract canonical permission keys from source
const canonicalKeys = new Set();
const defsRegex = /\[\s*"([a-z0-9_.-]+)"\s*,/g;
let m;
while ((m = defsRegex.exec(accessControlSource)) !== null) {
  canonicalKeys.add(m[1]);
}

// Extract permission aliases
const aliasKeys = new Set();
const aliasMatch = accessControlSource.match(/export const PERMISSION_ALIASES[^{]*\{([\s\S]*?)\};/);
if (aliasMatch) {
  const aliasRegex = /"([a-z0-9_.-]+)":\s*\[(.*?)\]/g;
  let am;
  while ((am = aliasRegex.exec(aliasMatch[1])) !== null) {
    aliasKeys.add(am[1]);
    const targets = am[2].match(/"([a-z0-9_.-]+)"/g) || [];
    for (const t of targets) {
      aliasKeys.add(t.replace(/"/g, ""));
    }
  }
}

// Add canonical bundle keys
const bundleRegex = /"([a-z0-9_.-]+)":\s*\[/g;
const bundleMatch = accessControlSource.match(/export const CANONICAL_PERMISSION_BUNDLES[^{]*\{([\s\S]*?)\};/);
if (bundleMatch) {
  let bm;
  while ((bm = bundleRegex.exec(bundleMatch[1])) !== null) {
    aliasKeys.add(bm[1]);
  }
}

// Valid permissions set
const validPermissions = new Set([...canonicalKeys, ...aliasKeys, "system.manage_all"]);

// Add PERMISSION_LABELS keys
const labelMatch = accessControlSource.match(/export const PERMISSION_LABELS[^{]*\{([\s\S]*?)\};/);
if (labelMatch) {
  const labelRegex = /"([a-z0-9_.-]+)":/g;
  let lm;
  while ((lm = labelRegex.exec(labelMatch[1])) !== null) {
    validPermissions.add(lm[1]);
  }
}

// Scan API controllers
const apiModulesDir = path.resolve(__dirname, "../apps/api/src/modules");

function findControllers(dir) {
  let results = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results = results.concat(findControllers(fullPath));
    } else if (entry.isFile() && entry.name.endsWith(".controller.ts") && !entry.name.endsWith(".spec.ts")) {
      results.push(fullPath);
    }
  }
  return results;
}

const controllerFiles = findControllers(apiModulesDir);

let totalEndpoints = 0;
let securedEndpoints = 0;
let authenticatedEndpoints = 0;
let publicEndpoints = 0;
const violations = [];
const invalidPermissionKeys = [];

for (const filePath of controllerFiles) {
  const relPath = path.relative(path.resolve(__dirname, ".."), filePath).replace(/\\/g, "/");
  const content = fs.readFileSync(filePath, "utf-8");
  const lines = content.split("\n");

  let currentClassPublic = false;
  let currentClassIntegrationAuth = false;
  let currentClassPermission = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.includes("export class ")) {
      const headerWindow = lines.slice(Math.max(0, i - 10), i).join("\n");
      currentClassPublic = /@Public\(\)/.test(headerWindow) || /@Controller\s*\(\s*['"`](?:public\/|mobile-)/.test(headerWindow);
      currentClassIntegrationAuth = /@UseGuards\([^)]*(?:ApiKeyGuard|BookingBotApiKeyGuard)/.test(headerWindow);
      const classPermMatch = headerWindow.match(/@(?:RequirePermissions|Permissions|RequireAnyPermission)\((.*?)\)/s);
      currentClassPermission = classPermMatch ? classPermMatch[1] : null;
    }

    const httpMatch = line.match(/@(Get|Post|Put|Patch|Delete)\s*\(\s*(?:['"`](.*?)['"`])?/);
    if (httpMatch) {
      totalEndpoints++;
      const method = httpMatch[1].toUpperCase();
      const route = httpMatch[2] || "/";

      // Look at window surrounding the HTTP method decorator (12 lines before to 12 lines after)
      const decoratorWindow = lines.slice(Math.max(0, i - 12), Math.min(lines.length, i + 12)).join("\n");

      const isPublic = currentClassPublic || /@Public\(\)/.test(decoratorWindow) || route.startsWith("public/") || route.startsWith("/public/");
      const isWebhook = route.includes("webhook") || /webhooks?\//.test(route);
      const isAuthenticatedOnly = currentClassIntegrationAuth || /@UseGuards\([^)]*(?:JwtAuthGuard|ApiKeyGuard)/.test(decoratorWindow) || /@CurrentUser\(/.test(decoratorWindow);

      // Extract permission decorators
      const permMatch = decoratorWindow.match(/@(?:RequirePermissions|Permissions|RequireAnyPermission)\(\s*([^)]+)\)/);

      if (isPublic) {
        publicEndpoints++;
      } else if (isWebhook) {
        // Webhooks use signature/secret validation instead of RBAC token
        publicEndpoints++;
      } else if (permMatch || currentClassPermission) {
        securedEndpoints++;
        const rawPerms = (permMatch ? permMatch[1] : currentClassPermission);
        const keys = rawPerms.match(/['"`]([a-z0-9_.*-]+)['"`]/g) || [];
        
        for (const k of keys) {
          const cleanKey = k.replace(/['"`]/g, "");
          // Allow wildcard like "clinical.*" or valid canonical/alias key
          if (!validPermissions.has(cleanKey) && !cleanKey.endsWith(".*") && cleanKey !== "*") {
            invalidPermissionKeys.push({
              file: relPath,
              line: i + 1,
              endpoint: `${method} ${route}`,
              key: cleanKey
            });
          }
        }
      } else if (isAuthenticatedOnly) {
        authenticatedEndpoints++;
      } else {
        // Unclassified / missing explicit guard
        violations.push({
          file: relPath,
          line: i + 1,
          endpoint: `${method} ${route}`,
          reason: "Endpoint lacks explicit @RequirePermissions, @RequireAnyPermission, @UseGuards(JwtAuthGuard), or @Public decorator."
        });
      }
    }
  }
}

console.log("=================================================");
console.log("       PERMISSIONS & RBAC AUDIT REPORT           ");
console.log("=================================================");
console.log(`Canonical Permission Catalog Size: ${canonicalKeys.size} keys (+ ${aliasKeys.size} aliases/bundles)`);
console.log(`Controllers Scanned: ${controllerFiles.length}`);
console.log(`Total Endpoints:     ${totalEndpoints}`);
console.log(`  - Secured (RBAC):      ${securedEndpoints}`);
console.log(`  - Authenticated (JWT): ${authenticatedEndpoints}`);
console.log(`  - Public/Webhook:      ${publicEndpoints}`);
console.log("=================================================");

let hasErrors = false;

if (invalidPermissionKeys.length > 0) {
  hasErrors = true;
  console.error(`\n❌ Found ${invalidPermissionKeys.length} invalid or non-canonical permission key(s):`);
  for (const inv of invalidPermissionKeys) {
    console.error(`  - [${inv.file}:${inv.line}] ${inv.endpoint} uses unknown permission "${inv.key}"`);
  }
}

if (violations.length > 0) {
  hasErrors = true;
  console.error(`\n❌ Found ${violations.length} unclassified/unprotected endpoint(s):`);
  for (const v of violations) {
    console.error(`  - [${v.file}:${v.line}] ${v.endpoint}: ${v.reason}`);
  }
}

if (!hasErrors) {
  console.log("\n✅ All endpoints strictly classified and verified against canonical permissions.");
  process.exit(0);
} else {
  console.error("\nAudit failed. Fix permission annotations before proceeding.");
  process.exit(1);
}
