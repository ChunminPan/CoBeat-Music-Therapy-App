import { TopAppBar } from './TopAppBar';
import { PrimaryButton } from './PrimaryButton';
import { Lock, Unlock, Zap, Activity } from 'lucide-react';

interface TrainingModeSelectProps {
  onBack?: () => void;
  onHelp?: () => void;
  onStage1?: () => void;
  onStage2?: () => void;
  stage2Unlocked?: boolean;
}

export function TrainingModeSelect({
  onBack,
  onHelp,
  onStage1,
  onStage2,
  stage2Unlocked = false,
}: TrainingModeSelectProps) {
  return (
    <div className="h-full flex flex-col bg-background">
      {/* Top App Bar */}
      <TopAppBar
        title="节拍训练"
        onBack={onBack}
        showHelp={true}
        onHelp={onHelp}
        showSettings={false}
      />

      {/* 主内容区 */}
      <div className="flex-1 px-5 py-6 space-y-5 overflow-y-auto">
        
        {/* Stage 1 卡片 */}
        <div className="bg-card rounded-[var(--radius-2xl)] p-6 shadow-sm border border-border">
          <div className="flex items-start justify-between mb-4">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <Activity className="w-5 h-5 text-primary" />
                <h2 className="text-foreground">Stage 1：固定节拍</h2>
              </div>
              <p className="text-muted-foreground text-sm mb-1">
                60–80 BPM，1 分钟一轮
              </p>
              <p className="text-muted-foreground text-xs">
                跟随固定节奏，练习稳定性
              </p>
            </div>
          </div>
          
          <PrimaryButton
            size="large"
            className="w-full"
            onClick={onStage1}
          >
            进入 Stage 1
          </PrimaryButton>
        </div>

        {/* Stage 2 卡片 */}
        <div 
          className={`bg-card rounded-[var(--radius-2xl)] p-6 shadow-sm border ${
            stage2Unlocked ? 'border-border' : 'border-border opacity-75'
          }`}
        >
          <div className="flex items-start justify-between mb-4">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <Zap className={`w-5 h-5 ${stage2Unlocked ? 'text-success' : 'text-muted-foreground'}`} />
                <h2 className="text-foreground">Stage 2：变速挑战</h2>
                {!stage2Unlocked && (
                  <Lock className="w-4 h-4 text-muted-foreground" />
                )}
                {stage2Unlocked && (
                  <Unlock className="w-4 h-4 text-success" />
                )}
              </div>
              <p className="text-muted-foreground text-sm mb-1">
                4×30 秒，动态难度
              </p>
              <p className="text-muted-foreground text-xs">
                {stage2Unlocked 
                  ? '自适应难度，挑战你的极限' 
                  : '完成 Stage 1 达标（≥70%）后解锁'
                }
              </p>
            </div>
          </div>
          
          <PrimaryButton
            size="large"
            className="w-full"
            onClick={onStage2}
            disabled={!stage2Unlocked}
          >
            {stage2Unlocked ? '进入 Stage 2' : '未解锁'}
          </PrimaryButton>
        </div>

        {/* 提示信息 */}
        {!stage2Unlocked && (
          <div className="bg-primary/5 rounded-[var(--radius-lg)] p-4 border border-primary/20">
            <p className="text-primary text-sm text-center">
              💡 完成 Stage 1 并达到 70% 命中率即可解锁 Stage 2
            </p>
          </div>
        )}

      </div>

      {/* 底部安全区域 */}
      <div style={{ height: 'var(--safe-area-bottom)' }} className="bg-background" />
    </div>
  );
}
