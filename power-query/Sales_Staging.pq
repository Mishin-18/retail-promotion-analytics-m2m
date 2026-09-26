let
    Source = fnReadCsv("sales.csv", {
        {"TransactionID", type text}, {"SaleDate", type date}, {"StoreID", type text},
        {"ProductID", type text}, {"CustomerID", type text}, {"Quantity", Int64.Type},
        {"UnitPrice", Currency.Type}, {"DiscountAmount", Currency.Type},
        {"Returned", Int64.Type}, {"CostAmount", Currency.Type}
    }),
    DuplicateCounts = Table.Group(Source, {"TransactionID"}, {{"KeyCount", each Table.RowCount(_), Int64.Type}}),
    WithCounts = Table.NestedJoin(Source, {"TransactionID"}, DuplicateCounts, {"TransactionID"}, "Counts", JoinKind.LeftOuter),
    Expanded = Table.ExpandTableColumn(WithCounts, "Counts", {"KeyCount"}, {"KeyCount"}),
    WithReason = Table.AddColumn(Expanded, "RejectReason", each
        if [KeyCount] > 1 then "Duplicate TransactionID"
        else if not List.Contains(DimProduct[ProductID], [ProductID]) then "Unknown ProductID"
        else if not List.Contains(DimStore[StoreID], [StoreID]) then "Unknown StoreID"
        else if not List.Contains(DimCustomer[CustomerID], [CustomerID]) then "Unknown CustomerID"
        else if [Quantity] <= 0 then "Quantity must be positive"
        else if [SaleDate] < #date(2025,1,1) or [SaleDate] > #date(2025,12,31) then "SaleDate outside reporting period"
        else null, type nullable text),
    WithNetRevenue = Table.AddColumn(WithReason, "NetRevenue", each [Quantity] * [UnitPrice] - [DiscountAmount], Currency.Type),
    WithGrossMargin = Table.AddColumn(WithNetRevenue, "GrossMargin", each [NetRevenue] - [CostAmount], Currency.Type)
in
    WithGrossMargin
