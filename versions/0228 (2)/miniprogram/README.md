# Music Therapy 音乐疗法训练小程序

## 项目说明

这是一款面向儿童的音乐疗法训练微信小程序，包含节拍训练和即兴创作两大核心功能模块。

## 目录结构

```
/miniprogram
  /pages
    /home              - 主页（选择模块入口）
    /training-mode     - 训练模式选择
    /stage1            - Stage 1：固定节拍训练
    /stage2            - Stage 2：变速挑战
    /melody-maker      - 即兴创作（旋律网格）
  /images              - 图标资源（需要准备）
  app.js               - 小程序逻辑
  app.json             - 小程序配置
  app.wxss             - 全局样式
  sitemap.json         - 站点地图
```

## 所需图标资源

请在 `/miniprogram/images/` 目录下准备以下图标（建议 PNG 格式，48x48px）：

### 通用图标
- `back.png` - 返回箭头
- `settings.png` - 设置齿轮
- `help.png` - 帮助（问号）
- `close.png` - 关闭（X）
- `music.png` - 音乐符号
- `clock.png` - 时钟

### 功能图标
- `drum.png` - 鼓/节拍图标
- `grid.png` - 网格图标
- `activity.png` - 活动/统计图标
- `zap.png` - 闪电图标
- `lock.png` - 锁定图标
- `unlock.png` - 解锁图标
- `up.png` - 向上箭头
- `down.png` - 向下箭头

### 播放控制图标
- `play.png` - 播放
- `pause.png` - 暂停
- `undo.png` - 撤销
- `clear.png` - 清空
- `save.png` - 保存
- `share.png` - 分享

**提示**：如果暂时没有图标，可以使用纯色或文字代替，或从 iconfont、feathericons 等图标库下载。

## 功能特性

### 1. Home 主页
- 两个大卡片入口：节拍训练、即兴创作
- 显示最近训练记录和创作作品
- 设置入口

### 2. 训练模式选择
- Stage 1：固定节拍训练
- Stage 2：变速挑战（需解锁）
- Stage 2 解锁条件：完成 Stage 1 且命中率 ≥70%

### 3. Stage 1：固定节拍训练
- 3秒倒计时 → 60秒训练
- 固定 BPM (60-80)
- 动态容忍窗调整
- 命中反馈（绿色/灰色圆圈）
- 训练结果统计

### 4. Stage 2：变速挑战
- 4 轮训练，每轮 30 秒
- DDA 动态难度调整
- BPM 平滑过渡
- 上轮表现展示
- 自适应难度

### 5. 即兴创作（Melody Maker）
- 16×8 音符网格编辑器
- 播放/暂停、速度控制
- 撤销、清空功能
- 作品命名与保存
- 导出分享

## 设计规范

### 色彩系统
- **背景色**：#F5F6F8（中性浅灰）
- **主色**：#8B9FDB（柔和蓝紫）
- **成功色**：#8FD4A8（柔和绿）
- **失败色**：#C4C7D0（柔和灰）
- **警告色**：#F5C08F（柔和橙）

### 圆角规范
- 小元素：24rpx
- 中等元素：32-40rpx
- 大卡片：64rpx
- 完全圆形：9999rpx

### 触控规范
- 最小触控区域：88rpx × 88rpx（44px）
- 按钮最小高度：88rpx（普通）/ 112rpx（大按钮）
- 按钮间距：≥24rpx

### 字体规范
- 超大号（倒计时）：112rpx
- 大号：80rpx
- 标题：64rpx
- 副标题：48rpx
- 正文：32rpx
- 辅助文本：28rpx
- 小号：24rpx

## 运行说明

1. 在微信开发者工具中打开项目
2. 填写 AppID（或使用测试号）
3. 准备图标资源到 `/images/` 目录
4. 编译运行

## 注意事项

1. **图标资源**：本代码中的图标路径是占位符，需要替换为实际图标
2. **音频播放**：Beat Orb 的节拍音效和 Melody Maker 的音符播放需要集成音频 API
3. **数据持久化**：当前使用 `wx.getStorageSync/setStorageSync` 本地存储，生产环境建议接入云数据库
4. **Canvas 进度**：环形进度当前使用简化实现，可使用 Canvas 绘制更精确的环形进度
5. **动画优化**：部分动画使用 CSS，可以使用小程序动画 API 实现更流畅的效果

## 开发建议

### 音频集成
```javascript
// 在 Stage1/Stage2 中播放节拍音
const beatAudio = wx.createInnerAudioContext();
beatAudio.src = '/audio/beat.mp3';
beatAudio.play();
```

### Canvas 环形进度
```javascript
// 在 Stage1 中绘制环形进度
const ctx = wx.createCanvasContext('progressCanvas');
ctx.setLineWidth(8);
ctx.setStrokeStyle('#8B9FDB');
ctx.arc(40, 40, 36, -Math.PI/2, -Math.PI/2 + (progress/100) * 2 * Math.PI);
ctx.stroke();
ctx.draw();
```

## 后续扩展

- [ ] 训练记录列表页
- [ ] 用户设置页
- [ ] 作品分享功能
- [ ] 云数据库集成
- [ ] 实际音频播放
- [ ] 更多训练模式
- [ ] 成就系统

## 联系方式

如有问题，请参考微信小程序官方文档：https://developers.weixin.qq.com/miniprogram/dev/framework/

---

© 2024 Music Therapy App - 为儿童设计的音乐疗法训练小程序
