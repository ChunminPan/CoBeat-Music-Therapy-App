interface ChipProps {
  label: string;
  value?: string | number;
  variant?: 'default' | 'success' | 'muted';
}

export function Chip({ label, value, variant = 'default' }: ChipProps) {
  const variantStyles = {
    default: 'bg-primary/10 text-primary border-primary/20',
    success: 'bg-success/10 text-success border-success/20',
    muted: 'bg-muted text-muted-foreground border-border',
  };

  return (
    <div 
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border ${variantStyles[variant]}`}
    >
      <span className="text-sm font-medium">{label}</span>
      {value !== undefined && (
        <span className="text-sm font-medium opacity-90">{value}</span>
      )}
    </div>
  );
}
