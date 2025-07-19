import * as THREE from 'three';
import { generatePicData, loadImageAsync } from '@/assets/data';
import EventBus from '@/bus';

export function loaderRoam(app) {
  createIconGroup(app);
  
  // 添加状态跟踪
  app.currentViewingPicture = null; // 当前正在观看的画作
  app.isInViewingPosition = false; // 是否已经在观看位置

  // 鼠标移动事件
  app.initRaycaster(onMouseMove, app.rayModel, 'mousemove');

  // 鼠标点击事件
  app.initRaycaster(onClick, app.rayModel, 'click');
}

// 🚀 懒加载图片并显示画作详情的函数
async function loadPictureAndShow(pictureData) {
  try {
    // 如果图片已经加载过，直接显示
    if (pictureData.image) {
      EventBus.$emit('showPictureDetail', pictureData);
      return;
    }
    
    // 如果有imagePath，进行懒加载
    if (pictureData.imagePath) {
      try {
        // 懒加载图片
        const imageUrl = await loadImageAsync(pictureData.imagePath);
        
        // 将加载的图片URL保存到数据中，避免重复加载
        pictureData.image = imageUrl;
        
        EventBus.$emit('showPictureDetail', pictureData);
        
      } catch (error) {
        console.error('❌ 图片懒加载失败:', error);
        
        // 即使图片加载失败，也显示弹窗（只是没有图片）
        EventBus.$emit('showPictureDetail', {
          ...pictureData,
          image: null,
          imageError: true
        });
      }
    } else {
      // 没有图片路径，直接显示
      EventBus.$emit('showPictureDetail', pictureData);
    }
    
  } catch (error) {
    console.error('❌ 处理画作详情时出错:', error);
    
    // 出错时仍然显示弹窗
    EventBus.$emit('showPictureDetail', pictureData);
  }
}

