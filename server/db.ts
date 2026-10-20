import "dotenv/config";
import { Pool, type PoolClient } from "pg";
const globalDb = globalThis as unknown as { samadaPool?: Pool };
export const db = globalDb.samadaPool ||= new Pool({ connectionString: process.env.DATABASE_URL, max: 10, connectionTimeoutMillis:5000 });
export async function transaction<T>(work: (client: PoolClient) => Promise<T>): Promise<T> {
  const client=await db.connect();
  try { await client.query("BEGIN"); const result=await work(client); await client.query("COMMIT"); return result; }
  catch(error) { await client.query("ROLLBACK"); throw error; }
  finally { client.release(); }
}
