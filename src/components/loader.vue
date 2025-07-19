<template>
  <div class="art-gallery-loader">
    <!-- 主卡片容器 -->
    <div class="gallery-card">
      <!-- 图片区域 -->
      <div class="image-section">
        <img src="@/assets/image/loding.webp" alt="Art Gallery" class="gallery-image" />
      </div>
      
      <!-- 文字信息区域 -->
      <div class="info-section">
        <h1 class="gallery-title">丹青共韵·3D艺术展</h1>
        <p class="gallery-subtitle">四位艺术家——陈文福、丁冲、李文生、任羿飞，根植中华文化沃土，融通南北风韵，贯通书画艺道，以多元艺术形式共绘笔墨神韵。</p>
        
        <div class="instructions">
          <h3>操作指南</h3>
          <div class="control-info">
            <p>WASD键/双击地面/虚拟摇杆- 移动</p>
             <p>长按拖动-转动视角</p>
          </div>
        </div>
        
        <!-- 加载进度和按钮 -->
        <div class="loading-section">
          <div v-if="displayNumber < 100" class="progress-container">
            <div class="progress-bar">
              <div class="progress-fill" :style="{width: displayNumber + '%'}"></div>
            </div>
            <p class="loading-text">
              <span v-if="displayNumber < 70">正在加载资源... {{ displayNumber }}%</span>
              <span v-else-if="displayNumber < 90">加载模型和纹理... {{ displayNumber }}%</span>
              <span v-else-if="displayNumber < 98">准备场景渲染... {{ displayNumber }}%</span>
              <span v-else>正在渲染首帧，即将完成... {{ displayNumber }}%</span>
            </p>
          </div>
          
          <button v-else class="explore-btn" @click="startExploring">
            进入展厅
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'ArtGalleryLoader',
  props: {
    number: {
      type: [Number],
      default: 0
    }
  },
  data() {
    return {
      displayNumber: 0
    }
  },
  watch: {
    number(newVal) {
      // 平滑过渡到新的进度值
      this.animateProgress(newVal);
    }
  },
  methods: {
    animateProgress(targetNumber) {
      const start = this.displayNumber;
      const end = Math.min(100, Math.max(0, targetNumber));
      const duration = 300; // 300ms 动画时间
      const startTime = Date.now();
      
      const animate = () => {
        const now = Date.now();
        const elapsed = now - startTime;
        const progress = Math.min(elapsed / duration, 1);
        
        // 使用缓动函数让动画更自然
        const easeProgress = progress * (2 - progress); // easeOutQuad
        this.displayNumber = Math.round(start + (end - start) * easeProgress);
        
        if (progress < 1 && this.displayNumber < end) {
          requestAnimationFrame(animate);
        } else {
          this.displayNumber = end;
        }
      };
      
      animate();
    },
    
    startExploring() {
      // 触发开始探索事件
      this.$emit('start-exploring');
    }
  }
};
</script>

<style lang="less" scoped>
.art-gallery-loader {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 99999;
  display: flex;
  justify-content: center;
  align-items: center;
  font-family: 'Arial', sans-serif;
  
  // 🎨 独立的背景层，包含所有动画效果
  &::before {
    content: '';
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: url('../assets/image/lodingbg.jpg') no-repeat center center;
    background-size: cover;
    animation: ink-background-flow 20s ease-in-out infinite;
    z-index: -3;
  }
  
  // 🌊 水墨扩散效果 - 第一层
  &::after {
    content: '';
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: radial-gradient(
      circle at 20% 30%, 
      rgba(0, 0, 0, 0.1) 0%, 
      transparent 30%
    ),
    radial-gradient(
      circle at 80% 70%, 
      rgba(0, 0, 0, 0.08) 0%, 
      transparent 25%
    ),
    radial-gradient(
      circle at 60% 20%, 
      rgba(0, 0, 0, 0.06) 0%, 
      transparent 35%
    ),
    radial-gradient(
      circle at 40% 80%, 
      rgba(0, 0, 0, 0.05) 0%, 
      transparent 40%
    ),
    radial-gradient(
      circle at 90% 30%, 
      rgba(0, 0, 0, 0.07) 0%, 
      transparent 30%
    );
    animation: ink-diffusion-combined 25s ease-in-out infinite;
    z-index: -2;
  }
}

// �� 背景轻微流动动画（只影响背景层）
@keyframes ink-background-flow {
  0%, 100% {
    transform: scale(1) translateX(0) translateY(0);
    filter: contrast(1) brightness(1);
  }
  25% {
    transform: scale(1.02) translateX(-5px) translateY(3px);
    filter: contrast(1.05) brightness(0.98);
  }
  50% {
    transform: scale(1.01) translateX(3px) translateY(-2px);
    filter: contrast(0.98) brightness(1.02);
  }
  75% {
    transform: scale(1.03) translateX(2px) translateY(4px);
    filter: contrast(1.02) brightness(0.99);
  }
}

