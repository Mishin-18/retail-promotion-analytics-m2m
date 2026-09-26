let
    Source = Sales_Staging,
    RejectedRows = Table.SelectRows(Source, each [RejectReason] <> null)
in
    RejectedRows
