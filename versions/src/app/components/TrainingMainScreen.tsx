import { useState } from 'react';
import { TopAppBar } from './TopAppBar';
import { PrimaryButton, SecondaryButton } from './PrimaryButton';
import { BeatOrb } from './BeatOrb';
import { Chip } from './Chip';
import { InlineHint } from './Toast';

interface TrainingMainScreenProps {
  onStartTraining?: () => void;
  onViewRecords?: () => void;
}

export function TrainingMainScreen({ 
  onStartTraining, 
  onViewRecords 
}: TrainingMainScreenProps) {
  // 训练状态
  const [stage] = useState(1);
  const [bpm, setBpm] = useState(72);
  const [tolMs, setTolMs] = useState(200);
  
  // 模拟命中/未命中状态
  const [orbState, setOrbState] = useState<'default' | 'hit' | 'miss'>('default');
  const [consecutiveHits, setConsecutiveHits] = useState(0);
  const [consecutiveMisses, setConsecutiveMisses] = useState(0);

  // 模拟用户点击节拍圆
  const handleBeatClick = () => {
    // 随机模拟命中或未命中（实际应用中会根据时间判断）
    const isHit = Math.random() > 0.3;
    
    if (isHit) {
      setOrbState('hit');
      setConsecutiveHits(prev => prev + 1);
      setConsecutiveMisses(0);
      
      // 连续命中 ≥ 12 拍：容忍窗收紧到 180ms
      if (consecutiveHits + 1 >= 12) {
        setTolMs(180);
      }
    } else {
      setOrbState('miss');
      setConsecutiveMisses(prev => prev + 1);
      setConsecutiveHits(0);
      
      // 连续失败 ≥ 6 拍：容忍窗放宽到 220ms，降速 5%
      if (consecutiveMisses + 1 >= 6) {
        setTolMs(220);
        setBpm(prev => Math.round(prev * 0.95));
      }
    }
    
    // 500ms 后恢复默认状态
    setTimeout(() => setOrbState('default'), 500);
  };

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Top App Bar */}
      <TopAppBar
        title="节拍训练"
        showBack={false}
        showHelp={true}
        showSettings={false}
        onHelp={() => console.log('打开帮助')}
      />

      {/* 主内容区 */}
      <div className="flex-1 flex flex-col items-center justify-between px-5 py-8">
        
        {/* 顶部信息区域 */}
        <div className="w-full flex justify-center">
          <InlineHint message="准备好开始训练了吗？" type="default" />
        </div>

        {/* 中央交互区域 - 节拍圆 */}
        <div className="flex flex-col items-center gap-6">
          {/* 节拍圆 - 可点击 */}
          <button
            onClick={handleBeatClick}
            className="focus:outline-none active:scale-95 transition-transform"
            aria-label="点击跟随节拍"
          >
            <BeatOrb 
              state={orbState}
              size={160} 
              pulse={true} 
            />
          </button>

          {/* 节拍圆下方提示 */}
          <InlineHint 
            message="跟着圆点点点点" 
            type="highlight" 
          />

          {/* 信息 Chips - 中下部 */}
          <div className="flex flex-wrap justify-center gap-2 mt-4">
            <Chip label="Stage" value={stage} variant="success" />
            <Chip label="BPM" value={bpm} />
            <Chip label="容忍窗" value={`${tolMs}ms`} variant="muted" />
          </div>

          {/* 状态调试信息（可选显示） */}
          {process.env.NODE_ENV === 'development' && (
            <div className="text-xs text-muted-foreground mt-2 text-center">
              <div>连续命中: {consecutiveHits} | 连续失败: {consecutiveMisses}</div>
              <div className="text-[10px] mt-1">
                命中≥12拍→容忍窗180ms | 失败≥6拍→容忍窗220ms & BPM↓5%
              </div>
            </div>
          )}
        </div>

        {/* 底部操作区 */}
        <div className="w-full space-y-3">
          <PrimaryButton
            size="large"
            className="w-full"
            onClick={onStartTraining}
          >
            开始训练
          </PrimaryButton>
          
          <SecondaryButton
            className="w-full"
            onClick={onViewRecords}
          >
            查看记录/数据
          </SecondaryButton>
        </div>
      </div>

      {/* 底部安全区域 */}
      <div style={{ height: 'var(--safe-area-bottom)' }} className="bg-background" />
    </div>
  );
}
