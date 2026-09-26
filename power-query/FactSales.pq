let
    Source = Sales_Staging,
    ValidRows = Table.SelectRows(Source, each [RejectReason] = null),
    RemovedAuditColumns = Table.RemoveColumns(ValidRows, {"KeyCount", "RejectReason"})
in
    RemovedAuditColumns
