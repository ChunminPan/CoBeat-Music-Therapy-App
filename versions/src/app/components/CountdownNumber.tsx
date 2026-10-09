import { useEffect, useState } from 'react';

interface CountdownNumberProps {
  number: number;
  size?: 'default' | 'large';
  animate?: boolean;
}

export function CountdownNumber({ 
  number, 
  size = 'large',
  animate = true 
}: CountdownNumberProps) {
  const [scale, setScale] = useState(1);

  useEffect(() => {
    if (animate) {
      // 轻微缩放动画，不闪烁
      setScale(1.1);
      const timer = setTimeout(() => setScale(1), 150);
      return () => clearTimeout(timer);
    }
  }, [number, animate]);

  const fontSize = size === 'large' 
    ? 'text-[var(--text-4xl)]' 
    : 'text-[var(--text-3xl)]';

  return (
    <div className="flex items-center justify-center">
      <div
        className={`${fontSize} font-medium text-primary transition-transform duration-150 ease-out`}
        style={{ transform: `scale(${scale})` }}
      >
        {number}
      </div>
    </div>
  );
}
