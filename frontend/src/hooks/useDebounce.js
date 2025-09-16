import { useRef } from "react";

const useDebounce = (callback, delay = 500) => {
  const timeoutRef = useRef(null);

  const debouncedFunction = (...args) => {
    clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      callback(...args);
    }, delay);
  };

  return debouncedFunction;
};

export default useDebounce;
