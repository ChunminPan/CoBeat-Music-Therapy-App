interface StatItem {
  label: string;
  value: string | number;
  unit?: string;
}

interface StatsCardProps {
  title?: string;
  stats: StatItem[];
}

export function StatsCard({ title, stats }: StatsCardProps) {
  return (
    <div className="bg-card rounded-[var(--radius-xl)] p-5 shadow-sm border border-border">
      {title && (
        <h3 className="mb-4 text-foreground">{title}</h3>
      )}
      <div className="grid grid-cols-2 gap-4">
        {stats.map((stat, index) => (
          <div key={index} className="flex flex-col">
            <div className="text-sm text-muted-foreground mb-1">
              {stat.label}
            </div>
            <div className="text-xl font-medium text-foreground">
              {stat.value}
              {stat.unit && (
                <span className="text-base text-muted-foreground ml-1">
                  {stat.unit}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
