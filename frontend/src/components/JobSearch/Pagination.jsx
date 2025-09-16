// components/Pagination.jsx

import React from "react";

const Pagination = ({ currentPage, totalPages, onPageChange }) => {
  if (totalPages <= 1) return null;

  return (
    <div style={{ textAlign: "center", marginTop: "20px" }}>
      {[...Array(totalPages)].map((_, idx) => {
        const pageNum = idx + 1;
        return (
          <button
            key={pageNum}
            style={{
              padding: "6px 12px",
              margin: "0 5px",
              backgroundColor: pageNum === currentPage ? "#005a78" : "#eee",
              color: pageNum === currentPage ? "#fff" : "#333",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer",
            }}
            onClick={() => onPageChange(pageNum)}
          >
            {pageNum}
          </button>
        );
      })}
    </div>
  );
};

export default Pagination;
