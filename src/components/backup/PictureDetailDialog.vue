<template>
  <div class="picture-detail-overlay" v-if="visible" @click="closeDialog">
    <div class="picture-detail-dialog" @click.stop>
      <div class="dialog-header">
        <h2 class="picture-title">{{ currentWork.title }}</h2>
        <button class="close-btn" @click="closeDialog">&times;</button>
      </div>
      
      <div class="dialog-content">
        <div class="picture-image-section">
          <!-- 图片加载状态管理 -->
          <div v-if="imageLoading" class="image-loading">
            <div class="loading-spinner"></div>
            <p>正在加载图片...</p>
          </div>
          <div v-else-if="imageError" class="image-error">
            <p>图片加载失败</p>
            <button @click="retryLoadImage" class="retry-btn">重试</button>
          </div>
          
          <!-- 更新：图片和放大镜图标的容器 -->
          <div v-if="loadedImageUrl" class="picture-image-wrapper">
            <img 
              :src="loadedImageUrl" 
              :alt="currentWork.title" 
              class="picture-image" 
              @error="handleImageError"
              @click="openImageZoom"
            />
            <img
              src="@/assets/image/放大镜.png"
              alt="放大查看"
              class="zoom-icon"
              @click.stop="openImageZoom"
            />
          </div>
        </div>
        
        <div class="picture-info-section">
          <div class="info-item">
            <label class="info-label">作者：</label>
            <span class="info-value">{{ currentWork.author }}</span>
          </div>
          
          <div class="info-item description">
            <label class="info-label">作品简介：</label>
            <p class="info-description">{{ currentWork.description }}</p>
          </div>
        </div>
      </div>
      
      <!-- 🔥 新增：作品集浏览控制器 -->
      <div class="dialog-footer" v-if="isCollectionView">
        <button class="footer-btn" @click="goBackToList">返回画家列表</button>
        <div class="work-counter">{{ currentIndex + 1 }} / {{ worksCollection.length }}</div>
        <button class="footer-btn" @click="nextWork">下一个</button>
      </div>
    </div>
    
    <!-- 新增：图片缩放查看器 -->
    <div v-if="imageZoomVisible" class="image-zoom-overlay" @click="closeImageZoom">
      <img 
        :src="loadedImageUrl" 
        :alt="currentWork.title" 
        class="zoomed-image" 
        @click.stop
      >
      <button class="close-zoom-btn" @click.stop="closeImageZoom">&times;</button>
    </div>
  </div>
</template>

<script>
import { loadImageAsync } from '@/assets/data';

