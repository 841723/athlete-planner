interface WorkoutTextProps {
  text?: string;
  className?: string;
}

export function WorkoutText({ text, className }: WorkoutTextProps) {
  if (!text) return null;
  return (
    <div className={`whitespace-pre-line text-sm leading-relaxed text-gray-200 ${className ?? ""}`}>
      {text}
    </div>
  );
}
