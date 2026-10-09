import { useState, useEffect, useRef } from 'react';
import { TopAppBar } from './TopAppBar';
import { PrimaryButton, SecondaryButton } from './PrimaryButton';
import { BeatOrb } from './BeatOrb';
import { Chip } from './Chip';
import { CountdownNumber } from './CountdownNumber';
import { CircularProgress } from './CircularProgress';
import { InlineHint } from './Toast';
import { Modal } from './Modal';
import { StatsCard } from './StatsCard';
import { TrendingUp, TrendingDown } from 'lucide-react';

type TrainingPhase = 'prepare' | 'countdown' | 'training' | 'paused' | 'roundComplete' | 'allComplete';

interface Stage2TrainingProps {
  onExit?: () => void;
  onComplete?: () => void;
}

export function Stage2Training({ onExit, onComplete }: Stage2TrainingProps) {
  // DDA 参数
  const [bpmCur, setBpmCur] = useState(80);
  const [bpmTarget, setBpmTarget] = useState(80);
  const [range, setRange] = useState(10); // ±%
  const [tolMs, setTolMs] = useState(200);
  
  const roundDuration = 30; // 30 秒每轮
  const totalRounds = 4;

  // 训练状态
  const [phase, setPhase] = useState<TrainingPhase>('prepare');
  const [currentRound, setCurrentRound] = useState(1);
  const [prepareCountdown, setPrepareCountdown] = useState(2);
  const [countdown, setCountdown] = useState(3);
  const [timeRemaining, setTimeRemaining] = useState(roundDuration);
  const [progress, setProgress] = useState(0);

  // 节拍状态
  const [orbState, setOrbState] = useState<'default' | 'hit' | 'miss'>('default');
  const [roundHits, setRoundHits] = useState(0);
  const [roundTotal, setRoundTotal] = useState(0);
  const [roundMeanErr, setRoundMeanErr] = useState(0);

  // 上一 Block 数据（DDA 面板显示）
  const [lastBlockAcc, setLastBlockAcc] = useState(85);
  const [lastBlockErr, setLastBlockErr] = useState(25);

  // 结果
  const [showRoundResult, setShowRoundResult] = useState(false);
  const [showFinalResult, setShowFinalResult] = useState(false);
  const [finalHitRate, setFinalHitRate] = useState(0);

  const timer = useRef<NodeJS.Timeout>();

  // BPM 平滑过渡（1秒）
  const [isTransitioning, setIsTransitioning] = useState(false);

  // 准备阶段倒计时
  useEffect(() => {
    if (phase === 'prepare' && prepareCountdown > 0) {
      timer.current = setTimeout(() => {
        setPrepareCountdown(prepareCountdown - 1);
      }, 1000);
    } else if (phase === 'prepare' && prepareCountdown === 0) {
      setPhase('countdown');
      setCountdown(3);
    }
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [phase, prepareCountdown]);

  // 3秒倒计时
  useEffect(() => {
    if (phase === 'countdown' && countdown > 0) {
      timer.current = setTimeout(() => {
        setCountdown(countdown - 1);
      }, 1000);
    } else if (phase === 'countdown' && countdown === 0) {
      setTimeout(() => {
        setPhase('training');
        startRound();
      }, 500);
    }
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [phase, countdown]);

  // 开始一轮训练
  const startRound = () => {
    setTimeRemaining(roundDuration);
    setProgress(0);
    setRoundHits(0);
    setRoundTotal(0);

    timer.current = setInterval(() => {
      setTimeRemaining(prev => {
        const newTime = prev - 1;
        setProgress(((roundDuration - newTime) / roundDuration) * 100);
        
        if (newTime <= 0) {
          endRound();
          return 0;
        }
        return newTime;
      });
    }, 1000);
  };

  // 结束一轮
  const endRound = () => {
    if (timer.current) clearInterval(timer.current);
    setPhase('roundComplete');
    
    const hitRate = roundTotal > 0 ? Math.round((roundHits / roundTotal) * 100) : 0;
    
    // 模拟 DDA 调整
    adjustDifficulty(hitRate);
    
    setShowRoundResult(true);
  };

  // DDA 难度调整
  const adjustDifficulty = (hitRate: number) => {
    setLastBlockAcc(hitRate);
    setLastBlockErr(roundMeanErr);

    if (hitRate >= 85) {
      // 表现优秀，提高难度
      const newTarget = Math.min(bpmCur + 10, 120);
      setBpmTarget(newTarget);
      setRange(Math.max(range - 2, 5));
      setTolMs(Math.max(tolMs - 20, 120));
      
      // 平滑过渡
      smoothTransition(bpmCur, newTarget);
    } else if (hitRate < 60) {
      // 表现不佳，降低难度
      const newTarget = Math.max(bpmCur - 5, 60);
      setBpmTarget(newTarget);
      setRange(Math.min(range + 2, 15));
      setTolMs(Math.min(tolMs + 20, 250));
      
      smoothTransition(bpmCur, newTarget);
    }
  };

  // BPM 平滑过渡
  const smoothTransition = (from: number, to: number) => {
    if (from === to) return;
    
    setIsTransitioning(true);
    const step = (to - from) / 10; // 10 步，每步 100ms
    let current = from;
    let count = 0;

    const transitionTimer = setInterval(() => {
      count++;
      current += step;
      setBpmCur(Math.round(current));
      
      if (count >= 10) {
        clearInterval(transitionTimer);
        setBpmCur(to);
        setIsTransitioning(false);
      }
    }, 100);
  };

  // 用户点击节拍
  const handleBeatClick = () => {
    if (phase !== 'training') return;

    const isHit = Math.random() > 0.2;
    setRoundTotal(prev => prev + 1);
    
    if (isHit) {
      setOrbState('hit');
      setRoundHits(prev => prev + 1);
    } else {
      setOrbState('miss');
    }
    
    setRoundMeanErr(Math.round(Math.random() * 40 + 10));
    setTimeout(() => setOrbState('default'), 500);
  };

  // 继续下一轮
  const handleNextRound = () => {
    setShowRoundResult(false);
    
    if (currentRound >= totalRounds) {
      // 全部完成
      const totalHitRate = Math.round((roundHits / roundTotal) * 100);
      setFinalHitRate(totalHitRate);
      setPhase('allComplete');
      setShowFinalResult(true);
    } else {
      // 继续下一轮
      setCurrentRound(prev => prev + 1);
      setPhase('prepare');
      setPrepareCountdown(2);
    }
  };

  // 暂停
  const handlePause = () => {
    setPhase('paused');
    if (timer.current) clearInterval(timer.current);
  };

  // 继续
  const handleResume = () => {
    setPhase('training');
    startRound();
  };

  const currentHitRate = roundTotal > 0 ? Math.round((roundHits / roundTotal) * 100) : 0;

  return (
    <div className="h-full flex flex-col bg-background">
      <TopAppBar
        title="Stage 2 变速挑战"
        onBack={onExit}
        showHelp={true}
        onHelp={() => console.log('帮助')}
        showSettings={false}
      />

      <div className="flex-1 flex flex-col items-center justify-between px-5 py-4 gap-4">
        
        {/* 顶部信息 */}
        <div className="w-full space-y-3">
          {/* 环形进度 */}
          {(phase === 'training' || phase === 'paused') && (
            <div className="flex justify-center">
              <CircularProgress progress={progress} size={70} showPercentage={false} />
            </div>
          )}

          {/* 信息 Chips */}
          <div className="flex flex-wrap justify-center gap-2">
            <Chip label={`Round ${currentRound}/${totalRounds}`} variant="success" />
            <Chip label="BPM" value={bpmCur} />
            <Chip label="Range" value={`±${range}%`} variant="muted" />
            <Chip label="容忍窗" value={`${tolMs}ms`} variant="muted" />
          </div>

          {/* 速度变化提示 */}
          {isTransitioning && (
            <div className="bg-primary/10 rounded-[var(--radius-lg)] px-4 py-2 flex items-center justify-center gap-2">
              {bpmTarget > bpmCur ? (
                <TrendingUp className="w-4 h-4 text-primary" />
              ) : (
                <TrendingDown className="w-4 h-4 text-primary" />
              )}
              <span className="text-sm text-primary">
                速度调整中 {bpmCur} → {bpmTarget}
              </span>
            </div>
          )}
        </div>

        {/* 中央区域 */}
        <div className="flex flex-col items-center gap-4">
          {phase === 'prepare' && prepareCountdown > 0 ? (
            <>
              <InlineHint message={`准备 ${prepareCountdown}s`} type="default" />
            </>
          ) : phase === 'countdown' && countdown > 0 ? (
            <>
              <CountdownNumber number={countdown} size="large" animate />
            </>
          ) : (
            <>
              <button
                onClick={handleBeatClick}
                className="focus:outline-none active:scale-95 transition-transform"
                disabled={phase !== 'training'}
              >
                <BeatOrb state={orbState} size={140} pulse={phase === 'training'} />
              </button>

              <InlineHint 
                message={phase === 'training' ? '跟着圆点点点点' : '训练已暂停'} 
                type={phase === 'training' ? 'highlight' : 'default'} 
              />

              {phase === 'training' && (
                <div className="text-sm text-muted-foreground">
                  命中: {roundHits} / {roundTotal} ({currentHitRate}%)
                </div>
              )}
            </>
          )}
        </div>

        {/* DDA 面板 */}
        {phase === 'training' && currentRound > 1 && (
          <div className="w-full bg-accent/50 rounded-[var(--radius-lg)] p-3 border border-border">
            <div className="text-xs text-muted-foreground mb-2">上轮表现</div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-muted-foreground">命中率</span>
                <span className="ml-2 text-foreground font-medium">{lastBlockAcc}%</span>
              </div>
              <div>
                <span className="text-muted-foreground">平均误差</span>
                <span className="ml-2 text-foreground font-medium">{lastBlockErr}ms</span>
              </div>
            </div>
          </div>
        )}

        {/* 底部按钮 */}
        <div className="w-full space-y-3">
          {phase === 'training' ? (
            <div className="grid grid-cols-2 gap-3">
              <SecondaryButton onClick={onExit}>退出</SecondaryButton>
              <PrimaryButton onClick={handlePause}>暂停</PrimaryButton>
            </div>
          ) : phase === 'paused' ? (
            <div className="grid grid-cols-2 gap-3">
              <SecondaryButton onClick={onExit}>退出</SecondaryButton>
              <PrimaryButton onClick={handleResume}>继续</PrimaryButton>
            </div>
          ) : null}
        </div>
      </div>

      <div style={{ height: 'var(--safe-area-bottom)' }} className="bg-background" />

      {/* 轮次结果 */}
      <Modal
        isOpen={showRoundResult}
        onClose={() => {}}
        title={`Round ${currentRound} 完成`}
        primaryAction={{
          label: currentRound >= totalRounds ? '查看总结' : '继续下一轮',
          onClick: handleNextRound,
        }}
      >
        <StatsCard
          title="本轮成绩"
          stats={[
            { label: '命中率', value: currentHitRate, unit: '%' },
            { label: '平均误差', value: roundMeanErr, unit: 'ms' },
            { label: '最终 BPM', value: bpmCur },
            { label: '最终 Range', value: `±${range}`, unit: '%' },
          ]}
        />
      </Modal>

      {/* 最终结果 */}
      <Modal
        isOpen={showFinalResult}
        onClose={() => {}}
        title="🎉 Stage 2 完成！"
        primaryAction={{
          label: '返回',
          onClick: () => {
            setShowFinalResult(false);
            onComplete?.();
          },
        }}
      >
        <div className="space-y-4">
          <p className="text-foreground text-center">
            太棒了！你完成了所有 4 轮挑战！
          </p>
          <StatsCard
            title="总体表现"
            stats={[
              { label: '完成轮数', value: totalRounds },
              { label: '最终 BPM', value: bpmCur },
              { label: '最终 Range', value: `±${range}`, unit: '%' },
              { label: '最终容忍窗', value: tolMs, unit: 'ms' },
            ]}
          />
        </div>
      </Modal>
    </div>
  );
}