async function onClick(selectObj, app) {
  if (app.controls.isClickLock) {
    return;
  }

  // 检查多种可能的地板名称，包括实际的地面名称
  const floorNames = ['地板', 'floor', 'Floor', 'floor003', 'ground', 'Ground', 'G-Object_1'];
  const isFloor = selectObj?.object?.name && floorNames.some(name => 
    selectObj.object.name === name || selectObj.object.name.includes(name)
  );

  if (isFloor) {
    const point = selectObj.point;
    
    // === 修复：点击地面时显示圆圈 0.5 秒 ===
    if (app.iconGroup) {
      app.iconGroup.position.copy(point.clone().add(new THREE.Vector3(0, 0.01, 0)));
      app.iconGroup.visible = true;
      if (app._iconGroupTimer) clearTimeout(app._iconGroupTimer);
      app._iconGroupTimer = setTimeout(() => {
        app.iconGroup.visible = false;
      }, 500);
    }
    // === END ===
    
    // 修改碰撞检测：使用1单位安全距离，如果超出则移动到安全边界
    const currentPos = app.camera.position.clone();
    let targetPos = new THREE.Vector3(point.x, app.camera.position.y, point.z);
    
    // 检查目标位置是否安全，如果不安全则调整到安全位置
    targetPos = findSafePosition(app, currentPos, targetPos);
    
    let position,
      controls,
      isContains = false;
    for (const key in app.helperBox) {
      if (Object.hasOwnProperty.call(app.helperBox, key)) {
        const obj = app.helperBox[key];
        if (obj.box.containsPoint(new THREE.Vector3(targetPos.x, point.y, targetPos.z))) {
          isContains = true;
          position = obj.position;
          controls = obj.controls;
        }
      }
    }

    if (!isContains) {
      // 🔥 修复：保持当前朝向，不强制改变相机朝向
      // 获取当前相机朝向，计算新位置下的目标点
      const currentDirection = new THREE.Vector3();
      app.camera.getWorldDirection(currentDirection);
      
      position = [targetPos.x, app.camera.position.y, targetPos.z];
      
      // 在新位置保持当前朝向
      const newCameraPos = new THREE.Vector3(targetPos.x, app.camera.position.y, targetPos.z);
      const newTarget = newCameraPos.clone().add(currentDirection.multiplyScalar(5));
      
      controls = [newTarget.x, newTarget.y, newTarget.z];
    }

    app.flyTo({
      position,
      controls,
      done: () => {
        app.iconGroup.visible = true;
        // 🔥 修复：移动完成后不强制更新控制器目标，保持当前朝向
        // app.controls.target.copy(targetPosition);
        // app.controls.update();
      },
      start: () => {
        app.iconGroup.visible = false;
      }
    });
  }

  if (selectObj?.object?.name.indexOf('pic') > -1) {
    const model = selectObj.object;
    let obj = generatePicData(model.name);
    
    // 🔧 新增：如果没有数据（返回null），则不执行任何操作
    if (!obj) {
      console.log(`ℹ️ ${model.name} 没有API数据，跳过点击操作`);
      return;
    }
    
    // 检查是否是二次点击同一画作
    if (app.currentViewingPicture === model.name && app.isInViewingPosition) {
      
      // 动态获取支持自定义上传的画作列表
      const { getCustomUploadPictures } = await import('@/assets/data.js');
      const customUploadPictures = getCustomUploadPictures();
      
      // 检查是否是支持自定义上传的画作（专属展位）
      if (customUploadPictures.includes(model.name)) {
        console.log('🎨', model.name, '- 专属展位，检查是否有自定义作品');
        
        // 检查是否已有自定义上传的作品
        const customArtwork = localStorage.getItem(`customArtwork_${model.name}`);
        if (customArtwork) {
          try {
            const artworkData = JSON.parse(customArtwork);
            console.log('🎯 已有自定义作品，显示详情:', artworkData.title);
            EventBus.$emit('showPictureDetail', artworkData);
          } catch (error) {
            console.error('❌ 读取自定义作品失败:', error);
            // 失败时显示上传弹窗
            console.log('📁 数据读取失败，显示上传弹窗');
            EventBus.$emit('showPictureUpload', model.name);
          }
        } else {
          // 没有自定义作品，显示上传弹窗
          console.log('📁 没有自定义作品，显示上传弹窗');
          EventBus.$emit('showPictureUpload', model.name);
        }
        return;
      }
      
      // 其他画作懒加载图片并显示详情弹窗
      await loadPictureAndShow(obj);
      return;
    }
    
    // 第一次点击或点击不同画作，移动摄像机
    
    // 获取画作的位置，取得准确的中心点
    const modelPosition = model.position.clone();
    
    // 计算画作的包围盒，获取真实尺寸
    const boundingBox = new THREE.Box3().setFromObject(model);
    const size = new THREE.Vector3();
    boundingBox.getSize(size);
    

    
    // 获取画作的最大边（排除画框厚度）
    // 将三个维度排序，取最大的两个维度中的最大值（排除最小的画框厚度）
    const dimensions = [size.x, size.y, size.z].sort((a, b) => b - a); // 降序排列
    const maxDimension = dimensions[0]; // 最大的维度
 

    
    // 检查是否是需要特殊处理的画作（需要在使用前定义）
    const specialPictures = ['pic20', 'pic21', 'pic24', 'pic25', 'pic26'];
    const isSpecialPicture = specialPictures.includes(model.name);
    
    // 根据相机视角和画作尺寸计算最佳观看距离
    const fov = app.camera.fov * Math.PI / 180; // 转换为弧度
    const idealDistance = (maxDimension / 2) / Math.tan(fov / 2);
    
    // 检测是否为移动设备
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
                     (window.innerWidth <= 768) || 
                     ('ontouchstart' in window);
    
    // 根据画作尺寸动态调整距离
    let extraDistance = 0;
    const sizeThreshold = 3.0; // 3米作为大小画作的分界线
    
    if (maxDimension < sizeThreshold) {
      // 小画作：增加0.5米距离，避免过近
      extraDistance = 0.5;

    } else {
      // 大画作：减少0.5米距离，避免过远
      extraDistance = -0.5;

    }
    
    // 手机版本额外增加距离，确保能看到完整的图片模型
    if (isMobile) {
      extraDistance += 1.5; // 手机版本额外增加1.5米距离

    }
    
    // 特殊画作额外处理（如果需要）
    if (isSpecialPicture) {
      // 特殊画作标记
    }
    
    // 添加适当的安全边距，确保画作完整显示且不会太近
    const safetyMargin = Math.max(1.0, maxDimension * 0.3); // 至少1米，或画作最大边的30%
    const cameraDistance = idealDistance + safetyMargin;
    
    // 对于特别大的画作，限制最大距离，避免离得太远
    const maxDistance = 8.0;
    const finalDistance = Math.min(cameraDistance, maxDistance);
    

    
    // 从画作位置获取画作的正面朝向（通过画作的世界矩阵）
    const modelMatrix = model.matrixWorld.clone();
    
    // === 画作朝向分析 ===
    
    // 尝试不同的本地朝向轴
    const localForwardZ = new THREE.Vector3(0, 0, 1);  // Z轴正方向
    
    const worldForwardZ = localForwardZ.clone().applyMatrix4(modelMatrix).sub(modelPosition).normalize();
    


    
    // 对于特殊画作，我们尝试使用X轴作为朝向（可能画作的朝向不是Z轴）
    let worldForward;
    if (isSpecialPicture) {
      // 特殊画作可能朝向不同，先尝试X轴
      worldForward = worldForwardZ.clone(); // 先用Z轴试试

    } else {
      // 普通画作使用Z轴朝向
      worldForward = worldForwardZ.clone();

    }
    
    let viewDirection;
    if (isSpecialPicture) {
      // 对于特殊画作，摄像机移动到正面观看（取反方向）
      viewDirection = worldForward.clone().multiplyScalar(-1);

    } else {
      // 其他画作从背面观看（原方向）
      viewDirection = worldForward.clone();

    }
    

    
    // 定义点击时的额外靠近距离
    const clickExtraDistance = -0.5; // 点击时额外靠近0.5米
    
    // 距离计算完成
    
    // 使用动态计算的距离设置相机位置，并添加0.5米的额外靠近距离
    const cameraPosition = modelPosition.clone().add(
      viewDirection.clone().multiplyScalar(finalDistance + extraDistance + clickExtraDistance)
    );
    
    // 固定相机高度为2.5米，保持平视
    cameraPosition.y = 2.5;
    
    // 调整画作观看目标点，确保平视
    const targetPosition = modelPosition.clone();
    targetPosition.y = 2.5; // 与相机同高，实现平视
    
    // 创建一个临时相机，使用lookAt计算正确的视线方向
    const tempCamera = new THREE.PerspectiveCamera();
    tempCamera.position.copy(cameraPosition);
    tempCamera.lookAt(targetPosition);
    
    // 获取经过lookAt计算后的相机目标方向
    const lookAtDirection = new THREE.Vector3(0, 0, -1).applyQuaternion(tempCamera.quaternion);
    
    // 根据lookAt计算的方向，计算相机前方5米处的目标点（确保视线方向完全正对画作）
    const targetLookAt = cameraPosition.clone().add(lookAtDirection.multiplyScalar(5));
    

    
    // 设置相机位置和目标点
    const position = [cameraPosition.x, cameraPosition.y, cameraPosition.z];
    const controls = [targetLookAt.x, targetLookAt.y, targetLookAt.z];
    
    // 使用flyTo移动相机
    app.flyTo({
      position,
      controls,
      done: () => {
        // 完成后强制确保相机正对画作
        app.controls.target.copy(targetPosition);
        app.controls.update();
        
        // 更新状态：现在处于观看位置
        app.currentViewingPicture = model.name;
        app.isInViewingPosition = true;
        

        
        // 不再自动显示旧的视频弹窗
        // if (obj) {
        //   EventBus.$emit('changeDialog', obj);
        // }
      },
      start: () => {
        app.iconGroup.visible = false;
        
        // 重置状态：开始移动时清除观看状态
        app.isInViewingPosition = false;
        app.currentViewingPicture = null;
      }
    });
  }
}

