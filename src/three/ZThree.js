import * as THREE from 'three';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader';
import { MTLLoader } from 'three/examples/jsm/loaders/MTLLoader';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader';
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js';
import TWEEN from 'three/examples/jsm/libs/tween.module.js';
import Stats from 'three/examples/jsm/libs/stats.module.js';
import nipplejs from 'nipplejs';

export default class ZThree {
  constructor(id) {
    this.id = id;
    this.el = document.getElementById(id);
    
    // 初始化键盘控制相关变量
    this.keys = {
      w: false,
      a: false,
      s: false,
      d: false
    };
    this.velocity = new THREE.Vector3();
    this.direction = new THREE.Vector3();
    this.moveSpeed = 0.0125; // 
    this.isMoving = false; // 是否正在WASD移动
    this.movementEndTimeout = null; // 移动结束延迟计时器
    
    // 虚拟摇杆相关变量
    this.joystick = null;
    this.joystickData = {
      active: false,
      x: 0,
      y: 0
    };
    
    // 🔥 第一人称控制器相关变量
    this.firstPersonControls = {
      enabled: true,
      sensitivity: 0.002,  // 鼠标灵敏度
      touchSensitivity: 0.003,  // 触摸灵敏度
      isLocked: false,
      euler: new THREE.Euler(0, 0, 0, 'YXZ'),  // 欧拉角，YXZ顺序避免万向节锁
      PI_2: Math.PI / 2,
      minPolarAngle: 0,  // 最小俯仰角（看天空）
      maxPolarAngle: Math.PI,  // 最大俯仰角（看地面）
      isMouseDown: false,
      isTouchActive: false,
      lastMouseX: 0,
      lastMouseY: 0,
      lastTouchX: 0,
      lastTouchY: 0
    };
    
    // 🔥 修复：使用时间戳来区分拖拽和点击，替代布尔标记
    this.lastDragEndTime = 0;
    
    // 🐋 第三人称视角相关变量
    this.thirdPersonMode = false; // 是否处于第三人称模式
    this.whaleModel = null; // 鲸鱼模型
    this.whaleMixer = null; // 鲸鱼动画混合器
    this.whaleAnimations = {}; // 鲸鱼动画缓存
    this.whaleAnimationClips = []; // 🔥 新增：鲸鱼动画剪辑数据（模型加载时保存）
    this.whalePosition = new THREE.Vector3(0, 1.8, 0); // 鲸鱼位置（1.8米，不遮挡画作）
    this.whaleRotation = new THREE.Euler(0, 0, 0); // 鲸鱼旋转
    this.cameraOffset = new THREE.Vector3(0, 0.7, 1.3); // 第三人称相机偏移（更近距离）
    
    // 🔥 修改：鲸鱼动画状态跟踪
    this.whaleIsMoving = false; // 鲸鱼是否正在移动
    this.whaleLastMoveTime = 0; // 最后移动时间戳
    this.whaleIdleTimeout = 500; // 停止移动后多长时间切换到空闲动画（毫秒）
    this.currentPlayingAnimations = new Set(); // 当前播放的动画名称集合
    this.thirdPersonControls = {
      enabled: false,
      sensitivity: 0.002,
      euler: new THREE.Euler(0, 0, 0, 'YXZ'),
      isMouseDown: false,
      isTouchActive: false,
      lastMouseX: 0,
      lastMouseY: 0,
      lastTouchX: 0,
      lastTouchY: 0
    };

    // 🔥 新增：用于跟踪上次报告的加载进度，防止倒退
    this.lastReportedProgress = 0;
  }