export default {
  name: 'PictureDetailDialog',
  data() {
    return {
      visible: false,
      pictureData: {}, // 用于单张图片模式
      
      // 🔥 新增：作品集浏览模式相关状态
      isCollectionView: false,
      worksCollection: [],
      currentIndex: 0,

      // 懒加载相关状态
      loadedImageUrl: '',
      imageLoading: false,
      imageError: false,
      
      // 新增：图片缩放状态
      imageZoomVisible: false,
    };
  },
  computed: {
    // 🔥 计算属性，返回当前正在显示的作品
    currentWork() {
      if (this.isCollectionView) {
        return this.worksCollection[this.currentIndex] || {};
      }
      return this.pictureData;
    }
  },
  methods: {
    async showDialog(data) {
      if (Array.isArray(data)) {
        // 🔥 作品集模式
        this.isCollectionView = true;
        this.worksCollection = data;
        this.currentIndex = 0;
        this.pictureData = {}; // 清空单张模式数据
      } else {
        // 单张图片模式
        this.isCollectionView = false;
        this.pictureData = { ...data };
        this.worksCollection = [];
        this.currentIndex = 0;
      }

      this.visible = true;
      await this.loadImage();
      
      this.$nextTick(() => {
        this.adjustDialogPosition();
        this.adjustMobileHeaderHeight();
      });
    },
    
    async loadImage() {
      const work = this.currentWork;
      if (!work) return;

      this.loadedImageUrl = '';
      this.imageLoading = true;
      this.imageError = false;
      
      try {
        if (work.image && !work.imagePath) {
          this.loadedImageUrl = work.image;
        } else if (work.imagePath) {
          this.loadedImageUrl = await loadImageAsync(work.imagePath);
        } else {
          this.imageError = true;
        }
      } catch (error) {
        console.error('❌ 图片加载失败:', error);
        this.imageError = true;
      } finally {
        this.imageLoading = false;
      }
    },
    
    async retryLoadImage() {
      await this.loadImage();
    },
    
    handleImageError() {
      this.imageError = true;
      this.loadedImageUrl = '';
    },
    
    closeDialog() {
      this.visible = false;
      this.isCollectionView = false; // 关闭时重置模式
      // 清理图片资源
      this.loadedImageUrl = '';
      this.imageLoading = false;
      this.imageError = false;
      
      // 🔥 清理内联样式，为下次显示做准备
      const header = this.$el?.querySelector('.dialog-header');
      if (header) {
        header.style.padding = '';
        header.style.minHeight = '';
        
        const title = header.querySelector('.picture-title');
        if (title) {
          title.style.fontSize = '';
          title.style.margin = '';
        }
        
        const closeBtn = header.querySelector('.close-btn');
        if (closeBtn) {
          closeBtn.style.width = '';
          closeBtn.style.height = '';
          closeBtn.style.fontSize = '';
        }
      }
      
      console.log('关闭画作详情弹窗');
    },

    // 新增：打开图片缩放
    openImageZoom() {
      this.imageZoomVisible = true;
      window.addEventListener('keydown', this.handleEscKey);
    },
    
    // 新增：关闭图片缩放
    closeImageZoom() {
      this.imageZoomVisible = false;
      window.removeEventListener('keydown', this.handleEscKey);
    },
    
    // 新增：处理Esc键关闭缩放
    handleEscKey(event) {
      if (event.key === 'Escape') {
        this.closeImageZoom();
      }
    },

    // 🔥 新增：切换到下一个作品
    nextWork() {
      if (!this.isCollectionView) return;
      this.currentIndex = (this.currentIndex + 1) % this.worksCollection.length;
      this.loadImage(); // 加载新图片
    },
    
    // 🔥 新增：返回画家列表
    goBackToList() {
      this.closeDialog();
      this.$emit('back-to-list');
    },

    // 智能调整弹窗位置和大小
    adjustDialogPosition() {
      const dialog = this.$el.querySelector('.picture-detail-dialog');
      if (!dialog) return;

      // 获取视口尺寸
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      
      // 获取弹窗当前尺寸
      const dialogRect = dialog.getBoundingClientRect();
      
      console.log('视口尺寸:', { width: viewportWidth, height: viewportHeight });
      console.log('弹窗尺寸:', { width: dialogRect.width, height: dialogRect.height });
      
      // 计算安全边距
      const safeMargin = {
        horizontal: Math.min(40, viewportWidth * 0.02), // 2%的视口宽度或40px，取较小值
        vertical: Math.min(30, viewportHeight * 0.02)   // 2%的视口高度或30px，取较小值
      };
      
      // 计算最大可用空间
      const maxWidth = viewportWidth - (safeMargin.horizontal * 2);
      const maxHeight = viewportHeight - (safeMargin.vertical * 2);
      
      // 动态调整弹窗尺寸
      let needsResize = false;
      
      if (dialogRect.width > maxWidth) {
        dialog.style.width = `${maxWidth}px`;
        dialog.style.maxWidth = `${maxWidth}px`;
        needsResize = true;
        console.log('调整弹窗宽度:', maxWidth);
      }
      
      if (dialogRect.height > maxHeight) {
        dialog.style.height = `${maxHeight}px`;
        dialog.style.maxHeight = `${maxHeight}px`;
        needsResize = true;
        console.log('调整弹窗高度:', maxHeight);
      }
      
      // 特殊设备适配
      this.handleSpecialDevices(dialog, viewportWidth, viewportHeight);
      
      // 如果调整了尺寸，重新获取弹窗尺寸并调整内容区域
      if (needsResize) {
        // 强制重新计算布局
        dialog.offsetHeight; // 触发重排
        
        // 确保内容区域可滚动
        const dialogContent = dialog.querySelector('.dialog-content');
        if (dialogContent) {
          dialogContent.style.overflowY = 'auto';
          dialogContent.style.maxHeight = `calc(${maxHeight}px - 140px)`; // 减去头部高度
        }
        
        // 调整图片区域的最大高度
        const imageSection = dialog.querySelector('.picture-image-section');
        if (imageSection) {
          const availableHeight = maxHeight - 200; // 减去头部和内边距
          imageSection.style.maxHeight = `${availableHeight}px`;
          console.log('调整图片区域最大高度:', availableHeight);
        }
      }
      
      console.log('✅ 弹窗自适应调整完成');
    },

    // 处理特殊设备的适配
    handleSpecialDevices(dialog, viewportWidth, viewportHeight) {
      // 移动设备特殊处理
      if (viewportWidth <= 768) {
        dialog.style.width = '95vw';
        dialog.style.maxWidth = '95vw';
        dialog.style.height = 'auto';
        dialog.style.maxHeight = '95vh';
        
        // 移动设备上减少内边距
        const dialogContent = dialog.querySelector('.dialog-content');
        if (dialogContent) {
          dialogContent.style.padding = '20px';
          dialogContent.style.gap = '20px';
          dialogContent.style.flexDirection = 'column';
          dialogContent.style.overflowY = 'auto'; // 确保内容可滚动
        }
        
        // 调整图片区域高度限制（移动设备）- 增加可用高度
        const imageSection = dialog.querySelector('.picture-image-section');
        if (imageSection) {
          /* The following lines are the root cause of the issue and have been removed. */
          // imageSection.style.maxHeight = '55vh'; 
          // imageSection.style.flex = 'none';
          // imageSection.style.overflowY = 'auto';
        }
        
        // 调整信息区域（移动设备）
        const infoSection = dialog.querySelector('.picture-info-section');
        if (infoSection) {
          infoSection.style.maxHeight = '35vh'; // 限制信息区域高度
          infoSection.style.overflowY = 'auto'; // 允许信息区域滚动
        }
        
        console.log('📱 应用移动设备适配 - 优化高图片显示');
      }
      
      // 小屏幕设备（如480px以下）
      if (viewportWidth <= 480) {
        dialog.style.width = '98vw';
        dialog.style.maxWidth = '98vw';
        dialog.style.maxHeight = '98vh';
        
        // 进一步减少内边距和字体大小
        const dialogContent = dialog.querySelector('.dialog-content');
        if (dialogContent) {
          dialogContent.style.padding = '15px';
          dialogContent.style.gap = '15px';
          dialogContent.style.overflowY = 'auto'; // 确保超小屏幕内容可滚动
        }
        
        // 调整图片区域（超小屏幕）- 为高图片预留更多空间
        const imageSection = dialog.querySelector('.picture-image-section');
        if (imageSection) {
          /* The following lines are the root cause of the issue and have been removed. */
          // imageSection.style.flex = 'none';
          // imageSection.style.maxHeight = '50vh';
          // imageSection.style.overflowY = 'auto';
        }
        
        // 调整信息区域
        const infoSection = dialog.querySelector('.picture-info-section');
        if (infoSection) {
          infoSection.style.flex = '1';
          infoSection.style.maxHeight = '40vh'; // 限制信息区域高度
          infoSection.style.overflowY = 'auto'; // 允许信息区域滚动
        }
        
        console.log('📱 应用超小屏幕设备适配 - 优化高图片显示');
      }
      
      // 横屏模式特殊处理
      if (viewportHeight < viewportWidth && viewportHeight < 600) {
        dialog.style.maxHeight = '95vh';
        dialog.style.height = 'auto';
        
        const dialogContent = dialog.querySelector('.dialog-content');
        if (dialogContent) {
          dialogContent.style.flexDirection = 'row'; // 横屏时保持水平布局
          dialogContent.style.maxHeight = 'calc(95vh - 100px)';
        }
        
        console.log('📱 应用横屏模式适配');
      }
      
      // 超宽屏幕处理
      if (viewportWidth > 1920) {
        dialog.style.maxWidth = '1400px'; // 限制最大宽度
        console.log('🖥️ 应用超宽屏幕限制');
      }
    },

    // 🔥 新增：手机版本header高度强制调整
    adjustMobileHeaderHeight() {
      const header = this.$el.querySelector('.dialog-header');
      if (!header) return;
      
      const viewportWidth = window.innerWidth;
      
             // 强制设置手机版本的header样式
       if (viewportWidth <= 768) {
         // 🔥 统一手机版本使用用户要求的padding
         header.style.padding = '5px 15px';
         header.style.minHeight = 'auto';
         
         const title = header.querySelector('.picture-title');
         const closeBtn = header.querySelector('.close-btn');
         
         if (viewportWidth <= 480) {
           // 超小屏幕
           if (title) {
             title.style.fontSize = '18px';
             title.style.margin = '0';
           }
           
           if (closeBtn) {
             closeBtn.style.width = '30px';
             closeBtn.style.height = '30px';
             closeBtn.style.fontSize = '22px';
           }
           
           console.log('📱 强制应用超小屏幕header样式: padding 5px 15px');
         } else {
           // 普通手机屏幕
           if (title) {
             title.style.fontSize = '20px';
             title.style.margin = '0';
           }
           
           if (closeBtn) {
             closeBtn.style.width = '32px';
             closeBtn.style.height = '32px';
             closeBtn.style.fontSize = '24px';
           }
           
           console.log('📱 强制应用手机header样式: padding 5px 15px');
         }
      } else {
        // 桌面版本 - 恢复原始样式
        header.style.padding = '32px 40px';
        
        const title = header.querySelector('.picture-title');
        if (title) {
          title.style.fontSize = '32px';
        }
        
        const closeBtn = header.querySelector('.close-btn');
        if (closeBtn) {
          closeBtn.style.width = '50px';
          closeBtn.style.height = '50px';
          closeBtn.style.fontSize = '40px';
        }
        
        console.log('🖥️ 应用桌面header样式: padding 32px 40px');
      }
    },

    // 窗口大小改变时重新调整
    handleResize() {
      if (this.visible) {
        this.adjustDialogPosition();
        this.adjustMobileHeaderHeight(); // 🔥 也要调整header高度
      }
    }
  },
  mounted() {
    // 监听显示画作详情事件
    this.$EventBus.$on('showPictureDetail', this.showDialog);
    
    // 监听窗口大小变化
    window.addEventListener('resize', this.handleResize);
    
    // 监听屏幕方向变化（移动设备）
    window.addEventListener('orientationchange', () => {
      setTimeout(() => {
        this.handleResize();
      }, 100); // 延迟处理，等待浏览器完成方向切换
    });
  },
  
  beforeDestroy() {
    // 移除事件监听
    this.$EventBus.$off('showPictureDetail', this.showDialog);
    window.removeEventListener('resize', this.handleResize);
    window.removeEventListener('orientationchange', this.handleResize);
  }
};
</script>

