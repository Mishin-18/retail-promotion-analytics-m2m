import fs from "node:fs/promises";
import path from "node:path";
import { SpreadsheetFile, Workbook } from "@oai/artifact-tool";

const root = path.resolve(import.meta.dirname);
const incoming = path.join(root, "data", "incoming");
const docs = path.join(root, "docs");
const font = "Arial";
const navy = "#172A3A", blue = "#2563EB", teal = "#0F766E", amber = "#D97706", red = "#B91C1C";
const lightBlue = "#E8F0FE", lightTeal = "#E7F5F2", lightAmber = "#FFF4E5", lightRed = "#FDECEC", gray = "#64748B";

const parseCsv = async (name) => {
  const text = await fs.readFile(path.join(incoming, name), "utf8");
  return text.trim().split(/\r?\n/).map(line => {
    const out=[]; let cur="", q=false;
    for(let i=0;i<line.length;i++){
      const c=line[i];
      if(c==='"' && line[i+1]==='"' && q){cur+='"';i++;}
      else if(c==='"'){q=!q;}
      else if(c===';' && !q){out.push(cur);cur="";}
      else cur+=c;
    }
    out.push(cur); return out;
  });
};

const [salesCsv, productsCsv, promosCsv, bridgeCsv] = await Promise.all([
  parseCsv("sales.csv"), parseCsv("products.csv"), parseCsv("promotions.csv"), parseCsv("product_promotion_bridge.csv")
]);
const metrics = JSON.parse(await fs.readFile(path.join(root,"data","expected_metrics.json"),"utf8"));
const stores = new Set((await parseCsv("stores.csv")).slice(1).map(r=>r[0]));
const products = new Set(productsCsv.slice(1).map(r=>r[0]));
const customers = new Set((await parseCsv("customers.csv")).slice(1).map(r=>r[0]));
const counts = new Map();
for(const r of salesCsv.slice(1)) counts.set(r[0],(counts.get(r[0])??0)+1);
const typedSales = salesCsv.slice(1).map(r => ({
  id:r[0], date:r[1], store:r[2], product:r[3], customer:r[4], qty:+r[5], price:+r[6], discount:+r[7], returned:+r[8], cost:+r[9]
}));
const reason = r => counts.get(r.id)>1 ? "Duplicate TransactionID" : !products.has(r.product) ? "Unknown ProductID" : !stores.has(r.store) ? "Unknown StoreID" : !customers.has(r.customer) ? "Unknown CustomerID" : r.qty<=0 ? "Quantity must be positive" : (r.date<"2025-01-01"||r.date>"2025-12-31") ? "SaleDate outside reporting period" : "";
const clean = typedSales.filter(r=>!reason(r));
const rejected = typedSales.filter(r=>reason(r));

const wb = Workbook.create();
const dash = wb.worksheets.add("Dashboard");
const m2m = wb.worksheets.add("Many-to-Many");
const dq = wb.worksheets.add("Data Quality");
const build = wb.worksheets.add("Build");
const fact = wb.worksheets.add("FactSales");
const productSheet = wb.worksheets.add("Product Revenue");
const bridgeSheet = wb.worksheets.add("Bridge");
for(const s of [dash,m2m,dq,build,fact,productSheet,bridgeSheet]) { s.showGridLines=false; }
dash.tabColor=navy; m2m.tabColor=blue; dq.tabColor=amber; build.tabColor="#94A3B8";

function title(sheet, text, subtitle){
  sheet.getRange("A2:L2").merge(); sheet.getRange("A2").values=[[text]];
  sheet.getRange("A2").format={font:{name:font,size:16,bold:true,color:navy},rowHeight:26};
  sheet.getRange("A3:L3").merge(); sheet.getRange("A3").values=[[subtitle]];
  sheet.getRange("A3").format={font:{name:font,size:10,italic:true,color:gray},rowHeight:20,bottomBorder:{style:"thin",color:"#CBD5E1"}};
}
function section(r, fill=navy){ r.format={fill,font:{name:font,size:10,bold:true,color:"#FFFFFF"},verticalAlignment:"center",rowHeight:22}; }
function card(sheet, range, label, formula, fill){
  const r=sheet.getRange(range); r.format={fill,borders:{preset:"outside",style:"thin",color:"#CBD5E1"}};
  const start=range.split(":")[0]; const col=start.match(/[A-Z]+/)[0], row=+start.match(/\d+/)[0];
  sheet.getRange(`${col}${row}`).values=[[label]]; sheet.getRange(`${col}${row}`).format={font:{name:font,size:9,bold:true,color:"#FFFFFF"}};
  sheet.getRange(`${col}${row+1}`).formulas=[[formula]]; sheet.getRange(`${col}${row+1}`).format={font:{name:font,size:15,bold:true,color:"#FFFFFF"}};
}