  // 初始化场景
  initThree() {
    let _this = this;
    let width = this.el.offsetWidth;
    let height = this.el.offsetHeight;
    this.scene = new THREE.Scene();
    this.textureLoader = new THREE.TextureLoader();
    this.camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    // 设置摄像头初始位置为 (0, 2.5, 0) - 固定2.5米高度
    this.camera.position.set(0, 2.5, 0);
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true
    });
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.setSize(width, height);
    
    // 修复透视问题的关键设置
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputEncoding = THREE.sRGBEncoding;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.3;
    
    // 启用深度测试和深度写入
    this.renderer.sortObjects = true;
    this.renderer.autoClear = true;
    this.renderer.autoClearColor = true;
    this.renderer.autoClearDepth = true;
    this.renderer.autoClearStencil = false;
    
    this.el.append(this.renderer.domElement);
  

    // 初始化键盘控制
    this.initKeyboardControls();
    
    // 初始化虚拟摇杆
    this.initJoystick();

    window.addEventListener(
      'resize',
      function() {
        _this.camera.aspect = _this.el.offsetWidth / _this.el.offsetHeight;
        _this.camera.updateProjectionMatrix();
        _this.renderer.setSize(_this.el.offsetWidth, _this.el.offsetHeight);
        if (_this.cssRenderer) {
          _this.cssRenderer.setSize(_this.el.offsetWidth, _this.el.offsetHeight);
        }
      },
      false
    );
  }

  // 初始化键盘控制
  initKeyboardControls() {
    const _this = this;
    
    // 键盘按下事件
    document.addEventListener('keydown', (event) => {
      // 防止重复触发
      if (event.repeat) return;
      
      // 🔥 添加调试日志
      // console.log('⌨️ 键盘按下:', event.code, '当前状态:', {
      //   isMoving: _this.isMoving,
      //   controlsEnabled: _this.controls ? _this.controls.enabled : 'N/A'
      // });
      
      switch (event.code) {
        case 'KeyW':
          _this.keys.w = true;
          _this.isMoving = true;
          break;
        case 'KeyA':
          _this.keys.a = true;
          _this.isMoving = true;
          break;
        case 'KeyS':
          _this.keys.s = true;
          _this.isMoving = true;
          break;
        case 'KeyD':
          _this.keys.d = true;
          _this.isMoving = true;
          break;
      }
      
      // 🔥 添加调试日志
      // console.log('⌨️ 键盘按下后状态:', {
      //   keys: _this.keys,
      //   isMoving: _this.isMoving
      // });
    });

    // 键盘松开事件
    document.addEventListener('keyup', (event) => {
      // 🔥 添加调试日志
      // console.log('⌨️ 键盘松开:', event.code);
      
      switch (event.code) {
        case 'KeyW':
          _this.keys.w = false;
          break;
        case 'KeyA':
          _this.keys.a = false;
          break;
        case 'KeyS':
          _this.keys.s = false;
          break;
        case 'KeyD':
          _this.keys.d = false;
          break;
      }
      
      // 检查是否所有按键都松开了
      const hasAnyKey = _this.keys.w || _this.keys.a || _this.keys.s || _this.keys.d;
      // console.log('⌨️ 松开后按键状态:', _this.keys, '还有按键:', hasAnyKey);
      
      if (!hasAnyKey) {
        // 清除之前的超时
        if (_this.movementEndTimeout) {
          clearTimeout(_this.movementEndTimeout);
        }
        
        // 🔥 修复：减少延迟时间，加快响应速度
        _this.movementEndTimeout = setTimeout(() => {
          console.log('⌨️ 键盘移动超时结束，重置状态');
          
          // 检查是否还有摇杆输入
          const hasJoystickInput = _this.joystickData.active;
          if (!hasJoystickInput) {
            _this.isMoving = false;
            console.log('⌨️ 键盘移动结束，无摇杆输入，停止移动状态');
          } else {
            console.log('⌨️ 键盘移动结束，但摇杆仍有输入，保持移动状态');
          }
          
          // 🔥 修复：不再处理OrbitControls状态，保持并存
          // 🔥 修复：不再重置观看状态，允许用户在观看画作时使用键盘
          
        }, 50); // 🔥 从100ms减少到50ms，提高响应速度
      }
    });
  }

  // 初始化虚拟摇杆
  initJoystick() {
    const _this = this;
    
    // 🔥 优化：更精确的设备检测，网页端默认显示，手机端默认隐藏
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
                     (window.innerWidth <= 768 && 'ontouchstart' in window); // 🔥 修改：同时满足小屏幕和触摸才算移动端
    
    // 创建摇杆容器
    const joystickContainer = document.createElement('div');
    joystickContainer.id = 'joystick-container';
    
    // 🔥 修改：网页版本也使用左下角位置
    const positionStyle = `
      bottom: 30px;
      left: 30px;
    `;
    
    // 🔥 修复：根据设备类型设置初始显示状态
    const initialDisplay = isMobile ? 'none' : 'block';
    
    joystickContainer.style.cssText = `
      position: fixed;
      ${positionStyle}
      width: 120px;
      height: 120px;
      z-index: 1000;
      border-radius: 50%;
      background: rgba(128, 128, 128, 0.15);
      border: 2px solid rgba(128, 128, 128, 0.4);
      backdrop-filter: blur(10px);
      box-shadow: 0 4px 15px rgba(0, 0, 0, 0.3);
      touch-action: none;
      user-select: none;
      -webkit-user-select: none;
      -webkit-touch-callout: none;
      display: ${initialDisplay};
    `;
    
    // console.log(`🎮 摇杆初始化 - 位置: 左下角, 设备: ${isMobile ? '移动端' : '网页端'}, 初始状态: ${initialDisplay}, 窗口宽度: ${window.innerWidth}px, 触摸支持: ${'ontouchstart' in window}, UserAgent: ${navigator.userAgent.includes('Mobile') ? '移动设备' : '桌面设备'}`);
    
    // 🔥 延迟确认摇杆初始化完成
    setTimeout(() => {
      console.log('✅ 摇杆初始化完成！');
      // console.log(`🎮 摇杆当前状态: ${initialDisplay === 'block' ? '显示' : '隐藏'}`);
      // console.log(`📱 设备类型: ${isMobile ? '移动端 - 摇杆默认隐藏，可通过右上角按钮显示' : '网页端 - 摇杆默认显示，可通过按钮切换'}`);
      // console.log('💡 如果摇杆无法移动，请在控制台中运行：window.app.testJoystickStatus()');
      // console.log('🚀 快速测试所有控制功能：window.app.quickTestAllControls()');
    }, 100);
    
    // 添加四个方向三角形指示器
    const triangleStyle = `
      position: absolute;
      width: 0;
      height: 0;
      border: 6px solid transparent;
      opacity: 0.6;
    `;
    
    // 上方三角形 (向上)
    const topTriangle = document.createElement('div');
    topTriangle.style.cssText = triangleStyle + `
      top: 8px;
      left: 50%;
      transform: translateX(-50%);
      border-bottom: 8px solid rgba(128, 128, 128, 0.8);
      border-top: none;
    `;
    
    // 下方三角形 (向下)
    const bottomTriangle = document.createElement('div');
    bottomTriangle.style.cssText = triangleStyle + `
      bottom: 8px;
      left: 50%;
      transform: translateX(-50%);
      border-top: 8px solid rgba(128, 128, 128, 0.8);
      border-bottom: none;
    `;
    
    // 左方三角形 (向左)
    const leftTriangle = document.createElement('div');
    leftTriangle.style.cssText = triangleStyle + `
      left: 8px;
      top: 50%;
      transform: translateY(-50%);
      border-right: 8px solid rgba(128, 128, 128, 0.8);
      border-left: none;
    `;
    
    // 右方三角形 (向右)
    const rightTriangle = document.createElement('div');
    rightTriangle.style.cssText = triangleStyle + `
      right: 8px;
      top: 50%;
      transform: translateY(-50%);
      border-left: 8px solid rgba(128, 128, 128, 0.8);
      border-right: none;
    `;
    
    // 将三角形添加到容器中
    joystickContainer.appendChild(topTriangle);
    joystickContainer.appendChild(bottomTriangle);
    joystickContainer.appendChild(leftTriangle);
    joystickContainer.appendChild(rightTriangle);
    
    // 添加到页面
    document.body.appendChild(joystickContainer);
    
    // 🔥 修改：简化窗口大小变化监听，摇杆位置保持固定
    const updateJoystickPosition = () => {
      // 摇杆位置固定在左下角，不再根据设备类型调整
        joystickContainer.style.bottom = '30px';
        joystickContainer.style.left = '30px';
        joystickContainer.style.transform = 'none';
    };
    
    window.addEventListener('resize', updateJoystickPosition);
    
    // 🔥 关键修复：阻止摇杆容器的触摸事件冒泡到 OrbitControls
    joystickContainer.addEventListener('touchstart', function(e) {
      e.preventDefault();
      e.stopPropagation(); // 阻止事件冒泡
      console.log('🔴 触摸开始:', e.touches[0] ? { x: e.touches[0].clientX, y: e.touches[0].clientY } : 'No touch');
    }, { passive: false });
    
    joystickContainer.addEventListener('touchmove', function(e) {
      e.preventDefault();
      e.stopPropagation(); // 阻止事件冒泡
      console.log('🔵 触摸移动:', e.touches[0] ? { x: e.touches[0].clientX, y: e.touches[0].clientY } : 'No touch');
    }, { passive: false });
    
    joystickContainer.addEventListener('touchend', function(e) {
      e.preventDefault();
      e.stopPropagation(); // 阻止事件冒泡
      console.log('🟢 触摸结束');
    }, { passive: false });
    
    // 🔥 添加触摸取消事件处理
    joystickContainer.addEventListener('touchcancel', function(e) {
      e.preventDefault();
      e.stopPropagation();
      console.log('🟡 触摸取消');
    }, { passive: false });
    
    // 初始化nipplejs摇杆
    this.joystick = nipplejs.create({
      zone: joystickContainer,
      mode: 'static',
      position: { left: '50%', top: '50%' },
      color: '#666666', // 深灰色
      size: 80, // 减小摇杆尺寸，给更多拖拽空间
      threshold: 0.05, // 降低阈值，让摇杆更敏感
      fadeTime: 150,
      multitouch: false,
      maxNumberOfNipples: 1,
      dataOnly: false,
      restJoystick: true,
      restOpacity: 0.6,
      lockX: false,
      lockY: false,
      catchDistance: 150, // 增加捕捉距离
      dynamicPage: true // 启用动态页面模式
    });
    
    // 摇杆开始移动
    this.joystick.on('start', function() {
      // 🔥 修复：摇杆开始时重置方向数据，准备接收移动指令
      _this.joystickData.x = 0;
      _this.joystickData.y = 0;
      _this.joystickData.active = false; // 开始时设为false，等move事件激活
      
      // console.log('🕹️ 摇杆开始 - 准备接收输入');
      
      // 🔥 修复：不再禁用OrbitControls，让摇杆和鼠标控制并存
      // 这样用户可以同时使用摇杆移动和鼠标旋转视角
    });
    
    // 摇杆移动中
    this.joystick.on('move', function(evt, data) {
      if (data.vector && data.distance > 0.05) { // 降低距离阈值，让摇杆更敏感
        // 将摇杆的向量转换为我们的控制系统
        // nipplejs的坐标系：上为负Y，下为正Y，左为负X，右为正X
        // 我们需要转换为WASD系统：W(前)为负Z，S(后)为正Z，A(左)为负X，D(右)为正X
        _this.joystickData.x = data.vector.x; // 左右移动（A/D）
        _this.joystickData.y = data.vector.y; // 前后移动（W/S），注意：向上摇杆为负值
        _this.joystickData.active = true;
        // 🔥 修复：不在move事件中设置isMoving，让updateCameraMovement方法统一处理
        // _this.isMoving = true;
        
        // 调试信息：显示摇杆数据 - 更频繁显示以便调试
        // if (Math.random() < 0.02) { // 降低日志频率
        // console.log('🕹️ 摇杆移动:', {
        //   x: data.vector.x.toFixed(3),
        //   y: data.vector.y.toFixed(3),
        //   distance: data.distance.toFixed(3),
        //   angle: data.angle ? (data.angle.degree.toFixed(1) + '°') : 'N/A',
        //   force: data.force.toFixed(3)
        // });
        // }
      } else {
        // 如果拖拽距离太小，停止移动
        _this.joystickData.x = 0;
        _this.joystickData.y = 0;
        _this.joystickData.active = false;
        // if (Math.random() < 0.02) {
        // console.log('🕹️ 摇杆距离太小，停止移动:', data.distance?.toFixed(3));
        // }
      }
    });
    
    // 摇杆停止移动
    this.joystick.on('end', function() {
      // console.log('🕹️ 摇杆结束 - 停止移动');
      
      _this.joystickData.active = false;
      _this.joystickData.x = 0;
      _this.joystickData.y = 0;
      
      // 🔥 修复：延迟停止移动状态，确保平滑过渡
      setTimeout(() => {
        // 检查是否还有其他输入（比如键盘）
        const hasKeyboardInput = _this.keys.w || _this.keys.a || _this.keys.s || _this.keys.d;
        if (!hasKeyboardInput) {
          _this.isMoving = false;
          console.log('🕹️ 摇杆移动结束，无其他输入，停止移动状态');
        } else {
          console.log('🕹️ 摇杆移动结束，但键盘仍有输入，保持移动状态');
        }
        
      
        
      }, 50);
    });
  }

  // 🔥 新增：通用的状态重置方法
  resetControllerStates() {
    console.log('🔄 开始重置所有控制器状态...');
    
    // 🔥 修复：强制重置isMoving状态，避免自动漫游结束后的卡顿
    this.isMoving = false;
    
    // 重置键盘按键状态
    if (this.keys) {
      this.keys.w = false;
      this.keys.a = false;
      this.keys.s = false;
      this.keys.d = false;
    }
    
    // 重置摇杆状态
    if (this.joystickData) {
      this.joystickData.active = false;
      this.joystickData.x = 0;
      this.joystickData.y = 0;
    }
    
    
    // 重置观看状态
    this.currentViewingPicture = null;
    this.isInViewingPosition = false;
    
    // 重置速度
    if (this.velocity) {
      this.velocity.set(0, 0, 0);
    }
    
    // 🔥 关键修复：清理移动结束定时器
    if (this.movementEndTimeout) {
      clearTimeout(this.movementEndTimeout);
      this.movementEndTimeout = null;
    }
    
    // 🔥 关键修复：重置控制器状态
    if (this.controls) {
      this.controls.enabled = true;
      this.controls.isClickLock = false; // 确保重置点击锁定状态
      
      // 🔥 修改：注释掉 reset() 调用，避免镜头位置和朝向被重置
      // if (this.controls.reset) {
      //   this.controls.reset();
      // }
      
      // 🔥 第一人称控制器不需要阻尼和目标更新
      this.controls.update();
      
      console.log('🔄 已重置controls.isClickLock = false 和内部状态，镜头保持当前位置');
    }
    
    // 🔥 新增：强制清理所有可能的拖拽状态
    this.lastDragEndTime = 0;
    this.wasLastActionDrag = false;
    
    // 🔥 新增：确保DOM事件状态正确
    setTimeout(() => {
      // 强制触发一次键盘状态检查，确保没有卡住的按键
      const hasAnyKey = this.keys.w || this.keys.a || this.keys.s || this.keys.d;
      if (!hasAnyKey && this.isMoving) {
        console.log('🔄 检测到状态不一致，强制重置isMoving');
        this.isMoving = false;
      }
    }, 100);
    
    console.log('✅ 所有控制器状态已完全重置，摇杆已恢复可用');
  }

  // 更新摄像头位置（WASD控制和虚拟摇杆控制）
  updateCameraMovement() {
    // 检查是否有按键按下或虚拟摇杆激活，没有输入就不更新
    const hasKeyboardMovement = this.keys.w || this.keys.a || this.keys.s || this.keys.d;
    const hasJoystickMovement = this.joystickData.active;
    
    // 🔥 添加详细调试日志
    // if (hasKeyboardMovement || hasJoystickMovement) {
    //   if (Math.random() < 0.1) { // 降低日志频率，避免刷屏
    //     console.log('🎮 移动检测:', {
    //       hasKeyboard: hasKeyboardMovement,
    //       hasJoystick: hasJoystickMovement,
    //       isMoving: this.isMoving,
    //       controlsEnabled: this.controls ? this.controls.enabled : 'N/A',
    //       keys: this.keys,
    //       joystickData: this.joystickData
    //     });
    //   }
    // }
    
    // 🔥 优化：如果没有任何输入且不在移动状态，直接返回，避免不必要的处理
    if (!hasKeyboardMovement && !hasJoystickMovement && !this.isMoving) {
      return;
    }
    
    // 🔥 修复：允许摇杆和键盘在任何时候都能工作，不受OrbitControls状态影响
    // 移除这个检查，因为摇杆和键盘应该独立于OrbitControls工作
    // if ((hasKeyboardMovement || hasJoystickMovement) && this.controls && !this.controls.enabled) {
    //   console.log('🎮 控制器被禁用，跳过移动处理（可能在动画中）');
    //   return;
    // }
    
    // 🔥 修复：如果没有任何输入，直接返回
    if (!hasKeyboardMovement && !hasJoystickMovement) {
      return;
    }

    // 🔥 修复：只在开始移动时才设置isMoving状态，但不禁用OrbitControls
    if (!this.isMoving) {
      this.isMoving = true;
      // 🔥 修复：不再禁用OrbitControls，让摇杆和键盘与鼠标控制并存
      // console.log('🎮 开始移动（WASD/摇杆）');
    }

    // 使用更平滑的阻尼系数
    const damping = 0.8;
    this.velocity.multiplyScalar(damping);

    // 计算方向向量：合并键盘输入和虚拟摇杆输入
    let directionZ = 0;
    let directionX = 0;
    
    // 键盘输入
    if (hasKeyboardMovement) {
      directionZ = Number(this.keys.w) - Number(this.keys.s); // W前进，S后退
      directionX = Number(this.keys.d) - Number(this.keys.a); // D右移，A左移
    }
    
    // 虚拟摇杆输入（如果摇杆激活，优先使用摇杆输入）
    if (hasJoystickMovement) {
      directionZ = this.joystickData.y; // 前后移动（向上摇杆为前进）
      directionX = this.joystickData.x; // 左右移动
      
      // 调试信息：显示处理后的方向
      // if (Math.random() < 0.05) { // 降低日志频率
      //   console.log('🎮 摇杆方向处理:', {
      //     原始数据: { x: this.joystickData.x.toFixed(3), y: this.joystickData.y.toFixed(3) },
      //     处理后: { directionX: directionX.toFixed(3), directionZ: directionZ.toFixed(3) }
      //   });
      // }
    }
    
    this.direction.z = directionZ;
    this.direction.x = directionX;
    this.direction.normalize();

    // 应用移动速度到速度向量
    if (hasKeyboardMovement) {
      if (this.keys.w || this.keys.s) this.velocity.z += this.direction.z * this.moveSpeed;
      if (this.keys.a || this.keys.d) this.velocity.x += this.direction.x * this.moveSpeed;
    }
    
    if (hasJoystickMovement) {
      // 虚拟摇杆的移动强度基于摇杆偏移量
      this.velocity.z += this.direction.z * this.moveSpeed;
      this.velocity.x += this.direction.x * this.moveSpeed;
    }

    // 🔥 添加速度调试
    // if (Math.random() < 0.05) {
    //   console.log('🎮 计算后的速度:', {
    //     velocity: { x: this.velocity.x.toFixed(4), z: this.velocity.z.toFixed(4) },
    //     direction: { x: this.direction.x.toFixed(3), z: this.direction.z.toFixed(3) }
    //   });
    // }

    // 🐋 第三人称模式：移动鲸鱼而不是相机，使用相机视角作为参考
    if (this.thirdPersonMode && this.whaleModel) {
      // 🔥 修改：使用相机视角方向计算移动方向（而不是鲸鱼朝向）
      const cameraDirection = new THREE.Vector3();
      
      // 从第三人称控制器的欧拉角计算相机方向
      const tempMatrix = new THREE.Matrix4();
      tempMatrix.makeRotationFromEuler(this.thirdPersonControls.euler);
      cameraDirection.set(0, 0, 1).applyMatrix4(tempMatrix);
      cameraDirection.y = 0; // 只保留水平方向
      cameraDirection.normalize();
      
      // 计算相机的右方向向量
      const cameraRight = new THREE.Vector3();
      cameraRight.crossVectors(cameraDirection, new THREE.Vector3(0, 1, 0)).normalize();
      
      // 根据相机视角计算移动向量
      const moveVector = new THREE.Vector3();
      moveVector.addScaledVector(cameraDirection, this.velocity.z); // 前后移动（按相机视角）
      moveVector.addScaledVector(cameraRight, this.velocity.x); // 左右移动（相对相机）
      
      // 🔥 增强：使用鲸鱼位置进行碰撞检测，增加安全边距
      const targetPosition = new THREE.Vector3(
        this.whalePosition.x + moveVector.x,
        this.whalePosition.y,
        this.whalePosition.z + moveVector.z
      );
      
      // 🐋 鲸鱼需要更严格的碰撞检测，考虑鲸鱼的体积
      if (this.checkWhaleCollision(this.whalePosition, targetPosition)) {
        // 移动鲸鱼
        this.whalePosition.x += moveVector.x;
        this.whalePosition.z += moveVector.z;
        this.whaleModel.position.copy(this.whalePosition);
        
        // 🔥 新增：鲸鱼朝向跟随移动方向和动画控制
        if (moveVector.length() > 0.001) {
          // 计算鲸鱼应该面向的方向（移动方向）
          const targetRotation = Math.atan2(moveVector.x, moveVector.z);
          
          // 平滑旋转到目标角度
          const currentRotation = this.whaleModel.rotation.y;
          let rotationDiff = targetRotation - currentRotation;
          
          // 处理角度跨越问题（-π到π的跳跃）
          if (rotationDiff > Math.PI) rotationDiff -= 2 * Math.PI;
          if (rotationDiff < -Math.PI) rotationDiff += 2 * Math.PI;
          
          // 平滑插值旋转
          this.whaleModel.rotation.y += rotationDiff * 0.1;
          this.whaleRotation.y = this.whaleModel.rotation.y;
          
          // 🔥 优化：智能动画播放控制
          this.startWhaleMovementAnimation();
          
          // 记录移动状态
          this.whaleLastMoveTime = Date.now();
        }
      }
    } else {
      // 第一人称模式：移动相机，使用相机朝向

    // 获取摄像头的方向向量，但只使用水平方向（忽略Y轴旋转）
    const cameraDirection = new THREE.Vector3();
    this.camera.getWorldDirection(cameraDirection);
    // 将Y分量设为0，只保留水平方向
    cameraDirection.y = 0;
    cameraDirection.normalize();
    
    // 计算右方向向量（也是水平的）
    const right = new THREE.Vector3();
    right.crossVectors(cameraDirection, new THREE.Vector3(0, 1, 0)).normalize();
    
    // 保存当前的Y位置
    const fixedY = 2.5; // 将Y位置固定为2.5米
    
    // 根据摄像头朝向计算移动向量（只在水平面移动）
    const moveVector = new THREE.Vector3();
    moveVector.addScaledVector(cameraDirection, this.velocity.z);
    moveVector.addScaledVector(right, this.velocity.x);
    
    const targetPosition = new THREE.Vector3(
      this.camera.position.x + moveVector.x,
      fixedY,
      this.camera.position.z + moveVector.z
    );
    
    if (this.checkCollision(this.camera.position, targetPosition)) {
        // 只更新X和Z位置，强制保持Y位置为2.5米
      // const oldPosition = this.camera.position.clone(); // 🔥 已移除未使用的变量
      this.camera.position.x += moveVector.x;
      this.camera.position.z += moveVector.z;
        this.camera.position.y = fixedY; // 强制锁定Y位置为2.5米

      // 🔥 添加移动调试
      // if (Math.random() < 0.05) {
      //   console.log('🎮 相机移动:', {
      //     from: { x: oldPosition.x.toFixed(3), z: oldPosition.z.toFixed(3) },
      //     to: { x: this.camera.position.x.toFixed(3), z: this.camera.position.z.toFixed(3) },
      //     moveVector: { x: moveVector.x.toFixed(4), z: moveVector.z.toFixed(4) }
      //   });
      // }

      // 🔥 第一人称控制器移动后不需要更新target
    } else {
      // 🔥 添加碰撞调试
      // if (Math.random() < 0.1) {
      //   console.log('🚫 移动被碰撞检测阻止');
      // }
      }
    }
  }

  // 🐋 鲸鱼专用碰撞检测方法 - 更严格的安全距离
  checkWhaleCollision(currentPos, targetPos) {
    // 如果没有场景或模型，允许移动
    if (!this.scene || !this.rayModel) {
      return true;
    }

    // 创建射线检测器
    if (!this.whaleCollisionRaycaster) {
      this.whaleCollisionRaycaster = new THREE.Raycaster();
    }

    // 计算移动方向和距离
    const moveDirection = new THREE.Vector3().subVectors(targetPos, currentPos);
    const moveDistance = moveDirection.length();
    
    // 如果移动距离太小，直接允许
    if (moveDistance < 0.001) {
      return true;
    }
    
    moveDirection.normalize();
    
    // 获取需要检测碰撞的物体
    const collisionObjects = [];
    this.rayModel.forEach(obj => {
      const name = obj.name;
      if (name && (
        name === 'G-Object353_1' || 
        name === 'G-Object353_3' ||
        name === 'G-Object353' ||
        name === 'C-组件#1' ||
        name === 'C-组件#1_1' ||
        name === 'C-组件#1_2' ||
        name === 'G-Object002_2' ||
        name === '墙004' ||
        name.includes('wall') || 
        name.includes('Wall') 
      )) {
        collisionObjects.push(obj);
      }
    });

    if (collisionObjects.length === 0) {
      return true; // 没有可碰撞的物体
    }
    
    // 🐋 鲸鱼需要多方向检测，确保不会卡在墙角
    const checkDirections = [
      moveDirection.clone(), // 主要移动方向
      new THREE.Vector3(moveDirection.x + 0.2, 0, moveDirection.z).normalize(), // 稍微偏右
      new THREE.Vector3(moveDirection.x - 0.2, 0, moveDirection.z).normalize(), // 稍微偏左
    ];
    
    for (const direction of checkDirections) {
      this.whaleCollisionRaycaster.set(currentPos, direction);
      const intersects = this.whaleCollisionRaycaster.intersectObjects(collisionObjects, true);

      if (intersects.length > 0) {
        const hitObject = intersects[0].object;
        const hitDistance = intersects[0].distance;
        
        // 🐋 鲸鱼需要更大的安全距离，考虑鲸鱼的体积
        const safetyDistance = hitObject.name === 'C-组件#1_1' ? 1.0 : 2.0; // 比普通碰撞检测更大的安全距离
        
        // 如果撞到了，且距离小于安全距离，则阻止移动
        if (hitDistance < safetyDistance) {
          return false;
        }
      }
    }

    // 允许移动
    return true;
  }

  // 智能碰撞检测方法 - 性能优化版（第一人称用）
  checkCollision(currentPos, targetPos) {
    // 如果没有场景或模型，允许移动
    if (!this.scene || !this.rayModel) {
      return true;
    }

    // 创建射线检测器
    if (!this.collisionRaycaster) {
      this.collisionRaycaster = new THREE.Raycaster();
    }

    // 计算移动方向和距离
    const moveDirection = new THREE.Vector3().subVectors(targetPos, currentPos);
    const moveDistance = moveDirection.length();
    
    // 如果移动距离太小，直接允许
    if (moveDistance < 0.001) {
      return true;
    }
    
    moveDirection.normalize();
    
    // 获取需要检测碰撞的物体
    const collisionObjects = [];
    this.rayModel.forEach(obj => {
      const name = obj.name;
      if (name && (
        name === 'G-Object353_1' || 
        name === 'G-Object353_3' ||
        name === 'G-Object353' ||
        name === 'C-组件#1' ||
        name === 'C-组件#1_1' ||
        name === 'C-组件#1_2' ||
        name === 'G-Object002_2' ||
        name === '墙004' ||
        name.includes('wall') || 
        name.includes('Wall') 
     
      )) {
        collisionObjects.push(obj);
      }
    });

    if (collisionObjects.length === 0) {
      return true; // 没有可碰撞的物体
    }
    
    // 🔥 性能优化：只向移动方向投射一条射线
    this.collisionRaycaster.set(currentPos, moveDirection);
    const intersects = this.collisionRaycaster.intersectObjects(collisionObjects, true);

    if (intersects.length > 0) {
      const hitObject = intersects[0].object;
      const hitDistance = intersects[0].distance;
      
      // 根据碰到的物体，决定安全距离
      const safetyDistance = hitObject.name === 'C-组件#1_1' ? 0.5 : 1.5;
      
      // 如果撞到了，且距离小于安全距离，则阻止移动
      if (hitDistance < safetyDistance) {
        // if (Math.random() < 0.1) { // 降低日志频率
        //   console.log(`🚫 阻止移动 - 撞到 ${hitObject.name}, 距离: ${hitDistance.toFixed(2)}, 安全距离: ${safetyDistance}`);
        // }
        return false;
      }
    }

    // 允许移动
    return true;
  }

  // 启用/禁用WASD控制
  enableWASDControl(enable = true) {
    this.wasdEnabled = enable;
  }

  // 重新启用OrbitControls
  enableOrbitControls() {
    if (this.controls) {
      this.controls.enabled = true;
    }
  }

  // 🔥 新增：确保摇杆可见和可用的工具方法
  ensureJoystickVisible() {
    const joystickContainer = document.getElementById('joystick-container');
    if (joystickContainer) {
      joystickContainer.style.display = 'block';
      joystickContainer.style.visibility = 'visible';
      joystickContainer.style.opacity = '1';
      console.log('🎮 摇杆容器已确保可见');
    }
    
    // 确保摇杆本身处于可用状态
    if (this.joystick) {
      try {
        this.joystick.options.disabled = false;
        console.log('🎮 摇杆功能已确保启用');
      } catch (error) {
        console.warn('⚠️ 摇杆状态确认时出现警告:', error);
      }
    }
  }

  // 🔥 新增：测试摇杆状态的方法
  testJoystickStatus() {
    const joystickContainer = document.getElementById('joystick-container');
    console.log('🧪 摇杆状态测试开始...');
    
    // 检查摇杆容器状态
    if (joystickContainer) {
      console.log('📋 摇杆容器状态:', {
        display: joystickContainer.style.display,
        visibility: joystickContainer.style.visibility,
        opacity: joystickContainer.style.opacity,
        offsetWidth: joystickContainer.offsetWidth,
        offsetHeight: joystickContainer.offsetHeight,
        isVisible: joystickContainer.offsetWidth > 0 && joystickContainer.offsetHeight > 0
      });
    } else {
      console.log('❌ 摇杆容器未找到');
    }
    
    // 检查nipplejs摇杆状态
    if (this.joystick) {
      console.log('📋 nipplejs摇杆状态:', {
        exists: !!this.joystick,
        disabled: this.joystick.options?.disabled,
        options: this.joystick.options
      });
    } else {
      console.log('❌ nipplejs摇杆未初始化');
    }
    
    // 检查摇杆数据状态
    console.log('📋 摇杆数据状态:', {
      active: this.joystickData.active,
      x: this.joystickData.x,
      y: this.joystickData.y
    });
    
    // 检查相关控制状态
    console.log('📋 相关控制状态:', {
      isMoving: this.isMoving,
      controlsEnabled: this.controls ? this.controls.enabled : 'N/A'
    });
    
    console.log('🧪 摇杆状态测试完成！');
    
    // 🔥 新增：提供控制台测试指南
    console.log('💡 测试提示：');
    console.log('- 可以在控制台中调用 window.app.testJoystickStatus() 测试摇杆状态');
    console.log('- 可以在控制台中调用 window.app.joystickData 查看实时摇杆数据');
    console.log('- 尝试操作摇杆，观察 joystickData.active 是否变为 true');
    console.log('- 检查摇杆容器是否可见：document.getElementById("joystick-container").style.display');
    console.log('- 🆕 如果控制有问题，可以调用 window.app.reinitializeAllControls() 重新初始化所有控制');
    console.log('- 🆕 单独重新初始化键盘：window.app.reinitializeKeyboardControls()');
    console.log('- 🆕 单独重新初始化摇杆：window.app.reinitializeJoystickControls()');
    console.log('- 🚀 快速测试所有控制功能：window.app.quickTestAllControls()');
  }

  // 🔥 新增：重新初始化键盘控制
  reinitializeKeyboardControls() {
    console.log('🔄 开始重新初始化键盘控制...');
    
    // 重置所有键盘状态
    this.keys = {
      w: false,
      a: false,
      s: false,
      d: false
    };
    
    // 重置移动状态
    this.isMoving = false;
    
    // 清理旧的定时器
    if (this.movementEndTimeout) {
      clearTimeout(this.movementEndTimeout);
      this.movementEndTimeout = null;
    }
    
    // 重置速度
    if (this.velocity) {
      this.velocity.set(0, 0, 0);
    }
    
    // 强制清理任何可能卡住的键盘状态
    setTimeout(() => {
      // 模拟按键松开事件，确保清理任何可能的残留状态
      document.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyW' }));
      document.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyA' }));
      document.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyS' }));
      document.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyD' }));
    }, 50);
    
    console.log('✅ 键盘控制重新初始化完成');
  }

  // 🔥 新增：重新初始化摇杆控制
  reinitializeJoystickControls() {
    console.log('🔄 开始重新初始化摇杆控制...');
    
    // 重置摇杆数据
    this.joystickData = {
      active: false,
      x: 0,
      y: 0
    };
    
    // 检查摇杆容器
    const joystickContainer = document.getElementById('joystick-container');
    if (joystickContainer) {
      // 确保摇杆容器状态正确
      const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
                       (window.innerWidth <= 768) || 
                       ('ontouchstart' in window);
      
      const correctDisplay = isMobile ? 'none' : 'block';
      joystickContainer.style.display = correctDisplay;
      joystickContainer.style.visibility = 'visible';
      joystickContainer.style.opacity = '1';
      
      console.log('🎮 摇杆容器状态已重置:', {
        display: joystickContainer.style.display,
        device: isMobile ? '移动端' : '网页端'
      });
    } else {
      console.warn('⚠️ 摇杆容器未找到，可能需要重新创建');
    }
    
    // 检查nipplejs摇杆实例
    if (this.joystick) {
      try {
        // 重置摇杆选项
        this.joystick.options.disabled = false;
        
        // 强制重置摇杆内部状态
        if (this.joystick.manager && this.joystick.manager.nipples) {
          Object.values(this.joystick.manager.nipples).forEach(nipple => {
            if (nipple.ui && nipple.ui.el) {
              nipple.ui.el.style.transform = '';
            }
          });
        }
        
        console.log('🎮 nipplejs摇杆状态已重置');
      } catch (error) {
        console.warn('⚠️ 重置nipplejs摇杆时出现警告:', error);
      }
    } else {
      console.warn('⚠️ nipplejs摇杆实例不存在，可能需要重新初始化');
    }
    
    console.log('✅ 摇杆控制重新初始化完成');
  }

  // 🔥 新增：完整的控制重新初始化方法
  reinitializeAllControls() {
    console.log('🔄 开始完整的控制重新初始化...');
    
    // 1. 重新初始化键盘控制
    this.reinitializeKeyboardControls();
    
    // 2. 重新初始化摇杆控制
    this.reinitializeJoystickControls();
    
    // 3. 重置控制器状态
    this.resetControllerStates();
    
    // 4. 延迟确认所有控制正常工作
    setTimeout(() => {
      console.log('🧪 执行控制状态最终检查...');
      
      // 检查键盘状态
      const keyboardOK = this.keys && !this.keys.w && !this.keys.a && !this.keys.s && !this.keys.d;
      
      // 检查摇杆状态
      const joystickOK = this.joystickData && !this.joystickData.active && 
                        this.joystickData.x === 0 && this.joystickData.y === 0;
      
      // 检查控制器状态
      const controlsOK = this.controls && this.controls.enabled;
      
      console.log('🎮 控制状态检查结果:', {
        键盘状态: keyboardOK ? '✅ 正常' : '❌ 异常',
        摇杆状态: joystickOK ? '✅ 正常' : '❌ 异常',
        控制器状态: controlsOK ? '✅ 正常' : '❌ 异常',
        移动状态: this.isMoving ? '🔄 移动中' : '✅ 静止'
      });
      
      if (keyboardOK && joystickOK && controlsOK) {
        console.log('🎉 所有控制重新初始化成功！键盘和摇杆现在应该可以正常工作了');
      } else {
        console.warn('⚠️ 部分控制状态可能仍有问题，请检查上述状态');
      }
    }, 200);
    
    console.log('✅ 完整的控制重新初始化流程已启动');
  }

  // 🔥 新增：快速测试所有控制功能
  quickTestAllControls() {
    console.log('🚀 开始快速测试所有控制功能...');
    
    // 1. 测试键盘状态
    console.log('1️⃣ 测试键盘控制:');
    const keyboardStatus = {
      状态对象存在: !!this.keys,
      W键状态: this.keys ? this.keys.w : 'N/A',
      A键状态: this.keys ? this.keys.a : 'N/A',
      S键状态: this.keys ? this.keys.s : 'N/A',
      D键状态: this.keys ? this.keys.d : 'N/A',
      移动状态: this.isMoving,
      速度向量: this.velocity ? `(${this.velocity.x.toFixed(3)}, ${this.velocity.y.toFixed(3)}, ${this.velocity.z.toFixed(3)})` : 'N/A'
    };
    console.table(keyboardStatus);
    
    // 2. 测试摇杆状态
    console.log('2️⃣ 测试摇杆控制:');
    const joystickStatus = {
      数据对象存在: !!this.joystickData,
      激活状态: this.joystickData ? this.joystickData.active : 'N/A',
      X轴数据: this.joystickData ? this.joystickData.x.toFixed(3) : 'N/A',
      Y轴数据: this.joystickData ? this.joystickData.y.toFixed(3) : 'N/A',
      摇杆实例存在: !!this.joystick,
      摇杆被禁用: this.joystick ? this.joystick.options?.disabled : 'N/A'
    };
    console.table(joystickStatus);
    
    // 3. 测试摇杆容器
    console.log('3️⃣ 测试摇杆容器:');
    const joystickContainer = document.getElementById('joystick-container');
    const containerStatus = {
      容器存在: !!joystickContainer,
      显示状态: joystickContainer ? joystickContainer.style.display : 'N/A',
      可见性: joystickContainer ? joystickContainer.style.visibility : 'N/A',
      透明度: joystickContainer ? joystickContainer.style.opacity : 'N/A',
      实际宽度: joystickContainer ? joystickContainer.offsetWidth + 'px' : 'N/A',
      实际高度: joystickContainer ? joystickContainer.offsetHeight + 'px' : 'N/A',
      是否可见: joystickContainer ? (joystickContainer.offsetWidth > 0 && joystickContainer.offsetHeight > 0) : 'N/A'
    };
    console.table(containerStatus);
    
    // 4. 测试OrbitControls
    console.log('4️⃣ 测试OrbitControls:');
    const controlsStatus = {
      控制器存在: !!this.controls,
      已启用: this.controls ? this.controls.enabled : 'N/A',
      点击锁定: this.controls ? this.controls.isClickLock : 'N/A',
      阻尼已启用: this.controls ? this.controls.enableDamping : 'N/A',
      阻尼系数: this.controls ? this.controls.dampingFactor : 'N/A',
      缩放已启用: this.controls ? this.controls.enableZoom : 'N/A',
      旋转已启用: this.controls ? this.controls.enableRotate : 'N/A'
    };
    console.table(controlsStatus);
    
    // 5. 提供测试建议
    console.log('5️⃣ 测试建议:');
    console.log('📝 请按以下步骤测试控制功能：');
    console.log('   1. 尝试按住 W/A/S/D 键，观察控制台是否有移动日志');
    console.log('   2. 尝试操作摇杆（如果可见），观察是否有摇杆移动日志');
    console.log('   3. 尝试拖动鼠标旋转视角，观察是否正常');
    console.log('   4. 如果有问题，可以运行 window.app.reinitializeAllControls() 重新初始化');
    
    // 6. 自动诊断
    console.log('6️⃣ 自动诊断结果:');
    const diagnostics = [];
    
    if (!this.keys) {
      diagnostics.push('❌ 键盘状态对象不存在');
    } else if (this.keys.w || this.keys.a || this.keys.s || this.keys.d) {
      diagnostics.push('⚠️ 检测到键盘按键可能卡住');
    }
    
    if (!this.joystickData) {
      diagnostics.push('❌ 摇杆数据对象不存在');
    } else if (this.joystickData.active) {
      diagnostics.push('⚠️ 摇杆处于激活状态（可能正在使用中）');
    }
    
    if (!joystickContainer) {
      diagnostics.push('❌ 摇杆容器不存在');
    } else if (joystickContainer.style.display === 'none') {
      diagnostics.push('ℹ️ 摇杆容器被隐藏（可能是移动端）');
    }
    
    if (!this.controls) {
      diagnostics.push('❌ OrbitControls 不存在');
    } else if (!this.controls.enabled) {
      diagnostics.push('⚠️ OrbitControls 被禁用');
    }
    
    if (diagnostics.length === 0) {
      console.log('✅ 所有控制功能状态正常！');
    } else {
      console.log('🔍 发现以下问题：');
      diagnostics.forEach(item => console.log('   ' + item));
    }
    
    console.log('🎉 快速测试完成！');
  }

  initLight() {
    // 环境光 - 提供基础照明
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    this.scene.add(ambientLight);
    
    // 主方向光 - 适中强度，避免过曝
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.3);
    directionalLight.position.set(10, 10, 5);
    directionalLight.target.position.set(0, 0, 0);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 1024;
    directionalLight.shadow.mapSize.height = 1024;
    directionalLight.shadow.camera.near = 0.5;
    directionalLight.shadow.camera.far = 50;
    this.scene.add(directionalLight);
    this.scene.add(directionalLight.target);
    
    // 补充光源 - 柔和的补光
    const fillLight = new THREE.DirectionalLight(0xffffff, 0.15);
    fillLight.position.set(-5, 8, -3);
    fillLight.target.position.set(0, 0, 0);
    this.scene.add(fillLight);
  }

  // 初始化helper
  initHelper() {
    this.axesHelper = new THREE.AxesHelper(100);
    this.scene.add(this.axesHelper);
  }

  // 切换坐标轴显示状态
  toggleAxesHelper(visible) {
    if (this.axesHelper) {
      if (visible === undefined) {
        this.axesHelper.visible = !this.axesHelper.visible;
      } else {
        this.axesHelper.visible = visible;
      }
    }
  }

  // 🔥 初始化第一人称控制器（替换OrbitControls）
  initFirstPersonControls() {
    const controls = this.firstPersonControls;
    
    // 检测移动设备
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
                     (window.innerWidth <= 768) || 
                     ('ontouchstart' in window);
                     
    if (isMobile) {
      controls.touchSensitivity = 0.002;
      console.log('📱 检测到移动设备，启用触摸优化');
    }
    
    // 从相机当前朝向初始化欧拉角
    controls.euler.setFromQuaternion(this.camera.quaternion);
    
    // 🔥 鼠标控制事件
    this.renderer.domElement.addEventListener('mousedown', (event) => {
      if (event.button === 0 && controls.enabled) {
        controls.isMouseDown = true;
        controls.lastMouseX = event.clientX;
        controls.lastMouseY = event.clientY;
        console.log('🖱️ 开始第一人称旋转');
      }
    });
    
    this.renderer.domElement.addEventListener('mousemove', (event) => {
      if (controls.isMouseDown && controls.enabled) {
        const deltaX = event.clientX - controls.lastMouseX;
        const deltaY = event.clientY - controls.lastMouseY;
        
        // 更新欧拉角 - 真正的第一人称旋转
        controls.euler.y -= deltaX * controls.sensitivity;
        controls.euler.x -= deltaY * controls.sensitivity;
        
        // 限制垂直旋转角度
        controls.euler.x = Math.max(
          controls.minPolarAngle - controls.PI_2,
          Math.min(controls.maxPolarAngle - controls.PI_2, controls.euler.x)
        );
        
        // 应用旋转到相机（相机位置不变，只改变朝向）
        this.camera.quaternion.setFromEuler(controls.euler);
        
        controls.lastMouseX = event.clientX;
        controls.lastMouseY = event.clientY;
        this.lastDragEndTime = Date.now();
      }
    });
    
    this.renderer.domElement.addEventListener('mouseup', (event) => {
      if (event.button === 0) {
        controls.isMouseDown = false;
        console.log('🖱️ 结束第一人称旋转');
      }
    });
    
    // 🔥 触摸控制事件
    this.renderer.domElement.addEventListener('touchstart', (event) => {
      if (event.touches.length === 1 && controls.enabled) {
        event.preventDefault();
        controls.isTouchActive = true;
        controls.lastTouchX = event.touches[0].clientX;
        controls.lastTouchY = event.touches[0].clientY;
        console.log('👆 开始第一人称触摸旋转');
      }
    }, { passive: false });
    
    this.renderer.domElement.addEventListener('touchmove', (event) => {
      if (controls.isTouchActive && event.touches.length === 1 && controls.enabled) {
        event.preventDefault();
        
        const deltaX = event.touches[0].clientX - controls.lastTouchX;
        const deltaY = event.touches[0].clientY - controls.lastTouchY;
        
        // 更新欧拉角 - 真正的第一人称旋转
        controls.euler.y -= deltaX * controls.touchSensitivity;
        controls.euler.x -= deltaY * controls.touchSensitivity;
        
        // 限制垂直旋转角度
        controls.euler.x = Math.max(
          controls.minPolarAngle - controls.PI_2,
          Math.min(controls.maxPolarAngle - controls.PI_2, controls.euler.x)
        );
        
        // 应用旋转到相机（相机位置不变，只改变朝向）
        this.camera.quaternion.setFromEuler(controls.euler);
        
        controls.lastTouchX = event.touches[0].clientX;
        controls.lastTouchY = event.touches[0].clientY;
        this.lastDragEndTime = Date.now();
      }
    }, { passive: false });
    
    this.renderer.domElement.addEventListener('touchend', () => {
      if (controls.isTouchActive) {
        controls.isTouchActive = false;
        console.log('👆 结束第一人称触摸旋转');
      }
    }, { passive: false });
    
    this.renderer.domElement.addEventListener('touchcancel', () => {
      if (controls.isTouchActive) {
        controls.isTouchActive = false;
        console.log('👆 取消第一人称触摸旋转');
      }
    }, { passive: false });
    
    // 阻止滚轮事件
    this.renderer.domElement.addEventListener('wheel', (event) => {
      event.preventDefault();
      event.stopPropagation();
    }, { passive: false });
    
    // 🔥 创建兼容性控制器对象
    const compatControls = {
      enabled: true,
      isClickLock: false,
      target: new THREE.Vector3(0, 0, 0), // 兼容性target（第一人称不使用，但保留接口）
      update: () => {},
      addEventListener: (type) => {
        console.log(`🎮 第一人称控制器事件监听: ${type}`);
      },
      reset: () => {
        controls.euler.set(0, 0, 0);
        this.camera.quaternion.setFromEuler(controls.euler);
        console.log('🔄 重置第一人称控制器');
      }
    };

    this.controls = compatControls;
    this.updateControlsTarget = () => {}; // 兼容性函数
    
    console.log('🎮 第一人称控制器初始化完成');
  }

  // 初始化status
  initStatus() {
    this.stats = new Stats();
    this.el.appendChild(this.stats.dom);
  }

  // 初始化射线
  initRaycaster(callback, models = this.scene.children) {
    this.raycaster = new THREE.Raycaster();

    // 🔥 触摸设备支持：同时监听点击和触摸事件
    const handlePointerEvent = (evt) => {
      // 🔥 修复：拖拽结束后立即发生的点击/触摸应该被忽略
      if (Date.now() - this.lastDragEndTime < 100) {
        console.log(`🚫 拖拽结束后立即发生的 ${evt.type}，已跳过`);
        return;
      }

      // 🔥 添加调试信息
      // console.log('🖱️ 检测到指针事件:', evt.type);
      
      // console.log('✅ 执行点击事件处理');
      
      // 获取canvas元素的边界信息
      const rect = this.renderer.domElement.getBoundingClientRect();
      
      // 🔥 兼容触摸和鼠标事件的坐标计算
      let clientX, clientY;
      
      if (evt.type === 'touchend' && evt.changedTouches && evt.changedTouches.length > 0) {
        // 触摸事件：使用 changedTouches
        clientX = evt.changedTouches[0].clientX;
        clientY = evt.changedTouches[0].clientY;
        // console.log('📱 触摸事件坐标:', { x: clientX, y: clientY });
      } else {
        // 鼠标事件：使用 clientX/clientY
        clientX = evt.clientX;
        clientY = evt.clientY;
        // console.log('🖱️ 鼠标事件坐标:', { x: clientX, y: clientY });
      }
      
      // 修正坐标计算，使用canvas的相对位置
      let mouse = {
        x: ((clientX - rect.left) / rect.width) * 2 - 1,
        y: -((clientY - rect.top) / rect.height) * 2 + 1
      };
      
      // console.log('🎯 标准化坐标:', mouse);

      let activeObj = this.fireRaycaster(mouse, models);
      
      if (activeObj) {
        // console.log('🎯 射线命中对象:', activeObj.object.name || '未命名对象');
      } else {
        // console.log('🎯 射线未命中任何对象');
      }
      
      if (callback) {
        callback(activeObj, this, evt, mouse);
      }

      //鼠标的变换
      document.body.style.cursor = 'pointer';
    };

    // 🔥 同时绑定鼠标点击事件和触摸结束事件
    this.el.addEventListener('click', handlePointerEvent);
    this.el.addEventListener('touchend', handlePointerEvent);
    
    console.log('🎯 射线检测器已初始化，支持鼠标和触摸事件');
  }

  // 返回选中物体
  fireRaycaster(pointer, models) {
    // 使用一个新的原点和方向来更新射线
    this.raycaster.setFromCamera(pointer, this.camera);

    let intersects = this.raycaster.intersectObjects(models, true);
    //
    if (intersects.length > 0) {
      let selectedObject = intersects[0];
      return selectedObject;
    } else {
      return false;
    }
  }

  loaderModel(option) {
    switch (option.type) {
      case 'obj':
        if (!this.objLoader) {
          this.objLoader = new OBJLoader();
        }
        if (!this.mtlLoader) {
          this.mtlLoader = new MTLLoader();
        }
        this.mtlLoader.load(option.mtlUrl || '', (materials) => {
          materials.preload();
          this.objLoader
            .setMaterials(materials)
            .load(option.url, option.onLoad, option.onProgress, option.onError);
        });
        break;

      case 'gltf':
      case 'glb':
        if (!this.gltfLoader) {
          this.gltfLoader = new GLTFLoader();
          let dracoLoader = new DRACOLoader();
          dracoLoader.setDecoderPath('draco/');
          this.gltfLoader.setDRACOLoader(dracoLoader);
        }
        this.gltfLoader.load(option.url, option.onLoad, option.onProgress, option.onError);
        break;

      case 'fbx':
        if (!this.fbxLoader) {
          this.fbxLoader = new FBXLoader();
        }
        this.fbxLoader.load(option.url, option.onLoad, option.onProgress, option.onError);
        break;

      case 'rgbe':
        if (!this.rgbeLoader) {
          this.rgbeLoader = new RGBELoader();
        }
        this.rgbeLoader.load(option.url, option.onLoad, option.onProgress, option.onError);
        break;

      case 'mp3':
      case 'wav':
        if (!this.audioaLoader) {
          this.audioaLoader = new THREE.AudioLoader();
        }
        this.audioaLoader.load(option.url, option.onLoad, option.onProgress, option.onError);
        break;

      default:
        console.error('当前只支持obj, gltf, glb, fbx, rgbe格式');
        break;
    }
  }

  // 迭代加载
  iterateLoad(objFileList, onProgress, onAllLoad) {
    let fileIndex = 0;
    let that = this;

    // 🔥 新增：跟踪每个文件的加载进度 (0-1)
    const fileProgress = new Array(objFileList.length).fill(0);

    function iterateLoadForIt() {
      that.loaderModel({
        type: objFileList[fileIndex].type,
        dracoUrl: objFileList[fileIndex].dracoUrl,
        mtlUrl: objFileList[fileIndex].mtlUrl,
        url: objFileList[fileIndex].url,
        onLoad: function(object) {
          if (objFileList[fileIndex].onLoad) objFileList[fileIndex].onLoad(object);
          
          // 🔥 确保当前文件进度达到100%
          fileProgress[fileIndex] = 1; 
          that.updateOverallProgress(objFileList.length, fileProgress, onProgress);

          fileIndex++;
          if (fileIndex < objFileList.length) {
            iterateLoadForIt();
          } else {
            if (onAllLoad) onAllLoad();
            // 🔥 所有文件加载完成后，确保进度显示100%
            window.EventBus.$emit('changeLoaidng', 100); // 强制发送100%
          }
        },
        onProgress: function(xhr) {
          if (xhr.lengthComputable) {
            // 🔥 更新当前文件的进度百分比 (0-1)
            fileProgress[fileIndex] = xhr.loaded / xhr.total;
            that.updateOverallProgress(objFileList.length, fileProgress, onProgress);
          }
          if (objFileList[fileIndex].onProgress) objFileList[fileIndex].onProgress(xhr, fileIndex);
        },
        onError: function(error) {
            console.error('❌ 模型加载失败:', objFileList[fileIndex].url, error);
            // 🔥 即使加载失败，也将其标记为完成（或某种错误状态），避免卡住进度
            fileProgress[fileIndex] = 1; 
            that.updateOverallProgress(objFileList.length, fileProgress, onProgress);
            if (objFileList[fileIndex].onError) objFileList[fileIndex].onError(error);
        }
      });
    }
    iterateLoadForIt();
  }

  // 🔥 新增：统一的整体进度更新方法
  updateOverallProgress(totalFiles, fileProgressArray, externalOnProgress) {
    let totalProgress = 0;
    fileProgressArray.forEach(progress => {
      totalProgress += progress;
    });
    
    const overallPercent = Math.round((totalProgress / totalFiles) * 100);
    console.log(`📊 整体加载进度: ${overallPercent}% (${totalProgress.toFixed(2)}/${totalFiles})`);
    
    // 确保进度不倒退
    if (overallPercent > this.lastReportedProgress) {
        window.EventBus.$emit('changeLoaidng', overallPercent);
        this.lastReportedProgress = overallPercent;
    } else if (overallPercent === 100) {
        // 强制发送100% (为了确保最终状态)
        window.EventBus.$emit('changeLoaidng', 100);
        this.lastReportedProgress = 100;
    }

    if (externalOnProgress) {
      // 外部 onProgress 回调可能期望 XHR 对象，这里只发送一个虚拟的百分比
      // 注意：这里传递的XHR对象是模拟的，不包含实际的loaded/total字节数
      externalOnProgress({ loaded: overallPercent, total: 100 }, null); 
    }
  }

  // 加载天空盒
  loaderSky(path, onLoad, onProgress, onError) {
    console.log('🌅 ZThree.loaderSky 开始加载天空盒:', path);
    
    const cubeTextureLoader = new THREE.CubeTextureLoader();
    cubeTextureLoader.setPath(path);
    
    const urls = [
      'px.webp', //右
      'nx.webp', //左
      'py.webp', //上
      'ny.webp', //下
      'pz.webp', //前
      'nz.webp' //后
    ];
    
    const skyTexture = cubeTextureLoader.load(
      urls,
      // onLoad callback
      (texture) => {
        console.log('✅ ZThree.loaderSky 天空盒加载完成');
        if (onLoad) onLoad(texture);
      },
      // onProgress callback
      (xhr) => {
        if (onProgress) onProgress(xhr);
      },
      // onError callback
      (error) => {
        console.error('❌ ZThree.loaderSky 天空盒加载失败:', error);
        if (onError) onError(error);
      }
    );
    
    return skyTexture;
  }

  // 🐋 加载鲸鱼模型
  loadWhaleModel() {
    console.log('🐋 开始加载鲸鱼模型...');
    
    this.loaderModel({
      type: 'glb',
      url: '/model/whale.glb',
      onLoad: (gltf) => {
        console.log('✅ 鲸鱼模型加载成功');
        
        // 获取鲸鱼模型
        this.whaleModel = gltf.scene;
        
        // 放大6.67倍（原来的2/3）
        this.whaleModel.scale.setScalar(6.67);
        
        // 设置初始位置（第一人称相机前面稍微往下）
        this.whalePosition.copy(this.camera.position);
        this.whalePosition.add(new THREE.Vector3(0, -1, -3)); // 往下1米，往前3米
        this.whaleModel.position.copy(this.whalePosition);
        
        // 设置初始旋转（面向相机前方）
        this.whaleModel.rotation.y = this.camera.rotation.y;
        
        // 添加到场景中，但初始时隐藏
        this.whaleModel.visible = false;
        this.scene.add(this.whaleModel);
        
        // 🔥 修改：保存动画数据，但不立即初始化动画
        this.whaleAnimationClips = gltf.animations || [];
        
        if (this.whaleAnimationClips.length > 0) {
          console.log('🐋 鲸鱼模型动画数据已保存:');
          console.log('📋 动画总数:', this.whaleAnimationClips.length);
          this.whaleAnimationClips.forEach((clip, index) => {
            console.log(`🎭 [${index + 1}] 动画名称: "${clip.name}" - 时长: ${clip.duration.toFixed(2)}s - 轨道数: ${clip.tracks.length}`);
          });
          console.log('💡 动画将在切换到第三人称模式时加载');
        } else {
          console.log('⚠️ 鲸鱼模型没有动画数据');
        }
        
        console.log('🐋 鲸鱼模型初始化完成');
      },
      onProgress: (xhr) => {
        if (xhr.lengthComputable) {
          const percentComplete = xhr.loaded / xhr.total * 100;
          console.log('🐋 鲸鱼模型加载进度:', Math.round(percentComplete) + '%');
        }
      },
      onError: (error) => {
        console.error('❌ 鲸鱼模型加载失败:', error);
      }
    });
  }

  // 🐋 播放鲸鱼动画 - 支持同时播放多个动画
  playWhaleAnimation(animationName, loop = true, stopOthers = false) {
    if (!this.whaleMixer || !this.whaleAnimations[animationName]) {
      console.warn('⚠️ 鲸鱼动画未找到:', animationName);
      console.log('💡 可用动画:', Object.keys(this.whaleAnimations || {}).join(', '));
      return;
    }
    
    const action = this.whaleAnimations[animationName];
    
    // 🔥 优化：如果相同动画已经在播放，不需要重新播放
    if (action.isRunning()) {
      return;
    }
    
    // 🔥 修改：只有在 stopOthers 为 true 时才停止其他动画
    if (stopOthers) {
      Object.entries(this.whaleAnimations).forEach(([name, otherAction]) => {
        if (otherAction !== action && otherAction.isRunning()) {
          otherAction.stop();
          console.log('⏹️ 停止动画:', name);
        }
      });
    }
    
    // 播放指定动画
    action.reset();
    action.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce);
    action.timeScale = 2.0; // 🔥 新增：设置播放速度为2倍（提高一倍速度）
    action.play();
    
    // 🔥 新增：记录当前播放的动画（支持多个）
    if (!this.currentPlayingAnimations) {
      this.currentPlayingAnimations = new Set();
    }
    this.currentPlayingAnimations.add(animationName);
  }

  // 🐋 停止鲸鱼动画
  stopWhaleAnimation(animationName = null) {
    if (!this.whaleMixer || !this.whaleAnimations) return;
    
    if (animationName && this.whaleAnimations[animationName]) {
      // 停止指定动画
      this.whaleAnimations[animationName].stop();
      console.log('⏹️ 停止鲸鱼动画:', animationName);
    } else {
      // 停止所有动画
      Object.values(this.whaleAnimations).forEach(action => {
        if (action.isRunning()) {
          action.stop();
        }
      });
      console.log('⏹️ 停止所有鲸鱼动画');
    }
  }

  // 🐋 获取可用的鲸鱼动画列表
  getWhaleAnimations() {
    if (!this.whaleAnimations || !this.whaleMixer) return [];
    return Object.keys(this.whaleAnimations);
  }

  // 🔥 新增：初始化鲸鱼动画系统（在切换到第三人称时调用）
  initWhaleAnimations() {
    if (!this.whaleModel || !this.whaleAnimationClips || this.whaleAnimationClips.length === 0) {
      console.log('⚠️ 无法初始化鲸鱼动画：模型或动画数据不存在');
      return false;
    }
    
    // 如果已经初始化过，直接返回
    if (this.whaleMixer && this.whaleAnimations) {
      console.log('🎭 鲸鱼动画系统已初始化');
      return true;
    }
    
    console.log('🔧 正在初始化鲸鱼动画系统...');
    
    // 创建动画混合器
    this.whaleMixer = new THREE.AnimationMixer(this.whaleModel);
    this.whaleAnimations = {};
    
    // 缓存所有动画
    this.whaleAnimationClips.forEach((clip, index) => {
      const action = this.whaleMixer.clipAction(clip);
      this.whaleAnimations[clip.name] = action;
      console.log(`🎭 缓存动画 [${index + 1}]: "${clip.name}"`);
    });
    
    // 🔥 新增：为每个动画添加调试方法
    window.playWhaleAnimation = (animationName) => {
      if (this.whaleAnimations && this.whaleAnimations[animationName]) {
        this.playWhaleAnimation(animationName);
        console.log('✅ 手动播放动画:', animationName);
      } else {
        console.log('❌ 动画不存在:', animationName);
        console.log('💡 可用动画:', Object.keys(this.whaleAnimations || {}).join(', '));
      }
    };
    
    window.listWhaleAnimations = () => {
      if (this.whaleAnimations) {
        console.log('🐋 当前可用的鲸鱼动画:');
        Object.keys(this.whaleAnimations).forEach((name, index) => {
          console.log(`  ${index + 1}. ${name}`);
        });
        console.log('💡 使用 playWhaleAnimation("动画名称") 来播放指定动画');
      } else {
        console.log('⚠️ 鲸鱼动画系统尚未初始化');
      }
    };
    
    console.log('✅ 鲸鱼动画系统初始化完成');
    console.log('📋 可用动画:', Object.keys(this.whaleAnimations).join(', '));
    
    return true;
  }

  // 🔥 修改：开始鲸鱼移动动画 - 播放所有动画
  startWhaleMovementAnimation() {
    if (!this.whaleModel) return;
    
    // 🔥 确保动画系统已初始化
    if (!this.initWhaleAnimations()) {
      console.log('⚠️ 无法启动鲸鱼动画：初始化失败');
      return;
    }
    
    const availableAnimations = this.getWhaleAnimations();
    if (availableAnimations.length === 0) {
      console.log('⚠️ 鲸鱼模型没有可用动画');
      return;
    }
    
    console.log(`🎭 播放鲸鱼所有动画 (${availableAnimations.length}个):`);
    
    // 🔥 播放所有可用动画
    availableAnimations.forEach((animationName) => {
      this.playWhaleAnimation(animationName, true);
      console.log(`   ✅ 播放动画: "${animationName}"`);
    });
    
    // 设置标记，表示鲸鱼正在移动
    this.whaleIsMoving = true;
  }

  // 🔥 修改：停止鲸鱼移动动画 - 停止所有动画
  stopWhaleMovementAnimation() {
    if (!this.whaleModel) return;
    
    // 如果动画系统未初始化，直接返回
    if (!this.whaleMixer || !this.whaleAnimations) {
      console.log('💡 鲸鱼动画系统未初始化，无需停止动画');
      this.whaleIsMoving = false;
      return;
    }
    
    const availableAnimations = this.getWhaleAnimations();
    if (availableAnimations.length === 0) {
      console.log('⚠️ 鲸鱼模型没有可用动画');
      return;
    }
    
    console.log(`⏹️ 停止鲸鱼所有动画 (${availableAnimations.length}个):`);
    
    // 🔥 停止所有动画
    availableAnimations.forEach((animationName) => {
      const action = this.whaleAnimations[animationName];
      if (action && action.isRunning()) {
        action.stop();
        console.log(`   ⏹️ 停止动画: "${animationName}"`);
      }
    });
    
    // 清除动画记录
    if (this.currentPlayingAnimations) {
      this.currentPlayingAnimations.clear();
    }
    
    // 清除移动标记
    this.whaleIsMoving = false;
  }

  // 🐋 切换视角模式
  toggleViewMode() {
    this.thirdPersonMode = !this.thirdPersonMode;
    
    if (this.thirdPersonMode) {
      // 切换到第三人称
      console.log('🐋 切换到第三人称视角');
      
      // 显示鲸鱼模型
      if (this.whaleModel) {
        this.whaleModel.visible = true;
        
        // 设置鲸鱼初始位置为第一人称相机位置，但高度固定为1.8米
        this.whalePosition.copy(this.camera.position);
        this.whalePosition.y = 1.8; // 鲸鱼固定高度1.8米
        this.whaleModel.position.copy(this.whalePosition);
        
        // 🔥 修改：保持鲸鱼当前朝向，不强制与相机朝向匹配
        // 鲸鱼的朝向将在移动时根据移动方向自动调整
      }
      
      // 禁用第一人称控制，启用第三人称控制
      this.firstPersonControls.enabled = false;
      this.thirdPersonControls.enabled = true;
      
      // 🔥 新增：初始化第三人称控制器的欧拉角（基于当前相机朝向）
      const cameraDirection = new THREE.Vector3();
      this.camera.getWorldDirection(cameraDirection);
      this.thirdPersonControls.euler.y = Math.atan2(cameraDirection.x, cameraDirection.z);
      this.thirdPersonControls.euler.x = 0; // 初始时水平视角
      
      // 🔥 修改：第三人称模式时初始化并播放鲸鱼动画
      if (this.initWhaleAnimations()) {
        this.startWhaleMovementAnimation(); // 播放所有动画
        console.log('🎭 第三人称模式：动画系统已初始化并开始播放');
      } else {
        console.log('⚠️ 第三人称模式：无法初始化鲸鱼动画系统');
      }
      
      // 立即更新相机位置到正确的第三人称位置
      this.updateThirdPersonCamera();
      
    } else {
      // 切换到第一人称
      console.log('👤 切换到第一人称视角');
      
      // 隐藏鲸鱼模型
      if (this.whaleModel) {
        this.whaleModel.visible = false;
      }
      
      // 启用第一人称控制，禁用第三人称控制
      this.firstPersonControls.enabled = true;
      this.thirdPersonControls.enabled = false;
      
      // 将第一人称相机移动到鲸鱼当前位置
      if (this.whaleModel) {
        this.camera.position.copy(this.whalePosition);
        this.camera.position.y = 2.5; // 固定高度
      }
    }
    
    return this.thirdPersonMode;
  }

  // 🐋 更新第三人称相机位置
  updateThirdPersonCamera() {
    if (!this.thirdPersonMode || !this.whaleModel) return;
    
    // 基础偏移（相机在鲸鱼后方）
    const baseOffset = new THREE.Vector3(0, 0.6, -1.9); // 高度+0.7米（保持相机2.5米），后方1.9米（缩短0.3米）
    
    // 🔥 修改：使用第三人称控制器的欧拉角来计算相机偏移
    const cameraEuler = this.thirdPersonControls.euler;
    
    // 应用垂直旋转到偏移向量
    const rotatedOffset = baseOffset.clone();
    
    // 先应用垂直旋转（绕X轴）
    rotatedOffset.applyAxisAngle(new THREE.Vector3(1, 0, 0), cameraEuler.x);
    
    // 再应用水平旋转（绕Y轴）
    rotatedOffset.applyAxisAngle(new THREE.Vector3(0, 1, 0), cameraEuler.y);
    
    // 设置相机位置（鲸鱼位置 + 旋转后的偏移）
    const cameraTargetPosition = this.whalePosition.clone().add(rotatedOffset);
    
    // 🔥 新增：确保相机不低于地面
    const minGroundHeight = 0.2; // 相机距离地面的最小高度（20厘米）
    if (cameraTargetPosition.y < minGroundHeight) {
      cameraTargetPosition.y = minGroundHeight;
      // console.log('📏 第三人称相机高度已限制在地面以上:', minGroundHeight + 'm');
    }
    
    this.camera.position.copy(cameraTargetPosition);
    
    // 相机始终看向鲸鱼
    this.camera.lookAt(this.whalePosition);
  }

  // 🐋 初始化第三人称控制器
  initThirdPersonControls() {
    const controls = this.thirdPersonControls;
    
    // 鼠标控制事件（用于控制相机角度）
    this.renderer.domElement.addEventListener('mousedown', (event) => {
      if (event.button === 0 && controls.enabled && this.thirdPersonMode) {
        controls.isMouseDown = true;
        controls.lastMouseX = event.clientX;
        controls.lastMouseY = event.clientY;
      }
    });
    
    this.renderer.domElement.addEventListener('mousemove', (event) => {
      if (controls.isMouseDown && controls.enabled && this.thirdPersonMode && this.whaleModel) {
        const deltaX = event.clientX - controls.lastMouseX;
        const deltaY = event.clientY - controls.lastMouseY;
        
        // 🔥 修改：控制相机角度而不是鲸鱼朝向
        controls.euler.y -= deltaX * controls.sensitivity;
        controls.euler.x -= deltaY * controls.sensitivity;
        
        // 限制垂直角度
        controls.euler.x = Math.max(-Math.PI / 3, Math.min(Math.PI / 3, controls.euler.x));
        
        controls.lastMouseX = event.clientX;
        controls.lastMouseY = event.clientY;
      }
    });
    
    this.renderer.domElement.addEventListener('mouseup', (event) => {
      if (event.button === 0) {
        controls.isMouseDown = false;
      }
    });
    
    // 触摸控制事件
    this.renderer.domElement.addEventListener('touchstart', (event) => {
      if (event.touches.length === 1 && controls.enabled && this.thirdPersonMode) {
        event.preventDefault();
        controls.isTouchActive = true;
        controls.lastTouchX = event.touches[0].clientX;
        controls.lastTouchY = event.touches[0].clientY;
      }
    }, { passive: false });
    
    this.renderer.domElement.addEventListener('touchmove', (event) => {
      if (controls.isTouchActive && event.touches.length === 1 && controls.enabled && this.thirdPersonMode && this.whaleModel) {
        event.preventDefault();
        
        const deltaX = event.touches[0].clientX - controls.lastTouchX;
        const deltaY = event.touches[0].clientY - controls.lastTouchY;
        
        // 🔥 修改：控制相机角度而不是鲸鱼朝向
        controls.euler.y -= deltaX * controls.sensitivity;
        controls.euler.x -= deltaY * controls.sensitivity;
        
        // 限制垂直角度
        controls.euler.x = Math.max(-Math.PI / 3, Math.min(Math.PI / 3, controls.euler.x));
        
        controls.lastTouchX = event.touches[0].clientX;
        controls.lastTouchY = event.touches[0].clientY;
      }
    }, { passive: false });
    
    this.renderer.domElement.addEventListener('touchend', () => {
      if (controls.isTouchActive) {
        controls.isTouchActive = false;
      }
    }, { passive: false });
    
    console.log('🐋 第三人称控制器初始化完成');
  }

  // 平滑飞行动画 (用于点击画作) - 适配第一人称和第三人称控制器
  flyTo(option) {
    option.position = option.position || []; // 目标位置
    option.controls = option.controls || []; // 目标朝向位置
    option.duration = option.duration || 1000; // 飞行时间
    option.easing = option.easing || TWEEN.Easing.Linear.None;
    TWEEN.removeAll();
    
    // 强制设置Y坐标为2.5米
    const fixedY = 2.5;
    
    if (option.position.length >= 2) {
      option.position[1] = fixedY;
    }
    
    const targetPosition = new THREE.Vector3(option.position[0], fixedY, option.position[2]);
    const lookAtTarget = new THREE.Vector3(option.controls[0], option.controls[1], option.controls[2]);
    
    // 🐋 第三人称模式：移动鲸鱼而不是相机
    if (this.thirdPersonMode && this.whaleModel) {
      console.log('🐋 第三人称模式飞行到画作');
      
      const curWhalePosition = this.whalePosition.clone();
      const whaleTargetHeight = 1.8; // 鲸鱼固定高度1.8米
      
      // 计算鲸鱼的目标朝向
      const whaleDirection = new THREE.Vector3().subVectors(lookAtTarget, targetPosition).normalize();
      let targetRotation = Math.atan2(whaleDirection.x, whaleDirection.z);
      
      // 🔥 修复：pic27在第三人称模式下需要180度旋转修正
      if (option.pictureName === 'pic27') {
        targetRotation += Math.PI; // 增加180度
      }
      
      // 处理角度跨越问题，选择最短的旋转路径
      const currentRotation = this.whaleModel.rotation.y;
      let adjustedTargetRotation = targetRotation;
      
      // 计算角度差
      let angleDiff = targetRotation - currentRotation;
      if (angleDiff > Math.PI) {
        adjustedTargetRotation = targetRotation - 2 * Math.PI;
      } else if (angleDiff < -Math.PI) {
        adjustedTargetRotation = targetRotation + 2 * Math.PI;
      }
      
      const tween = new TWEEN.Tween({
        x: curWhalePosition.x, y: curWhalePosition.y, z: curWhalePosition.z,
        rotY: currentRotation
      }).to({
        x: targetPosition.x, y: whaleTargetHeight, z: targetPosition.z,
        rotY: adjustedTargetRotation
      }, option.duration)
        .easing(option.easing);
        
      // 🔥 新增：飞行开始时播放游泳动画
      tween.onStart(() => {
        this.startWhaleMovementAnimation();
        console.log('🐋 开始飞行，播放游泳动画');
      });
        
      tween.onUpdate(() => {
        // 更新鲸鱼位置和旋转
        this.whalePosition.set(tween._object.x, tween._object.y, tween._object.z);
        this.whaleModel.position.copy(this.whalePosition);
        this.whaleModel.rotation.y = tween._object.rotY;
        
        // 相机会自动通过updateThirdPersonCamera跟随
        
        // 🔥 新增：持续更新移动时间，保持游泳动画
        this.whaleLastMoveTime = Date.now();
      });
      
      tween.onComplete(() => {
        // 🔥 新增：飞行结束后延迟切换到空闲动画
        setTimeout(() => {
          this.stopWhaleMovementAnimation();
        }, this.whaleIdleTimeout);
        
        if (option.done) option.done();
        console.log('🐋 第三人称飞行完成');
      });

      tween.start();
      return tween;
    }
    
    // 🔥 第一人称模式：移动相机（原有逻辑）
    console.log('👤 第一人称模式飞行到画作');
    const curPosition = this.camera.position;
    const controls = this.firstPersonControls;
    const currentEuler = controls.euler.clone();
    
    // 🔥 修复：pic27在第一人称模式下需要180度旋转修正
    let adjustedLookAtTarget = lookAtTarget.clone();
    if (option.pictureName === 'pic27') {
      // 计算从目标位置指向当前lookAt目标的方向，然后反转
      const direction = new THREE.Vector3().subVectors(adjustedLookAtTarget, targetPosition);
      adjustedLookAtTarget = targetPosition.clone().sub(direction);
    }
    
    // 创建临时相机计算目标朝向
    const tempCamera = new THREE.PerspectiveCamera();
    tempCamera.position.copy(targetPosition);
    tempCamera.lookAt(adjustedLookAtTarget);
    
    // 获取目标欧拉角
    const targetEuler = new THREE.Euler().setFromQuaternion(tempCamera.quaternion, 'YXZ');
    
    const tween = new TWEEN.Tween({
      x: curPosition.x, y: curPosition.y, z: curPosition.z,
      rotX: currentEuler.x, rotY: currentEuler.y
    }).to({
      x: option.position[0], y: fixedY, z: option.position[2],
      rotX: targetEuler.x, rotY: targetEuler.y
    }, option.duration)
      .easing(option.easing);
      
    tween.onUpdate(() => {
      this.controls.enabled = false;
      
      // 更新相机位置
      this.camera.position.set(tween._object.x, fixedY, tween._object.z);
      
      // 更新相机朝向（第一人称）
      controls.euler.x = tween._object.rotX;
      controls.euler.y = tween._object.rotY;
      this.camera.quaternion.setFromEuler(controls.euler);
      
      // 兼容性：更新target（虽然第一人称不使用）
      this.controls.target.copy(lookAtTarget);
    });
    
    tween.onComplete(() => {
      this.controls.enabled = true;
      if (option.done) option.done();
      console.log('👤 第一人称飞行完成');
    });

    tween.start();
    return tween;
  }

  // 淡入淡出传送 (用于小地图) - 适配第一人称和第三人称控制器
  teleportTo(option) {
    // 🐋 根据模式选择不同的高度
    let targetHeight, targetPosition, lookAtTarget;
    
    if (this.thirdPersonMode && this.whaleModel) {
      // 第三人称模式：鲸鱼高度1.8米
      targetHeight = 1.8;
      targetPosition = new THREE.Vector3(option.position[0], targetHeight, option.position[2]);
      lookAtTarget = new THREE.Vector3(option.controls[0], option.controls[1], option.controls[2]);
    } else {
      // 第一人称模式：相机高度2.5米
      targetHeight = 2.5;
      targetPosition = new THREE.Vector3(option.position[0], targetHeight, option.position[2]);
      lookAtTarget = new THREE.Vector3(option.controls[0], option.controls[1], option.controls[2]);
    }
    
    if (!window.EventBus) {
      console.error("EventBus not found. Cannot perform fade transition. Teleporting instantly.");
      
      // 🐋 第三人称模式：传送鲸鱼
      if (this.thirdPersonMode && this.whaleModel) {
        console.log('🐋 第三人称瞬间传送');
        this.whalePosition.copy(targetPosition);
        this.whaleModel.position.copy(this.whalePosition);
        
        // 计算鲸鱼朝向
        const whaleDirection = new THREE.Vector3().subVectors(lookAtTarget, targetPosition).normalize();
        const targetRotation = Math.atan2(whaleDirection.x, whaleDirection.z);
        
        // 处理角度跨越问题，选择最短的旋转路径
        const currentRotation = this.whaleModel.rotation.y;
        let adjustedTargetRotation = targetRotation;
        
        let angleDiff = targetRotation - currentRotation;
        if (angleDiff > Math.PI) {
          adjustedTargetRotation = targetRotation - 2 * Math.PI;
        } else if (angleDiff < -Math.PI) {
          adjustedTargetRotation = targetRotation + 2 * Math.PI;
        }
        
        this.whaleModel.rotation.y = adjustedTargetRotation;
        
        // 调用done回调
        if (option.done) option.done();
        return;
      }
      
      // 🔥 第一人称传送：设置位置和朝向
      console.log('👤 第一人称瞬间传送');
      this.camera.position.copy(targetPosition);
      
      // 计算朝向
      const tempCamera = new THREE.PerspectiveCamera();
      tempCamera.position.copy(this.camera.position);
      tempCamera.lookAt(lookAtTarget);
      
      const targetEuler = new THREE.Euler().setFromQuaternion(tempCamera.quaternion, 'YXZ');
      this.firstPersonControls.euler.copy(targetEuler);
      this.camera.quaternion.setFromEuler(this.firstPersonControls.euler);
      
      // 兼容性：更新target
      this.controls.target.copy(lookAtTarget);
      
      // 调用done回调
      if (option.done) option.done();
      return;
    }

    const fadeDuration = 400;

    window.EventBus.$emit('toggle-fade', true);
    this.controls.enabled = false;

    setTimeout(() => {
      // 🐋 第三人称模式：传送鲸鱼
      if (this.thirdPersonMode && this.whaleModel) {
        console.log('🐋 第三人称淡入淡出传送');
        this.whalePosition.copy(targetPosition);
        this.whaleModel.position.copy(this.whalePosition);
        
        // 计算鲸鱼朝向
        const whaleDirection = new THREE.Vector3().subVectors(lookAtTarget, targetPosition).normalize();
        const targetRotation = Math.atan2(whaleDirection.x, whaleDirection.z);
        
        // 处理角度跨越问题，选择最短的旋转路径
        const currentRotation = this.whaleModel.rotation.y;
        let adjustedTargetRotation = targetRotation;
        
        let angleDiff = targetRotation - currentRotation;
        if (angleDiff > Math.PI) {
          adjustedTargetRotation = targetRotation - 2 * Math.PI;
        } else if (angleDiff < -Math.PI) {
          adjustedTargetRotation = targetRotation + 2 * Math.PI;
        }
        
        this.whaleModel.rotation.y = adjustedTargetRotation;
      } else {
      // 🔥 第一人称传送：设置位置和朝向
        console.log('👤 第一人称淡入淡出传送');
        this.camera.position.copy(targetPosition);
      
      // 计算朝向
      const tempCamera = new THREE.PerspectiveCamera();
      tempCamera.position.copy(this.camera.position);
      tempCamera.lookAt(lookAtTarget);
      
      const targetEuler = new THREE.Euler().setFromQuaternion(tempCamera.quaternion, 'YXZ');
      this.firstPersonControls.euler.copy(targetEuler);
      this.camera.quaternion.setFromEuler(this.firstPersonControls.euler);
      
      // 兼容性：更新target
      this.controls.target.copy(lookAtTarget);
      }

      window.EventBus.$emit('toggle-fade', false);

      setTimeout(() => {
        this.controls.enabled = true;
        
        // 调用done回调
        if (option.done) option.done();
      }, fadeDuration);
    }, fadeDuration);
  }

  // 计算模型的世界坐标
  getModelWorldPostion(model) {
    let worldPosition = new THREE.Vector3();
    model.getWorldPosition(worldPosition);
    console.log(worldPosition);
    return worldPosition;
  }

  // 截图功能
  takeScreenshot() {
    try {
      // 确保场景已经渲染
      this.renderer.render(this.scene, this.camera);
      
      // 获取canvas数据URL
      const dataURL = this.renderer.domElement.toDataURL('image/png');
      
      // 创建下载链接
      const link = document.createElement('a');
      link.download = `gallery-screenshot-${new Date().getTime()}.png`;
      link.href = dataURL;
      
      // 触发下载
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      console.log('📸 截图已保存');
      return true;
    } catch (error) {
      console.error('截图失败:', error);
      return false;
    }
  }

  // 渲染
  render(callback) {
    let _this = this;
    // 渲染
    function render() {
      // 🔥 修复：始终调用updateCameraMovement，让它自己判断是否需要更新
      // 而不是依赖于isMoving状态，避免漫游结束后控制卡顿
      _this.updateCameraMovement();

      // 🐋 更新鲸鱼动画和状态
      if (_this.whaleMixer) {
        _this.whaleMixer.update(0.016); // 假设60fps
        
        // 🔥 新增：检查鲸鱼是否应该切换到空闲状态
        if (_this.thirdPersonMode && _this.whaleIsMoving && _this.whaleLastMoveTime > 0) {
          const timeSinceLastMove = Date.now() - _this.whaleLastMoveTime;
          if (timeSinceLastMove > _this.whaleIdleTimeout) {
            _this.stopWhaleMovementAnimation();
            _this.whaleLastMoveTime = 0; // 重置时间戳
          }
        }
      }

      // 🐋 在第三人称模式下更新相机位置
      if (_this.thirdPersonMode) {
        _this.updateThirdPersonCamera();
      }

      // 更新状态
      if (_this.stats) {
        _this.stats.update();
      }

      requestAnimationFrame(render);

      TWEEN.update();

      if (callback) callback();
    }
    render();
  }
}
