<template>
  <div class="minimap-container" v-if="visible">
    <!-- 地图图片 -->
    <img src="@/assets/image/map.png" alt="小地图" class="minimap-bg">
    
    <!-- 玩家位置标记 -->
    <div class="player-dot" :style="playerPositionStyle"></div>
    
    <!-- 观赏点标记 -->
    <div v-for="point in points" 
         :key="point.id"
         class="map-point"
         :class="getTooltipClass(point)"
         :style="{ 
           left: getScaledCoords(point).x + 'px', 
           top: getScaledCoords(point).y + 'px' 
         }"
         @click="flyToPoint(point)">
      <div class="point-ripple"></div>
      <span class="point-tooltip">{{ point.name }}</span>
    </div>
  </div>
</template>

<script>
export default {
  name: 'MiniMap',
  props: {
    visible: {
      type: Boolean,
      default: true,
    },
    // 所有观赏点的信息
    points: {
      type: Array,
      default: () => [],
    },
    // 玩家当前在3D世界中的位置
    playerPosition: {
      type: Object,
      default: () => ({ x: 0, z: 0 }),
    },
    // 地图范围和3D世界坐标的映射关系
    mapConfig: {
      type: Object,
      default: () => ({
        // 3D世界坐标范围
        worldMin: { x: -20, z: -20 },
        worldMax: { x: 20, z: 20 },
        // 小地图尺寸
        mapSize: { width: 200, height: 200 },
      }),
    },
  },
  computed: {
    // 计算玩家在小地图上的位置
    playerPositionStyle() {
      const { x, z } = this.playerPosition;
      const { worldMin, worldMax, mapSize } = this.mapConfig;

      // 将3D世界坐标转换为小地图上的百分比
      const percentX = (x - worldMin.x) / (worldMax.x - worldMin.x);
      const percentZ = (z - worldMin.z) / (worldMax.z - worldMin.z);

      // 转换为小地图上的像素位置
      const mapX = percentX * mapSize.width;
      const mapY = percentZ * mapSize.height;

      return {
        transform: `translate(${mapX}px, ${mapY}px)`,
      };
    },
  },
  watch: {
    // 🔥 新增：监听mapConfig变化，确保小地图坐标正确更新
    mapConfig: {
      handler(newConfig) {
        console.log('🗺️ 小地图配置更新:', newConfig.mapSize);
        this.$forceUpdate(); // 强制更新组件重新计算坐标
      },
      deep: true
    }
  },
  methods: {
    // 根据当前地图尺寸缩放观赏点坐标
    getScaledCoords(point) {
      // 原始坐标基于200x200的地图
      const originalMapSize = 200;
      const scaleFactor = this.mapConfig.mapSize.width / originalMapSize;
      return {
        x: point.mapCoords.x * scaleFactor,
        y: point.mapCoords.y * scaleFactor,
      };
    },
    
    // 🔥 新增：根据地图点位置智能确定标签显示方向
    getTooltipClass(point) {
      const coords = this.getScaledCoords(point);
      const mapSize = this.mapConfig.mapSize.width;
      const centerX = mapSize / 2;
      const centerY = mapSize / 2;
      
      // 计算点相对于圆心的位置
      const deltaX = coords.x - centerX;
      const deltaY = coords.y - centerY;
      
      // 计算距离圆心的距离
      const distanceFromCenter = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
      const radius = mapSize / 2;
      
      // 如果点接近圆的边缘（距离圆心超过70%半径），调整标签位置
      if (distanceFromCenter > radius * 0.7) {
        // 根据象限决定标签位置
        if (deltaY < -radius * 0.3) {
          // 上半部分 - 标签显示在下方
          return 'tooltip-bottom';
        } else if (deltaY > radius * 0.3) {
          // 下半部分 - 标签显示在上方
          return 'tooltip-top';
        } else if (deltaX < 0) {
          // 左半部分 - 标签显示在右方
          return 'tooltip-right';
        } else {
          // 右半部分 - 标签显示在左方
          return 'tooltip-left';
        }
      }
      
      // 默认显示在上方
      return 'tooltip-top';
    },
    
    flyToPoint(point) {
      this.$emit('fly-to', point);
    },
  },
};
</script>

