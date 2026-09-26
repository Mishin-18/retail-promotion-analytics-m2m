let
    Source = fnReadCsv("promotions.csv", {
        {"PromotionID", type text}, {"PromotionName", type text},
        {"PromotionType", type text}, {"StartDate", type date}, {"EndDate", type date}
    }),
    UniqueKeys = Table.Distinct(Source, {"PromotionID"})
in
    UniqueKeys
