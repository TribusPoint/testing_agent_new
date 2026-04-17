"use client";

import React, { useMemo, useState, type ReactNode } from "react";
import { InfoHint } from "./info-hint";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
  type PaginationState,
} from "@tanstack/react-table";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TstAgntColumnConfig<T = Record<string, unknown>> {
  key: string;
  label: string;
  sortable?: boolean;
  searchable?: boolean;
  width?: number;
  renderCell?: (value: unknown, row: T) => React.ReactNode;
}

export interface TstAgntTableProps<T extends Record<string, unknown>> {
  data: T[];
  columns: TstAgntColumnConfig<T>[];
  tableTitle?: React.ReactNode;
  /** Shown next to the title behind the info icon (hover / click). */
  tableTitleHint?: ReactNode;
  tableTitleHintLabel?: string;
  actions?: React.ReactNode;
  enableSearch?: boolean;
  searchPlaceholder?: string;
  pagination?: { enabled?: boolean; rowsPerPage?: number };
  onRowClick?: (row: T) => void;
  selectedRowId?: string | number | null;
  emptyState?: React.ReactNode;
  className?: string;
}

// ─── Icons ────────────────────────────────────────────────────────────────────

function SortAscIcon() {
  return (
    <svg className="w-3 h-3" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth={2}>
      <path d="M6 9V3M3 6l3-3 3 3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function SortDescIcon() {
  return (
    <svg className="w-3 h-3" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth={2}>
      <path d="M6 3v6M3 6l3 3 3-3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function SortNeutralIcon() {
  return (
    <svg className="w-3 h-3 opacity-30" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth={2}>
      <path d="M6 2v8M3 5l3-3 3 3M3 7l3 3 3-3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function ChevronLeft() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={2}>
      <path d="M10 4L6 8l4 4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function ChevronRight() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={2}>
      <path d="M6 4l4 4-4 4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function TstAgntTable<T extends Record<string, unknown>>({
  data,
  columns: columnConfigs,
  tableTitle,
  tableTitleHint,
  tableTitleHintLabel,
  actions,
  enableSearch = true,
  searchPlaceholder = "Search...",
  pagination = { enabled: true, rowsPerPage: 10 },
  onRowClick,
  selectedRowId,
  emptyState,
  className = "",
}: TstAgntTableProps<T>) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState("");
  const [{ pageIndex, pageSize }, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: pagination.rowsPerPage ?? 10,
  });

  const paginationState = useMemo(
    () => ({ pageIndex, pageSize }),
    [pageIndex, pageSize]
  );

  // Build TanStack column defs from config
  const columns = useMemo<ColumnDef<T>[]>(
    () =>
      columnConfigs.map((col) => ({
        id: col.key,
        accessorKey: col.key,
        header: col.label,
        enableSorting: col.sortable ?? false,
        enableGlobalFilter: col.searchable ?? false,
        cell: ({ getValue, row }) => {
          const value = getValue();
          if (col.renderCell) return col.renderCell(value, row.original);
          if (value === null || value === undefined)
            return <span className="text-gray-400">—</span>;
          return <span>{String(value)}</span>;
        },
      })),
    [columnConfigs]
  );

  const table = useReactTable({
    data,
    columns,
    state: { sorting, globalFilter, pagination: paginationState },
    onSortingChange: setSorting,
    onGlobalFilterChange: (val) => {
      setGlobalFilter(val as string);
      setPagination((p) => ({ ...p, pageIndex: 0 }));
    },
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    manualPagination: false,
  });

  const totalRows = table.getFilteredRowModel().rows.length;
  const totalPages = table.getPageCount();
  const startRow = totalRows === 0 ? 0 : pageIndex * pageSize + 1;
  const endRow = Math.min((pageIndex + 1) * pageSize, totalRows);

  // Build page number array with ellipsis
  const pageButtons: (number | "...")[] = [];
  for (let i = 0; i < totalPages; i++) {
    if (
      i === 0 ||
      i === totalPages - 1 ||
      Math.abs(i - pageIndex) <= 1
    ) {
      if (pageButtons.length > 0 && pageButtons[pageButtons.length - 1] !== "..." && (pageButtons[pageButtons.length - 1] as number) < i - 1) {
        pageButtons.push("...");
      }
      pageButtons.push(i);
    }
  }

  const paginationEnabled = pagination.enabled !== false;

  return (
    <div className={`flex flex-col ${className}`}>
      {/* Toolbar */}
      {(tableTitle || actions || enableSearch) && (
        <div className="flex items-center justify-between gap-3 px-3 py-2.5 border border-gray-200 dark:border-gray-700 rounded-t-lg bg-gray-50 dark:bg-gray-800/60">
          <div className="flex items-center gap-3 min-w-0">
            {tableTitle && (
              <span className="flex min-w-0 flex-wrap items-center gap-1.5">
                <span className="text-xs font-semibold text-gray-700 dark:text-gray-300 truncate">{tableTitle}</span>
                {tableTitleHint ? (
                  <InfoHint label={tableTitleHintLabel ?? "About this list"}>{tableTitleHint}</InfoHint>
                ) : null}
              </span>
            )}
            {enableSearch && (
              <div className="relative">
                <svg
                  className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400"
                  fill="none" viewBox="0 0 16 16" stroke="currentColor" strokeWidth={2}
                >
                  <circle cx="7" cy="7" r="5" />
                  <path d="M12 12l2.5 2.5" strokeLinecap="round" />
                </svg>
                <input
                  type="text"
                  value={globalFilter}
                  onChange={(e) => setGlobalFilter(e.target.value)}
                  placeholder={searchPlaceholder}
                  className="pl-7 pr-3 py-1 text-xs border border-gray-200 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 w-44"
                />
              </div>
            )}
          </div>
          {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
        </div>
      )}

      {/* Table */}
      <div className={`overflow-x-auto border-x border-b border-gray-200 dark:border-gray-700 ${!paginationEnabled ? "rounded-b-lg" : ""} ${!(tableTitle || actions || enableSearch) ? "rounded-t-lg border-t" : ""}`}>
        <table className="w-full min-w-full text-sm">
          <thead>
            {table.getHeaderGroups().map((hg) => (
              <tr
                key={hg.id}
                className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800"
              >
                {hg.headers.map((header) => {
                  const canSort = header.column.getCanSort();
                  const sorted = header.column.getIsSorted();
                  return (
                    <th
                      key={header.id}
                      className={`px-3 py-2 text-left text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide select-none whitespace-nowrap ${canSort ? "cursor-pointer hover:text-gray-800 dark:hover:text-gray-200" : ""}`}
                      onClick={canSort ? header.column.getToggleSortingHandler() : undefined}
                    >
                      <div className="flex items-center gap-1">
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        {canSort && (
                          <span>
                            {sorted === "asc" ? <SortAscIcon /> : sorted === "desc" ? <SortDescIcon /> : <SortNeutralIcon />}
                          </span>
                        )}
                      </div>
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-100 dark:divide-gray-800">
            {table.getRowModel().rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-3 py-10 text-center">
                  {emptyState ?? (
                    <p className="text-xs text-gray-400">No results found.</p>
                  )}
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row) => {
                const isSelected = selectedRowId != null && (row.original as Record<string, unknown>).id === selectedRowId;
                return (
                <tr
                  key={row.id}
                  onClick={() => onRowClick?.(row.original)}
                  className={`transition-colors ${isSelected ? "bg-indigo-50 dark:bg-indigo-950/40 border-l-2 border-l-indigo-500" : ""} ${onRowClick ? "cursor-pointer hover:bg-indigo-50 dark:hover:bg-indigo-950/30" : "hover:bg-gray-50 dark:hover:bg-gray-800/40"}`}
                >
                  {row.getVisibleCells().map((cell) => (
                    <td
                      key={cell.id}
                      className="px-3 py-2.5 text-xs text-gray-700 dark:text-gray-300"
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination footer */}
      {paginationEnabled && (
        <div className="flex items-center justify-between px-3 py-2 border border-t-0 border-gray-200 dark:border-gray-700 rounded-b-lg bg-white dark:bg-gray-900">
          <div className="flex items-center gap-2 text-[11px] text-gray-500 dark:text-gray-400">
            <span>
              {totalRows === 0 ? "0 rows" : `${startRow}–${endRow} of ${totalRows}`}
            </span>
            <span className="text-gray-300 dark:text-gray-600">|</span>
            <label className="flex items-center gap-1">
              Rows:
              <select
                value={pageSize}
                onChange={(e) => {
                  setPagination({ pageIndex: 0, pageSize: Number(e.target.value) });
                }}
                className="text-[11px] border border-gray-200 dark:border-gray-600 rounded px-1 py-0.5 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                {[10, 25, 50, 100].map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </label>
          </div>

          <div className="flex items-center gap-0.5">
            <button
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
              className="p-1 rounded text-gray-500 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft />
            </button>

            {pageButtons.map((item, idx) =>
              item === "..." ? (
                <span key={`e${idx}`} className="px-1 text-[11px] text-gray-400">…</span>
              ) : (
                <button
                  key={item}
                  onClick={() => table.setPageIndex(item as number)}
                  className={`min-w-[26px] h-6 px-1 rounded text-[11px] font-medium transition-colors ${
                    pageIndex === item
                      ? "bg-indigo-600 text-white"
                      : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
                  }`}
                >
                  {(item as number) + 1}
                </button>
              )
            )}

            <button
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
              className="p-1 rounded text-gray-500 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRight />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default TstAgntTable;
