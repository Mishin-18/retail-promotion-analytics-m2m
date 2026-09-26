let
    Source = fnReadCsv("product_promotion_bridge.csv", {
        {"ProductID", type text}, {"PromotionID", type text}, {"AllocationWeight", type number}
    }),
    ValidProducts = Table.SelectRows(Source, each List.Contains(DimProduct[ProductID], [ProductID])),
    ValidPromotions = Table.SelectRows(ValidProducts, each List.Contains(DimPromotion[PromotionID], [PromotionID])),
    UniquePairs = Table.Distinct(ValidPromotions, {"ProductID", "PromotionID"})
in
    UniquePairs