<style lang="less" scoped>
.picture-detail-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.85);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 10000;
  backdrop-filter: blur(10px);
}

.picture-detail-dialog {
  position: relative;
  width: 90%;
  max-width: 1200px;
  max-height: 90vh;
  background: linear-gradient(145deg, #1e2028, #2a2d3a);
  border-radius: 20px;
  box-shadow: 
    0 20px 60px rgba(0, 0, 0, 0.5),
    inset 0 1px 0 rgba(255, 255, 255, 0.1);
  overflow: hidden;
  animation: dialog-scale-in 0.4s cubic-bezier(0.165, 0.84, 0.44, 1);
  display: flex;
  flex-direction: column;
}

.dialog-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 32px 40px;
  border-bottom: 1px solid #444;
  background: linear-gradient(90deg, #333 0%, #2a2a2a 100%);
  flex-shrink: 0;
}

.picture-title {
  color: #f0f0f0;
  font-size: 32px;
  font-weight: bold;
  margin: 0;
  text-shadow: 0 2px 5px rgba(0, 0, 0, 0.3);
  letter-spacing: 1px;
}

.close-btn {
  background: none;
  border: none;
  color: #aaa;
  font-size: 36px;
  cursor: pointer;
  padding: 0;
  width: 50px;
  height: 50px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  transition: all 0.3s ease;
  
  &:hover {
    background-color: rgba(255, 255, 255, 0.1);
    color: #fff;
    transform: rotate(90deg);
  }
}

.dialog-content {
  padding: 40px;
  display: flex;
  gap: 40px;
  overflow: auto; /* Allow the entire dialog content to scroll if needed */
  flex-grow: 1;
  min-height: 0; /* Important for flexbox shrinking */
}

.picture-image-section {
  flex: 1.2;
  display: flex;
  justify-content: center;
  align-items: center; /* 居中对齐 */
  min-width: 0; /* Allow the image section to shrink */
}

.picture-image-wrapper {
  position: relative;
  line-height: 0; /* 移除图片底部的额外空间 */
  max-width: 100%;
  max-height: 100%;
  /* 使用table布局让容器自适应图片内容 */
  display: table;
  margin: 0 auto; /* 保持水平居中 */
}

.zoom-icon {
  position: absolute;
  right: 15px;
  bottom: 15px;
  width: 40px;
  height: 40px;
  background-color: rgba(0, 0, 0, 0.3);
  border-radius: 50%;
  padding: 8px;
  cursor: pointer;
  transition: all 0.3s ease;
  z-index: 10;
}

.zoom-icon:hover {
  transform: scale(1.1);
  background-color: rgba(0, 0, 0, 0.6);
}

.picture-image {
  max-width: 100%;
  max-height: calc(90vh - 230px); /* Directly constrain the image height on desktop */
  border-radius: 15px;
  box-shadow: 0 12px 35px rgba(0, 0, 0, 0.5);
  object-fit: contain;
  background-color: #333;
  cursor: zoom-in; /* 更改鼠标指针样式 */
}

.picture-info-section {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 30px;
  min-width: 300px;
  .picture-image-section {
    /* flex: none !important; <-- This problematic rule is removed */
    /* max-height: 55vh !important; <-- This is removed */
    /* overflow-y: auto !important; <-- This is removed */
    max-height: none; /* This incorrectly nested rule is being removed */
  }
}

.info-item {
  display: flex;
  flex-direction: column;
  gap: 12px;
  
  &.description {
    flex: 1;
  }
}

.info-label {
  color: #ccc;
  font-size: 20px;
  font-weight: bold;
  text-transform: uppercase;
  letter-spacing: 1px;
  font-family: 'biaoti', 'Microsoft YaHei', sans-serif;
}

.info-value {
  color: #f0f0f0;
  font-size: 24px;
  font-weight: 500;
  font-family: 'biaoti', 'Microsoft YaHei', sans-serif;
}

.info-description {
  color: #e0e0e0;
  font-size: 18px;
  line-height: 1.8;
  margin: 0;
  text-align: justify;
  background-color: rgba(255, 255, 255, 0.05);
  padding: 20px;
  border-radius: 12px;
  border-left: 4px solid #666;
  font-family: 'biaoti', 'Microsoft YaHei', sans-serif;
}

.dialog-footer {
  padding: 16px 40px;
  border-top: 1px solid #444;
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: rgba(255, 255, 255, 0.02);
  flex-shrink: 0;

  .footer-btn {
    padding: 10px 20px;
    border: 1px solid #555;
    border-radius: 8px;
    background: rgba(255, 255, 255, 0.1);
    color: #ccc;
    font-size: 16px;
    cursor: pointer;
    transition: all 0.3s ease;
    &:hover {
      background: #4a90e2;
      border-color: #4a90e2;
      color: #fff;
    }
  }
  
  .work-counter {
      color: #888;
      font-size: 16px;
  }
}

/* 滚动条样式 */
.dialog-content::-webkit-scrollbar {
  width: 10px;
}

.dialog-content::-webkit-scrollbar-track {
  background: rgba(255, 255, 255, 0.1);
  border-radius: 5px;
}

.dialog-content::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.3);
  border-radius: 5px;
  
  &:hover {
    background: rgba(255, 255, 255, 0.5);
  }
}

