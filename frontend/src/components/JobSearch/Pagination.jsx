import React, { useMemo, useState } from "react";

function clampPage(value, totalPages) {
  const page = Number.parseInt(value, 10);
  if (!Number.isFinite(page)) return null;
  return Math.min(Math.max(page, 1), totalPages);
}

function pageItem(page, label = String(page)) {
  return { type: "page", page, label, key: `page-${page}-${label}` };
}

function ellipsisItem(key) {
  return { type: "ellipsis", key };
}

function getPaginationItems(currentPage, totalPages) {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => pageItem(index + 1));
  }

  if (currentPage <= 4) {
    return [
      ...Array.from({ length: 5 }, (_, index) => pageItem(index + 1)),
      ellipsisItem("end-ellipsis"),
      pageItem(totalPages, "Last"),
    ];
  }

  if (currentPage >= totalPages - 3) {
    const start = totalPages - 4;
    return [
      pageItem(1),
      ellipsisItem("start-ellipsis"),
      ...Array.from({ length: 5 }, (_, index) => pageItem(start + index)),
    ];
  }

  return [
    pageItem(1),
    ellipsisItem("start-ellipsis"),
    ...Array.from({ length: 5 }, (_, index) => pageItem(currentPage - 2 + index)),
    ellipsisItem("end-ellipsis"),
    pageItem(totalPages, "Last"),
  ];
}

const Pagination = ({ currentPage, totalPages, onPageChange }) => {
  const [pageInput, setPageInput] = useState("");
  const safeCurrentPage = clampPage(currentPage, totalPages) || 1;
  const items = useMemo(
    () => getPaginationItems(safeCurrentPage, totalPages),
    [safeCurrentPage, totalPages]
  );

  if (totalPages <= 1) return null;

  const handleSubmit = (event) => {
    event.preventDefault();
    const nextPage = clampPage(pageInput, totalPages);
    if (!nextPage) return;
    onPageChange(nextPage);
    setPageInput("");
  };

  return (
    <nav className="pagination-shell" aria-label="Job results pages">
      <div className="pagination-pages">
        {items.map((item) =>
          item.type === "ellipsis" ? (
            <span key={item.key} className="pagination-ellipsis" aria-hidden="true">
              ...
            </span>
          ) : (
            <button
              key={item.key}
              type="button"
              className={`pagination-button ${item.page === safeCurrentPage ? "active" : ""}`}
              aria-current={item.page === safeCurrentPage ? "page" : undefined}
              onClick={() => onPageChange(item.page)}
            >
              {item.label}
            </button>
          )
        )}
      </div>

      <form className="pagination-jump" onSubmit={handleSubmit}>
        <label htmlFor="job-page-jump">Go to</label>
        <input
          id="job-page-jump"
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          value={pageInput}
          placeholder={String(safeCurrentPage)}
          aria-label={`Go to page, 1 through ${totalPages}`}
          onChange={(event) => setPageInput(event.target.value.replace(/[^\d]/g, ""))}
        />
        <button type="submit">Go</button>
      </form>
    </nav>
  );
};

export default Pagination;
