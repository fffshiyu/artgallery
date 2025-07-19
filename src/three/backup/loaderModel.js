import * as THREE from 'three';
import EventBus from '@/bus';
import { loaderRoam } from './loaderRoam';

// 修复材质深度和透视问题的函数
function fixMaterialsDepthIssues(model) {
  model.traverse((obj) => {
    if (obj.isMesh && obj.material) {
      // 处理单个材质
      if (obj.material.isMaterial) {
        fixSingleMaterial(obj.material);
      }
      // 处理材质数组
      else if (Array.isArray(obj.material)) {
        obj.material.forEach(material => {
          if (material.isMaterial) {
            fixSingleMaterial(material);
          }
        });
      }
      
      // 确保几何体有正确的属性
      if (obj.geometry) {
        obj.geometry.computeBoundingBox();
        obj.geometry.computeBoundingSphere();
      }
      
      // 设置渲染顺序，确保不透明物体先渲染
      obj.renderOrder = obj.material.transparent ? 1 : 0;
    }
  });
}

// 修复单个材质的函数
function fixSingleMaterial(material) {
  // 强制启用深度测试和深度写入
  material.depthTest = true;
  material.depthWrite = !material.transparent;
  
  // 设置正确的面渲染
  if (material.side === undefined) {
    material.side = THREE.FrontSide;
  }
  
  // 修复意外的透明设置
  if (material.transparent && material.opacity >= 0.99) {
    material.transparent = false;
    material.opacity = 1.0;
    material.depthWrite = true;
  }
  
  // 设置正确的混合模式
  if (!material.transparent) {
    material.blending = THREE.NormalBlending;
  }
  
  // 确保材质更新
  material.needsUpdate = true;
  
  console.log('修复材质:', material.name || '未命名', '透明:', material.transparent, '不透明度:', material.opacity);
}