/* 响应式调整 */
@media (max-width: 1024px) {
  .picture-detail-dialog {
    max-width: 1000px;
  }
  
  .picture-title {
    font-size: 28px;
  }
  
  .info-label {
    font-size: 18px;
  }
  
  .info-value {
    font-size: 22px;
  }
  
  .info-description {
    font-size: 16px;
  }
}

/* 响应式设计 */
@media (max-width: 768px) {
  .picture-detail-dialog {
    width: 95vw !important;
    max-width: 95vw !important;
    max-height: 95vh !important;
    margin: 0;
    border-radius: 15px;
  }
  
  /* 🔥 手机版本header高度调整 - 增强选择器特异性 */
  .picture-detail-dialog .dialog-header {
    padding: 5px 15px !important; /* 从32px 40px减少到5px 15px */
    min-height: auto !important;
  }
  
  .dialog-content {
    flex-direction: column !important;
    padding: 20px !important;
    gap: 20px !important;
    min-height: auto !important;
    overflow-y: auto !important;
  }
  
  .picture-image-section {
    /* flex: none !important; <-- This problematic rule is removed */
    /* max-height: 55vh !important; <-- This is removed */
    /* overflow-y: auto !important; <-- This is removed */
  }
  
  .picture-info-section {
    flex: 1 !important;
    min-height: 200px !important;
    max-height: 35vh !important; /* 限制信息区域高度 */
    overflow-y: auto !important; /* 允许信息区域滚动 */
  }
  
  .picture-title {
    font-size: 24px;
  }
  
  .picture-detail-dialog .close-btn {
    width: 32px !important;
    height: 32px !important;
    font-size: 24px !important;
  }
  
  .info-label {
    font-size: 16px;
  }
  
  .info-value {
    font-size: 20px;
  }
  
  .info-description {
    font-size: 15px;
    padding: 15px;
  }
  
  .picture-image {
    max-height: none !important; /* On mobile, let the image have its natural height */
  }
}

