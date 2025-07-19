<template>
  <div class="upload-overlay" v-if="visible" @click="closeDialog">
    <div class="upload-dialog" @click.stop>
      <div class="dialog-header">
        <h2 class="upload-title">上传你的作品</h2>
        <button class="close-btn" @click="closeDialog">&times;</button>
      </div>
      
      <div class="dialog-content">
        <!-- 图片上传区域 -->
        <div class="upload-section">
          <div class="upload-area" 
               :class="{ 'has-image': previewImage, 'dragover': isDragOver }"
               @click="triggerFileInput"
               @dragover.prevent="onDragOver"
               @dragleave.prevent="onDragLeave"
               @drop.prevent="onDrop">
            
            <!-- 预览图片 -->
            <div v-if="previewImage" class="image-preview">
              <img :src="previewImage" alt="预览图片" class="preview-img" />
              <div class="image-overlay">
                <span class="change-text">点击更换图片</span>
              </div>
            </div>
            
            <!-- 默认上传提示 -->
            <div v-else class="upload-placeholder">
              <div class="upload-icon">📁</div>
              <p class="upload-text">点击选择图片或拖拽图片到此处</p>
              <p class="upload-hint">支持 JPG、PNG、GIF 格式，建议尺寸不超过 5MB</p>
            </div>
          </div>
          

          
          <!-- 隐藏的文件输入 -->
          <input 
            ref="fileInput" 
            type="file" 
            accept="image/*" 
            style="display: none;"
            @change="onFileSelect"
          />
        </div>
        
        <!-- 作品信息表单 -->
        <div class="form-section">
          <div class="form-group">
            <label class="form-label">作品名称 *</label>
            <input 
              v-model="formData.title" 
              type="text" 
              class="form-input"
              placeholder="请输入作品名称"
              maxlength="50"
            />
            <div class="char-count">{{ formData.title.length }}/50</div>
          </div>
          
          <div class="form-group">
            <label class="form-label">作者姓名 *</label>
            <input 
              v-model="formData.author" 
              type="text" 
              class="form-input"
              placeholder="请输入作者姓名"
              maxlength="30"
            />
            <div class="char-count">{{ formData.author.length }}/30</div>
          </div>
          
          <div class="form-group">
            <label class="form-label">作品简介</label>
            <textarea 
              v-model="formData.description" 
              class="form-textarea"
              placeholder="请简要介绍这幅作品的创作背景、风格特点等（可选）"
              rows="4"
              maxlength="500"
            ></textarea>
            <div class="char-count">{{ formData.description.length }}/500</div>
          </div>
        </div>
      </div>
      
      <!-- 操作按钮 -->
      <div class="dialog-footer">
        <button class="btn btn-secondary" @click="closeDialog">取消</button>
        <button v-if="hasCustomArtwork" class="btn btn-danger" @click="handleDelete">
          删除当前作品
        </button>
        <button class="btn btn-primary" @click="handleSubmit" :disabled="!canSubmit">
          {{ isSubmitting ? '保存中...' : '保存作品' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script>
import EventBus from '@/bus';

export default {
  name: 'PictureUploadDialog',
  data() {
    return {
      visible: false,
      currentPicName: '', // 当前画作名称
      previewImage: '',
      originalImage: '', // 原始图片数据
      selectedFile: null,
      isDragOver: false,
      isSubmitting: false,
      formData: {
        title: '',
        author: '',
        description: ''
      },
      hasCustomArtwork: false
    };
  },
  computed: {
    canSubmit() {
      return !this.isSubmitting && 
             this.formData.title.trim() && 
             this.formData.author.trim() &&
             (this.hasCustomArtwork || this.selectedFile);
    }
  },
  methods: {
    showDialog(picName = 'pic20') {
      this.currentPicName = picName;
      this.visible = true;
      this.resetForm();
      this.checkExistingArtwork();
      console.log('显示图片上传弹窗 - 画作:', picName);
    },
    
    closeDialog() {
      this.visible = false;
      this.resetForm();
      console.log('关闭图片上传弹窗');
    },
    
    resetForm() {
      this.previewImage = '';
      this.originalImage = '';
      this.selectedFile = null;
      this.isDragOver = false;
      this.isSubmitting = false;
      this.formData = {
        title: '',
        author: '',
        description: ''
      };
      this.hasCustomArtwork = false;
    },
    
    triggerFileInput() {
      this.$refs.fileInput.click();
    },
    
    onFileSelect(event) {
      const file = event.target.files[0];
      if (file) {
        this.handleFile(file);
      }
    },
    
    onDragOver() {
      this.isDragOver = true;
    },
    
    onDragLeave() {
      this.isDragOver = false;
    },
    
    onDrop(event) {
      this.isDragOver = false;
      const files = event.dataTransfer.files;
      if (files.length > 0) {
        this.handleFile(files[0]);
      }
    },
    
    handleFile(file) {
      if (!file.type.startsWith('image/')) {
        alert('请选择图片文件！');
        return;
      }
      
      if (file.size > 5 * 1024 * 1024) {
        alert('图片大小不能超过 5MB！');
        return;
      }
      
      this.selectedFile = file;
      
      const reader = new FileReader();
      reader.onload = (e) => {
        this.originalImage = e.target.result;
        this.previewImage = e.target.result;
      };
      reader.readAsDataURL(file);
      
      console.log('选择的文件:', file.name, '大小:', (file.size / 1024 / 1024).toFixed(2) + 'MB');
    },
    
    async handleSubmit() {
      if (!this.canSubmit) return;
      this.isSubmitting = true;
      try {
        let imageData = this.previewImage;
        // === 仅对 pic16 和 pic17 做左右镜像 ===
        if (["pic16", "pic17"].includes(this.currentPicName) && imageData) {
          // 创建canvas进行左右翻转
          const img = new window.Image();
          await new Promise((resolve, reject) => {
            img.onload = resolve;
            img.onerror = reject;
            img.src = imageData;
          });
          const canvas = document.createElement('canvas');
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext('2d');
          ctx.translate(img.width, 0);
          ctx.scale(-1, 1);
          ctx.drawImage(img, 0, 0);
          imageData = canvas.toDataURL('image/jpeg', 0.92);
        }
        if (this.selectedFile) {
          // imageData已经设置好了
        } else if (this.hasCustomArtwork && this.previewImage) {
          // imageData已经设置好了  
        } else {
          alert('请选择图片文件！');
          this.isSubmitting = false;
          return;
        }
        const artworkData = {
          name: this.currentPicName,
          title: this.formData.title.trim(),
          author: this.formData.author.trim(),
          description: this.formData.description.trim() || `${this.formData.author.trim()}的精美作品《${this.formData.title.trim()}》`,
          image: imageData,
          uploadTime: new Date().toISOString(),
          isCustomUpload: true
        };
        localStorage.setItem(`customArtwork_${this.currentPicName}`, JSON.stringify(artworkData));
        EventBus.$emit('customArtworkUploaded', {
          picName: this.currentPicName,
          artworkData: artworkData
        });
        console.log('✅ 自定义作品保存成功:', artworkData);
        
        alert(this.hasCustomArtwork ? '作品更新成功！' : '作品上传成功！现在可以点击画作查看详情了。');
        
        this.closeDialog();
        setTimeout(() => {
          EventBus.$emit('showPictureDetail', artworkData);
        }, 500);
      } catch (error) {
        console.error('❌ 上传失败:', error);
        alert('上传失败，请重试！');
      } finally {
        this.isSubmitting = false;
      }
    },
    
    handleDelete() {
      if (confirm('确定要删除当前作品吗？删除后将恢复默认展示。')) {
        try {
          localStorage.removeItem(`customArtwork_${this.currentPicName}`);
          
          EventBus.$emit('resetTexture', this.currentPicName);
          
          this.hasCustomArtwork = false;
          
          console.log('✅ 自定义作品已删除');
          
          alert('作品删除成功！已恢复默认展示。');
          
          this.closeDialog();
          
        } catch (error) {
          console.error('❌ 删除失败:', error);
          alert('删除失败，请重试！');
        }
      }
    },
    
    checkExistingArtwork() {
      try {
        const customArtwork = localStorage.getItem(`customArtwork_${this.currentPicName}`);
        if (customArtwork) {
          const artworkData = JSON.parse(customArtwork);
          this.hasCustomArtwork = true;
          
          this.formData.title = artworkData.title || '';
          this.formData.author = artworkData.author || '';
          this.formData.description = artworkData.description || '';
          this.previewImage = artworkData.image || '';
          this.originalImage = artworkData.image || '';
          
          console.log('🎯 检测到已有自定义作品:', artworkData.title);
        } else {
          this.hasCustomArtwork = false;
          console.log('📝 暂无自定义作品');
        }
      } catch (error) {
        console.error('❌ 检测现有作品失败:', error);
        this.hasCustomArtwork = false;
      }
    }
  },
  mounted() {
    EventBus.$on('showPictureUpload', this.showDialog);
  },
  
  beforeDestroy() {
    EventBus.$off('showPictureUpload', this.showDialog);
  }
};
</script>

<style lang="less" scoped>
.upload-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.8);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 9999;
  backdrop-filter: blur(5px);
  font-family: 'biaoti', 'Microsoft YaHei', sans-serif;
}

