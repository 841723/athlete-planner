import { useLayoutEffect, useRef } from "react";

interface AutoTextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  minRows?: number;
  maxRows?: number;
}

export function AutoTextarea({ minRows = 2, maxRows, className, value, ...props }: AutoTextareaProps) {
  const ref = useRef<HTMLTextAreaElement>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    const lineHeight = parseFloat(getComputedStyle(el).lineHeight) || 20;
    let height = el.scrollHeight;
    if (minRows > 1) height = Math.max(height, minRows * lineHeight);
    if (maxRows) height = Math.min(height, maxRows * lineHeight);
    el.style.height = `${height}px`;
  }, [value, minRows, maxRows]);

  return (
    <textarea
      ref={ref}
      className={className}
      value={value}
      rows={minRows}
      {...props}
    />
  );
}
