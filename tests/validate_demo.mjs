import fs from "node:fs/promises";
import path from "node:path";
const root = path.resolve(import.meta.dirname, "..");
const read = async n => (await fs.readFile(path.join(root,"data","incoming",n),"utf8")).trim().split(/\r?\n/);
const sales = await read("sales.csv");
const bridge = await read("product_promotion_bridge.csv");
const metrics = JSON.parse(await fs.readFile(path.join(root,"data","expected_metrics.json"),"utf8"));
const checks = [
  ["sales row count", sales.length === 2407],
  ["bridge row count", bridge.length - 1 === metrics.bridgeRows],
  ["many-to-many exists", metrics.bridgeRows > 30],
  ["naive join overstates revenue", metrics.naivePromotionRevenue > metrics.netRevenue],
  ["controlled issues documented", metrics.controlledIssueTypes === 6 && metrics.rejectedRows === 7]
];
for (const [name, ok] of checks) { console.log(`${ok ? "PASS" : "FAIL"}: ${name}`); if (!ok) process.exitCode = 1; }