.upload-dialog {
  position: relative;
  width: 90%;
  max-width: 800px;
  max-height: 90vh;
  background: linear-gradient(145deg, #1e2028, #2a2d3a);
  border-radius: 20px;
  box-shadow: 
    0 20px 60px rgba(0, 0, 0, 0.5),
    0 10px 30px rgba(0, 0, 0, 0.3),
    inset 0 1px 0 rgba(255, 255, 255, 0.1);
  overflow: hidden;
  animation: dialogSlideIn 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94);
  display: flex;
  flex-direction: column;
}

.dialog-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 24px 32px;
  border-bottom: 1px solid #444;
  background: linear-gradient(90deg, #333 0%, #2a2a2a 100%);
}

.upload-title {
  color: #f0f0f0;
  font-size: 28px;
  font-weight: bold;
  margin: 0;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
  letter-spacing: 1px;
}

.close-btn {
  background: none;
  border: none;
  color: #aaa;
  font-size: 32px;
  cursor: pointer;
  padding: 0;
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  transition: all 0.3s ease;
  
  &:hover {
    background-color: rgba(255, 255, 255, 0.1);
    color: #fff;
    transform: scale(1.1);
  }
}

.dialog-content {
  padding: 32px;
  display: flex;
  gap: 32px;
  max-height: 500px;
  overflow-y: auto;
  flex: 1;
}

