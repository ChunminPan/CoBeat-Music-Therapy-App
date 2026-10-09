interface ProgressBarProps {
  progress: number; // 0-100
  showLabel?: boolean;
  label?: string;
}

export function ProgressBar({ 
  progress, 
  showLabel = false,
  label 
}: ProgressBarProps) {
  const clampedProgress = Math.min(100, Math.max(0, progress));

  return (
    <div className="w-full">
      {showLabel && label && (
        <div className="text-sm text-muted-foreground mb-2">{label}</div>
      )}
      <div className="w-full h-3 bg-accent rounded-full overflow-hidden">
        <div
          className="h-full bg-primary rounded-full transition-all duration-300 ease-out"
          style={{ width: `${clampedProgress}%` }}
        />
      </div>
    </div>
  );
}