function onMouseMove(selectObj, app) {
  // 检查多种可能的地板名称，包括实际的地面名称
  const floorNames = ['地板', 'floor', 'Floor', 'floor003', 'ground', 'Ground', 'G-Object_1'];
  const isFloor = selectObj?.object?.name && floorNames.some(name => 
    selectObj.object.name === name || selectObj.object.name.includes(name)
  );
  
  if (isFloor) {
    const point = selectObj.point;
    // 地板点击处理
    
    // 使用灰色圆圈
    app.iconGroup.children.forEach(child => {
      if (child.material) {
        // 设置为灰色
        child.material.color.setHex(0x888888);
        child.material.opacity = child.geometry.type === 'CircleGeometry' ? 0.3 : 0.7;
      }
    });
    
    app.iconGroup.position.copy(point.add(new THREE.Vector3(0, 0.01, 0)));
    app.iconGroup.visible = true;
  } else {
    app.iconGroup.visible = false;
  }
}

function createIconGroup(app) {
  const group = new THREE.Group();

  const circleGeometry = new THREE.CircleGeometry(0.2, 32);
  const circleMaterial = new THREE.MeshBasicMaterial({
    color: '#888888',
    transparent: true,
    opacity: 0.2
  });
  const circle = new THREE.Mesh(circleGeometry, circleMaterial);
  circle.rotateX(-0.5 * Math.PI);
  group.add(circle);

  const ringGeometry = new THREE.RingGeometry(0.22, 0.2, 32);
  const ringMaterial = new THREE.MeshBasicMaterial({
    color: '#888888',
    transparent: true,
    opacity: 0.7,
    side: THREE.DoubleSide
  });
  const ring = new THREE.Mesh(ringGeometry, ringMaterial);
  ring.rotateX(-0.5 * Math.PI);
  group.add(ring);

  group.position.set(0.63, 1, -18.18);
  group.visible = false;
  app.iconGroup = group;
  app.scene.add(group);
}

