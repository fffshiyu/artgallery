<template>
  <div class="painters-list-overlay" v-if="visible" @click.self="close">
    <div class="painters-list-dialog">
      <div class="dialog-header">
        <h2>画家列表</h2>
        <button class="close-btn" @click="close">&times;</button>
      </div>
      <div class="dialog-content">
        <ul>
          <li v-for="(works, artist) in artists" :key="artist" @click="selectArtist(artist)">
            {{ artist }}
            <span class="work-count">({{ works.length }} 幅作品)</span>
          </li>
        </ul>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'PaintersList',
  props: {
    artists: {
      type: Object,
      required: true
    }
  },
  data() {
    return {
      visible: false,
    };
  },
  methods: {
    show() {
      this.visible = true;
    },
    close() {
      this.visible = false;
    },
    selectArtist(artist) {
      this.$emit('select-artist', artist);
      this.close();
    }
  }
};
</script>

<style lang="less" scoped>
.painters-list-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.7);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 10000;
  backdrop-filter: blur(8px);
}

.painters-list-dialog {
  width: 90%;
  max-width: 400px;
  background: #1e2028;
  border-radius: 15px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
  animation: dialog-fade-in 0.3s ease-out;

  .dialog-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 16px 24px;
    border-bottom: 1px solid #444;
    color: #f0f0f0;

    h2 {
      margin: 0;
      font-size: 22px;
    }
  }

  .close-btn {
    background: none;
    border: none;
    color: #aaa;
    font-size: 28px;
    cursor: pointer;
    transition: color 0.2s;
    &:hover {
      color: #fff;
    }
  }

  .dialog-content {
    padding: 16px;
    max-height: 70vh;
    overflow-y: auto;

    ul {
      list-style: none;
      padding: 0;
      margin: 0;
    }

    li {
      color: #ccc;
      padding: 12px 24px;
      border-radius: 8px;
      cursor: pointer;
      transition: background-color 0.2s, color 0.2s;

      &:hover {
        background-color: rgba(255, 255, 255, 0.1);
        color: #fff;
      }
    }
    
    .work-count {
        float: right;
        color: #888;
        font-size: 14px;
    }
  }
}

@keyframes dialog-fade-in {
  from {
    opacity: 0;
    transform: scale(0.9);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

// 🔥 新增：移动端优化
@media (max-width: 768px) {
  .painters-list-dialog {
    width: 95%;
    max-width: 95%;
    margin: 0 auto;
    max-height: 80vh;
    
    .dialog-header {
      padding: 12px 16px;
      
      h2 {
        font-size: 18px;
      }
      
      .close-btn {
        font-size: 24px;
        width: 32px;
        height: 32px;
        display: flex;
        align-items: center;
        justify-content: center;
      }
    }
    
    .dialog-content {
      padding: 8px;
      
      li {
        padding: 16px 20px;
        font-size: 16px;
        border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        display: flex;
        justify-content: space-between;
        align-items: center;
        
        &:last-child {
          border-bottom: none;
        }
        
        // 增强触摸体验
        &:active {
          background-color: rgba(255, 255, 255, 0.2);
          transform: scale(0.98);
        }
      }
      
      .work-count {
        float: none;
        margin-left: 8px;
        font-size: 14px;
      }
    }
  }
}

// 🔥 新增：超小屏幕优化
@media (max-width: 480px) {
  .painters-list-dialog {
    width: 98%;
    max-height: 85vh;
    
    .dialog-header {
      padding: 10px 12px;
      
      h2 {
        font-size: 16px;
      }
      
      .close-btn {
        font-size: 20px;
        width: 28px;
        height: 28px;
      }
    }
    
    .dialog-content {
      padding: 4px;
      
      li {
        padding: 14px 16px;
        font-size: 15px;
        flex-direction: column;
        align-items: flex-start;
        gap: 4px;
        
        .work-count {
          margin-left: 0;
          font-size: 12px;
          color: #999;
        }
      }
    }
  }
}

// 🔥 新增：横屏模式适配
@media (max-width: 768px) and (orientation: landscape) {
  .painters-list-dialog {
    max-height: 90vh;
    width: 80%;
    
    .dialog-content {
      max-height: calc(90vh - 60px);
    }
  }
}
</style> 