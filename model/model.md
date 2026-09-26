# Semantic model

| From | Cardinality | To | Cross-filter |
|---|---:|---|---|
| DimDate[Date] | 1:* | FactSales[SaleDate] | Single |
| DimStore[StoreID] | 1:* | FactSales[StoreID] | Single |
| DimCustomer[CustomerID] | 1:* | FactSales[CustomerID] | Single |
| DimProduct[ProductID] | 1:* | FactSales[ProductID] | Single |
| DimProduct[ProductID] | 1:* | BridgeProductPromotion[ProductID] | Single |
| DimPromotion[PromotionID] | 1:* | BridgeProductPromotion[PromotionID] | Single |

`DimPromotion` does not directly filter `FactSales`. Promotion measures obtain the selected products from the bridge and apply them to `DimProduct` with `TREATAS`.

## Why this is safer

A flattened `Sales × ProductPromotion` table repeats a sale once for every promotion membership. Summing revenue after that join produces a mathematically valid but commercially wrong number. The bridge preserves the membership structure without changing fact-table grain: one row in `FactSales` remains one transaction line.

`AllocationWeight` equals `1 / number of promotions for the product`. The allocated measure multiplies product revenue by this weight, so promotion totals reconcile to company revenue. A second measure reports reach and deliberately counts unique transaction IDs instead.
