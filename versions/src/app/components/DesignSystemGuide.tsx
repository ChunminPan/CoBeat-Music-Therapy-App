/**
 * 儿童音乐疗法训练 App - 设计系统使用指南
 * 
 * 目标用户：儿童（需要家长陪同）
 * 设备尺寸：iPhone 13/14 (390x844px)
 * 
 * 设计原则：
 * 1. 温和、清爽、低刺激
 * 2. 避免闪烁与高对比
 * 3. 圆角大、触控区域大
 * 4. 主要交互集中在屏幕中央
 * 
 * ============================================
 * 色彩系统
 * ============================================
 * 
 * 背景色：
 * - --background: #F5F6F8 (中性浅灰)
 * - --card: #FFFFFF (白色卡片)
 * 
 * 主色调（低饱和度）：
 * - --primary: #8B9FDB (柔和蓝紫色)
 * - --primary-pressed: #7A8DC9 (按下态)
 * 
 * 功能色：
 * - --success: #8FD4A8 (柔和绿色，用于命中/成功)
 * - --miss: #C4C7D0 (柔和灰色，用于未命中/失败)
 * - --warning: #F5C08F (柔和橙色，避免使用刺眼红色)
 * 
 * 文本色：
 * - --foreground: #3A3D4A (主文本)
 * - --muted-foreground: #8A8D9A (次要文本)
 * 
 * ============================================
 * 字体系统
 * ============================================
 * 
 * 字体族：中文友好无衬线字体
 * - PingFang SC, Hiragino Sans GB, Microsoft YaHei
 * 
 * 字号（适合儿童阅读）：
 * - --text-4xl: 56px (大号倒计时)
 * - --text-3xl: 40px (倒计时)
 * - --text-2xl: 32px (大标题)
 * - --text-xl: 24px (标题)
 * - --text-lg: 18px (副标题)
 * - --text-base: 16px (正文)
 * - --text-sm: 14px (辅助文本)
 * 
 * ============================================
 * 圆角系统
 * ============================================
 * 
 * - --radius-sm: 12px (小元素)
 * - --radius-md: 16px (中等元素)
 * - --radius-lg: 20px (标准圆角)
 * - --radius-xl: 24px (按钮、卡片)
 * - --radius-2xl: 32px (Beat Orb)
 * - --radius-full: 完全圆形
 * 
 * ============================================
 * 触控规范
 * ============================================
 * 
 * - 最小触控区域：44px x 44px (符合 iOS 人机界面指南)
 * - 主要操作按钮：固定在底部安全区上方
 * - 按钮间距：至少 12px
 * - 按钮反馈：轻微缩放 (scale: 0.98)，避免闪烁
 * 
 * ============================================
 * 布局规范
 * ============================================
 * 
 * 安全区域：
 * - 顶部：44px (状态栏 + 导航栏)
 * - 底部：34px (Home Indicator)
 * 
 * 内容边距：
 * - 页面左右：20px (px-5)
 * - 卡片内边距：20px (p-5)
 * - 元素间距：32px (space-y-8)
 * 
 * 中央交互区域：
 * - 节拍圆等主要交互元素居中
 * - 留出足够的视觉呼吸空间
 * 
 * ============================================
 * 动画规范
 * ============================================
 * 
 * 原则：柔和、不闪烁
 * 
 * - 过渡时长：200-300ms
 * - 缓动函数：ease-out
 * - 按钮按下：scale(0.98)
 * - 倒计时数字：scale(1.1) -> scale(1)
 * - Beat Orb 脉动：scale(1.08) -> scale(1)，每秒 1 次
 * 
 * ============================================
 * 组件使用示例
 * ============================================
 * 
 * 1. TopAppBar - 顶部导航栏
 * ```tsx
 * <TopAppBar
 *   title="音乐疗法训练"
 *   onBack={() => navigate(-1)}
 *   onSettings={() => openSettings()}
 *   showHelp={true}
 * />
 * ```
 * 
 * 2. PrimaryButton / SecondaryButton - 按钮
 * ```tsx
 * <PrimaryButton size="large" onClick={handleStart}>
 *   开始训练
 * </PrimaryButton>
 * <SecondaryButton disabled>禁用状态</SecondaryButton>
 * ```
 * 
 * 3. BeatOrb - 节拍圆
 * ```tsx
 * <BeatOrb 
 *   state="default" // "default" | "hit" | "miss"
 *   size={140} 
 *   pulse={true} 
 * />
 * ```
 * 
 * 4. CountdownNumber - 倒计时
 * ```tsx
 * <CountdownNumber 
 *   number={3} 
 *   size="large" 
 *   animate={true} 
 * />
 * ```
 * 
 * 5. Chip - 小标签
 * ```tsx
 * <Chip label="BPM" value={120} />
 * <Chip label="Stage" value={2} variant="success" />
 * ```
 * 
 * 6. StatsCard - 统计卡片
 * ```tsx
 * <StatsCard
 *   title="本轮表现"
 *   stats={[
 *     { label: '命中率', value: 87, unit: '%' },
 *     { label: '平均误差', value: 23, unit: 'ms' },
 *   ]}
 * />
 * ```
 * 
 * 7. Toast - 提示消息
 * ```tsx
 * <Toast
 *   message="练习已保存"
 *   type="success" // "info" | "success" | "warning"
 *   show={showToast}
 *   onClose={() => setShowToast(false)}
 * />
 * ```
 * 
 * 8. Modal - 弹窗
 * ```tsx
 * <Modal
 *   isOpen={isOpen}
 *   onClose={onClose}
 *   title="练习完成"
 *   primaryAction={{ label: '确定', onClick: handleConfirm }}
 *   secondaryAction={{ label: '取消', onClick: onClose }}
 * >
 *   <p>内容...</p>
 * </Modal>
 * ```
 * 
 * ============================================
 * 可访问性
 * ============================================
 * 
 * - 所有按钮包含 aria-label
 * - 色彩对比度符合 WCAG AA 标准
 * - 支持键盘导航（必要时）
 * - 文本可缩放（使用 rem 单位）
 */

export const DesignSystemGuide = () => null;