@media (max-width: 480px) {
  .picture-detail-dialog {
    width: 98vw !important;
    max-width: 98vw !important;
    max-height: 98vh !important;
    border-radius: 10px;
  }
  
  /* 🔥 超小屏幕header高度进一步调整 - 增强选择器特异性 */
  .picture-detail-dialog .dialog-header {
    padding: 5px 15px !important; /* 从32px 40px进一步减少到5px 15px */
    min-height: auto !important;
  }
  
  .picture-detail-dialog .picture-title {
    font-size: 18px !important;
    margin: 0 !important;
  }
  
  .picture-detail-dialog .close-btn {
    width: 30px !important;
    height: 30px !important;
    font-size: 22px !important;
  }
  
  .dialog-content {
    padding: 15px !important;
    gap: 15px !important;
    overflow-y: auto !important; /* 确保超小屏幕内容可滚动 */
  }
  
  .picture-image-section {
    /* max-height: 50vh !important; <-- 移除固定的高度限制 */
    /* overflow-y: auto !important; <-- 移除内部滚动 */
  }
  
  .picture-info-section {
    max-height: 40vh !important; /* 限制信息区域高度 */
    overflow-y: auto !important; /* 允许信息区域滚动 */
  }
  
  .picture-description {
    font-size: 14px !important;
    line-height: 1.4 !important;
  }
}

