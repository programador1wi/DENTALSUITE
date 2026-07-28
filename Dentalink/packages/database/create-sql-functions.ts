import { config as loadEnv } from "dotenv";
import { resolve } from "node:path";
loadEnv({ path: resolve(__dirname, "../../.env") });

import { Pool } from "pg";

async function main() {
  console.log("Conectando a la base de datos para crear secuencias y funciones...");
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  
  const sql = `
    CREATE SEQUENCE IF NOT EXISTS "family_code_sequence" START 1;
    CREATE SEQUENCE IF NOT EXISTS "policy_number_sequence" START 1;

    CREATE OR REPLACE FUNCTION next_family_code()
    RETURNS TEXT
    LANGUAGE plpgsql
    AS $$
    DECLARE
      serial_value BIGINT;
    BEGIN
      serial_value := nextval('family_code_sequence');
      IF serial_value > 9999999 THEN
        RAISE EXCEPTION 'Se agotó la secuencia visible de familias';
      END IF;
      RETURN 'FAM-' || EXTRACT(YEAR FROM CURRENT_DATE)::TEXT || '-' || LPAD(serial_value::TEXT, 6, '0');
    END;
    $$;

    CREATE OR REPLACE FUNCTION next_policy_number()
    RETURNS TEXT
    LANGUAGE plpgsql
    AS $$
    DECLARE
      serial_value BIGINT;
    BEGIN
      serial_value := nextval('policy_number_sequence');
      IF serial_value > 9999999 THEN
        RAISE EXCEPTION 'Se agotó la secuencia visible de pólizas';
      END IF;
      RETURN 'POL-' || EXTRACT(YEAR FROM CURRENT_DATE)::TEXT || '-' || LPAD(serial_value::TEXT, 6, '0');
    END;
    $$;
  `;

  try {
    await pool.query(sql);
    console.log("Secuencias y funciones creadas exitosamente.");
  } catch (error) {
    console.error("Error al crear funciones SQL:", error);
  } finally {
    await pool.end();
  }
}

main();
