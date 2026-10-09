import { useState } from 'react';
import { HomePage } from './components/HomePage';
import { TrainingModeSelect } from './components/TrainingModeSelect';
import { Stage1Training } from './components/Stage1Training';
import { Stage2Training } from './components/Stage2Training';
import { MelodyMaker } from './components/MelodyMaker';

type Screen = 'home' | 'training-mode' | 'stage1' | 'stage2' | 'melody-maker';

export default function App() {
  const [currentScreen, setCurrentScreen] = useState<Screen>('home');
  const [stage2Unlocked, setStage2Unlocked] = useState(false);

  // 导航函数
  const navigateTo = (screen: Screen) => {
    setCurrentScreen(screen);
  };

  // 解锁 Stage 2
  const handleUnlockStage2 = () => {
    setStage2Unlocked(true);
    navigateTo('training-mode');
  };

  // 渲染当前页面
  const renderScreen = () => {
    switch (currentScreen) {
      case 'home':
        return (
          <HomePage
            onStartTraining={() => navigateTo('training-mode')}
            onStartCreation={() => navigateTo('melody-maker')}
            onViewRecords={() => console.log('查看记录')}
            onSettings={() => console.log('设置')}
          />
        );

      case 'training-mode':
        return (
          <TrainingModeSelect
            onBack={() => navigateTo('home')}
            onHelp={() => console.log('帮助')}
            onStage1={() => navigateTo('stage1')}
            onStage2={() => navigateTo('stage2')}
            stage2Unlocked={stage2Unlocked}
          />
        );

      case 'stage1':
        return (
          <Stage1Training
            onExit={() => navigateTo('training-mode')}
            onUnlockStage2={handleUnlockStage2}
          />
        );

      case 'stage2':
        return (
          <Stage2Training
            onExit={() => navigateTo('training-mode')}
            onComplete={() => navigateTo('training-mode')}
          />
        );

      case 'melody-maker':
        return (
          <MelodyMaker
            onBack={() => navigateTo('home')}
            onHelp={() => console.log('帮助')}
            onSaveWork={(name) => console.log('保存作品:', name)}
          />
        );

      default:
        return <HomePage onStartTraining={() => navigateTo('training-mode')} />;
    }
  };

  return (
    // iPhone 13/14 尺寸容器
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div 
        className="bg-background shadow-2xl overflow-hidden relative"
        style={{ 
          width: '390px', 
          height: '844px',
          borderRadius: '40px',
        }}
      >
        {/* 开发调试导航 - 生产环境可删除 */}
        {process.env.NODE_ENV === 'development' && (
          <div className="absolute top-2 left-1/2 -translate-x-1/2 z-50 bg-foreground/90 backdrop-blur-sm rounded-full px-3 py-1 shadow-lg">
            <div className="flex gap-1">
              {(['home', 'training-mode', 'stage1', 'stage2', 'melody-maker'] as Screen[]).map((screen) => (
                <button
                  key={screen}
                  onClick={() => navigateTo(screen)}
                  className={`px-2 py-1 rounded-full text-[10px] transition-all ${
                    currentScreen === screen
                      ? 'bg-primary text-primary-foreground'
                      : 'text-background/70 hover:text-background'
                  }`}
                >
                  {screen === 'home' ? '首页' : 
                   screen === 'training-mode' ? '选择' : 
                   screen === 'stage1' ? 'S1' : 
                   screen === 'stage2' ? 'S2' : '创作'}
                </button>
              ))}
              <button
                onClick={() => setStage2Unlocked(!stage2Unlocked)}
                className={`px-2 py-1 rounded-full text-[10px] ${
                  stage2Unlocked ? 'bg-success text-white' : 'bg-miss text-miss-foreground'
                }`}
                title="切换 Stage 2 解锁状态"
              >
                {stage2Unlocked ? '🔓' : '🔒'}
              </button>
            </div>
          </div>
        )}

        {/* 主内容 */}
        {renderScreen()}
      </div>
    </div>
  );
}
