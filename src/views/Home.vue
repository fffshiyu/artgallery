<template>
  <div class="main">
    <loader 
      :number="loadingNumber" 
      v-if="showLoader"
      @start-exploring="handleStartExploring"
    ></loader>
    
    <!-- 右上角控制图标 -->
    <div class="control-icons" v-if="!showLoader">
      <!-- 一键漫游功能 -->
      <button class="control-btn" 
              :class="{ 
                'roaming-active': isRoaming,
                'disabled': isThirdPersonMode
              }"
              :title="isThirdPersonMode ? '第三人称模式下无法使用漫游' : (isRoaming ? '停止漫游' : '一键漫游')" 
              @click="toggleAutoRoaming">
        <img src="@/assets/image/roaming.png" alt="roaming icon">
      </button>
      
      <!-- 截图功能 -->
      <button class="control-btn" 
              title="截图" 
              @click="takeScreenshot">
        <img src="@/assets/image/camera.png" alt="camera icon">
      </button>
      
      <!-- 音乐控制 -->
      <button class="control-btn" 
              :title="isMuted ? '取消静音' : '静音'" 
              @click="toggleMusic">
        <img :src="isMuted ? require('@/assets/image/mute-speaker.png') : require('@/assets/image/volume.png')" 
             alt="volume icon">
      </button>
      
      <!-- 分享功能 -->
      <button class="control-btn"
              title="分享"
              @click="shareUrl">
        <img src="@/assets/image/share.png" alt="share icon">
      </button>
      
      <!-- 虚拟摇杆控制 -->
      <button class="control-btn"
              title="虚拟摇杆"
              @click="toggleJoystick">
        <img src="@/assets/image/controller.png" alt="joystick icon">
      </button>
      
      <!-- 画家列表按钮 -->
      <button class="control-btn"
              title="画家列表"
              @click="showArtistList">
        <img src="@/assets/image/2dbutton.png" alt="artist list icon">
      </button>
      
      <!-- 🔥 新增：小地图开关 -->
      <button class="control-btn"
              title="显示/隐藏地图"
              @click="toggleMiniMap">
        <img src="@/assets/image/map_icon.png" alt="map icon">
      </button>
      
      <!-- 🐋 第三人称视角切换 -->
      <button class="control-btn"
              :class="{ 'whale-active': isThirdPersonMode }"
              :title="isThirdPersonMode ? '切换到第一人称' : '切换到第三人称'"
              @click="toggleViewMode">
        <img src="@/assets/image/whale.png" alt="whale icon">
      </button>
    </div>
    
    <div id="screen" class="screen"></div>
    <el-dialog title="视频播放" width="70%" v-model="dialogTableVisible">
      <div style="position: relative; padding: 30% 45%;">
        <iframe
          style="position: absolute; width: 100%; height: 100%; left: 0; top: 0;"
          :src="curPicUrl"
          scrolling="no"
          border="0"
          frameborder="no"
          framespacing="0"
          allowfullscreen="true"
        >
        </iframe>
      </div>
    </el-dialog>
    
    <!-- 背景音乐 -->
    <audio ref="backgroundMusic" loop>
      <source src="/music/纯音乐 - 海的尽头.mp3" type="audio/mpeg">
    </audio>
    
    <!-- 🔥 新增：淡入淡出过渡遮罩 -->
    <div class="fade-overlay" :class="{ 'visible': isFading }"></div>
    
    <!-- 画作详情弹窗 -->
    <PictureDetailDialog ref="pictureDetailDialog" @back-to-list="showArtistList" />
    
    <!-- 画作上传弹窗 -->
    <PictureUploadDialog ref="pictureUploadDialog" />
    
    <!-- 画家列表弹窗 -->
    <PaintersList ref="paintersList" :artists="artistsData" @select-artist="showArtistWorks" />
    
    <!-- 🔥 新增：小地图组件 -->
    <MiniMap 
      :visible="isMiniMapVisible"
      :points="mapPoints"
      :player-position="playerPosition"
      :map-config="mapConfig"
      @fly-to="handleFlyTo"
    />
    

  </div>
