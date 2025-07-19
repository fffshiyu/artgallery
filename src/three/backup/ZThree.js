import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
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
    this.moveSpeed = 0.0125; // 移动速度（再次减半，更精细控制）
    this.isMoving = false; // 是否正在WASD移动
    this.movementEndTimeout = null; // 移动结束延迟计时器
    this.initialTargetYOffset = null; // 控制器目标Y轴偏移量
    
    // 虚拟摇杆相关变量
    this.joystick = null;
    this.joystickData = {
      active: false,
      x: 0,
      y: 0
    };
    
    // 🔥 修复：使用时间戳来区分拖拽和点击，替代布尔标记
    this.lastDragEndTime = 0;
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
    this.renderer.toneMappingExposure = 0.5;
    
    // 启用深度测试和深度写入
    this.renderer.sortObjects = true;
    this.renderer.autoClear = true;
    this.renderer.autoClearColor = true;
    this.renderer.autoClearDepth = true;
    this.renderer.autoClearStencil = false;
    
    this.el.append(this.renderer.domElement);
    // this.renderer.setClearColor('#000');
    // this.gui = new GUI();

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
    });

    // 键盘松开事件
    document.addEventListener('keyup', (event) => {
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
      if (!hasAnyKey) {
        // 清除之前的超时
        if (_this.movementEndTimeout) {
          clearTimeout(_this.movementEndTimeout);
        }
        
        // 延迟100ms后停止移动状态，避免误点击
        _this.movementEndTimeout = setTimeout(() => {
          _this.isMoving = false;
        }, 100);
      }
    });
  }

  // 初始化虚拟摇杆
  initJoystick() {
    const _this = this;
    
    // 检测是否为移动设备 - 此变量未被使用，已移除
    // const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
    //                  (window.innerWidth <= 768) || 
    //                  ('ontouchstart' in window);
    
    // 创建摇杆容器
    const joystickContainer = document.createElement('div');
    joystickContainer.id = 'joystick-container';
    
    // 🔥 修改：网页版本也使用左下角位置
    const positionStyle = `
      bottom: 30px;
      left: 30px;
    `;
    
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
    `;
    
    console.log(`🎮 摇杆初始化 - 固定位置: 左下角, 窗口宽度: ${window.innerWidth}px`);
    
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
      // 完全重置摇杆数据，防止使用旧的方向值
      _this.joystickData.x = 0;
      _this.joystickData.y = 0;
      _this.joystickData.active = false;
      _this.isMoving = false; // 重置移动状态
      
      console.log('🕹️ 摇杆开始 - 数据已重置');
      
      // 🔥 修复：更安全地禁用OrbitControls
      if (_this.controls && _this.controls.enabled) {
        _this.controls.enabled = false;
        console.log('🕹️ OrbitControls 已禁用');
      }
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
        _this.isMoving = true;
        
        // 调试信息：显示摇杆数据 - 更频繁显示以便调试
        if (Math.random() < 0.02) { // 降低日志频率
        console.log('🕹️ 摇杆移动:', {
          x: data.vector.x.toFixed(3),
          y: data.vector.y.toFixed(3),
          distance: data.distance.toFixed(3),
          angle: data.angle ? (data.angle.degree.toFixed(1) + '°') : 'N/A',
          force: data.force.toFixed(3)
        });
        }
      } else {
        // 如果拖拽距离太小，停止移动
        _this.joystickData.x = 0;
        _this.joystickData.y = 0;
        _this.joystickData.active = false;
        if (Math.random() < 0.02) {
        console.log('🕹️ 摇杆距离太小，停止移动:', data.distance?.toFixed(3));
        }
      }
    });
    
    // 摇杆停止移动
    this.joystick.on('end', function() {
      console.log('🕹️ 摇杆结束 - 停止移动');
      
      _this.joystickData.active = false;
      _this.joystickData.x = 0;
      _this.joystickData.y = 0;
      
      // 🔥 修复：更安全地重新启用OrbitControls
      setTimeout(() => {
        _this.isMoving = false;
        if (_this.controls && !_this.controls.enabled) {
          _this.controls.enabled = true;
          console.log('🕹️ OrbitControls 已重新启用');
          // 重新启用控制器时更新目标点
          if (_this.updateControlsTarget) {
            _this.updateControlsTarget();
          }
        }
      }, 100);
    });
  }

  // 更新摄像头位置（WASD控制和虚拟摇杆控制）
  updateCameraMovement() {
    // 检查是否有按键按下或虚拟摇杆激活，没有输入就不更新
    const hasKeyboardMovement = this.keys.w || this.keys.a || this.keys.s || this.keys.d;
    const hasJoystickMovement = this.joystickData.active;
    
    if (!hasKeyboardMovement && !hasJoystickMovement) {
      return;
    }

    // 使用更平滑的阻尼系数
    const damping = 0.8;
    this.velocity.multiplyScalar(damping);

    // 计算方向向量：合并键盘输入和虚拟摇杆输入
    let directionZ = 0;
    let directionX = 0;
    
    // 键盘输入
    if (hasKeyboardMovement) {
      directionZ = Number(this.keys.w) - Number(this.keys.s);
      directionX = Number(this.keys.d) - Number(this.keys.a);
    }
    
    // 虚拟摇杆输入（如果摇杆激活，优先使用摇杆输入）
    if (hasJoystickMovement) {
      directionZ = this.joystickData.y; // 前后移动（向上摇杆为前进）
      directionX = this.joystickData.x; // 左右移动
      
      // 调试信息：显示处理后的方向
      if (Math.random() < 0.05) { // 降低日志频率
        console.log('🎮 摇杆方向处理:', {
          原始数据: { x: this.joystickData.x.toFixed(3), y: this.joystickData.y.toFixed(3) },
          处理后: { directionX: directionX.toFixed(3), directionZ: directionZ.toFixed(3) }
        });
      }
    }
    
    this.direction.z = directionZ;
    this.direction.x = directionX;
    this.direction.normalize();

    // 应用移动速度到速度向量
    if (hasKeyboardMovement) {
      if (this.keys.w || this.keys.s) this.velocity.z -= this.direction.z * this.moveSpeed;
      if (this.keys.a || this.keys.d) this.velocity.x -= this.direction.x * this.moveSpeed;
    }
    
    if (hasJoystickMovement) {
      // 虚拟摇杆的移动强度基于摇杆偏移量
      this.velocity.z -= this.direction.z * this.moveSpeed;
      this.velocity.x -= this.direction.x * this.moveSpeed;
    }

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
    moveVector.addScaledVector(cameraDirection, -this.velocity.z);
    moveVector.addScaledVector(right, -this.velocity.x);
    
    // 碰撞检测：检查移动目标位置是否会撞墙
    const targetPosition = new THREE.Vector3(
      this.camera.position.x + moveVector.x,
      fixedY,
      this.camera.position.z + moveVector.z
    );
    
    // 如果没有碰撞，才执行移动
    if (this.checkCollision(this.camera.position, targetPosition)) {
      // 只更新X和Z位置，强制保持Y位置为3米
      this.camera.position.x += moveVector.x;
      this.camera.position.z += moveVector.z;
      this.camera.position.y = fixedY; // 强制锁定Y位置为3米

      // 🔥 使用动态目标系统，确保移动后旋转依然是原地旋转
      if (this.controls && this.updateControlsTarget) {
        this.updateControlsTarget();
      }
    }
  }

  // 智能碰撞检测方法 - 性能优化版
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
        name.includes('wall') || 
        name.includes('Wall') ||
        name.includes('沙发') ||
        name.includes('中间屏') ||
        name === '天窗栅栏' ||
        name === '房顶' ||
        name === 'G-Object240'
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
        if (Math.random() < 0.1) { // 降低日志频率
          console.log(`🚫 阻止移动 - 撞到 ${hitObject.name}, 距离: ${hitDistance.toFixed(2)}, 安全距离: ${safetyDistance}`);
        }
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

  // 初始化控制器
  initOrbitControls() {
    let controls = new OrbitControls(this.camera, this.renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.enableZoom = false; // 禁用滚轮缩放
    controls.autoRotate = false;
    controls.autoRotateSpeed = 0.5;
    controls.enablePan = true;
    
    // 🔥 优化触摸设备兼容性设置 - 确保触摸旋转行为与鼠标一致
    controls.touches = {
      ONE: THREE.TOUCH.ROTATE,     // 单指旋转
      TWO: THREE.TOUCH.DOLLY_PAN   // 双指缩放和平移（已禁用缩放）
    };
    
    // 🔥 移除上下视角限制，实现更自由的第一人称视角
    controls.minDistance = 1.0;
    controls.maxDistance = 50;
    controls.minPolarAngle = 0;  // 允许看到天花板
    controls.maxPolarAngle = Math.PI;  // 允许看到地板
    
    // 🔥 新增：更精确的旋转速度控制
    controls.rotateSpeed = 0.5;              // 降低旋转速度，让控制更精准
    controls.panSpeed = 0.8;
    controls.keyPanSpeed = 7.0;
    
    // 🔥 新增：更稳定的阻尼设置
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;           // 稍微增加阻尼，让旋转更平滑
    
    // 🔥 新增：移动设备专用优化
    controls.enablePan = false;              // 在移动设备上禁用平移，避免意外移动
    controls.screenSpacePanning = false;     // 禁用屏幕空间平移
    controls.enableKeys = false;             // 禁用键盘控制（我们有自己的WASD系统）
    
    // 🔥 触摸特定优化
    controls.mouseButtons = {
      LEFT: THREE.MOUSE.ROTATE,              // 鼠标左键旋转
      MIDDLE: THREE.MOUSE.DOLLY,             // 鼠标中键缩放（已禁用）
      RIGHT: null                            // 禁用鼠标右键
    };
    
    // 检测移动设备，如果是移动设备则进一步优化
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
                     (window.innerWidth <= 768) || 
                     ('ontouchstart' in window);
                     
    if (isMobile) {
      controls.rotateSpeed = 0.3;            // 移动设备降低旋转速度
      controls.minPolarAngle = 0; // 移动设备同样取消限制
      controls.maxPolarAngle = Math.PI;
      console.log('📱 检测到移动设备，启用触摸优化');
    }
    
    // 🔥 新增：动态目标更新功能
    // 支持两种模式：拖动旋转时围绕镜头本身旋转（距离0），其他操作围绕前方5米处旋转
    this.updateControlsTarget = (forceDistance = null) => {
      // 获取相机朝向
      const cameraDirection = new THREE.Vector3();
      this.camera.getWorldDirection(cameraDirection);
      
      // 根据参数决定目标距离：拖动旋转时为0，其他时候为5
      const targetDistance = forceDistance !== null ? forceDistance : 5.0;
      const newTarget = this.camera.position.clone().add(
        cameraDirection.multiplyScalar(targetDistance)
      );
      
      controls.target.copy(newTarget);
    };

    // 保存控制器原始设置
    const originalMinDistance = controls.minDistance;
    
    // 🔥 鼠标事件处理 - 区分拖动和单击
    let mouseDownPosition = null;
    let isDragging = false;
    const dragThreshold = 15; // 增加像素阈值到15，避免轻微移动被识别为拖动
    
    // 监听鼠标按下事件
    this.renderer.domElement.addEventListener('mousedown', (event) => {
      if (event.button === 0) { // 左键
        // 记录鼠标按下位置
        mouseDownPosition = { x: event.clientX, y: event.clientY };
        isDragging = false;
        
        // 平滑过渡到自转模式：设置很小的距离，接近自转效果
        controls.minDistance = 0.1;
        // 使用当前视角方向设置一个很近的target，避免视角跳跃
        const cameraDirection = new THREE.Vector3();
        this.camera.getWorldDirection(cameraDirection);
        const nearTarget = this.camera.position.clone().add(cameraDirection.multiplyScalar(0.1));
        controls.target.copy(nearTarget);
        controls.update();
      }
    });
    
    // 监听鼠标移动事件，检测是否为拖动
    this.renderer.domElement.addEventListener('mousemove', (event) => {
      if (mouseDownPosition && !isDragging) {
        const deltaX = Math.abs(event.clientX - mouseDownPosition.x);
        const deltaY = Math.abs(event.clientY - mouseDownPosition.y);
        
        // 如果移动距离超过阈值，标记为拖动
        if (deltaX > dragThreshold || deltaY > dragThreshold) {
          isDragging = true;
        }
      }
    });
    
    // 监听鼠标松开事件
    this.renderer.domElement.addEventListener('mouseup', (event) => {
      if (event.button === 0) {
        // 恢复原始最小距离
        controls.minDistance = originalMinDistance;
        // 恢复正常旋转模式：设置前方5米处为目标
        this.updateControlsTarget(5.0);
        controls.update();
        
        // 🔥 修复：如果刚刚是拖拽，则记录结束时间
        if (isDragging) {
          this.lastDragEndTime = Date.now();
        }
        
        // 重置状态
        mouseDownPosition = null;
        isDragging = false;
      }
    });

    // 🔥 触摸状态变量
    let touchStartTime = 0;
    let touchMoveCount = 0;                  // 新增：移动计数器
    let lastTouchMove = 0;                   // 新增：最后移动时间
    const TOUCH_DEBOUNCE = 16;               // 新增：触摸防抖间隔（约60fps）
    const MIN_TOUCH_DURATION = 100;          // 新增：最小触摸持续时间
    
    // 🔥 新增：触摸拖拽检测变量
    let touchStartPosition = null;
    let isTouchDragging = false;
    const touchDragThreshold = 30;           // 🔥 触摸拖拽阈值，提高到30像素，防止轻触被误认为拖拽
    
    // 🔥 新增：触摸开始
    const handleTouchStart = (event) => {
      event.preventDefault(); // 阻止浏览器默认行为
      event.stopPropagation(); // 阻止事件冒泡
      
      touchStartTime = Date.now();
      touchMoveCount = 0;
      lastTouchMove = 0;
      
      // 🔥 新增：记录触摸开始位置，用于拖拽检测
      if (event.touches.length === 1) {
        touchStartPosition = {
          x: event.touches[0].clientX,
          y: event.touches[0].clientY
        };
        isTouchDragging = false;
        console.log('👆 触摸开始位置:', touchStartPosition);
      }
      
      // 单指触摸才处理
      if (event.touches.length === 1) {
        controls.enabled = true;
        
        // 🔥 触摸时也切换到近距离旋转模式，像鼠标拖动一样
        controls.minDistance = 0.1;
        const cameraDirection = new THREE.Vector3();
        this.camera.getWorldDirection(cameraDirection);
        const nearTarget = this.camera.position.clone().add(cameraDirection.multiplyScalar(0.1));
        controls.target.copy(nearTarget);
        controls.update();
        
        console.log('👆 触摸开始 - 切换到近距离旋转模式');
      } else if (event.touches.length === 2) {
        // 双指操作，保持缩放功能
        controls.enabled = true;
        console.log('🤏 双指操作');
      }
    };
    
    // 🔥 新增：触摸移动（带防抖和拖拽检测）
    const handleTouchMove = (event) => {
      event.preventDefault(); // 阻止浏览器默认行为
      event.stopPropagation(); // 阻止事件冒泡
      
      const now = Date.now();
      const timeSinceLastMove = now - lastTouchMove;
      
      // 防抖：限制触摸事件频率
      if (timeSinceLastMove < TOUCH_DEBOUNCE) {
        return;
      }
      
      lastTouchMove = now;
      touchMoveCount++;
      
      // 🔥 新增：检测触摸拖拽 - 更严格的拖拽检测
      if (touchStartPosition && !isTouchDragging && event.touches.length === 1) {
        const deltaX = Math.abs(event.touches[0].clientX - touchStartPosition.x);
        const deltaY = Math.abs(event.touches[0].clientY - touchStartPosition.y);
        const totalDistance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
        
        // 🔥 需要满足多个条件才算拖拽：距离超过阈值 + 移动次数超过2次
        if (totalDistance > touchDragThreshold && touchMoveCount >= 3) {
          isTouchDragging = true;
          console.log('👆 检测到触摸拖拽，总距离:', totalDistance, '移动次数:', touchMoveCount);
        }
      }
      
      // 确保控制器启用
      if (!controls.enabled) {
        controls.enabled = true;
      }
    };
    
    // 🔥 新增：触摸结束
    const handleTouchEnd = (event) => {
      event.preventDefault(); // 阻止浏览器默认行为
      // event.stopPropagation(); // 不再阻止事件冒泡，确保射线检测能收到 touchend
      
      const touchDuration = Date.now() - touchStartTime;
      
      // 🔥 触摸结束时恢复正常旋转模式
      controls.minDistance = originalMinDistance;
      this.updateControlsTarget(5.0);
      controls.update();
      
      // === 修正拖拽判定 ===
      let totalDistance = 0;
      if (touchStartPosition && event.changedTouches && event.changedTouches.length > 0) {
        const endX = event.changedTouches[0].clientX;
        const endY = event.changedTouches[0].clientY;
        const deltaX = Math.abs(endX - touchStartPosition.x);
        const deltaY = Math.abs(endY - touchStartPosition.y);
        totalDistance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
      }
      // 只有明显拖拽才算拖拽，否则都算点击
      const wasDragging = (totalDistance > touchDragThreshold && touchMoveCount >= 3);
      if (wasDragging) {
        this.lastDragEndTime = Date.now();
      }
      this.wasLastActionDrag = wasDragging;
      console.log('👆 触摸结束 - 是否拖拽:', this.wasLastActionDrag, '总距离:', totalDistance, '移动次数:', touchMoveCount, '持续时间:', touchDuration);
      
      // 重置触摸拖拽状态
      touchStartPosition = null;
      isTouchDragging = false;
      
      // 检测是否为有效的触摸操作
      if (touchDuration < MIN_TOUCH_DURATION && touchMoveCount < 3) {
        // 可能是意外触摸，暂时禁用控制器避免抖动
        setTimeout(() => {
          if (controls.enabled) {
            controls.enabled = true; // 重新启用
          }
        }, 50);
      }
      
      console.log(`👆 触摸结束 - 持续: ${touchDuration}ms, 移动: ${touchMoveCount}次 - 恢复正常旋转模式`);
    };

    // 🔥 注册触摸事件监听器
    this.renderer.domElement.addEventListener('touchstart', handleTouchStart, { passive: false });
    this.renderer.domElement.addEventListener('touchmove', handleTouchMove, { passive: false });
    this.renderer.domElement.addEventListener('touchend', handleTouchEnd, { passive: false });
    this.renderer.domElement.addEventListener('touchcancel', handleTouchEnd, { passive: false });

    // 🔥 彻底阻止滚轮事件，确保不会改变视角
    this.renderer.domElement.addEventListener('wheel', (event) => {
      event.preventDefault();
      event.stopPropagation();
    }, { passive: false });

    this.controls = controls;
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
      console.log('🖱️ 检测到指针事件:', evt.type);
      
      console.log('✅ 执行点击事件处理');
      
      // 获取canvas元素的边界信息
      const rect = this.renderer.domElement.getBoundingClientRect();
      
      // 🔥 兼容触摸和鼠标事件的坐标计算
      let clientX, clientY;
      
      if (evt.type === 'touchend' && evt.changedTouches && evt.changedTouches.length > 0) {
        // 触摸事件：使用 changedTouches
        clientX = evt.changedTouches[0].clientX;
        clientY = evt.changedTouches[0].clientY;
        console.log('📱 触摸事件坐标:', { x: clientX, y: clientY });
      } else {
        // 鼠标事件：使用 clientX/clientY
        clientX = evt.clientX;
        clientY = evt.clientY;
        console.log('🖱️ 鼠标事件坐标:', { x: clientX, y: clientY });
      }
      
      // 修正坐标计算，使用canvas的相对位置
      let mouse = {
        x: ((clientX - rect.left) / rect.width) * 2 - 1,
        y: -((clientY - rect.top) / rect.height) * 2 + 1
      };
      
      console.log('🎯 标准化坐标:', mouse);

      let activeObj = this.fireRaycaster(mouse, models);
      
      if (activeObj) {
        console.log('🎯 射线命中对象:', activeObj.object.name || '未命名对象');
      } else {
        console.log('🎯 射线未命中任何对象');
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

    function iterateLoadForIt() {
      that.loaderModel({
        type: objFileList[fileIndex].type,
        dracoUrl: objFileList[fileIndex].dracoUrl,
        mtlUrl: objFileList[fileIndex].mtlUrl,
        url: objFileList[fileIndex].url,
        onLoad: function(object) {
          if (objFileList[fileIndex].onLoad) objFileList[fileIndex].onLoad(object);
          fileIndex++;
          if (fileIndex < objFileList.length) {
            iterateLoadForIt();
          } else {
            if (onAllLoad) onAllLoad();
          }
        },
        onProgress: function(xhr) {
          if (objFileList[fileIndex].onProgress) objFileList[fileIndex].onProgress(xhr, fileIndex);
          if (onProgress) onProgress(xhr, fileIndex);
        }
      });
    }
    iterateLoadForIt();
  }

  // 加载天空盒
  loaderSky(path) {
    let skyTexture = new THREE.CubeTextureLoader().setPath(path).load([
      'px.png', //右
      'nx.png', //左
      'py.png', //上
      'ny.png', //下
      'pz.png', //前
      'nz.png' //后
    ]);
    return skyTexture;
  }

  // 平滑飞行动画 (用于点击画作)
  flyTo(option) {
    option.position = option.position || []; // 相机新的位置
    option.controls = option.controls || []; // 控制器新的中心点位置(围绕此点旋转等)
    option.duration = option.duration || 1000; // 飞行时间
    option.easing = option.easing || TWEEN.Easing.Linear.None;
    TWEEN.removeAll();
    const curPosition = this.camera.position;
    const controlsTar = this.controls.target;
    
    // 强制设置Y坐标为2.5米
    const fixedY = 2.5;
    
    if (option.position.length >= 2) {
      option.position[1] = fixedY;
    }
    
    const tween = new TWEEN.Tween({
      x1: curPosition.x, y1: curPosition.y, z1: curPosition.z,
      x2: controlsTar.x, y2: controlsTar.y, z2: controlsTar.z
    }).to({
      x1: option.position[0], y1: fixedY, z1: option.position[2],
      x2: option.controls[0], y2: option.controls[1], z2: option.controls[2]
    }, option.duration)
      .easing(option.easing);
      
    tween.onUpdate(() => {
      this.controls.enabled = false;
      this.camera.position.set(tween._object.x1, fixedY, tween._object.z1);
      this.controls.target.set(tween._object.x2, tween._object.y2, tween._object.z2);
      this.controls.update();
    });
    
    tween.onComplete(() => {
      this.controls.enabled = true;
      if (option.done) option.done();
    });

    tween.start();
    return tween;
  }

  // 淡入淡出传送 (用于小地图)
  teleportTo(option) {
    if (!window.EventBus) {
      console.error("EventBus not found. Cannot perform fade transition. Teleporting instantly.");
      this.camera.position.set(option.position[0], option.position[1], option.position[2]);
      this.controls.target.set(option.controls[0], option.controls[1], option.controls[2]);
      this.controls.update();
      return;
    }

    const fadeDuration = 400;

    window.EventBus.$emit('toggle-fade', true);
    this.controls.enabled = false;

    setTimeout(() => {
      this.camera.position.set(option.position[0], option.position[1], option.position[2]);
      this.controls.target.set(option.controls[0], option.controls[1], option.controls[2]);
      this.controls.update();

      window.EventBus.$emit('toggle-fade', false);

      setTimeout(() => {
        this.controls.enabled = true;
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
      // 更新WASD控制
      if (_this.isMoving) {
        _this.updateCameraMovement();
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
