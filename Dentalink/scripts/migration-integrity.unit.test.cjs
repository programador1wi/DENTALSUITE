const test = require("node:test");
const assert = require("node:assert/strict");
const { classifyMigrationRecord, variants } = require("./migration-integrity.cjs");

test("migration checksum variants distinguish line endings from SQL changes", () => {
  const lf = variants(Buffer.from("SELECT 1;\nSELECT 2;\n"));
  const crlf = variants(Buffer.from("SELECT 1;\r\nSELECT 2;\r\n"));
  const changed = variants(Buffer.from("SELECT 1;\nSELECT 3;\n"));
  assert.equal(lf.lf, crlf.lf);
  assert.notEqual(lf.lf, changed.lf);
});

test("migration records ignore rolled back attempts and flag material drift", () => {
  const hashes = variants(Buffer.from("SELECT 1;\n"));
  assert.equal(
    classifyMigrationRecord(
      { checksum: "manual", finished_at: null, rolled_back_at: new Date() },
      true,
      hashes
    ),
    "ROLLED_BACK_RECORD"
  );
  assert.equal(
    classifyMigrationRecord(
      { checksum: hashes.crlf, finished_at: new Date(), rolled_back_at: null },
      true,
      hashes
    ),
    "LINE_ENDINGS_ONLY"
  );
  assert.equal(
    classifyMigrationRecord(
      { checksum: "material-difference", finished_at: new Date(), rolled_back_at: null },
      true,
      hashes
    ),
    "SQL_CONTENT_DIFFERS"
  );
});
