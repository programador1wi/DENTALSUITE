const path = require("node:path");
const { Client } = require("pg");
require("dotenv").config({ path: path.resolve(__dirname, "..", ".env"), quiet: true });

async function main() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    const { rows } = await client.query(`
      SELECT jsonb_build_object(
        'legacyLists', (SELECT count(*) FROM "PriceList"),
        'versionedLists', (SELECT count(DISTINCT "priceListId") FROM "PriceListVersion"),
        'legacyItems', (SELECT count(*) FROM "PriceListItem"),
        'versionedLegacyItems', (SELECT count(*) FROM "PriceListVersionItem" WHERE "legacyPriceListItemId" IS NOT NULL),
        'missingVersionForLegacyList', (
          SELECT count(*) FROM "PriceList" pl
          WHERE NOT EXISTS (SELECT 1 FROM "PriceListVersion" plv WHERE plv."priceListId" = pl."id")
        ),
        'duplicateVersionItems', (
          SELECT count(*) FROM (
            SELECT "priceListVersionId", "procedureId", coalesce("procedureVariantId", ''), count(*)
            FROM "PriceListVersionItem"
            GROUP BY 1, 2, 3 HAVING count(*) > 1
          ) duplicated
        ),
        'historicalItemsWithCodeSnapshot', (
          SELECT count(*) FROM "TreatmentPlanItem" WHERE "procedureCodeSnapshot" IS NOT NULL
        ),
        'historicalItemsWithVersionSnapshot', (
          SELECT count(*) FROM "TreatmentPlanItem" WHERE "priceListId" IS NOT NULL AND "priceListVersionId" IS NOT NULL
        ),
        'migrationAuditEvents', (
          SELECT count(*) FROM "PricingAuditEvent" WHERE "action" = 'legacy_backfill'
        )
      ) AS verification
    `);
    const verification = rows[0].verification;
    console.log(JSON.stringify(verification, null, 2));
    if (
      verification.legacyLists !== verification.versionedLists ||
      verification.legacyItems !== verification.versionedLegacyItems ||
      verification.missingVersionForLegacyList !== 0 ||
      verification.duplicateVersionItems !== 0
    ) {
      throw new Error("Price list v2 verification failed");
    }
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