export function loaderModel(app) {
  app.rayModel = [];
  app.helperBox = {};
  const oaNames = ['地板', 'G-Object353_1', 'G-Object353', 'C-组件#1', '天窗栅栏', '房顶'];
  const rayModelNames = ['地板', 'G-Object353_1', 'G-Object353', 'C-组件#1', '沙发', '中间屏'];
  return new Promise((resolve) => {
    const urls = [
      {
        type: 'rgbe',
        url: 'texture/royal_esplanade_1k.hdr',
        onLoad: (texture) => {
          texture.mapping = THREE.EquirectangularReflectionMapping;
          app.envMap = texture;
        }
      },
      {
        type: 'gltf',
        url: 'model/model.glb',
        onLoad: (object) => {
          app.model = object.scene;
        }
      }
    ];

    let urlsLength = urls.length;
    let completedFiles = 0;
    let currentFileProgress = new Array(urlsLength).fill(0);
    let lastEmittedProgress = 0;
    let skyLoadingStarted = false;
    
    // 开始加载天空盒
    const skyTexture = app.loaderSky('texture/sea/');
    
    function simulateSkyProgress() {
      if (!skyLoadingStarted) {
        skyLoadingStarted = true;
        
        // 模拟天空盒加载进度
        let skyProgress = 0;
        const skyInterval = setInterval(() => {
          skyProgress += Math.random() * 20; // 随机增长
          if (skyProgress >= 100) {
            skyProgress = 100;
            clearInterval(skyInterval);
            app.scene.background = skyTexture;
          }
          
          // 计算总体进度 (URL资源占70%，天空盒占30%)
          const urlTotalProgress = completedFiles + currentFileProgress.reduce((sum, p) => sum + p, 0);
          const urlWeight = 0.7;
          const skyWeight = 0.3;
          const overallProgress = Math.round((urlTotalProgress / urlsLength) * urlWeight * 100 + (skyProgress / 100) * skyWeight * 100);
          
          if (overallProgress > lastEmittedProgress) {
            lastEmittedProgress = overallProgress;
            EventBus.$emit('changeLoaidng', overallProgress);
          }
          
          if (overallProgress >= 100) {
            setTimeout(() => {
              EventBus.$emit('changeScene', true);
            }, 200);
          }
        }, 100);
      }
    }
    
    app.iterateLoad(
      urls,
      (xhr, fileIndex) => {
        // 计算当前文件的加载进度
        let fileProgress = 0;
        if (xhr.total && xhr.total > 0) {
          fileProgress = Math.min(1, xhr.loaded / xhr.total);
        } else if (xhr.loaded > 0) {
          fileProgress = Math.min(1, xhr.loaded / (1024 * 1024));
        }
        
        currentFileProgress[fileIndex] = fileProgress;
        
        // 开始天空盒加载（在第一个文件开始加载时）
        if (!skyLoadingStarted && fileProgress > 0) {
          simulateSkyProgress();
        }
        
        // 当单个文件完成时，更新已完成文件计数
        if (fileProgress >= 1 && currentFileProgress[fileIndex] < 1.1) {
          currentFileProgress[fileIndex] = 1.1;
          completedFiles++;
        }
      },
      () => {
        app.model.traverse((obj) => {
          // 调试：输出所有模型对象的名称和类型
          if (obj.name) {
            console.log('发现模型对象:', obj.name, '类型:', obj.type, '是否为Group:', obj.isGroup, '是否为Mesh:', obj.isMesh);
          }

          if (obj.isGroup) {
            if (rayModelNames.includes(obj.name)) {
              obj.children.forEach((item) => {
                console.log('  添加Group子对象到rayModel:', item.name);
                app.rayModel.push(item);
              });
            }
          }

          if (obj.isMesh) {
            // if (obj.name === '房顶') {
            //   obj.visible = false;
            // }

            if (oaNames.includes(obj.name)) {
              const basicMaterial = new THREE.MeshBasicMaterial();
              basicMaterial.map = obj.material.map;
              basicMaterial.color = obj.material.color;
              
              // 修复透视问题：确保材质正确设置
              basicMaterial.transparent = false;
              basicMaterial.opacity = 1.0;
              basicMaterial.depthTest = true;
              basicMaterial.depthWrite = true;
              basicMaterial.side = THREE.FrontSide;
              
              obj.material = basicMaterial;
            } else {
              // 为其他材质设置环境贴图和正确的深度属性
              if (obj.material) {
                obj.material.envMap = app.envMap;
                
                // 确保材质有正确的深度设置
                obj.material.transparent = obj.material.transparent || false;
                obj.material.opacity = obj.material.opacity || 1.0;
                obj.material.depthTest = true;
                obj.material.depthWrite = true;
                obj.material.side = obj.material.side || THREE.FrontSide;
                
                // 如果材质有透明度但不需要透明效果，强制设为不透明
                if (obj.material.transparent && obj.material.opacity >= 0.99) {
                  obj.material.transparent = false;
                  obj.material.opacity = 1.0;
                }
              }
            }

            // 🔥 将所有网格模型都添加到射线检测范围，确保新墙壁等可被检测
            app.rayModel.push(obj);

            if (obj.name.indexOf('helperBox') > -1) {
              obj.geometry.computeBoundingBox();
              const box = new THREE.Box3().setFromObject(obj);

              const position = app.getModelWorldPostion(obj);

              const childrenPosition = app.getModelWorldPostion(obj.children[0]);

              const subVec3 = childrenPosition
                .clone()
                .sub(position)
                .normalize();

              let x = 0;
              let z = 0;

              if (Math.abs(subVec3.x) > Math.abs(subVec3.z)) {
                x = subVec3.x > 0 ? 0.1 : -0.1;
              } else {
                z = subVec3.z > 0 ? 0.1 : -0.1;
              }

              const number = 100;
              position.x += -number * x;
              position.z += -number * z;

              app.helperBox[obj.name] = {
                model: obj,
                box,
                position: [position.x, childrenPosition.y, position.z],
                controls: [position.x + x, childrenPosition.y, position.z + z]
              };

              // const helper = new THREE.Box3Helper(box, 0xff0000);
              // app.scene.add(helper);
            }
          }
        });
        app.scene.add(app.model);
        
        // 添加材质修复函数，确保所有模型正确渲染
        fixMaterialsDepthIssues(app.model);
        
        // 🎨 初始化多个画作的自定义纹理系统
        initCustomTextureSystem(app);
        
        loaderRoam(app);
        resolve();
      }
    );
  });
}
// 🎨 初始化多个画作的自定义纹理系统
function initCustomTextureSystem(app) {
  // 动态获取支持自定义上传的画作列表
  import('@/assets/data.js').then((dataModule) => {
    const customPictures = dataModule.getCustomUploadPictures();
    
    // 存储原始材质和模型引用
    app.customPictureModels = {};
    app.originalMaterials = {};
    
    // 遍历找到所有支持自定义的画作模型
    app.model.traverse((obj) => {
      if (obj.isMesh && customPictures.includes(obj.name)) {
        console.log('✅ 找到自定义画作模型:', obj.name);
        
        // 保存原始材质作为备份
        app.originalMaterials[obj.name] = obj.material.clone();
        
        // 存储模型引用
        app.customPictureModels[obj.name] = obj;
        
        // 延迟加载纹理，确保模型完全初始化
        setTimeout(() => {
          loadCustomTexture(app, obj.name);
        }, 100);
      }
    });

    console.log(`🎨 自定义纹理系统初始化完成，支持 ${Object.keys(app.customPictureModels).length} 个画作位置`);
  }).catch((error) => {
    console.error('❌ 动态获取自定义画作列表失败:', error);
  });
  
  // 监听自定义作品上传事件
  EventBus.$on('customArtworkUploaded', (data) => {
    const { picName, artworkData } = data;
    console.log('🎨 检测到自定义作品上传，更新纹理:', picName);
    updateCustomTexture(app, picName, artworkData.image);
  });
  
  // 监听重置纹理事件
  EventBus.$on('resetPictureTexture', (picName) => {
    console.log('🔄 检测到重置请求，恢复默认纹理:', picName);
    resetCustomTexture(app, picName);
  });
}
// 🎨 初始化多个画作的自定义纹理系统
// function initCustomTextureSystem(app) {
//   // 支持自定义上传的画作列表
//   const customPictures = ['pic20', 'pic21', 'pic22', 'pic23', 'pic13', 'pic14', 'pic15', 'pic16', 'pic17', 'pic18','pic28','pic29','pic30','pic31','pic32','pic33'];
  
