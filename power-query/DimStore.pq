let
    Source = fnReadCsv("stores.csv", {
        {"StoreID", type text}, {"StoreName", type text},
        {"City", type text}, {"Format", type text}
    }),
    UniqueKeys = Table.Distinct(Source, {"StoreID"})
in
    UniqueKeys
