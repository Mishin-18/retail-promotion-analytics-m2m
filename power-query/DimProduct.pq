let
    Source = fnReadCsv("products.csv", {
        {"ProductID", type text}, {"ProductName", type text},
        {"Category", type text}, {"BasePrice", Currency.Type}
    }),
    UniqueKeys = Table.Distinct(Source, {"ProductID"})
in
    UniqueKeys