</template>

<script>
  import loader from '@/components/loader';
  import ZThree from '@/three/ZThree';
  import * as THREE from 'three';
  import { loaderModel } from '@/three/loaderModel';
  import { CSS3DRenderer } from 'three/examples/jsm/renderers/CSS3DRenderer';
  import { cssRender } from '@/three/cssRender';
  import TWEEN from 'three/examples/jsm/libs/tween.module.js';
  import PictureDetailDialog from '@/components/PictureDetailDialog';
  import PictureUploadDialog from '@/components/PictureUploadDialog';
  import PaintersList from '@/components/PaintersList.vue';
  //import { getArtistsAndWorks } from '@/assets/artists.js'; // 🔥 引入数据处理函数
  
  // 🔥 引入小地图相关
  import MiniMap from '@/components/MiniMap.vue';
  import { mapPoints } from '@/assets/mapPoints.js';
  import { calculateViewingPosition } from '@/three/loaderRoam.js'; // 🔥 新增：导入计算观赏位置的函数

  let app, camera, scene, renderer, controls, clock;

  export default {
    name: 'Home',
    components: {
      loader,
      PictureDetailDialog,
      PictureUploadDialog,
      PaintersList,
      MiniMap // 🔥 注册小地图组件
    },
    data() {
      const isMobile = window.innerWidth <= 768;
      return {
        // loading数值
        loadingNumber: 0,
        // 控制加载界面显示
        showLoader: true,
        curPicUrl: null,
        dialogTableVisible: false,
        // 音乐控制
        isMuted: false,
        musicPlaying: false,
        
        // 🔥 新增画家列表数据
        artistsData: {},
        
        // 🔥 小地图相关状态
        isMiniMapVisible: !isMobile, // 在移动端默认隐藏
        mapPoints: mapPoints,
        playerPosition: { x: 0, z: 0 },
        mapConfig: {
            worldMin: { x: -15, z: -16},
            worldMax: { x: 25, z: 22},
            mapSize: { width: isMobile ? 150 : 200, height: isMobile ? 150 : 200 }, // 移动端尺寸缩小
        },
        
        // 🔥 新增：控制淡入淡出遮罩的状态
        isFading: false,
        
        // 🔥 新增：漫游功能状态
        isRoaming: false,
        roamingTimer: null, // 漫游定时器
        currentRoamingIndex: 0, // 当前漫游索引
        roamingSequence: [], // 漫游序列

        // 🔥 新增：数据更新订阅
        unsubscribeDataUpdate: null,
        
        // 🐋 第三人称视角状态
        isThirdPersonMode: false,
      };
    },
    


    // 🔥 新增：组件挂载时注册数据更新监听
    async mounted() {
      // 注册数据更新回调
      const { registerDataUpdateCallback } = await import('@/assets/data.js');
      this.unsubscribeDataUpdate = registerDataUpdateCallback(() => {
        console.log('🔄 Home组件收到数据更新通知，刷新画家列表...');
        this.refreshArtistData();
      });

      // 原有的事件监听器
      this.$EventBus.$on('changeLoaidng', (val) => {
        this.loadingNumber = val;
      });

      this.$EventBus.$on('changeDialog', (obj) => {
        this.curPicUrl = obj.url;
        this.dialogTableVisible = true;
      });
      
      // 监听画作详情显示事件
      this.$EventBus.$on('showPictureDetail', (pictureData) => {
        console.log('🎨 Home.vue 接收到显示画作详情事件:', pictureData.title);
        this.$refs.pictureDetailDialog.showDialog(pictureData);
      });
      
      // 监听画作上传弹窗显示事件
      this.$EventBus.$on('showPictureUpload', (picName) => {
        console.log('📁 Home.vue 接收到显示上传弹窗事件:', picName);
        this.$refs.pictureUploadDialog.showDialog(picName);
      });
      
      // 🔥 新增：监听控制淡入淡出的事件
      this.$EventBus.$on('toggle-fade', (state) => {
        this.isFading = state;
      });
      

      
      this.initZThree();
      
      // 初始化时隐藏坐标轴
      setTimeout(() => {
        if (app) {
          app.toggleAxesHelper(false);
        }
      }, 1000);
    },

    // 🔥 新增：组件销毁时清理监听
    beforeDestroy() {
      if (this.unsubscribeDataUpdate) {
        this.unsubscribeDataUpdate();
      }
      // 清理事件监听器
      this.$EventBus.$off('changeLoaidng');
      this.$EventBus.$off('changeDialog');
      this.$EventBus.$off('showPictureDetail');
      this.$EventBus.$off('showPictureUpload');
      this.$EventBus.$off('toggle-fade');
      
      // 🔥 新增：清理漫游定时器
      if (this.roamingTimer) {
        clearTimeout(this.roamingTimer);
        this.roamingTimer = null;
      }
      
      console.log('🧹 已清理 Home.vue 中的事件监听器和定时器');
    },

    methods: {
      async initZThree() {
        console.log('🚀 开始初始化3D场景...');
        
        // 1. 创建基础3D环境
        app = new ZThree('screen');
        app.initThree();
        app.initHelper();
        app.initLight();
        app.initFirstPersonControls();

        window.app = app;
        // 🎨 确保 EventBus 全局可用，供纹理更新系统使用
        window.EventBus = this.$EventBus;
        
        camera = app.camera;
        // 设置摄像头初始位置 - 高度调整到2.5米
        const vec3Pos = new THREE.Vector3(9.59, 2.5, 0.48);
        camera.position.copy(vec3Pos);
        scene = app.scene;
        renderer = app.renderer;
        renderer.outputEncoding = THREE.sRGBEncoding; //采用sRGBEncoding
        controls = app.controls;
        
        // 🔥 修复：设置初始朝向，并同步第一人称控制器
        camera.lookAt(new THREE.Vector3(7.97, 2.5, -0.69)); // 设置初始朝向，保持水平视线
        
        // 🔥 重要：设置朝向后，需要同步第一人称控制器的欧拉角
        if (app.firstPersonControls) {
          app.firstPersonControls.euler.setFromQuaternion(camera.quaternion);
        }
        
        // 🔥 兼容性：为其他可能存在的控制器更新目标点
        if (app.updateControlsTarget) {
          app.updateControlsTarget(); // 初始化动态目标点
        }
        
        // 启用基本的控制功能，保持交互性
        controls.enableZoom = false; // 禁用滚轮缩放操作
        controls.enablePan = true;
        controls.enableRotate = true;
        // 设置合理的距离限制
        controls.minDistance = 0.5;
        controls.maxDistance = 50;

        clock = new THREE.Clock();

        // 2. 等待所有资源加载完成和首帧渲染
        console.log('📦 开始资源加载流程...');
        try {
          await loaderModel(app);
          console.log('✅ 资源加载和首帧渲染完成');
        } catch (error) {
          console.error('❌ 资源加载失败:', error);
        }

        // 🐋 初始化第三人称视角功能
        console.log('🐋 初始化第三人称视角功能...');
        app.initThirdPersonControls();
        app.loadWhaleModel();

        // 3. 初始化CSS渲染器
        console.log('🎨 初始化CSS渲染器...');
        let instance = new cssRender(CSS3DRenderer, app);
        app.cssRenderer = instance.cssRenderer;
        app.instance = instance;

        // 4. 启动渲染循环 - 只有在所有资源准备完毕后才启动
        console.log('🎬 启动渲染循环...');
        app.render(() => {
          controls.update(clock.getDelta());
          renderer.render(scene, camera);
          app.cssRenderer.render(scene, camera);
          TWEEN.update();
          
          // 🔥 实时更新玩家位置
          if (this.isMiniMapVisible) {
            this.playerPosition = { x: camera.position.x, z: camera.position.z };
          }
        });
        
        console.log('🎉 3D场景初始化完成！');
      },
      
      // 处理开始探索按钮点击
      handleStartExploring() {
        this.showLoader = false;
        console.log('🎨 开始探索艺术画廊！');
        
        // 开始播放背景音乐
        this.playBackgroundMusic();
        
        // 可以在这里添加一些进入动画或其他效果
        // 比如淡入效果、相机动画等
        if (app && app.camera) {
          // 确保相机位置正确 - 高度3米
          app.camera.position.set(9.59, 3.0, 0.48);
          if (app.controls) {
            // 🔥 使用动态目标系统而不是固定目标点
            app.camera.lookAt(new THREE.Vector3(7.97, 3.0, -0.69)); // 设置朝向
            app.updateControlsTarget(); // 更新动态目标点
            app.controls.update();
          }
        }
      },
      
      // 播放背景音乐
      playBackgroundMusic() {
        try {
          const audio = this.$refs.backgroundMusic;
          audio.volume = 0.3; // 设置音量为30%
          audio.play().then(() => {
            this.musicPlaying = true;
            console.log('🎵 背景音乐开始播放');
          }).catch(() => {
            console.log('🔇 音乐播放被浏览器阻止，需要用户交互后播放');
            // 现代浏览器需要用户交互才能播放音频
          });
        } catch (error) {
          console.error('音乐播放错误:', error);
        }
      },
      
      // 切换音乐播放状态
      toggleMusic() {
        const audio = this.$refs.backgroundMusic;
        if (this.isMuted) {
          audio.muted = false;
          this.isMuted = false;
          console.log('🔊 取消静音');
        } else {
          audio.muted = true;
          this.isMuted = true;
          console.log('🔇 静音');
        }
      },
      
      // 截图功能
      takeScreenshot() {
        if (app && app.takeScreenshot) {
          const success = app.takeScreenshot();
          if (success) {
            console.log('✅ 截图成功');
          } else {
            console.log('❌ 截图失败');
          }
        } else {
          console.error('3D场景尚未初始化');
        }
      },
      
      // 分享URL功能
      shareUrl() {
        const url = window.location.href;
        
        // 创建一个临时输入框来复制内容
        const tempInput = document.createElement('input');
        tempInput.value = url;
        document.body.appendChild(tempInput);
        tempInput.select();
        document.execCommand('copy');
        document.body.removeChild(tempInput);
        
        // 提示用户已复制 - 使用黑白灰配色
        this.$message({
          message: '链接已复制到剪贴板，可以分享给他人了！',
          customClass: 'dark-message',
          center: true,
          offset: 60,
          duration: 2000
        });
      },
      
      // 切换虚拟摇杆显示/隐藏
      toggleJoystick() {
        const joystickContainer = document.getElementById('joystick-container');
        if (joystickContainer) {
          const isVisible = joystickContainer.style.display !== 'none';
          joystickContainer.style.display = isVisible ? 'none' : 'block';
        }
      },
      
      // 🔧 修复：异步获取画家数据后再显示列表
      async showArtistList() {
        try {
          // 先获取画家数据
          await this.getArtistsAndWorks();
          // 数据加载完成后再显示列表
          this.$refs.paintersList.show();
        } catch (error) {
          console.error('❌ 显示画家列表失败:', error);
        }
      },
      
      // 🔧 修复：改为 async 方法，正确处理异步数据加载
      async getArtistsAndWorks(){
        try {
          // 动态导入获取最新的 picData
                     const module = await import('@/assets/data.js');
           const { picData } = module;
           
           const artists = {};
          
          for (const picKey in picData) {
            const work = picData[picKey];
            if (work && work.author) {
              if (!artists[work.author]) {
                artists[work.author] = [];
              }
              artists[work.author].push(work);
            }
          }
          
          this.artistsData = artists;
          console.log('✅ 画家列表数据更新:', this.artistsData);
          
          return artists;
        } catch (error) {
          console.error('❌ 获取 picData 失败:', error);
          return {};
        }
      },
      
      // 🔥 新增：显示指定画家的作品集
      showArtistWorks(artistName) {
        const works = this.artistsData[artistName];
        if (works && works.length > 0) {
          this.$refs.pictureDetailDialog.showDialog(works); // 传入整个作品数组
        }
      },
      
      // 🔥 新增：切换小地图显示/隐藏
      toggleMiniMap() {
        this.isMiniMapVisible = !this.isMiniMapVisible;
      },
      
      // 🔥 新增：处理小地图飞行请求
      handleFlyTo(target) {
        if (app && app.teleportTo) {
          // 修复：调用新的teleportTo函数以实现淡入淡出效果
          app.teleportTo({
            position: [target.worldCoords.x, target.worldCoords.y, target.worldCoords.z],
            controls: [target.lookAt.x, target.lookAt.y, target.lookAt.z]
          });
        }
      },
      
      // 🔥 新增：切换漫游功能状态
      toggleAutoRoaming() {
        if (this.isRoaming) {
          this.stopAutoRoaming();
        } else {
          this.startAutoRoaming();
        }
      },
      
      // 🐋 切换视角模式
      toggleViewMode() {
        if (!app) {
          this.$message.warning('场景尚未初始化完成');
          return;
        }
        
        try {
          const newMode = app.toggleViewMode();
          this.isThirdPersonMode = newMode;
          
          // 🔥 新增：切换到第三人称时自动停止漫游
          if (newMode && this.isRoaming) {
            this.stopAutoRoaming();
            this.$message({
              message: '已切换到第三人称视角，自动漫游已停止',
              type: 'warning',
              duration: 3000,
              customClass: 'dark-message'
            });
          } else {
            const modeText = newMode ? '第三人称' : '第一人称';
            this.$message({
              message: `已切换到${modeText}视角`,
              type: 'success',
              duration: 2000,
              customClass: 'dark-message'
            });
          }
          
          console.log(`🐋 视角切换完成: ${newMode ? '第三人称' : '第一人称'}`);
        } catch (error) {
          console.error('❌ 视角切换失败:', error);
          this.$message.error('视角切换失败，请稍后再试');
        }
      },
      
      // 🔥 新增：开始自动漫游
      startAutoRoaming() {
        if (!app || !app.rayModel) {
          this.$message.warning('场景尚未加载完成，请稍后再试');
          return;
        }

        // 🐋 新增：第三人称模式下禁用漫游
        if (app.thirdPersonMode) {
          this.$message.warning('第三人称模式下无法使用自动漫游，请切换回第一人称');
          return;
        }

        // 定义漫游序列：pic1-pic12, pic27, pic26, pic25, pic24
        const roamingPictures = [
          'pic1', 'pic2', 'pic3', 'pic4', 'pic5', 'pic6', 'pic7', 'pic8', 'pic9', 'pic10', 'pic11', 'pic12',
          'pic27', 'pic26', 'pic25', 'pic24'
        ];

        // 查找所有相关的画作模型
        this.roamingSequence = [];
        roamingPictures.forEach(picName => {
          const model = app.rayModel.find(obj => obj.name === picName);
          if (model) {
            this.roamingSequence.push(model);
            console.log('✅ 找到画作模型:', picName);
          } else {
            console.warn('⚠️ 未找到画作模型:', picName);
          }
        });

        if (this.roamingSequence.length === 0) {
          this.$message.error('未找到可漫游的画作');
          return;
        }

        this.isRoaming = true;
        this.currentRoamingIndex = 0;
        
        console.log('🎬 开始一键漫游，共', this.roamingSequence.length, '个画作');
        
        // 输出实际漫游的画作列表
        const actualPictures = this.roamingSequence.map(model => model.name);
        console.log('📋 实际漫游序列:', actualPictures.join(' → '));
        
        this.$message({
          message: `开始一键漫游，将依次观赏 ${this.roamingSequence.length} 幅画作`,
          type: 'success',
          duration: 3000
        });

        // 开始漫游第一幅画作
        this.roamToNextPicture();
      },

      // 🔥 新增：停止自动漫游
      stopAutoRoaming() {
        this.isRoaming = false;
        if (this.roamingTimer) {
          clearTimeout(this.roamingTimer);
          this.roamingTimer = null;
        }
        
        console.log('⏹️ 停止一键漫游');
        this.$message({
          message: '已停止一键漫游',
          type: 'info',
          duration: 2000
        });
      },

      // 🔥 重构 v2：修复pic12重复观看问题，统一漫游逻辑
      roamToNextPicture() {
        if (!this.isRoaming || this.currentRoamingIndex >= this.roamingSequence.length) {
          this.isRoaming = false;
          console.log('🎉 漫游完成！');
          this.$message({
            message: '一键漫游已完成，欢迎继续自由探索！',
            type: 'success',
            duration: 3000,
          });
          return;
        }

        const currentModel = this.roamingSequence[this.currentRoamingIndex];
        const viewingPosition = calculateViewingPosition(app, currentModel);
        
        if (!viewingPosition) {
          console.error('❌ 无法计算画作观赏位置:', currentModel.name);
          this.currentRoamingIndex++;
          this.roamToNextPicture();
          return;
        }

        console.log(`🎨 漫游到第 ${this.currentRoamingIndex + 1}/${this.roamingSequence.length} 幅画作: ${currentModel.name}`);
        
        // 统一执行“飞行”和“观看”
        app.flyTo({
          position: viewingPosition.position,
          controls: viewingPosition.controls,
          pictureName: viewingPosition.pictureName,
          duration: 1500,
          done: () => {
            console.log(`✅ 到达画作 ${currentModel.name}，停留2秒`);
            
            this.roamingTimer = setTimeout(() => {
              if (!this.isRoaming) return;

              const isLastPictureOfFirstHall = currentModel.name === 'pic12';

              // 在停留观看结束后，决策下一步动作
              if (isLastPictureOfFirstHall) {
                // 如果是pic12，执行跨展厅传送
                console.log(`🎭 从 ${currentModel.name} 跨展厅移动...`);

                const nextIndex = this.currentRoamingIndex + 1;
                if (nextIndex >= this.roamingSequence.length) {
                    this.roamToNextPicture(); // 结束漫游
                    return;
                }
                const nextModel = this.roamingSequence[nextIndex];
                const nextViewingPosition = calculateViewingPosition(app, nextModel);

                // 使用teleportTo方法处理跨展厅传送，支持第一人称和第三人称
                app.teleportTo({
                  position: nextViewingPosition.position,
                  controls: nextViewingPosition.controls,
                  done: () => {
                    console.log(`✅ 成功跨展厅到达 ${nextModel.name}，停留2秒`);
                    
            this.roamingTimer = setTimeout(() => {
                      if (this.isRoaming) {
                        this.currentRoamingIndex = nextIndex + 1; // 完成传送后，直接跳到下一幅画
                this.roamToNextPicture();
              }
                    }, 2000);
                  }
                });

              } else {
                // 普通漫游，直接到下一幅
                this.currentRoamingIndex++;
                this.roamToNextPicture();
              }
            }, 2000); // 观看停留时间
          },
        });
      },
      
      handleClickControl() {},

      // 🔥 新增：刷新画家列表数据
      refreshArtistData() {
        this.getArtistsAndWorks().then(() => {
          console.log('✅ 画家列表数据已刷新:', this.artistsData);
          // 如果当前正在显示画家列表，则刷新显示
          if (this.$refs.paintersList && this.$refs.paintersList.visible) {
            this.$refs.paintersList.show();
          }
        });
      },


    }
  };
