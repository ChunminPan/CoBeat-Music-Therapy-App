import { useEffect, useState } from 'react';

interface BeatOrbProps {
  state?: 'default' | 'hit' | 'miss';
  size?: number;
  pulse?: boolean;
}

export function BeatOrb({ 
  state = 'default', 
  size = 120,
  pulse = false 
}: BeatOrbProps) {
  const [scale, setScale] = useState(1);

  useEffect(() => {
    if (pulse && state === 'default') {
      // 每拍轻微缩放，不闪烁
      const interval = setInterval(() => {
        setScale(1.08);
        setTimeout(() => setScale(1), 120);
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [pulse, state]);

  const stateStyles = {
    default: 'bg-primary border-primary',
    hit: 'bg-success border-success',
    miss: 'bg-miss border-miss',
  };

  const stateRingStyles = {
    default: 'border-primary/30',
    hit: 'border-success/40',
    miss: 'border-miss/40',
  };

  return (
    <div className="flex items-center justify-center">
      {/* 外圈 - 轻微的视觉提示 */}
      <div
        className={`rounded-full border-4 ${stateRingStyles[state]} transition-all duration-300 ease-out flex items-center justify-center`}
        style={{ 
          width: size + 24, 
          height: size + 24,
          transform: `scale(${scale})`,
        }}
      >
        {/* 内圈 - 主体 */}
        <div
          className={`rounded-full ${stateStyles[state]} shadow-lg transition-all duration-300 ease-out`}
          style={{ width: size, height: size }}
        />
      </div>
    </div>
  );
}
