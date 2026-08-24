/**
 * Helper script to automatically append or update a release item in releases.json
 * Usage:
 *   node scripts/publish-release.cjs --version=2.5.0 --title="Nuevo módulo de Inventario" --category="NEW" --tags="Inventario,Clínica" --summary="Control en tiempo real..."
 */

const fs = require("fs");
const path = require("path");

const RELEASES_FILE = path.join(__dirname, "../apps/web/src/features/novedades/data/releases.json");

function parseArgs() {
  const args = process.argv.slice(2);
  const result = {};

  for (const arg of args) {
    if (arg.startsWith("--")) {
      const [key, ...rest] = arg.slice(2).split("=");
      result[key] = rest.join("=");
    }
  }

  return result;
}

function main() {
  const args = parseArgs();
  const version = args.version || "1.0.0";
  const title = args.title || "Actualización de la plataforma";
  const summary = args.summary || "Mejoras generales de estabilidad y nuevas funcionalidades.";
  const category = (args.category || "IMPROVEMENT").toUpperCase();
  const tags = args.tags ? args.tags.split(",").map((t) => t.trim()) : ["Warner Suite"];
  const actionUrl = args.actionUrl || "/novedades";
  const actionLabel = args.actionLabel || "Explorar funcionalidad";

  const dateStr = new Date().toISOString().split("T")[0];
  const id = `rel-${dateStr}-${Date.now().toString(36)}`;

  const newRelease = {
    id,
    version,
    title,
    summary,
    content: args.content ? args.content.split("|").map((c) => c.trim()) : [summary],
    category: ["NEW", "IMPROVEMENT", "FIX", "ANNOUNCEMENT"].includes(category) ? category : "IMPROVEMENT",
    tags,
    publishedAt: dateStr,
    author: {
      name: args.author || "Equipo Warner Suite",
      role: "Warner Suite"
    },
    actionUrl,
    actionLabel
  };

  let releases = [];
  if (fs.existsSync(RELEASES_FILE)) {
    try {
      releases = JSON.parse(fs.readFileSync(RELEASES_FILE, "utf-8"));
    } catch (e) {
      console.warn("Could not parse existing releases.json, creating a new array.");
      releases = [];
    }
  }

  // Prepend to show newest first
  releases.unshift(newRelease);

  fs.writeFileSync(RELEASES_FILE, JSON.stringify(releases, null, 2), "utf-8");
  console.log(`[OK] Release ${version} (${id}) added successfully to releases.json`);
}

main();
