import React from "react";

const IncomeWidget = ({ income }) => {
  return (
    <div className="income-widget">
      <h3>Income Overview</h3>
      <p>Monthly Income: ${income}</p>
      {/* Placeholder for future charts/graphs */}
    </div>
  );
};

export default IncomeWidget;