//   // 存储原始材质和模型引用
//   app.customPictureModels = {};
//   app.originalMaterials = {};
  
//   // 遍历找到所有支持自定义的画作模型
//   app.model.traverse((obj) => {
//     if (obj.isMesh && customPictures.includes(obj.name)) {
//       console.log('✅ 找到自定义画作模型:', obj.name);
      
//       // 保存原始材质作为备份
//       app.originalMaterials[obj.name] = obj.material.clone();
      
//       // 存储模型引用
//       app.customPictureModels[obj.name] = obj;
      
//       // 检查本地存储中是否有自定义作品
//       loadCustomTexture(app, obj.name);
//     }
//   });

//   console.log(`🎨 自定义纹理系统初始化完成，支持 ${Object.keys(app.customPictureModels).length} 个画作位置`);
  
//   // 监听自定义作品上传事件
//   EventBus.$on('customArtworkUploaded', (data) => {
//     const { picName, artworkData } = data;
//     console.log('🎨 检测到自定义作品上传，更新纹理:', picName);
//     updateCustomTexture(app, picName, artworkData.image);
//   });
  
//   // 监听重置纹理事件
//   EventBus.$on('resetPictureTexture', (picName) => {
//     console.log('🔄 检测到重置请求，恢复默认纹理:', picName);
//     resetCustomTexture(app, picName);
//   });
// }

// 加载自定义纹理
function loadCustomTexture(app, picName) {
  try {
    const customArtwork = localStorage.getItem(`customArtwork_${picName}`);
    if (customArtwork) {
      const artworkData = JSON.parse(customArtwork);
      console.log('🎯 检测到已保存的自定义作品，应用纹理:', picName, artworkData.title);
      updateCustomTexture(app, picName, artworkData.image);
    } else {
      console.log('📝', picName, '暂无自定义作品，使用默认纹理');
    }
  } catch (error) {
    console.error('❌ 加载自定义纹理失败:', picName, error);
  }
}

// 更新指定画作的纹理
function updateCustomTexture(app, picName, imageData) {
  const model = app.customPictureModels[picName];
  const originalMaterial = app.originalMaterials[picName];
  
  if (!model || !originalMaterial || !imageData) {
    console.warn('⚠️ 模型、原始材质或图片数据不存在:', picName);
    return;
  }

  try {
    // 创建纹理加载器
    const textureLoader = new THREE.TextureLoader();
    
    // 从 base64 数据创建纹理
    textureLoader.load(imageData, (loadedTexture) => {
      console.log('✅ 自定义纹理加载成功:', picName);
      
      // 设置纹理属性 - 已取消所有镜像设置
      loadedTexture.flipY = false;
      loadedTexture.wrapS = THREE.ClampToEdgeWrapping;
      loadedTexture.wrapT = THREE.ClampToEdgeWrapping;
      loadedTexture.minFilter = THREE.LinearFilter;
      loadedTexture.magFilter = THREE.LinearFilter;
      
      // 克隆原始材质并应用新纹理
      const newMaterial = originalMaterial.clone();
      newMaterial.map = loadedTexture;
      newMaterial.needsUpdate = true;
      
      // 应用新材质到模型
      model.material = newMaterial;
      
      console.log('🎨', picName, '纹理更新完成');
    }, undefined, (error) => {
      console.error('❌ 纹理加载失败:', picName, error);
    });
    
  } catch (error) {
    console.error('❌ 更新纹理时出错:', picName, error);
  }
}

// 重置指定画作为默认纹理
function resetCustomTexture(app, picName) {
  const model = app.customPictureModels[picName];
  const originalMaterial = app.originalMaterials[picName];
  
  if (!model || !originalMaterial) {
    console.warn('⚠️ 模型或原始材质不存在:', picName);
    return;
  }

  try {
    // 恢复原始材质
    model.material = originalMaterial.clone();
    console.log('🔄', picName, '纹理已重置为默认');
  } catch (error) {
    console.error('❌ 重置纹理失败:', picName, error);
  }
}

// 替换原有的 pic20 特定函数
function initPic20TextureSystem(app) {
  // 使用新的通用系统
  initCustomTextureSystem(app);
}
// 导出纹理管理函数，供其他模块使用
export { updateCustomTexture, resetCustomTexture, initCustomTextureSystem };

