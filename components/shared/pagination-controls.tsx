"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

type Props = {
  basePath: string;
  params: Record<string, string | undefined>;
  page: number;
  pageSize: number;
  total: number;
  hasNext: boolean;
};

type PageItem = number | "ellipsis-left" | "ellipsis-right";

function buildHref(
  basePath: string,
  params: Record<string, string | undefined>,
  page: number,
  pageSize: number,
) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value) query.set(key, value);
  });
  query.set("page", String(Math.max(1, page)));
  query.set("pageSize", String(pageSize));
  return `${basePath}?${query.toString()}`;
}

function getPageItems(currentPage: number, totalPages: number): PageItem[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  if (currentPage <= 4) {
    return [1, 2, 3, 4, 5, "ellipsis-right", totalPages];
  }

  if (currentPage >= totalPages - 3) {
    return [1, "ellipsis-left", totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
  }

  return [1, "ellipsis-left", currentPage - 1, currentPage, currentPage + 1, "ellipsis-right", totalPages];
}

export default function PaginationControls({
  basePath,
  params,
  page,
  pageSize,
  total,
  hasNext,
}: Props) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const pageItems = getPageItems(page, totalPages);
  const firstHref = buildHref(basePath, params, 1, pageSize);
  const previousHref = buildHref(basePath, params, page - 1, pageSize);
  const nextHref = buildHref(basePath, params, page + 1, pageSize);
  const lastHref = buildHref(basePath, params, totalPages, pageSize);

  return (
    <div className="flex flex-col gap-2.5 border-t border-slate-200 bg-slate-50/70 px-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-4">
      <p className="text-[11px] text-slate-500 sm:text-xs">
        Hiển thị {total === 0 ? 0 : (page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} trong {total.toLocaleString("vi-VN")} kết quả
      </p>

      <div className="flex flex-wrap items-center justify-start gap-1 sm:justify-end">
        <form method="get" className="mr-1.5">
          {Object.entries(params).map(([key, value]) =>
            value ? <input key={key} type="hidden" name={key} value={value} /> : null,
          )}
          <input type="hidden" name="page" value="1" />
          <label className="sr-only" htmlFor={`${basePath.replace(/[^a-z]/gi, "")}-page-size`}>
            Số nhân sự mỗi trang
          </label>
          <select
            id={`${basePath.replace(/[^a-z]/gi, "")}-page-size`}
            name="pageSize"
            defaultValue={pageSize}
            onChange={(event) => event.currentTarget.form?.requestSubmit()}
            className="h-8 rounded-md border border-slate-300 bg-white px-2 text-xs font-semibold text-slate-700 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-100"
          >
            <option value="10">10 / trang</option>
            <option value="20">20 / trang</option>
            <option value="50">50 / trang</option>
          </select>
        </form>

        <a
          aria-label="Trang đầu"
          aria-disabled={page <= 1}
          className={`inline-flex h-8 items-center justify-center rounded-md border px-2 text-xs font-semibold transition ${page <= 1 ? "pointer-events-none border-slate-200 bg-slate-50 text-slate-300" : "border-slate-300 bg-white text-slate-600 hover:bg-slate-100"}`}
          href={firstHref}
        >
          « <span className="hidden sm:inline">first</span>
        </a>
        <a
          aria-label="Trang trước"
          aria-disabled={page <= 1}
          className={`inline-flex h-8 items-center justify-center gap-0.5 rounded-md border px-2 text-xs font-semibold transition ${page <= 1 ? "pointer-events-none border-slate-200 bg-slate-50 text-slate-300" : "border-slate-300 bg-white text-slate-600 hover:bg-slate-100"}`}
          href={previousHref}
        >
          <ChevronLeft className="h-3.5 w-3.5" /><span className="hidden sm:inline">Trước</span>
        </a>

        {pageItems.map((item, index) =>
          typeof item === "string" ? (
            <span key={`${item}-${index}`} className="inline-flex h-8 min-w-7 items-center justify-center px-0.5 text-xs font-semibold text-slate-500">
              ...
            </span>
          ) : (
            <a
              key={item}
              aria-current={item === page ? "page" : undefined}
              className={`inline-flex h-8 min-w-7 items-center justify-center rounded-md border px-1.5 text-xs font-semibold transition ${item === page ? "border-slate-800 bg-slate-800 text-white shadow-sm" : "border-slate-300 bg-white text-slate-600 hover:bg-slate-100"}`}
              href={buildHref(basePath, params, item, pageSize)}
            >
              {item}
            </a>
          ),
        )}

        <a
          aria-label="Trang sau"
          aria-disabled={!hasNext}
          className={`inline-flex h-8 items-center justify-center gap-0.5 rounded-md border px-2 text-xs font-semibold transition ${!hasNext ? "pointer-events-none border-slate-200 bg-slate-50 text-slate-300" : "border-slate-300 bg-white text-slate-600 hover:bg-slate-100"}`}
          href={nextHref}
        >
          <span className="hidden sm:inline">Sau</span><ChevronRight className="h-3.5 w-3.5" />
        </a>
        <a
          aria-label="Trang cuối"
          aria-disabled={!hasNext}
          className={`inline-flex h-8 items-center justify-center rounded-md border px-2 text-xs font-semibold transition ${!hasNext ? "pointer-events-none border-slate-200 bg-slate-50 text-slate-300" : "border-slate-300 bg-white text-slate-600 hover:bg-slate-100"}`}
          href={lastHref}
        >
          <span className="hidden sm:inline">last</span> »
        </a>
      </div>
    </div>
  );
}