/* 横屏模式适配 */
@media (orientation: landscape) and (max-height: 600px) {
  .picture-detail-dialog {
    max-height: 95vh !important;
    width: 95vw !important;
  }
  
  .dialog-content {
    flex-direction: row !important;
    padding: 20px !important;
    min-height: auto !important;
    max-height: calc(95vh - 100px) !important;
    overflow-y: auto !important;
  }
  
  .picture-image-section {
    flex: 1 !important;
    max-height: none !important;
  }
  
  .picture-info-section {
    flex: 1 !important;
    overflow-y: auto !important;
  }
}

/* 超大屏幕限制 */
@media (min-width: 1920px) {
  .picture-detail-dialog {
    max-width: 1400px !important;
  }
}

/* 新增：图片缩放查看器样式 */
.image-zoom-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.85);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 2000; /* 确保在最上层 */
  animation: zoom-fade-in 0.3s ease;
}

.image-zoom-content {
  /* 此类不再需要，样式直接应用在zoomed-image上 */
}

.zoomed-image {
  max-width: 90vw;
  max-height: 90vh;
  object-fit: contain;
  box-shadow: 0 10px 40px rgba(0,0,0,0.5); /* 添加阴影提升效果 */
}

.close-zoom-btn {
  position: absolute;
  top: 20px;
  right: 30px;
  font-size: 40px;
  color: #fff;
  background: none;
  border: none;
  cursor: pointer;
  line-height: 1;
}

@keyframes zoom-fade-in {
  from { opacity: 0; }
  to { opacity: 1; }
}

/* 动画效果 */
@keyframes dialog-fade-in {
  from {
    opacity: 0;
    transform: scale(0.95);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

@keyframes dialog-scale-in {
  from {
    opacity: 0;
    transform: scale(0.95);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}
</style> 