// Fact data: one row remains one transaction line.
const factRows = clean.map(r=>[r.id,new Date(`${r.date}T00:00:00Z`),r.store,r.product,r.customer,r.qty,r.price,r.discount,r.returned,r.cost,+(r.qty*r.price-r.discount).toFixed(2),+(r.qty*r.price-r.discount-r.cost).toFixed(2)]);
fact.getRange("A1:L1").values=[["TransactionID","SaleDate","StoreID","ProductID","CustomerID","Quantity","UnitPrice","DiscountAmount","Returned","CostAmount","NetRevenue","GrossMargin"]];
fact.getRange("A2").write(factRows); fact.tables.add(`A1:L${factRows.length+1}`,true,"FactSalesTable");
fact.getRange(`B2:B${factRows.length+1}`).setNumberFormat("yyyy-mm-dd"); fact.getRange(`G2:L${factRows.length+1}`).setNumberFormat("#,##0.00"); fact.freezePanes.freezeRows(1);
fact.getRange("A1:L1").format={fill:navy,font:{name:font,bold:true,color:"#FFFFFF"}}; fact.getRange("A:L").format.font={name:font,size:9};

// Product-level aggregation. Formulas preserve the fact grain and are reused by the bridge.
productSheet.getRange("A1:E1").values=[["ProductID","ProductName","Category","Net Revenue","Transactions"]];
productSheet.getRange("A2:C31").values=productsCsv.slice(1).map(r=>[r[0],r[1],r[2]]);
productSheet.getRange("D2").formulas=[[`=SUMIF(FactSales!$D$2:$D$${factRows.length+1},A2,FactSales!$K$2:$K$${factRows.length+1})`]];
productSheet.getRange("D2:D31").fillDown();
productSheet.getRange("E2").formulas=[[`=COUNTIF(FactSales!$D$2:$D$${factRows.length+1},A2)`]]; productSheet.getRange("E2:E31").fillDown();
productSheet.tables.add("A1:E31",true,"ProductRevenueTable"); productSheet.getRange("D2:D31").setNumberFormat("#,##0.00");
productSheet.getRange("A1:E1").format={fill:navy,font:{name:font,bold:true,color:"#FFFFFF"}}; productSheet.getRange("A:E").format.font={name:font,size:9};

// Bridge calculations: same product revenue is either repeated (wrong) or weighted (safe).
bridgeSheet.getRange("A1:E1").values=[["ProductID","PromotionID","AllocationWeight","Direct Join Revenue","Allocated Revenue"]];
bridgeSheet.getRange("A2:C44").values=bridgeCsv.slice(1).map(r=>[r[0],r[1],+r[2]]);
bridgeSheet.getRange("D2").formulas=[["=SUMIF('Product Revenue'!$A$2:$A$31,A2,'Product Revenue'!$D$2:$D$31)"]]; bridgeSheet.getRange("D2:D44").fillDown();
bridgeSheet.getRange("E2").formulas=[["=C2*D2"]]; bridgeSheet.getRange("E2:E44").fillDown();
bridgeSheet.tables.add("A1:E44",true,"BridgeProductPromotionTable"); bridgeSheet.getRange("C2:C44").setNumberFormat("0.0%"); bridgeSheet.getRange("D2:E44").setNumberFormat("#,##0.00");
bridgeSheet.getRange("A1:E1").format={fill:navy,font:{name:font,bold:true,color:"#FFFFFF"}}; bridgeSheet.getRange("A:E").format.font={name:font,size:9};

