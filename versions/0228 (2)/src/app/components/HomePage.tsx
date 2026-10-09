import { Music, Drum, Grid3x3, Clock, TrendingUp, Settings } from 'lucide-react';
import { PrimaryButton } from './PrimaryButton';

interface HomePageProps {
  onStartTraining?: () => void;
  onStartCreation?: () => void;
  onViewRecords?: () => void;
  onSettings?: () => void;
}

export function HomePage({
  onStartTraining,
  onStartCreation,
  onViewRecords,
  onSettings,
}: HomePageProps) {
  // 模拟最近记录数据（实际应从数据库读取）
  const recentTraining = {
    hasData: true,
    hitRate: 87,
    date: '今天 14:30',
  };

  const recentWork = {
    hasData: true,
    name: '小星星变奏',
    date: '昨天',
  };

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Top App Bar */}
      <div className="w-full px-5 py-4 bg-card flex items-center justify-between">
        <h1 className="text-foreground">Music Therapy</h1>
        <button
          onClick={onSettings}
          className="flex items-center justify-center rounded-full transition-colors active:bg-accent"
          style={{ minWidth: 44, minHeight: 44 }}
          aria-label="设置"
        >
          <Settings className="w-6 h-6 text-muted-foreground" />
        </button>
      </div>

      {/* 主内容区 */}
      <div className="flex-1 px-5 py-6 space-y-5 overflow-y-auto">
        
        {/* 卡片 A：节拍训练 */}
        <div className="bg-card rounded-[var(--radius-2xl)] p-6 shadow-sm border border-border">
          <div className="flex items-start justify-between mb-4">
            <div className="flex-1">
              <h2 className="text-foreground mb-2">节拍训练</h2>
              <p className="text-muted-foreground text-sm">
                跟着节拍点一点
              </p>
            </div>
            <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
              <Drum className="w-7 h-7 text-primary" />
            </div>
          </div>
          <PrimaryButton
            size="large"
            className="w-full"
            onClick={onStartTraining}
          >
            开始训练
          </PrimaryButton>
        </div>

        {/* 卡片 B：即兴创作 */}
        <div className="bg-card rounded-[var(--radius-2xl)] p-6 shadow-sm border border-border">
          <div className="flex items-start justify-between mb-4">
            <div className="flex-1">
              <h2 className="text-foreground mb-2">即兴创作</h2>
              <p className="text-muted-foreground text-sm">
                点格子做旋律
              </p>
            </div>
            <div className="w-14 h-14 rounded-full bg-success/10 flex items-center justify-center">
              <Grid3x3 className="w-7 h-7 text-success" />
            </div>
          </div>
          <PrimaryButton
            size="large"
            className="w-full"
            onClick={onStartCreation}
          >
            开始创作
          </PrimaryButton>
        </div>

        {/* 最近记录/我的作品 */}
        <button
          onClick={onViewRecords}
          className="w-full bg-card rounded-[var(--radius-xl)] p-5 shadow-sm border border-border active:bg-accent transition-colors text-left"
        >
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-foreground">最近记录</h3>
            <Music className="w-5 h-5 text-muted-foreground" />
          </div>

          {recentTraining.hasData || recentWork.hasData ? (
            <div className="space-y-2">
              {recentTraining.hasData && (
                <div className="flex items-center gap-2 text-sm">
                  <Clock className="w-4 h-4 text-success" />
                  <span className="text-muted-foreground">训练</span>
                  <span className="text-foreground font-medium">
                    命中率 {recentTraining.hitRate}%
                  </span>
                  <span className="text-muted-foreground text-xs ml-auto">
                    {recentTraining.date}
                  </span>
                </div>
              )}
              {recentWork.hasData && (
                <div className="flex items-center gap-2 text-sm">
                  <Music className="w-4 h-4 text-primary" />
                  <span className="text-muted-foreground">作品</span>
                  <span className="text-foreground font-medium">
                    {recentWork.name}
                  </span>
                  <span className="text-muted-foreground text-xs ml-auto">
                    {recentWork.date}
                  </span>
                </div>
              )}
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">
              还没有记录，开始你的第一次练习吧！
            </p>
          )}
        </button>

      </div>

      {/* 底部安全区域 */}
      <div style={{ height: 'var(--safe-area-bottom)' }} className="bg-background" />
    </div>
  );
}