<style lang="less" scoped>
.minimap-container {
  position: fixed;
  bottom: 20px;
  right: 20px;
  width: 200px;
  height: 200px;
  border-radius: 50%;
  overflow: visible; /* 🔥 修改：允许标签显示在外部 */
  border: 3px solid rgba(255, 255, 255, 0.3);
  box-shadow: 0 5px 20px rgba(0, 0, 0, 0.5);
  z-index: 1000;
  background-color: #333;
  animation: map-fade-in 0.5s ease-out;
  
  /* 🔥 新增：使用伪元素创建圆形遮罩，只对背景图片生效 */
  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    border-radius: 50%;
    z-index: 1;
    pointer-events: none;
  }

  .minimap-bg {
    width: 100%;
    height: 100%;
    object-fit: cover;
    border-radius: 50%; /* 🔥 新增：确保背景图片也是圆形 */
    position: relative;
    z-index: 0; /* 确保背景在最底层 */
  }

  .player-dot {
    position: absolute;
    top: 0;
    left: 0;
    width: 10px;
    height: 10px;
    background-color: #4a90e2;
    border-radius: 50%;
    border: 2px solid #fff;
    box-shadow: 0 0 8px #4a90e2;
    transition: transform 0.2s linear;
    will-change: transform;
    z-index: 2; /* 🔥 新增：确保玩家点在背景之上 */
  }

  .map-point {
    position: absolute;
    width: 12px;
    height: 12px;
    background-color: #ff5c5c;
    border-radius: 50%;
    border: 2px solid #fff;
    cursor: pointer;
    transform: translate(-50%, -50%);
    z-index: 3; /* 🔥 新增：确保地图点在最上层（除了标签） */

    &:hover .point-tooltip {
      opacity: 1;
      visibility: visible;
      transform: translate(-50%, -150%);
    }
    
    .point-ripple {
      position: absolute;
      top: 50%;
      left: 50%;
      width: 100%;
      height: 100%;
      border-radius: 50%;
      background-color: #ff5c5c;
      transform: translate(-50%, -50%);
      animation: ripple 1.5s infinite ease-out;
    }

    .point-tooltip {
      position: absolute;
      padding: 4px 8px;
      background-color: rgba(0, 0, 0, 0.8);
      color: #fff;
      font-size: 12px;
      border-radius: 4px;
      white-space: nowrap;
      opacity: 0;
      visibility: hidden;
      transition: all 0.3s ease;
      z-index: 10; /* 确保标签在最上层 */
      max-width: 80px; /* 限制最大宽度 */
      text-align: center;
      
      /* 默认位置（上方） */
      bottom: 100%;
      left: 50%;
      transform: translate(-50%, -130%);
    }
    
    /* 🔥 新增：不同方向的标签位置样式 */
    &.tooltip-top .point-tooltip {
      bottom: 100%;
      left: 50%;
      transform: translate(-50%, -130%);
    }
    
    &.tooltip-bottom .point-tooltip {
      top: 100%;
      left: 50%;
      transform: translate(-50%, 30%);
    }
    
    &.tooltip-left .point-tooltip {
      top: 50%;
      right: 100%;
      transform: translate(-130%, -50%);
    }
    
    &.tooltip-right .point-tooltip {
      top: 50%;
      left: 100%;
      transform: translate(30%, -50%);
    }
  }
}

@keyframes map-fade-in {
  from {
    opacity: 0;
    transform: scale(0.8);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

@keyframes ripple {
  0% {
    transform: translate(-50%, -50%) scale(1);
    opacity: 0.6;
  }
  100% {
    transform: translate(-50%, -50%) scale(3);
    opacity: 0;
  }
}

/* 🔥 移动端小地图缩小1/3 */
@media (max-width: 768px) {
  .minimap-container {
    width: 133px; /* 200px * 2/3 = 133px */
    height: 133px;
    bottom: 15px;
    right: 15px;
    border-width: 2px;
    
    .player-dot {
      width: 7px; /* 10px * 2/3 ≈ 7px */
      height: 7px;
      border-width: 1px;
    }
    
    .map-point {
      width: 8px; /* 12px * 2/3 = 8px */
      height: 8px;
      border-width: 1px;
      
      .point-tooltip {
        font-size: 10px;
        padding: 2px 6px;
      }
    }
  }
}
</style> 