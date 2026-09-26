let
    Source = fnReadCsv("customers.csv", {
        {"CustomerID", type text}, {"Segment", type text}, {"HomeCity", type text}
    }),
    UniqueKeys = Table.Distinct(Source, {"CustomerID"})
in
    UniqueKeys
