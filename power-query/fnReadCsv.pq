(fileName as text, columnTypes as list) as table =>
let
    FullPath = pRootFolder & "\\data\\incoming\\" & fileName,
    Raw = Csv.Document(
        File.Contents(FullPath),
        [Delimiter=";", Encoding=65001, QuoteStyle=QuoteStyle.Csv]
    ),
    Headers = Table.PromoteHeaders(Raw, [PromoteAllScalars=true]),
    Typed = Table.TransformColumnTypes(Headers, columnTypes, "en-US")
in
    Typed