// 寻找安全位置的函数
function findSafePosition(app, currentPos, targetPos) {
  const safetyDistance = 1.5; // 统一安全距离为1.5单位
  
  // 如果没有场景或模型，返回原目标位置
  if (!app.scene || !app.rayModel) {
    return targetPos;
  }

  // 创建射线检测器
  if (!app.collisionRaycaster) {
    app.collisionRaycaster = new THREE.Raycaster();
  }

  // 获取碰撞物体
  const collisionObjects = [];
  app.rayModel.forEach(obj => {
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
    return targetPos; // 没有碰撞物体，返回原目标位置
  }

  // 计算从当前位置到目标位置的方向
  const direction = new THREE.Vector3().subVectors(targetPos, currentPos);
  const totalDistance = direction.length();
  direction.normalize();

  // 设置射线
  app.collisionRaycaster.set(currentPos, direction);
  const intersects = app.collisionRaycaster.intersectObjects(collisionObjects, true);

  if (intersects.length > 0) {
    const closestIntersect = intersects[0];
    const collisionDistance = closestIntersect.distance;
    
    // 如果碰撞距离小于总距离加上安全距离，需要调整位置
    if (collisionDistance < totalDistance + safetyDistance) {
      // 计算安全位置：在碰撞点前安全距离处停下
      const safeDistance = Math.max(0, collisionDistance - safetyDistance);
      const safePosition = currentPos.clone().add(direction.clone().multiplyScalar(safeDistance));
      
  
      return safePosition;
    }
  }

  // 额外检查：从目标位置向四周检测，确保周围有足够空间
  const targetCheckDirections = [
    new THREE.Vector3(1, 0, 0),   // 右
    new THREE.Vector3(-1, 0, 0),  // 左
    new THREE.Vector3(0, 0, 1),   // 前
    new THREE.Vector3(0, 0, -1),  // 后
  ];

  for (let dir of targetCheckDirections) {
    app.collisionRaycaster.set(targetPos, dir);
    const intersects = app.collisionRaycaster.intersectObjects(collisionObjects, true);
    
    if (intersects.length > 0) {
      const distance = intersects[0].distance;
      if (distance < safetyDistance) {
        // 如果目标位置周围空间不够，向远离障碍物的方向调整
        const adjustment = dir.clone().multiplyScalar(-(safetyDistance - distance));
        targetPos.add(adjustment);
      }
    }
  }

  return targetPos;
}

/**
 * 计算画作的最佳观赏位置
 * @param {Object} app - ZThree应用实例
 * @param {Object} model - 画作模型对象
 * @returns {Object} 包含position和controls的观赏位置数据
 */
export function calculateViewingPosition(app, model) {
  if (!model || !model.geometry) {
    console.error('❌ 模型或几何体不存在');
    return null;
  }

  // 获取模型的世界位置和边界框
  const modelPosition = new THREE.Vector3();
  model.getWorldPosition(modelPosition);
  
  const box = new THREE.Box3().setFromObject(model);
  const size = new THREE.Vector3();
  box.getSize(size);
  
  const dimensions = [size.x, size.y, size.z].sort((a, b) => b - a);
  const maxDimension = dimensions[0];
  
  // 检查是否是需要特殊处理的画作
  const specialPictures = ['pic20', 'pic21', 'pic24', 'pic25', 'pic26'];
  const isSpecialPicture = specialPictures.includes(model.name);
  
  // 根据相机视角和画作尺寸计算最佳观看距离
  const fov = app.camera.fov * Math.PI / 180;
  const idealDistance = (maxDimension / 2) / Math.tan(fov / 2);
  
  // 检测是否为移动设备
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
                   (window.innerWidth <= 768) || 
                   ('ontouchstart' in window);
  
  // 根据画作尺寸动态调整距离
  let extraDistance = 0;
  const sizeThreshold = 3.0;
  
  if (maxDimension < sizeThreshold) {
    extraDistance = 0.5;
  } else {
    extraDistance = -0.5;
  }
  
  if (isMobile) {
    extraDistance += 1.5;
  }
  
  // 添加适当的安全边距
  const safetyMargin = Math.max(1.0, maxDimension * 0.3);
  const cameraDistance = idealDistance + safetyMargin;
  const maxDistance = 8.0;
  const finalDistance = Math.min(cameraDistance, maxDistance);
  
  // 从画作位置获取画作的正面朝向
  const modelMatrix = model.matrixWorld.clone();
  const localForwardZ = new THREE.Vector3(0, 0, 1);
  const worldForward = localForwardZ.clone().applyMatrix4(modelMatrix).sub(modelPosition).normalize();
  
  let viewDirection;
  if (isSpecialPicture) {
    viewDirection = worldForward.clone().multiplyScalar(-1);
  } else {
    viewDirection = worldForward.clone();
  }
  
  // 计算相机位置
  const clickExtraDistance = -0.5; // 点击时额外靠近0.5米
  const cameraPosition = modelPosition.clone().add(
    viewDirection.clone().multiplyScalar(finalDistance + extraDistance + clickExtraDistance)
  );
  
  // 固定相机高度为2.5米
  cameraPosition.y = 2.5;
  
  // 调整画作观看目标点
  const targetPosition = modelPosition.clone();
  targetPosition.y = 2.5;
  
  // 创建临时相机计算正确的视线方向
  const tempCamera = new THREE.PerspectiveCamera();
  tempCamera.position.copy(cameraPosition);
  tempCamera.lookAt(targetPosition);
  
  const lookAtDirection = new THREE.Vector3(0, 0, -1).applyQuaternion(tempCamera.quaternion);
  const targetLookAt = cameraPosition.clone().add(lookAtDirection.multiplyScalar(5));
  
  return {
    position: [cameraPosition.x, cameraPosition.y, cameraPosition.z],
    controls: [targetLookAt.x, targetLookAt.y, targetLookAt.z],
    pictureName: model.name
  };
}
