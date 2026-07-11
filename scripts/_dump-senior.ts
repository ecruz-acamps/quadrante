import XLSX from "xlsx";
import fs from "fs";
import path from "path";
const dir = "/home/true/quadrante";
const files = fs.readdirSync(dir).filter(f => /^(1[2-9]|2[01])/.test(f) && f.endsWith(".xlsx")).sort();
for (const f of files) {
  const wb = XLSX.readFile(path.join(dir, f));
  console.log(`\n############ ${f}`);
  for (const s of wb.SheetNames) {
    const rows = XLSX.utils.sheet_to_json<any[]>(wb.Sheets[s], { header: 1, defval: null });
    const nonEmpty = rows.filter(r => r.some((c:any) => c !== null && String(c).trim() !== ""));
    console.log(`\n=== [${s}] rows=${rows.length} nonEmpty=${nonEmpty.length}`);
    for (const r of nonEmpty.slice(0, 12)) {
      console.log(JSON.stringify(r.slice(0, 14)));
    }
  }
}