.upload-section {
  flex: 1;
}

.upload-area {
  width: 100%;
  height: 300px;
  border: 3px dashed #666;
  border-radius: 15px;
  cursor: pointer;
  transition: all 0.3s ease;
  position: relative;
  overflow: hidden;
  
  &:hover, &.dragover {
    border-color: #4a90e2;
    background-color: rgba(74, 144, 226, 0.1);
  }
  
  &.has-image {
    border: none;
    
    &:hover .image-overlay {
      opacity: 1;
    }
  }
}

.upload-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  text-align: center;
  padding: 20px;
}

.upload-icon {
  font-size: 48px;
  margin-bottom: 16px;
  opacity: 0.6;
}

.upload-text {
  color: #ccc;
  font-size: 18px;
  margin: 0 0 8px 0;
  font-weight: 500;
}

.upload-hint {
  color: #888;
  font-size: 14px;
  margin: 0;
}

.image-preview {
  position: relative;
  width: 100%;
  height: 100%;
}

.preview-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: 12px;
}

.image-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: opacity 0.3s ease;
  border-radius: 12px;
}

.change-text {
  color: #fff;
  font-size: 16px;
  font-weight: 500;
}

.form-section {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.form-group {
  position: relative;
}

.form-label {
  display: block;
  color: #ccc;
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 8px;
  letter-spacing: 0.5px;
}

.form-input, .form-textarea {
  width: 100%;
  padding: 12px 16px;
  background: rgba(255, 255, 255, 0.1);
  border: 2px solid #444;
  border-radius: 10px;
  color: #fff;
  font-size: 16px;
  transition: all 0.3s ease;
  font-family: 'biaoti', 'Microsoft YaHei', sans-serif;
  box-sizing: border-box;
  
  &:focus {
    outline: none;
    border-color: #4a90e2;
    background: rgba(74, 144, 226, 0.15);
  }
  
  &::placeholder {
    color: #888;
  }
}

.form-textarea {
  resize: vertical;
  min-height: 100px;
  line-height: 1.5;
}

.char-count {
  position: absolute;
  right: 8px;
  bottom: -20px;
  font-size: 12px;
  color: #888;
}

.dialog-footer {
  padding: 24px 32px;
  border-top: 1px solid #444;
  display: flex;
  justify-content: flex-end;
  gap: 16px;
  background: rgba(255, 255, 255, 0.02);
}

.btn {
  padding: 12px 24px;
  border: none;
  border-radius: 10px;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
  font-family: 'biaoti', 'Microsoft YaHei', sans-serif;
  
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
}

.btn-secondary {
  background: rgba(255, 255, 255, 0.1);
  color: #ccc;
  
  &:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.2);
    color: #fff;
  }
}

