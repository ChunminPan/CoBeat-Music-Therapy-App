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

type TrainingPhase = 'countdown' | 'training' | 'paused' | 'completed';

interface Stage1TrainingProps {
  onExit?: () => void;
  onNextStage?: () => void;
  onUnlockStage2?: () => void;
}

export function Stage1Training({ onExit, onNextStage, onUnlockStage2 }: Stage1TrainingProps) {
  // 训练配置
  const [bpm] = useState(72); // 60-80 之间固定值
  const [tolMs, setTolMs] = useState(200);
  const trainingDuration = 60; // 1 分钟训练时长（秒）

  // 训练状态
  const [phase, setPhase] = useState<TrainingPhase>('countdown');
  const [countdown, setCountdown] = useState(3);
  const [timeRemaining, setTimeRemaining] = useState(trainingDuration);
  const [progress, setProgress] = useState(0);

  // 节拍状态
  const [orbState, setOrbState] = useState<'default' | 'hit' | 'miss'>('default');
  const [totalBeats, setTotalBeats] = useState(0);
  const [hitBeats, setHitBeats] = useState(0);
  const [consecutiveHits, setConsecutiveHits] = useState(0);
  const [consecutiveMisses, setConsecutiveMisses] = useState(0);

  // 结果数据
  const [hitRate, setHitRate] = useState(0);
  const [showResultModal, setShowResultModal] = useState(false);

  // 定时器引用
  const countdownTimer = useRef<NodeJS.Timeout>();
  const trainingTimer = useRef<NodeJS.Timeout>();
  const beatTimer = useRef<NodeJS.Timeout>();

  // 倒计时逻辑
  useEffect(() => {
    if (phase === 'countdown' && countdown > 0) {
      countdownTimer.current = setTimeout(() => {
        setCountdown(countdown - 1);
      }, 1000);
    } else if (phase === 'countdown' && countdown === 0) {
      // 倒计时结束，开始训练
      setTimeout(() => {
        setPhase('training');
        startTraining();
      }, 500);
    }

    return () => {
      if (countdownTimer.current) clearTimeout(countdownTimer.current);
    };
  }, [phase, countdown]);

  // 开始训练
  const startTraining = () => {
    // 开始计时
    trainingTimer.current = setInterval(() => {
      setTimeRemaining(prev => {
        const newTime = prev - 1;
        setProgress(((trainingDuration - newTime) / trainingDuration) * 100);
        
        if (newTime <= 0) {
          endTraining();
          return 0;
        }
        return newTime;
      });
    }, 1000);

    // 开始节拍脉动
    startBeatPulse();
  };

  // 节拍脉动（模拟）
  const startBeatPulse = () => {
    const beatInterval = (60 / bpm) * 1000; // 转换为毫秒
    
    beatTimer.current = setInterval(() => {
      setTotalBeats(prev => prev + 1);
    }, beatInterval);
  };

  // 用户点击节拍
  const handleBeatClick = () => {
    if (phase !== 'training') return;

    // 简化版：随机模拟命中/未命中（实际应根据时间窗口判断）
    const isHit = Math.random() > 0.25;
    
    if (isHit) {
      setOrbState('hit');
      setHitBeats(prev => prev + 1);
      setConsecutiveHits(prev => prev + 1);
      setConsecutiveMisses(0);
      
      // 连续命中 ≥ 12 拍：容忍窗收紧
      if (consecutiveHits + 1 >= 12 && tolMs > 180) {
        setTolMs(180);
      }
    } else {
      setOrbState('miss');
      setConsecutiveMisses(prev => prev + 1);
      setConsecutiveHits(0);
      
      // 连续失败 ≥ 6 拍：容忍窗放宽
      if (consecutiveMisses + 1 >= 6 && tolMs < 220) {
        setTolMs(220);
      }
    }
    
    // 500ms 后恢复默认状态
    setTimeout(() => setOrbState('default'), 500);
  };

  // 暂停训练
  const handlePause = () => {
    setPhase('paused');
    if (trainingTimer.current) clearInterval(trainingTimer.current);
    if (beatTimer.current) clearInterval(beatTimer.current);
  };

  // 继续训练
  const handleResume = () => {
    setPhase('training');
    startTraining();
  };

  // 退出训练
  const handleExit = () => {
    if (trainingTimer.current) clearInterval(trainingTimer.current);
    if (beatTimer.current) clearInterval(beatTimer.current);
    onExit?.();
  };

  // 结束训练
  const endTraining = () => {
    if (trainingTimer.current) clearInterval(trainingTimer.current);
    if (beatTimer.current) clearInterval(beatTimer.current);
    
    setPhase('completed');
    
    // 计算命中率
    const rate = totalBeats > 0 ? Math.round((hitBeats / totalBeats) * 100) : 0;
    setHitRate(rate);
    setShowResultModal(true);
  };

  // 清理定时器
  useEffect(() => {
    return () => {
      if (countdownTimer.current) clearTimeout(countdownTimer.current);
      if (trainingTimer.current) clearInterval(trainingTimer.current);
      if (beatTimer.current) clearInterval(beatTimer.current);
    };
  }, []);

  // 是否达标（≥70%）
  const isPassed = hitRate >= 70;

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Top App Bar */}
      <TopAppBar
        title="Stage 1：固定 BPM 同拍"
        onBack={handleExit}
        showHelp={false}
        showSettings={false}
      />

      {/* 主内容区 */}
      <div className="flex-1 flex flex-col items-center justify-between px-5 py-6">
        
        {/* 顶部进度区域 */}
        <div className="w-full space-y-3">
          {/* 环形进度 - 显示剩余时间 */}
          {phase === 'training' || phase === 'paused' || phase === 'completed' ? (
            <div className="flex justify-center">
              <CircularProgress 
                progress={progress} 
                size={80} 
                showPercentage={false}
              />
            </div>
          ) : null}

          {/* 信息 Chips */}
          <div className="flex flex-wrap justify-center gap-2">
            <Chip label="BPM" value={bpm} />
            <Chip label="容忍窗" value={`${tolMs}ms`} variant="muted" />
            {(phase === 'training' || phase === 'paused') && (
              <Chip 
                label="剩余时间" 
                value={`${timeRemaining}s`} 
                variant="success" 
              />
            )}
          </div>
        </div>

        {/* 中央区域 - 倒计时或节拍圆 */}
        <div className="flex flex-col items-center gap-6">
          {phase === 'countdown' && countdown > 0 ? (
            // 倒计时阶段
            <>
              <CountdownNumber number={countdown} size="large" animate />
              <InlineHint message="准备开始..." type="default" />
            </>
          ) : (
            // 训练阶段
            <>
              <button
                onClick={handleBeatClick}
                className="focus:outline-none active:scale-95 transition-transform"
                disabled={phase !== 'training'}
                aria-label="点击跟随节拍"
              >
                <BeatOrb 
                  state={orbState}
                  size={160} 
                  pulse={phase === 'training'} 
                />
              </button>

              <InlineHint 
                message={
                  phase === 'training' 
                    ? "跟着圆点点点点" 
                    : phase === 'paused'
                    ? "训练已暂停"
                    : "训练完成"
                } 
                type={phase === 'training' ? 'highlight' : 'default'} 
              />

              {/* 实时统计 */}
              {phase === 'training' && (
                <div className="text-sm text-muted-foreground text-center">
                  命中: {hitBeats} / {totalBeats}
                </div>
              )}
            </>
          )}
        </div>

        {/* 底部操作区 */}
        <div className="w-full space-y-3">
          {phase === 'countdown' ? (
            <SecondaryButton
              className="w-full"
              onClick={handleExit}
            >
              取消
            </SecondaryButton>
          ) : phase === 'training' ? (
            <div className="grid grid-cols-2 gap-3">
              <SecondaryButton onClick={handleExit}>
                退出
              </SecondaryButton>
              <PrimaryButton onClick={handlePause}>
                暂停
              </PrimaryButton>
            </div>
          ) : phase === 'paused' ? (
            <div className="grid grid-cols-2 gap-3">
              <SecondaryButton onClick={handleExit}>
                退出
              </SecondaryButton>
              <PrimaryButton onClick={handleResume}>
                继续
              </PrimaryButton>
            </div>
          ) : null}
        </div>
      </div>

      {/* 底部安全区域 */}
      <div style={{ height: 'var(--safe-area-bottom)' }} className="bg-background" />

      {/* 结果弹窗 */}
      <Modal
        isOpen={showResultModal}
        onClose={() => setShowResultModal(false)}
        title={isPassed ? "🎉 训练完成！" : "训练完成"}
        primaryAction={
          isPassed
            ? {
                label: '解锁 Stage 2',
                onClick: () => {
                  setShowResultModal(false);
                  onUnlockStage2?.();
                },
              }
            : {
                label: '再试一次',
                onClick: () => {
                  setShowResultModal(false);
                  // 重置状态
                  setPhase('countdown');
                  setCountdown(3);
                  setTimeRemaining(trainingDuration);
                  setProgress(0);
                  setTotalBeats(0);
                  setHitBeats(0);
                  setConsecutiveHits(0);
                  setConsecutiveMisses(0);
                  setTolMs(200);
                },
              }
        }
        secondaryAction={{
          label: '返回',
          onClick: () => {
            setShowResultModal(false);
            handleExit();
          },
        }}
      >
        <div className="space-y-4">
          {isPassed ? (
            <p className="text-foreground text-center">
              太棒了！你的表现达标了，可以进入下一阶段！
            </p>
          ) : (
            <p className="text-foreground text-center">
              继续练习，你会越来越好的！
            </p>
          )}
          
          <StatsCard
            title="本轮成绩"
            stats={[
              { label: '命中率', value: hitRate, unit: '%' },
              { label: '达标要求', value: '70', unit: '%' },
              { label: '总节拍数', value: totalBeats },
              { label: '命中数', value: hitBeats },
            ]}
          />
          
          <div className={`text-center p-4 rounded-[var(--radius-lg)] ${
            isPassed 
              ? 'bg-success/10 text-success border border-success/30' 
              : 'bg-muted text-muted-foreground border border-border'
          }`}>
            {isPassed ? '✓ 已达标' : '✗ 未达标'}
          </div>
        </div>
      </Modal>
    </div>
  );
}