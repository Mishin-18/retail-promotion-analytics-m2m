import fs from "node:fs/promises";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const outDir = path.join(root, "data", "incoming");
await fs.mkdir(outDir, { recursive: true });

let state = 5362026;
const rnd = () => ((state = (state * 1664525 + 1013904223) >>> 0) / 4294967296);
const pick = (xs) => xs[Math.floor(rnd() * xs.length)];
const csv = (rows) => rows.map(r => r.map(v => {
  const s = String(v ?? "");
  return /[;"\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
}).join(";")).join("\n") + "\n";

const stores = [
  ["S01","Belgrade Center","Belgrade","Urban"], ["S02","Novi Beograd","Belgrade","Mall"],
  ["S03","Novi Sad North","Novi Sad","Urban"], ["S04","Nis South","Nis","Urban"],
  ["S05","Kragujevac","Kragujevac","Regional"], ["S06","Subotica","Subotica","Regional"]
];
const categories = ["Beverages","Bakery","Dairy","Snacks","Household","Personal Care"];
const products = Array.from({length: 30}, (_, i) => {
  const category = categories[i % categories.length];
  return [`P${String(i+1).padStart(3,"0")}`, `${category} Item ${String(i+1).padStart(2,"0")}`, category, 1.35 + (i % 9) * 0.72];
});
const promotions = [
  ["PR01","Breakfast Bundle","Bundle","2025-01-15","2025-03-31"],
  ["PR02","Weekend Saver","Discount","2025-02-01","2025-06-30"],
  ["PR03","Healthy Choice","Category","2025-04-01","2025-09-30"],
  ["PR04","Summer Essentials","Seasonal","2025-06-01","2025-08-31"],
  ["PR05","Back to Routine","Seasonal","2025-09-01","2025-10-31"],
  ["PR06","Holiday Value","Discount","2025-11-01","2025-12-31"]
];

// Intentional many-to-many mapping: every promotion contains many products and
// selected products participate in multiple promotions.
const bridge = [];
for (let p = 0; p < products.length; p++) {
  const memberships = new Set([p % promotions.length]);
  if (p % 3 === 0) memberships.add((p + 1) % promotions.length);
  if (p % 10 === 0) memberships.add((p + 3) % promotions.length);
  for (const promoIndex of memberships) bridge.push([products[p][0], promotions[promoIndex][0], 1 / memberships.size]);
}

const customers = Array.from({length: 240}, (_, i) => [
  `C${String(i+1).padStart(4,"0")}`,
  pick(["Value","Convenience","Family","Premium"]),
  pick(["Belgrade","Novi Sad","Nis","Kragujevac","Subotica"])
]);

const start = Date.UTC(2025,0,1);
const sales = [];
for (let i = 0; i < 2400; i++) {
  const d = new Date(start + Math.floor(rnd()*365)*86400000);
  const product = pick(products);
  const qty = 1 + Math.floor(rnd()*5);
  const price = +(product[3] * (1 + (rnd()-0.5)*0.18)).toFixed(2);
  const gross = +(qty*price).toFixed(2);
  const discount = rnd() < 0.36 ? +(gross * pick([0.05,0.10,0.15,0.20])).toFixed(2) : 0;
  const returned = rnd() < 0.045 ? 1 : 0;
  const cost = +(gross * (0.55 + rnd()*0.16)).toFixed(2);
  sales.push([
    `T${String(i+1).padStart(6,"0")}`, d.toISOString().slice(0,10), pick(stores)[0], product[0], pick(customers)[0],
    qty, price, discount, returned, cost
  ]);
}

// Controlled data-quality exceptions used by the Power Query audit.
sales.push([...sales[17]]);                         // duplicate TransactionID
sales.push(["T900001","2025-05-12","S02","P999","C0003",2,3.25,0,0,3.80]); // orphan product
sales.push(["T900002","2025-07-04","S99","P004","C0010",1,4.10,0,0,2.30]); // orphan store
sales.push(["T900003","2025-08-09","S04","P007","C9999",2,2.90,0,0,3.20]); // orphan customer
sales.push(["T900004","2025-10-11","S03","P011","C0025",0,5.20,0,0,0]);    // invalid quantity
sales.push(["T900005","2026-02-01","S01","P015","C0030",1,6.40,0,0,3.80]); // date outside scope

await fs.writeFile(path.join(outDir,"stores.csv"), csv([["StoreID","StoreName","City","Format"],...stores]), "utf8");
await fs.writeFile(path.join(outDir,"products.csv"), csv([["ProductID","ProductName","Category","BasePrice"],...products]), "utf8");
await fs.writeFile(path.join(outDir,"promotions.csv"), csv([["PromotionID","PromotionName","PromotionType","StartDate","EndDate"],...promotions]), "utf8");
await fs.writeFile(path.join(outDir,"product_promotion_bridge.csv"), csv([["ProductID","PromotionID","AllocationWeight"],...bridge]), "utf8");
await fs.writeFile(path.join(outDir,"customers.csv"), csv([["CustomerID","Segment","HomeCity"],...customers]), "utf8");
await fs.writeFile(path.join(outDir,"sales.csv"), csv([["TransactionID","SaleDate","StoreID","ProductID","CustomerID","Quantity","UnitPrice","DiscountAmount","Returned","CostAmount"],...sales]), "utf8");

const idCounts = new Map();
for (const r of sales) idCounts.set(r[0], (idCounts.get(r[0]) ?? 0) + 1);
const productIds = new Set(products.map(r => r[0]));
const storeIds = new Set(stores.map(r => r[0]));
const customerIds = new Set(customers.map(r => r[0]));
const clean = sales.filter(r => idCounts.get(r[0]) === 1 && productIds.has(r[3]) && storeIds.has(r[2]) && customerIds.has(r[4]) && r[5] > 0 && r[1] >= "2025-01-01" && r[1] <= "2025-12-31");
const netRevenue = clean.reduce((a,r) => a + r[5]*r[6]-r[7], 0);
const margin = clean.reduce((a,r) => a + r[5]*r[6]-r[7]-r[9], 0);
const naiveAttribution = clean.reduce((a,r) => {
  const memberships = bridge.filter(b => b[0] === r[3]).length;
  return a + (r[5]*r[6]-r[7])*memberships;
}, 0);
await fs.writeFile(path.join(root,"data","expected_metrics.json"), JSON.stringify({
  generatedAt: "2026-09-26", seed: 5362026, validTransactions: clean.length,
  netRevenue: +netRevenue.toFixed(2), grossMargin: +margin.toFixed(2),
  naivePromotionRevenue: +naiveAttribution.toFixed(2),
  overstatement: +(naiveAttribution-netRevenue).toFixed(2),
  rejectedRows: sales.length-clean.length, controlledIssueTypes: 6, bridgeRows: bridge.length
}, null, 2), "utf8");

console.log(`Generated ${sales.length} sales rows and ${bridge.length} bridge rows.`);
