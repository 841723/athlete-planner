interface WorkoutTextProps {
  text?: string;
  className?: string;
}

export function WorkoutText({ text, className }: WorkoutTextProps) {
  if (!text) return null;
  return (
    <div
      className={`whitespace-pre-wrap text-sm leading-relaxed text-gray-200 ${className ?? ""}`}
      style={{ tabSize: 2 }}
    >
      {text}
    </div>
  );
}
