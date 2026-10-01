// Uso: DATABASE_URL="postgresql://postgres.<ref>:<senha>@aws-0-sa-east-1.pooler.supabase.com:5432/postgres" node scripts/apply-schema.mjs
// Usar o host do pooler (não o "db.<ref>.supabase.co" direto): o direto só tem endereço IPv6,
// e redes sem rota IPv6 não conseguem resolver o DNS.
import { readFileSync } from "node:fs";
import { Client } from "pg";

const sql = readFileSync(new URL("../supabase/schema.sql", import.meta.url), "utf8");

const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

await client.connect();
try {
  await client.query(sql);
  console.log("Schema aplicado com sucesso.");
} finally {
  await client.end();
}
