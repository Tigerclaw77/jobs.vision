import React, { useState } from "react";
import "../../styles/TagInput.css";

const TagInput = ({ tags, onAddTag, onRemoveTag }) => {
  const [input, setInput] = useState("");

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && input.trim()) {
      e.preventDefault();
      onAddTag(input.trim());
      setInput("");
    }
  };

  return (
    <div className="tag-input-container">
      <div className="active-tags">
        {tags.map((tag, idx) => (
          <span key={idx} className="filter-tag">
            {tag}
            <button
              className="remove-button"
              onClick={() => onRemoveTag(tag)}
              aria-label={`Remove ${tag}`}
            >
              &times;
            </button>
          </span>
        ))}
      </div>
      <input
        type="text"
        placeholder="Add keyword and press Enter"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        className="tag-input"
      />
    </div>
  );
};

export default TagInput;