</script>

<style lang="less" scoped>
  .main {
    width: 100%;
    height: 100%;
    overflow: hidden;
    background-color: #000000;
    position: relative;

    // 右上角控制图标样式
    .control-icons {
      position: fixed;
      top: 20px;
      right: 20px;
      z-index: 1000;
      display: flex;
      align-items: center;
      gap: 15px; // 图标之间的间距

      .control-btn {
        width: 40px;
        height: 40px;
        border: none;
        border-radius: 50%;
        background: rgba(255, 255, 255, 0.8);
        box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.3s ease;
        
        &:hover {
          background: rgba(255, 255, 255, 0.95);
          transform: scale(1.1);
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
        }
        
        &:active {
          transform: scale(0.95);
        }
        
        // 🔥 新增：漫游按钮激活状态样式
        &.roaming-active {
          background: linear-gradient(45deg, #ff6b6b, #ff4757);
          animation: roaming-pulse 2s infinite;
          box-shadow: 0 0 20px rgba(255, 107, 107, 0.6);
          
          &:hover {
            background: linear-gradient(45deg, #ff5252, #ff3742);
            transform: scale(1.1);
          }
        }
        
        // 🐋 新增：鲸鱼按钮激活状态样式
        &.whale-active {
          background: linear-gradient(45deg, #00bfff, #1e90ff);
          animation: whale-swim 3s infinite;
          box-shadow: 0 0 20px rgba(30, 144, 255, 0.6);
          
          &:hover {
            background: linear-gradient(45deg, #00aaee, #1c7ed6);
            transform: scale(1.1);
          }
        }
        
        // 🔥 新增：禁用按钮样式
        &.disabled {
          background: rgba(128, 128, 128, 0.5);
          cursor: not-allowed;
          opacity: 0.5;
          
          &:hover {
            background: rgba(128, 128, 128, 0.5);
            transform: none;
            box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
          }
          
          img {
            opacity: 0.6;
          }
        }
        
        img {
          width: 18px;
          height: 18px;
          object-fit: contain;
        }
      }
      
      // 🔥 新增：漫游按钮脉冲动画
      @keyframes roaming-pulse {
        0% {
          box-shadow: 0 0 20px rgba(255, 107, 107, 0.6);
        }
        50% {
          box-shadow: 0 0 30px rgba(255, 107, 107, 0.8);
          transform: scale(1.05);
        }
        100% {
          box-shadow: 0 0 20px rgba(255, 107, 107, 0.6);
        }
      }
      
      // 🐋 新增：鲸鱼游泳动画
      @keyframes whale-swim {
        0% {
          box-shadow: 0 0 20px rgba(30, 144, 255, 0.6);
          transform: rotateY(0deg);
        }
        33% {
          box-shadow: 0 0 25px rgba(30, 144, 255, 0.7);
          transform: rotateY(10deg) scale(1.02);
        }
        66% {
          box-shadow: 0 0 30px rgba(30, 144, 255, 0.8);
          transform: rotateY(-10deg) scale(1.05);
        }
        100% {
          box-shadow: 0 0 20px rgba(30, 144, 255, 0.6);
          transform: rotateY(0deg);
        }
      }
      
      // 📱 手机端样式优化
      @media (max-width: 768px) {
        top: 10px;
        right: 10px;
        gap: 8px; // 减少图标间距
        
        .control-btn {
          width: 32px; // 缩小图标大小
          height: 32px;
          background: rgba(255, 255, 255, 0.7); // 增加透明度
          box-shadow: 0 1px 6px rgba(0, 0, 0, 0.15); // 减小阴影
          
          &:hover {
            background: rgba(255, 255, 255, 0.85);
            transform: scale(1.05); // 减小hover缩放
            box-shadow: 0 2px 12px rgba(0, 0, 0, 0.2);
          }
          
          // 漫游按钮激活状态 - 手机端
          &.roaming-active {
            background: linear-gradient(45deg, rgba(255, 107, 107, 0.9), rgba(255, 71, 87, 0.9));
            box-shadow: 0 0 15px rgba(255, 107, 107, 0.5);
            
            &:hover {
              background: linear-gradient(45deg, rgba(255, 82, 82, 0.95), rgba(255, 55, 66, 0.95));
              transform: scale(1.05);
            }
          }
          
          // 鲸鱼按钮激活状态 - 手机端
          &.whale-active {
            background: linear-gradient(45deg, rgba(0, 191, 255, 0.9), rgba(30, 144, 255, 0.9));
            box-shadow: 0 0 15px rgba(30, 144, 255, 0.5);
            
            &:hover {
              background: linear-gradient(45deg, rgba(0, 170, 238, 0.95), rgba(28, 126, 214, 0.95));
              transform: scale(1.05);
            }
          }
          
          img {
            width: 14px; // 缩小图标内部图片
            height: 14px;
          }
        }
      }
      
      // 📱 更小屏幕的进一步优化
      @media (max-width: 480px) {
        top: 8px;
        right: 8px;
        gap: 6px;
        
        .control-btn {
          width: 28px; // 进一步缩小
          height: 28px;
          background: rgba(255, 255, 255, 0.65); // 更透明
          
          img {
            width: 12px;
            height: 12px;
          }
        }
      }
    }

    .video {
      position: absolute;
      width: 0;
      height: 0;
    }
    .control {
      height: 6%;
      position: fixed;
      bottom: 40px;
      right: 42%;
      z-index: 3;
      float: left;
    }

    .screen {
      width: 100%;
      height: 100%;
      position: fixed;
      top: 0;
      left: 0;
    }

    .left {
      width: 600px;
      height: 82%;
      position: fixed;
      top: 160px;
      left: 24px;
      z-index: 3;
    }
    .right {
      width: 600px;
      height: 82%;
      position: fixed;
      top: 160px;
      right: 24px;
      z-index: 3;
    }
    .top {
      width: 984px;
      height: 16%;
      position: fixed;
      top: 10%;
      right: 31%;
      z-index: 3;
      float: left;
    }

    .back {
      width: 48px;
      height: 16%;
      position: fixed;
      bottom: -80px;
      right: 1909px;
      z-index: 3;
      cursor: pointer;
      img {
        width: 100%;
      }
      p {
        color: #fff;
        text-align: center;
      }
    }
  }
  
  /* 🔥 新增：淡入淡出遮罩样式 */
  .fade-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: #000000;
    z-index: 9999; /* 确保在最顶层 */
    opacity: 0;
    pointer-events: none; /* 默认不可点击 */
    transition: opacity 0.4s ease-in-out;
  }

  .fade-overlay.visible {
    opacity: 1;
    pointer-events: auto; /* 可见时捕获点击事件 */
  }


</style>
<style>
  .text-3d {
    padding: 0 10px;
    background: url('./../assets/image/bed_bg.png') no-repeat;
    background-size: 100% 100%;
    color: #fff;
    font-size: 24px;
    line-height: 48px;
    text-align: center;
    cursor: pointer;
  }
  
  /* 黑白灰色系消息提示样式 */
  .dark-message {
    background-color: rgba(40, 40, 40, 0.9) !important;
    border-color: #444 !important;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3) !important;
  }
  
  .dark-message .el-message__content {
    color: #f0f0f0 !important;
    font-weight: 400 !important;
  }
  
  .dark-message .el-message__icon {
    color: #aaa !important;
  }
  
  .dark-message .el-icon-close {
    color: #999 !important;
  }
</style>
