# Power BI build guide

1. Create a text parameter `pRootFolder` pointing to this repository folder.
2. Add the Power Query queries in dependency order: `fnReadCsv`, dimensions, `BridgeProductPromotion`, `Sales_Staging`, `FactSales_Rejected`, `FactSales` and `DimDate`.
3. Load `FactSales`, the five dimensions and the bridge. Disable load for staging/helper queries.
4. Create the relationships listed in `model/model.md`; keep every relationship single-direction.
5. Create a measure table and paste the measures from `model/measures.dax`.
6. Build three report sections: Executive overview, Promotion attribution and Data quality.
7. Reconcile `[Allocated Promotion Revenue]` with `[Net Revenue]`. The difference should be zero when all promotions are selected.

Recommended visuals:

- KPI cards: Net Revenue, Gross Margin %, Orders, Return Rate.
- Line chart: Net Revenue by month.
- Bar chart: Allocated Promotion Revenue by PromotionName.
- Matrix: PromotionName × Category with Allocated Promotion Revenue.
- Audit table: RejectReason and rejected-row count.
- Warning card: Direct Join Overstatement.
