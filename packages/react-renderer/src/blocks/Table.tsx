"use client";

import type {
  TableBlockObjectResponse,
  TableRowBlockObjectResponse,
} from "@notionhq/client/build/src/api-endpoints";
import {
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Table as UiTable,
} from "../components/ui/table";
import { cn } from "../lib/utils";
import { RichText } from "../rich-text/RichText";
import type { BlockComponentProps, NotionBlock } from "../types";

function isTableRow(b: NotionBlock): b is TableRowBlockObjectResponse {
  return b.type === "table_row";
}

export function Table({
  block,
  className,
}: BlockComponentProps<TableBlockObjectResponse>) {
  const rows = (block.children ?? []).filter(isTableRow);
  const hasHeaderRow = block.table.has_column_header && rows.length > 0;
  const headerCells = hasHeaderRow ? (rows[0]?.table_row.cells ?? []) : [];
  const bodyRows = hasHeaderRow ? rows.slice(1) : rows;

  return (
    <UiTable className={cn("my-3 w-full", className)}>
      {hasHeaderRow ? (
        <TableHeader>
          <TableRow>
            {headerCells.map((cell, idx) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: 列順は安定
              <TableHead key={idx}>
                <RichText value={cell} />
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
      ) : null}
      <TableBody>
        {bodyRows.map((row) => (
          <TableRow key={row.id}>
            {row.table_row.cells.map((cell, idx) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: 列順は安定
              <TableCell key={idx}>
                <RichText value={cell} />
              </TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </UiTable>
  );
}
