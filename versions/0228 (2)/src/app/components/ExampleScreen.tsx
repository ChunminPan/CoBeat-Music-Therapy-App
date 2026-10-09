import { useState, useEffect } from 'react';
import { TopAppBar } from './TopAppBar';
import { PrimaryButton } from './PrimaryButton';
import { CountdownNumber } from './CountdownNumber';
import { BeatOrb } from './BeatOrb';
import { CircularProgress } from './CircularProgress';
import { Chip } from './Chip';
import { InlineHint } from './Toast';

export function ExampleScreen() {
  const [countdown, setCountdown] = useState(3);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (isPlaying && countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [isPlaying, countdown]);

  useEffect(() => {
    if (isPlaying && countdown === 0) {
      const interval = setInterval(() => {
        setProgress((prev) => {
          if (prev >= 100) {
            clearInterval(interval);
            setIsPlaying(false);
            return 100;
          }
          return prev + 2;
        });
      }, 600);
      return () => clearInterval(interval);
    }
  }, [isPlaying, countdown]);

  const handleStart = () => {
    setIsPlaying(true);
    setCountdown(3);
    setProgress(0);
  };

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Top Bar */}
      <TopAppBar
        title="节奏训练"
        onBack={() => console.log('返回')}
        onSettings={() => console.log('设置')}
      />

      {/* 主内容区 - 中央对齐 */}
      <div className="flex-1 flex flex-col items-center justify-between px-5 py-8">
        {/* 顶部信息 */}
        <div className="w-full flex justify-center gap-2">
          <Chip label="BPM" value={120} />
          <Chip label="Stage" value={1} variant="success" />
          <Chip label="Round" value="1/4" />
        </div>

        {/* 中央区域 - 主要交互 */}
        <div className="flex flex-col items-center gap-8">
          {countdown > 0 && isPlaying ? (
            <CountdownNumber number={countdown} size="large" animate />
          ) : isPlaying ? (
            <BeatOrb state="default" size={140} pulse={true} />
          ) : (
            <BeatOrb state="default" size={140} />
          )}

          {isPlaying && countdown === 0 && (
            <InlineHint message="跟着圆点点点点" type="highlight" />
          )}

          {!isPlaying && progress === 0 && (
            <InlineHint message="准备好了吗？" type="default" />
          )}
        </div>

        {/* 底部操作区 */}
        <div className="w-full space-y-4">
          {isPlaying && countdown === 0 && (
            <CircularProgress progress={progress} size={80} />
          )}
          
          <PrimaryButton
            size="large"
            className="w-full"
            onClick={handleStart}
            disabled={isPlaying}
          >
            {isPlaying ? '训练中...' : '开始训练'}
          </PrimaryButton>
        </div>
      </div>

      {/* 底部安全区域 */}
      <div style={{ height: 'var(--safe-area-bottom)' }} className="bg-background" />
    </div>
  );
}
