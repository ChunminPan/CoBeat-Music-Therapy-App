import { useState } from 'react';
import { TopAppBar } from './TopAppBar';
import { PrimaryButton, SecondaryButton } from './PrimaryButton';
import { Modal, NamingModal } from './Modal';
import { Play, Pause, RotateCcw, Undo, Share2, Save } from 'lucide-react';

interface MelodyMakerProps {
  onBack?: () => void;
  onHelp?: () => void;
  onSaveWork?: (name: string) => void;
}

// 音符网格：16 列（时间步）× 8 行（音高）
const GRID_COLS = 16;
const GRID_ROWS = 8;
const NOTE_NAMES = ['C5', 'B4', 'A4', 'G4', 'F4', 'E4', 'D4', 'C4'];

export function MelodyMaker({ onBack, onHelp, onSaveWork }: MelodyMakerProps) {
  // 网格状态：true = 有音符，false = 无音符
  const [grid, setGrid] = useState<boolean[][]>(
    Array(GRID_ROWS).fill(null).map(() => Array(GRID_COLS).fill(false))
  );

  // 播放状态
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentStep, setCurrentStep] = useState(-1);
  const [playbackSpeed, setPlaybackSpeed] = useState(120); // BPM

  // Modal 状态
  const [showNamingModal, setShowNamingModal] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [workName, setWorkName] = useState('');

  // 撤销历史
  const [history, setHistory] = useState<boolean[][][]>([]);

  // 切换音符
  const toggleNote = (row: number, col: number) => {
    // 保存历史用于撤销
    setHistory([...history, grid.map(r => [...r])]);
    
    const newGrid = grid.map(r => [...r]);
    newGrid[row][col] = !newGrid[row][col];
    setGrid(newGrid);
  };

  // 播放/暂停
  const togglePlay = () => {
    setIsPlaying(!isPlaying);
    if (!isPlaying) {
      setCurrentStep(0);
      // 实际应用中这里会启动音频播放循环
    } else {
      setCurrentStep(-1);
    }
  };

  // 清空网格
  const clearGrid = () => {
    setHistory([...history, grid.map(r => [...r])]);
    setGrid(Array(GRID_ROWS).fill(null).map(() => Array(GRID_COLS).fill(false)));
  };

  // 撤销
  const undo = () => {
    if (history.length > 0) {
      const previous = history[history.length - 1];
      setGrid(previous);
      setHistory(history.slice(0, -1));
    }
  };

  // 保存草稿
  const handleSaveDraft = () => {
    console.log('保存草稿', grid);
    // 实际应用中保存到本地存储或数据库
  };

  // 完成并导出
  const handleComplete = () => {
    setShowNamingModal(true);
  };

  // 命名后导出
  const handleNameSaved = (name: string) => {
    setWorkName(name);
    setShowNamingModal(false);
    setShowExportModal(true);
    onSaveWork?.(name);
  };

  // 分享/导出
  const handleShare = () => {
    console.log('分享作品:', workName);
    // 实际应用中生成分享链接或导出文件
  };

  const hasNotes = grid.some(row => row.some(cell => cell));

  return (
    <div className="h-full flex flex-col bg-background">
      <TopAppBar
        title="即兴创作"
        onBack={onBack}
        showHelp={true}
        onHelp={onHelp}
        showSettings={false}
      />

      <div className="flex-1 flex flex-col px-5 py-4 gap-4 overflow-hidden">
        
        {/* 音符网格 */}
        <div className="flex-1 overflow-auto">
          <div className="inline-block min-w-full">
            {/* 音高标签 */}
            <div className="flex mb-2">
              <div className="w-10 flex-shrink-0" /> {/* 占位 */}
              {Array.from({ length: GRID_COLS }).map((_, i) => (
                <div 
                  key={i} 
                  className="w-5 flex-shrink-0 text-[10px] text-center text-muted-foreground"
                >
                  {i + 1}
                </div>
              ))}
            </div>

            {/* 网格 */}
            {grid.map((row, rowIndex) => (
              <div key={rowIndex} className="flex items-center mb-1">
                {/* 音符名称 */}
                <div className="w-10 flex-shrink-0 text-xs text-muted-foreground font-medium">
                  {NOTE_NAMES[rowIndex]}
                </div>
                
                {/* 音符格子 */}
                {row.map((hasNote, colIndex) => (
                  <button
                    key={colIndex}
                    onClick={() => toggleNote(rowIndex, colIndex)}
                    className={`w-5 h-5 flex-shrink-0 mr-0.5 rounded transition-all ${
                      hasNote
                        ? 'bg-primary shadow-sm'
                        : colIndex === currentStep && isPlaying
                        ? 'bg-accent border border-primary'
                        : 'bg-accent border border-border'
                    } ${
                      colIndex === currentStep && isPlaying
                        ? 'ring-2 ring-primary/50'
                        : ''
                    }`}
                    aria-label={`${NOTE_NAMES[rowIndex]}, 步骤 ${colIndex + 1}`}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>

        {/* 播放控制条 */}
        <div className="bg-card rounded-[var(--radius-xl)] p-4 shadow-sm border border-border">
          <div className="flex items-center justify-between gap-3 mb-3">
            <button
              onClick={togglePlay}
              className="flex items-center justify-center w-12 h-12 rounded-full bg-primary text-primary-foreground active:scale-95 transition-transform"
              aria-label={isPlaying ? '暂停' : '播放'}
            >
              {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
            </button>

            <div className="flex-1 flex items-center gap-2">
              <span className="text-sm text-muted-foreground">速度</span>
              <input
                type="range"
                min="60"
                max="180"
                value={playbackSpeed}
                onChange={(e) => setPlaybackSpeed(Number(e.target.value))}
                className="flex-1"
              />
              <span className="text-sm text-foreground font-medium w-12">
                {playbackSpeed}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={undo}
              disabled={history.length === 0}
              className="flex items-center gap-1 px-3 py-2 rounded-lg bg-secondary text-secondary-foreground disabled:opacity-50 active:bg-secondary-pressed transition-colors"
            >
              <Undo className="w-4 h-4" />
              <span className="text-sm">撤销</span>
            </button>

            <button
              onClick={clearGrid}
              disabled={!hasNotes}
              className="flex items-center gap-1 px-3 py-2 rounded-lg bg-secondary text-secondary-foreground disabled:opacity-50 active:bg-secondary-pressed transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
              <span className="text-sm">清空</span>
            </button>
          </div>
        </div>

        {/* 底部操作按钮 */}
        <div className="grid grid-cols-2 gap-3">
          <SecondaryButton
            onClick={handleSaveDraft}
            disabled={!hasNotes}
            className="flex items-center justify-center gap-2"
          >
            <Save className="w-4 h-4" />
            保存草稿
          </SecondaryButton>
          
          <PrimaryButton
            onClick={handleComplete}
            disabled={!hasNotes}
            className="flex items-center justify-center gap-2"
          >
            <Share2 className="w-4 h-4" />
            完成并导出
          </PrimaryButton>
        </div>
      </div>

      <div style={{ height: 'var(--safe-area-bottom)' }} className="bg-background" />

      {/* 命名 Modal */}
      <NamingModal
        isOpen={showNamingModal}
        onClose={() => setShowNamingModal(false)}
        onSave={handleNameSaved}
      />

      {/* 导出分享 Modal */}
      <Modal
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
        title="导出分享"
        primaryAction={{
          label: '分享',
          onClick: handleShare,
        }}
        secondaryAction={{
          label: '关闭',
          onClick: () => setShowExportModal(false),
        }}
      >
        <div className="space-y-4">
          <div className="bg-accent rounded-[var(--radius-lg)] p-4 text-center">
            <p className="text-foreground font-medium mb-1">{workName}</p>
            <p className="text-sm text-muted-foreground">
              {grid.flat().filter(Boolean).length} 个音符
            </p>
          </div>

          {/* 缩略预览 */}
          <div className="bg-card rounded-[var(--radius-lg)] p-3 border border-border">
            <div className="text-xs text-muted-foreground mb-2">作品预览</div>
            <div className="space-y-0.5">
              {grid.map((row, i) => (
                <div key={i} className="flex gap-0.5">
                  {row.map((hasNote, j) => (
                    <div
                      key={j}
                      className={`w-2 h-2 rounded-sm ${
                        hasNote ? 'bg-primary' : 'bg-accent'
                      }`}
                    />
                  ))}
                </div>
              ))}
            </div>
          </div>

          <div className="bg-success/10 rounded-[var(--radius-lg)] p-3 border border-success/30">
            <p className="text-success text-sm text-center">
              ✓ 作品已保存
            </p>
          </div>
        </div>
      </Modal>
    </div>
  );
}