// 🌊 水墨扩散动画（合并版本）
@keyframes ink-diffusion-combined {
  0%, 100% {
    opacity: 0.3;
    transform: scale(1) rotate(0deg);
    filter: blur(1px);
  }
  25% {
    opacity: 0.5;
    transform: scale(1.1) rotate(1deg);
    filter: blur(2px);
  }
  50% {
    opacity: 0.4;
    transform: scale(0.9) rotate(-1deg);
    filter: blur(1.5px);
  }
  75% {
    opacity: 0.6;
    transform: scale(1.2) rotate(2deg);
    filter: blur(2.5px);
  }
}

.gallery-card {
  width: 90%;
  max-width: 650px;
  background: #ffffff;
  border-radius: 20px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.15);
  overflow: hidden;
  display: flex;
  flex-direction: column;
  max-height: 85vh;
}

.image-section {
  width: 100%;
  height: 320px;
  overflow: hidden;
  position: relative;
  flex-shrink: 0;
  padding: 10px 0;
}

.gallery-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center;
}

.info-section {
  background: #ffffff;
  color: #000000;
  padding: 25px 35px;
  text-align: center;
  overflow-y: auto;
  flex: 1;
}

.gallery-title {
  font-size: 2.2rem;
  font-weight: bold;
  margin: 0 0 8px 0;
  letter-spacing: 2px;
  color: #000000;
}

.gallery-subtitle {
  font-size: 0.9rem;
  margin: 0 0 20px 0;
  color: #333333;
  line-height: 1.4;
}

.instructions {
  margin-bottom: 20px;
}

.instructions h3 {
  font-size: 1.1rem;
  margin: 0 0 8px 0;
  color: #000000;
}

.control-info p {
  margin: 3px 0;
  font-size: 0.85rem;
  color: #333333;
}

.loading-section {
  margin-top: 15px;
}

.progress-container {
  margin-bottom: 15px;
}

.progress-bar {
  width: 100%;
  height: 6px;
  background: rgba(0, 0, 0, 0.1);
  border-radius: 3px;
  overflow: hidden;
  margin-bottom: 10px;
}

.progress-fill {
  height: 100%;
  background: #000000;
  transition: width 0.3s ease;
  border-radius: 3px;
}

.loading-text {
  font-size: 0.9rem;
  color: #333333;
  margin: 0;
}

.explore-btn {
  background: #ffffff;
  color: #000000;
  border: 2px solid #000000;
  padding: 12px 35px;
  font-size: 0.95rem;
  font-weight: bold;
  letter-spacing: 2px;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.3s ease;
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
  position: relative;
  overflow: hidden;
}

.explore-btn::before {
  content: '';
  position: absolute;
  top: 0;
  left: -100%;
  width: 100%;
  height: 100%;
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.4), transparent);
  transition: left 0.5s ease;
}

.explore-btn:hover {
  transform: translateY(-3px);
  box-shadow: 0 8px 25px rgba(0, 0, 0, 0.2);
  background: #000000;
  color: #ffffff;
  border-color: #000000;
}

.explore-btn:hover::before {
  left: 100%;
}

.explore-btn:active {
  transform: translateY(-1px);
  transition: all 0.1s ease;
}

/* 🔥 优化：桌面端居中显示 */
@media (min-width: 769px) {
  .gallery-card {
    margin: 0 auto; // 桌面端居中
  }
}

/* 响应式设计 */
@media (max-width: 768px) {
  .gallery-card {
    width: 95%;
    margin: 20px auto; // 🔥 修复：移动端也居中显示
    max-height: 90vh;
  }
  
  .image-section {
    height: 280px;
    padding: 0;
  }
  
  .info-section {
    padding: 20px 25px;
  }
  
  .gallery-title {
    font-size: 2rem;
  }
  
  .gallery-subtitle {
    font-size: 0.85rem;
  }
}

@media (max-width: 480px) {
  .gallery-card {
    width: 95%;
    margin: 10px auto; // 🔥 修复：超小屏幕也居中显示
    max-height: 95vh;
  }
  
  .image-section {
    height: 220px;
    padding: 0;
  }
  
  .info-section {
    padding: 18px 20px;
  }
  
  .gallery-title {
    font-size: 1.7rem;
    letter-spacing: 1px; // 🔥 优化：小屏幕减少字间距
  }
  
  .gallery-subtitle {
    font-size: 0.8rem;
    line-height: 1.3;
  }
  
  .instructions h3 {
    font-size: 1rem;
  }
  
  .control-info p {
    font-size: 0.8rem;
  }
  
  .explore-btn {
    padding: 10px 25px; // 🔥 优化：小屏幕减少按钮内边距
    font-size: 0.9rem;
    letter-spacing: 1px;
  }
}

/* 🔥 新增：横屏模式优化 */
@media (max-width: 768px) and (orientation: landscape) {
  .gallery-card {
    max-height: 95vh;
    width: 80%;
  }
  
  .image-section {
    height: 200px;
  }
  
  .info-section {
    padding: 15px 20px;
  }
  
  .gallery-title {
    font-size: 1.5rem;
  }
  
  .gallery-subtitle {
    font-size: 0.75rem;
  }
}
</style>
