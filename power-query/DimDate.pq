let
    StartDate = #date(2025, 1, 1),
    EndDate = #date(2025, 12, 31),
    Dates = List.Dates(StartDate, Duration.Days(EndDate - StartDate) + 1, #duration(1,0,0,0)),
    ToTable = Table.FromList(Dates, Splitter.SplitByNothing(), {"Date"}),
    Typed = Table.TransformColumnTypes(ToTable, {{"Date", type date}}),
    Year = Table.AddColumn(Typed, "Year", each Date.Year([Date]), Int64.Type),
    MonthNo = Table.AddColumn(Year, "MonthNo", each Date.Month([Date]), Int64.Type),
    Month = Table.AddColumn(MonthNo, "Month", each Date.ToText([Date], "MMM", "en-US"), type text),
    YearMonth = Table.AddColumn(Month, "YearMonth", each Date.ToText([Date], "yyyy-MM"), type text)
in
    YearMonth
