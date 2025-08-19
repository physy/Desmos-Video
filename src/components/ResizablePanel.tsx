import React, { useState, useCallback, useRef, useEffect } from "react";

interface ResizablePanelProps {
  children: React.ReactNode;
  direction: "horizontal" | "vertical";
  initialSizes?: number[];
  minSizes?: number[];
  maxSizes?: number[];
  className?: string;
}

export const ResizablePanel: React.FC<ResizablePanelProps> = ({
  children,
  direction,
  initialSizes = [50, 50],
  minSizes = [20, 20],
  maxSizes = [80, 80],
  className = "",
}) => {
  const [sizes, setSizes] = useState(initialSizes);
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const dragStartPos = useRef<number>(0);
  const dragStartSizes = useRef<number[]>([]);

  const childrenArray = React.Children.toArray(children);
  const isHorizontal = direction === "horizontal";

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      setIsDragging(true);
      dragStartPos.current = isHorizontal ? e.clientX : e.clientY;
      dragStartSizes.current = [...sizes];
    },
    [sizes, isHorizontal]
  );

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isDragging || !containerRef.current) return;

      const container = containerRef.current.getBoundingClientRect();
      const containerSize = isHorizontal ? container.width : container.height;
      const currentPos = isHorizontal ? e.clientX : e.clientY;
      const deltaPos = currentPos - dragStartPos.current;
      const deltaPercent = (deltaPos / containerSize) * 100;

      const newSizes = [...dragStartSizes.current];
      newSizes[0] = Math.max(minSizes[0], Math.min(maxSizes[0], newSizes[0] + deltaPercent));
      newSizes[1] = Math.max(minSizes[1], Math.min(maxSizes[1], 100 - newSizes[0]));

      setSizes(newSizes);
    },
    [isDragging, isHorizontal, minSizes, maxSizes]
  );

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  useEffect(() => {
    if (isDragging) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = isHorizontal ? "col-resize" : "row-resize";
      document.body.style.userSelect = "none";

      return () => {
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp, isHorizontal]);

  return (
    <div
      ref={containerRef}
      className={`${className} ${isHorizontal ? "flex" : "flex flex-col"} h-full w-full`}
    >
      {/* First panel */}
      <div
        style={{
          [isHorizontal ? "width" : "height"]: `${sizes[0]}%`,
        }}
        className="relative"
      >
        {childrenArray[0]}
      </div>

      {/* Resizer */}
      <div
        className={`
          ${
            isHorizontal
              ? "w-1 cursor-col-resize hover:bg-blue-500"
              : "h-1 cursor-row-resize hover:bg-blue-500"
          }
          bg-gray-300 hover:bg-blue-400 transition-colors duration-200 flex-shrink-0 relative group
        `}
        onMouseDown={handleMouseDown}
      >
        <div
          className={`
            absolute ${
              isHorizontal ? "-left-1 -right-1 top-0 bottom-0" : "-top-1 -bottom-1 left-0 right-0"
            }
            ${isHorizontal ? "cursor-col-resize" : "cursor-row-resize"}
          `}
        />
        {/* Visual indicator */}
        <div
          className={`
            absolute ${
              isHorizontal
                ? "top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
                : "left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
            }
            ${isHorizontal ? "w-0.5 h-6" : "h-0.5 w-6"}
            bg-gray-500 group-hover:bg-blue-600 rounded-full opacity-60 group-hover:opacity-100 transition-all duration-200
          `}
        />
      </div>

      {/* Second panel */}
      <div
        style={{
          [isHorizontal ? "width" : "height"]: `${sizes[1]}%`,
        }}
        className="relative"
      >
        {childrenArray[1]}
      </div>
    </div>
  );
};

export default ResizablePanel;