// Build: monthly formulas and promotion rollup.
build.getRange("A1:C1").values=[["Month","Net Revenue","Gross Margin"]];
for(let i=0;i<12;i++) build.getCell(i+1,0).values=[[new Date(Date.UTC(2025,i,1))]];
build.getRange("D1").values=[["Month Label"]];
build.getRange("D2:D13").values=Array.from({length:12},(_,i)=>[["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][i]]);
build.getRange("A2:A13").setNumberFormat("mmm yyyy");
build.getRange("B2").formulas=[[`=SUMIFS(FactSales!$K$2:$K$${factRows.length+1},FactSales!$B$2:$B$${factRows.length+1},">="&A2,FactSales!$B$2:$B$${factRows.length+1},"<"&EDATE(A2,1))`]]; build.getRange("B2:B13").fillDown();
build.getRange("C2").formulas=[[`=SUMIFS(FactSales!$L$2:$L$${factRows.length+1},FactSales!$B$2:$B$${factRows.length+1},">="&A2,FactSales!$B$2:$B$${factRows.length+1},"<"&EDATE(A2,1))`]]; build.getRange("C2:C13").fillDown();
build.getRange("E1:H1").values=[["PromotionID","Promotion","Direct Join Revenue","Allocated Revenue"]];
build.getRange("E2:F7").values=promosCsv.slice(1).map(r=>[r[0],r[1]]);
build.getRange("G2").formulas=[["=SUMIF(Bridge!$B$2:$B$44,E2,Bridge!$D$2:$D$44)"]]; build.getRange("G2:G7").fillDown();
build.getRange("H2").formulas=[["=SUMIF(Bridge!$B$2:$B$44,E2,Bridge!$E$2:$E$44)"]]; build.getRange("H2:H7").fillDown();
build.getRange("A1:C1").format={fill:navy,font:{name:font,bold:true,color:"#FFFFFF"}}; build.getRange("E1:H1").format={fill:navy,font:{name:font,bold:true,color:"#FFFFFF"}};
build.getRange("B2:C13").setNumberFormat("#,##0"); build.getRange("G2:H7").setNumberFormat("#,##0");

title(dash,"Retail analytics overview","Synthetic data · 2025 · currency units");
card(dash,"A5:C7","NET REVENUE",`=SUM(FactSales!K2:K${factRows.length+1})`,blue);
card(dash,"D5:F7","GROSS MARGIN",`=SUM(FactSales!L2:L${factRows.length+1})`,teal);
card(dash,"G5:I7","VALID TRANSACTIONS",`=COUNTA(FactSales!A2:A${factRows.length+1})`,navy);
card(dash,"J5:L7","REJECTED ROWS",`='Data Quality'!B6`,red);
dash.getRange("A6:F6").setNumberFormat("#,##0.00"); dash.getRange("G6:L6").setNumberFormat("#,##0");
dash.getRange("A10:F10").merge(); dash.getRange("A10").values=[["Monthly performance"]]; section(dash.getRange("A10:F10"),navy);
dash.getRange("G10:L10").merge(); dash.getRange("G10").values=[["Model control"]]; section(dash.getRange("G10:L10"),navy);
dash.getRange("G12:I12").values=[["Direct join total","Safe allocated total","Overstatement"]];
dash.getRange("G13").formulas=[["=SUM(Bridge!D2:D44)"]]; dash.getRange("H13").formulas=[["=SUM(Bridge!E2:E44)"]]; dash.getRange("I13").formulas=[["=G13-SUM(FactSales!K2:K2400)"]];
dash.getRange("G13:I13").setNumberFormat("#,##0.00"); dash.getRange("G12:I12").format={fill:lightBlue,font:{name:font,bold:true,color:navy}};
dash.getRange("G16:L18").merge(); dash.getRange("G16").values=[["The direct join repeats product revenue for every promotion membership. Allocation weights restore reconciliation without changing the FactSales grain."]]; dash.getRange("G16").format={fill:lightAmber,font:{name:font,size:10,color:"#7C2D12"},wrapText:true,verticalAlignment:"center"};
const trend=dash.charts.add("line",[build.getRange("D1:D13"),build.getRange("B1:B13"),build.getRange("C1:C13")]); trend.title="Monthly revenue and gross margin"; trend.titleTextStyle.typeface=font; trend.legend={position:"top",textStyle:{typeface:font}}; trend.yAxis={numberFormatCode:"#,##0",numberFormatSourceLinked:false,textStyle:{typeface:font}}; trend.xAxis={axisType:"textAxis",textStyle:{typeface:font}}; trend.setPosition("A12","F28");

title(m2m,"Many-to-many promotion attribution","Products can belong to several promotions; sales retain a single transaction-line grain");
m2m.getRange("A5:L5").merge(); m2m.getRange("A5").values=[["Model path: FactSales → DimProduct → BridgeProductPromotion ← DimPromotion"]]; section(m2m.getRange("A5:L5"),blue);
m2m.getRange("A7:D7").values=[["Metric","Value","Expected behavior","Status"]]; section(m2m.getRange("A7:D7"),navy);
m2m.getRange("A8:A11").values=[["Total net revenue"],["Direct join revenue"],["Allocated promotion revenue"],["Allocation reconciliation"]];
m2m.getRange("B8").formulas=[[`=SUM(FactSales!K2:K${factRows.length+1})`]]; m2m.getRange("B9").formulas=[["=SUM(Bridge!D2:D44)"]]; m2m.getRange("B10").formulas=[["=SUM(Bridge!E2:E44)"]]; m2m.getRange("B11").formulas=[["=B10-B8"]];
m2m.getRange("C8:C11").values=[["Control total"],["Intentionally overstated"],["Must equal total net revenue"],["Must equal zero"]];
m2m.getRange("D8:D10").values=[["CONTROL"],["WARNING"],["PASS"]]; m2m.getRange("D11").formulas=[["=IF(ABS(B11)<0.01,\"PASS\",\"FAIL\")"]];
m2m.getRange("B8:B11").setNumberFormat("#,##0.00"); m2m.getRange("D9").format={fill:lightRed,font:{name:font,bold:true,color:red}}; m2m.getRange("D10:D11").format={fill:lightTeal,font:{name:font,bold:true,color:teal}};
m2m.getRange("A14:H14").merge(); m2m.getRange("A14").values=[["Promotion comparison"]]; section(m2m.getRange("A14:H14"),navy);
m2m.getRange("A15:C21").formulas=[["=Build!F1","=Build!G1","=Build!H1"],...Array.from({length:6},(_,i)=>[`=Build!F${i+2}`,`=Build!G${i+2}`,`=Build!H${i+2}`])]; m2m.getRange("B16:C21").setNumberFormat("#,##0");
const promoChart=m2m.charts.add("bar",m2m.getRange("A15:C21")); promoChart.title="Direct join versus allocated revenue"; promoChart.titleTextStyle.typeface=font; promoChart.legend={position:"top",textStyle:{typeface:font}}; promoChart.xAxis={axisType:"textAxis",textStyle:{typeface:font}}; promoChart.yAxis={numberFormatCode:"#,##0",numberFormatSourceLinked:false,textStyle:{typeface:font}}; promoChart.setPosition("E15","L30");

title(dq,"Data quality audit","Controlled exceptions are isolated, classified and excluded from business measures");
dq.getRange("A5:D5").values=[["Control","Result","Expected","Status"]]; section(dq.getRange("A5:D5"),navy);
dq.getRange("A6:A9").values=[["Rejected rows"],["Issue types"],["Valid fact rows"],["Allocation reconciliation"]];
dq.getRange("B6:B8").values=[[rejected.length],[new Set(rejected.map(reason)).size],[clean.length]]; dq.getRange("B9").formulas=[["='Many-to-Many'!B11"]];
dq.getRange("C6:C9").values=[[metrics.rejectedRows],[metrics.controlledIssueTypes],[metrics.validTransactions],[0]];
dq.getRange("D6").formulas=[["=IF(B6=C6,\"PASS\",\"FAIL\")"]]; dq.getRange("D6:D9").fillDown(); dq.getRange("D6:D9").format={fill:lightTeal,font:{name:font,bold:true,color:teal}};
dq.getRange("D9").formulas=[["=IF(ABS(B9-C9)<0.01,\"PASS\",\"FAIL\")"]];
dq.getRange("A12:K12").values=[["TransactionID","SaleDate","StoreID","ProductID","CustomerID","Quantity","UnitPrice","Discount","Returned","Cost","RejectReason"]]; section(dq.getRange("A12:K12"),amber);
dq.getRange("A13").write(rejected.map(r=>[r.id,new Date(`${r.date}T00:00:00Z`),r.store,r.product,r.customer,r.qty,r.price,r.discount,r.returned,r.cost,reason(r)])); dq.getRange(`B13:B${12+rejected.length}`).setNumberFormat("yyyy-mm-dd"); dq.getRange(`G13:J${12+rejected.length}`).setNumberFormat("#,##0.00");

for(const [s,widths] of [[dash,[16,16,16,16,16,16,16,16,16,16,16,16]],[m2m,[25,18,28,14,16,16,16,16,16,16,16,16]],[dq,[23,14,14,13,14,12,12,12,11,12,31]]]){
  widths.forEach((w,i)=>s.getRange(`${String.fromCharCode(65+i)}:${String.fromCharCode(65+i)}`).format.columnWidth=w);
  s.getUsedRange().format.font={name:font,size:10};
}
for(const s of [build,fact,productSheet,bridgeSheet]) s.getUsedRange().format.autofitColumns();

wb.recalculate();
await fs.mkdir(docs,{recursive:true});
const previewRanges={"Dashboard":"A1:L30","Many-to-Many":"A1:L31","Data Quality":"A1:L21","Build":"A1:H14","FactSales":"A1:L35","Product Revenue":"A1:E31","Bridge":"A1:E44"};
for(const sheetName of Object.keys(previewRanges)){
  const blob=await wb.render({sheetName,range:previewRanges[sheetName],scale:1,format:"png"});
  await fs.writeFile(path.join(docs,`${sheetName.replaceAll(" ","-").toLowerCase()}.png`),new Uint8Array(await blob.arrayBuffer()));
}
const inspection=await wb.inspect({kind:"table",range:"Many-to-Many!A7:D11",include:"values,formulas",tableMaxRows:10,tableMaxCols:6});
console.log(inspection.ndjson);
const errors=await wb.inspect({kind:"match",searchTerm:"#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A|#NUM!|#NULL!|#SPILL!|#CALC!",options:{useRegex:true,maxResults:100},summary:"final formula error scan"});
console.log(errors.ndjson);
const out=await SpreadsheetFile.exportXlsx(wb); await out.save(path.join(root,"Retail_Analytics_Demo.xlsx"));
console.log(`Saved workbook with ${factRows.length} valid and ${rejected.length} rejected rows.`);
