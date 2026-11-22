import { eq } from "drizzle-orm";
import { getDbDriver, getPgDb, getSqliteDb } from "./client.js";
import { companyTxtFiles, type CompanyTxtFileRow } from "./schema.pg.js";
import { companyTxtFilesSqlite } from "./schema.sqlite.js";

export type CompanyTxtFile = CompanyTxtFileRow;

export async function getCompanyTxtFiles(companyName: string): Promise<CompanyTxtFile[] | null> {
  const name = companyName.trim();
  if (!name) return null;
  if (getDbDriver() === "sqlite") {
    const [row] = await getSqliteDb()
      .select()
      .from(companyTxtFilesSqlite)
      .where(eq(companyTxtFilesSqlite.companyName, name))
      .limit(1);
    return row ? row.files : null;
  }
  const [row] = await getPgDb()
    .select()
    .from(companyTxtFiles)
    .where(eq(companyTxtFiles.companyName, name))
    .limit(1);
  return row ? row.files : null;
}

export async function saveCompanyTxtFiles(companyName: string, files: CompanyTxtFile[]): Promise<CompanyTxtFile[]> {
  const name = companyName.trim();
  const values = { companyName: name, files, updatedAt: new Date() };
  if (getDbDriver() === "sqlite") {
    await getSqliteDb()
      .insert(companyTxtFilesSqlite)
      .values(values)
      .onConflictDoUpdate({
        target: companyTxtFilesSqlite.companyName,
        set: { files: values.files, updatedAt: values.updatedAt },
      });
  } else {
    await getPgDb()
      .insert(companyTxtFiles)
      .values(values)
      .onConflictDoUpdate({
        target: companyTxtFiles.companyName,
        set: { files: values.files, updatedAt: values.updatedAt },
      });
  }
  return files;
}