.btn-primary {
  background: linear-gradient(45deg, #4a90e2, #1e88e5);
  color: #fff;
  
  &:hover:not(:disabled) {
    background: linear-gradient(45deg, #357abd, #1565c0);
    transform: translateY(-2px);
    box-shadow: 0 8px 20px rgba(74, 144, 226, 0.3);
  }
}

.btn-danger {
  background: linear-gradient(45deg, #e53935, #c62828);
  color: #fff;
  
  &:hover:not(:disabled) {
    background: linear-gradient(45deg, #d32f2f, #b71c1c);
    transform: translateY(-2px);
    box-shadow: 0 8px 20px rgba(239, 68, 68, 0.3);
  }
}

/* 响应式设计 */
@media (max-width: 768px) {
  .upload-dialog {
    width: 95vw;
    max-height: 95vh;
    display: flex;
    flex-direction: column;
  }
  
  .dialog-content {
    flex-direction: column;
    padding: 20px;
    gap: 20px;
    max-height: none;
    flex: 1;
    overflow-y: auto;
  }
  
  .upload-area {
    height: 180px;
  }
  
  .form-textarea {
    min-height: 80px;
  }
  
  .dialog-footer {
    flex-shrink: 0;
    padding: 16px 20px;
  }
}

@media (max-width: 480px) {
  .upload-dialog {
    width: 98vw;
    height: 98vh;
    max-height: 98vh;
    display: flex;
    flex-direction: column;
  }
  
  .dialog-header {
    padding: 12px 16px;
    flex-shrink: 0;
  }
  
  .upload-title {
    font-size: 20px;
  }
  
  .dialog-content {
    padding: 16px;
    gap: 16px;
    flex: 1;
    overflow-y: auto;
    min-height: 0;
  }
  
  .upload-area {
    height: 160px;
  }
  
  .form-textarea {
    min-height: 60px;
  }
  
  .dialog-footer {
    padding: 12px 16px;
    flex-direction: column-reverse;
    gap: 8px;
    flex-shrink: 0;
    position: sticky;
    bottom: 0;
    background: rgba(255, 255, 255, 0.02);
    
    .btn {
      width: 100%;
      margin: 0;
    }
  }
}

/* 动画效果 */
@keyframes dialogSlideIn {
  0% {
    opacity: 0;
    transform: scale(0.8);
  }
  100% {
    opacity: 1;
    transform: scale(1);
  }
}

/* 滚动条样式 */
.dialog-content::-webkit-scrollbar {
  width: 8px;
}

.dialog-content::-webkit-scrollbar-track {
  background: rgba(255, 255, 255, 0.1);
  border-radius: 4px;
}

.dialog-content::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.3);
  border-radius: 4px;
  
  &:hover {
    background: rgba(255, 255, 255, 0.5);
  }
}
</style> 