import { useCallback, useRef } from "react";

interface Props {
  onResize: (delta: number) => void;
}

export function ResizeHandle({ onResize }: Props) {
  const startXRef = useRef(0);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      startXRef.current = e.clientX;

      const handle = e.currentTarget as HTMLElement;
      handle.classList.add("oai-resize--active");
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";

      const onMouseMove = (ev: MouseEvent) => {
        const delta = ev.clientX - startXRef.current;
        if (delta !== 0) {
          onResize(delta);
          startXRef.current = ev.clientX;
        }
      };

      const onMouseUp = () => {
        handle.classList.remove("oai-resize--active");
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
        document.removeEventListener("mousemove", onMouseMove);
        document.removeEventListener("mouseup", onMouseUp);
      };

      document.addEventListener("mousemove", onMouseMove);
      document.addEventListener("mouseup", onMouseUp);
    },
    [onResize],
  );

  return (
    <div className="oai-resize" onMouseDown={handleMouseDown} />
  );
}
