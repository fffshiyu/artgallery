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
  
  // 调试输出已移除
}

export function loaderModel(app) {
  app.rayModel = [];
  app.helperBox = {};
  const oaNames = ['地板', 'G-Object353_1', 'G-Object353', 'C-组件#1', '天窗栅栏', '房顶'];
  const rayModelNames = ['地板', 'G-Object353_1', 'G-Object353', 'C-组件#1', '沙发', '中间屏'];
  
  return new Promise((resolve) => {
  
    
    // 创建多个Promise来追踪不同资源的加载
    const loadingPromises = [];
    
    // 1. 环境贴图加载Promise
    const envMapPromise = new Promise((resolveEnvMap) => {
      
      app.loaderModel({
        type: 'rgbe',
        url: 'texture/royal_esplanade_1k.hdr',
        onLoad: (texture) => {
          texture.mapping = THREE.EquirectangularReflectionMapping;
          app.envMap = texture;
          
          resolveEnvMap(texture);
        },
        onProgress: (xhr) => {
          const progress = xhr.loaded / xhr.total * 100;
          
          EventBus.$emit('changeLoaidng', Math.round(progress * 0.3)); // 环境贴图占30%
        },
        onError: (error) => {
          console.error('❌ 环境贴图加载失败:', error);
          resolveEnvMap(null); // 即使失败也resolve，避免卡住
        }
      });
    });
    
    // 2. 3D模型加载Promise
    const modelPromise = new Promise((resolveModel) => {
      
      app.loaderModel({
        type: 'gltf',
        url: 'model/model.glb',
        onLoad: (object) => {
          app.model = object.scene;
          
          resolveModel(object.scene);
        },
        onProgress: (xhr) => {
          const progress = xhr.loaded / xhr.total * 100;
          
          EventBus.$emit('changeLoaidng', Math.round(30 + progress * 0.4)); // 3D模型占40%，从30%开始
        },
        onError: (error) => {
          console.error('❌ 3D模型加载失败:', error);
          resolveModel(null); // 即使失败也resolve，避免卡住
        }
      });
    });
    
    // 3. 天空盒加载Promise
    const skyBoxPromise = new Promise((resolveSkyBox) => {
      
      
      // 简化天空盒加载进度处理
      let skyBoxProgress = 0;
      const skyBoxProgressInterval = setInterval(() => {
        skyBoxProgress += 5; // 每100ms增加5%
        if (skyBoxProgress <= 100) {
          
          EventBus.$emit('changeLoaidng', Math.round(70 + skyBoxProgress * 0.2)); // 天空盒占20%，从70%开始
        }
        if (skyBoxProgress >= 100) {
          clearInterval(skyBoxProgressInterval);
          }
        }, 100);
      
      app.loaderSky(
        'texture/sea/',
        // onLoad - 天空盒加载完成
        (texture) => {
          clearInterval(skyBoxProgressInterval);

          EventBus.$emit('changeLoaidng', 90); // 确保进度到90%
          resolveSkyBox(texture);
        },
        // onProgress - 天空盒加载进度（可能不稳定，我们使用定时器代替）
        undefined,
        // onError - 天空盒加载错误
        (error) => {
          clearInterval(skyBoxProgressInterval);
          console.error('❌ 天空盒加载失败:', error);
          resolveSkyBox(null); // 即使失败也resolve，避免卡住
        }
      );
    });
    
    // 将所有Promise添加到数组中
    loadingPromises.push(envMapPromise, modelPromise, skyBoxPromise);
    
    // 使用Promise.all()等待所有资源加载完成
    // 添加超时保护机制
    const loadingTimeout = setTimeout(() => {
      
      EventBus.$emit('changeLoaidng', 100);
      EventBus.$emit('changeScene', true);
    }, 30000); // 30秒超时
    
    Promise.all(loadingPromises).then(([envMapTexture, modelScene, skyBoxTexture]) => {
      clearTimeout(loadingTimeout); // 清除超时定时器
      
      
      // 检查关键资源是否加载成功
      if (!modelScene) {
        console.error('❌ 3D模型加载失败，无法继续');
        // 即使模型加载失败，也要显示场景，避免卡住
        EventBus.$emit('changeScene', true);
        return;
      }
      
      // 4. 应用环境贴图到材质
      
      if (envMapTexture) {
        app.model.traverse((obj) => {
          if (obj.name) {
            // 模型处理已简化
          }

          if (obj.isGroup) {
            if (rayModelNames.includes(obj.name)) {
              obj.children.forEach((item) => {
                // 添加Group子对象到rayModel处理已简化
                app.rayModel.push(item);
              });
            }
          }

          if (obj.isMesh) {
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
              // 为其他材质设置环境贴图
              if (obj.material) {
                obj.material.envMap = envMapTexture;
                
                // 确保材质有正确的深度设置
                obj.material.transparent = obj.material.transparent || false;
                obj.material.opacity = obj.material.opacity || 1.0;
                obj.material.depthTest = true;
                obj.material.depthWrite = true;
                obj.material.side = obj.material.side || THREE.FrontSide;
                
                if (obj.material.transparent && obj.material.opacity >= 0.99) {
                  obj.material.transparent = false;
                  obj.material.opacity = 1.0;
                }
                
                obj.material.needsUpdate = true;
              }
            }

            app.rayModel.push(obj);

            if (obj.name.indexOf('helperBox') > -1) {
              obj.geometry.computeBoundingBox();
              const box = new THREE.Box3().setFromObject(obj);
              const position = app.getModelWorldPostion(obj);
              const childrenPosition = app.getModelWorldPostion(obj.children[0]);
              const subVec3 = childrenPosition.clone().sub(position).normalize();

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
            }
          }
        });
        
      } else {
        console.warn('⚠️ 环境贴图未加载成功，跳过应用');
      }
      
      // 5. 应用天空盒到场景
      if (skyBoxTexture) {
        app.scene.background = skyBoxTexture;
        
      } else {
        console.warn('⚠️ 天空盒未加载成功，跳过应用');
      }
      
      // 6. 添加模型到场景
        app.scene.add(app.model);
        
      // 7. 修复材质深度问题
        fixMaterialsDepthIssues(app.model);
        
      // 8. 初始化自定义纹理系统
      
        initCustomTextureSystem(app);
      
      // 9. 初始化漫游系统
      
      loaderRoam(app);
      
      // 10. 更新进度到90%
      
      EventBus.$emit('changeLoaidng', 90);
      
      // 11. 等待一下确保所有操作完成，然后显示场景
      setTimeout(() => {

        EventBus.$emit('changeLoaidng', 100);
        
        setTimeout(() => {
          EventBus.$emit('changeScene', true);
        }, 200);
      }, 100);
      
      // 12. 解析Promise
      resolve();
    }).catch((error) => {
      clearTimeout(loadingTimeout); // 清除超时定时器
      console.error('❌ 资源加载过程中发生错误:', error);
      // 即使有错误也要显示场景，避免卡住
      EventBus.$emit('changeLoaidng', 100);
      setTimeout(() => {
        EventBus.$emit('changeScene', true);
      }, 500);
        resolve();
    });
  });
}

// 🎨 初始化多个画作的自定义纹理系统
function initCustomTextureSystem(app) {
  // 🚀 第一步：动态检测3D场景中的所有画作模型
  const detectedPictures = [];
  
  app.model.traverse((obj) => {
    if (obj.isMesh && obj.name && obj.name.startsWith('pic')) {
      detectedPictures.push(obj.name);
    }
  });
  
  console.log('🔍 检测到画作模型:', detectedPictures.length, '个', detectedPictures);
  
  // 动态获取支持自定义上传的画作列表
  import('@/assets/data.js').then((dataModule) => {
    // 🚀 设置检测到的画作位置列表到数据系统
    dataModule.setDetectedPicturePositions(detectedPictures);
    
    // 🚀 获取动态计算的可上传位置列表
    const customPictures = dataModule.getCustomUploadPictures();
    
    console.log('🎨 动态可上传位置:', customPictures.length, '个', customPictures);
    
    // 存储原始材质和模型引用
    app.customPictureModels = {};
    app.originalMaterials = {};
    
    // 遍历找到所有支持自定义的画作模型
    app.model.traverse((obj) => {
      if (obj.isMesh && detectedPictures.includes(obj.name)) {
        // 保存原始材质作为备份
        app.originalMaterials[obj.name] = obj.material.clone();
        
        // 存储模型引用
        app.customPictureModels[obj.name] = obj;
        
        // 检查是否为可上传位置
        if (customPictures.includes(obj.name)) {
          console.log('✅ 可上传画作模型:', obj.name);
        } else {
          console.log('📋 有数据的画作模型:', obj.name);
        }
        
        // 延迟加载纹理，确保模型完全初始化
        setTimeout(() => {
          loadCustomTexture(app, obj.name);
        }, 100);
      }
    });

    // 自定义纹理系统初始化完成
    console.log('🎨 动态纹理系统初始化完成，总画作:', detectedPictures.length, '个，可上传:', customPictures.length, '个');
    
    // 🚀 注册数据更新回调，当 picData 变化时更新纹理
    const unsubscribe = dataModule.registerDataUpdateCallback((updatedPicData) => {
      console.log('🔄 3D场景收到数据更新通知，开始更新纹理...');
      updateAllTexturesFromData(app, updatedPicData);
      
      // 🚀 数据更新后，重新计算可上传位置
      const newCustomPictures = dataModule.getCustomUploadPictures();
      console.log('🔄 重新计算可上传位置:', newCustomPictures.length, '个');
    });
    
    // 保存取消订阅函数，以便后续清理
    app.unsubscribeDataUpdate = unsubscribe;
    
  }).catch((error) => {
    console.error('❌ 动态获取自定义画作列表失败:', error);
  });
  
  // 监听自定义作品上传事件
  EventBus.$on('customArtworkUploaded', (data) => {
    const { picName, artworkData } = data;
    // 检测到自定义作品上传处理已简化
    updateCustomTexture(app, picName, artworkData.image);
  });
  
  // 监听重置纹理事件
  EventBus.$on('resetTexture', (picName) => {
    resetCustomTexture(app, picName);
  });
}

// 🚀 根据更新的数据刷新所有纹理
function updateAllTexturesFromData(app, updatedPicData) {
  if (!app.customPictureModels) return;
  
  console.log('🔄 开始更新所有画作纹理...');
  
  // 遍历所有自定义画作模型
  Object.keys(app.customPictureModels).forEach(picName => {
    const model = app.customPictureModels[picName];
    if (model && model.isMesh) {
      // 检查是否有对应的新数据
      const artworkData = updatedPicData[picName];
      if (artworkData) {
        console.log(`🔄 更新纹理: ${picName} - ${artworkData.title}`);
        // 使用新数据更新纹理
        loadDefaultTextureFromPicData(app, picName);
      } else {
        console.log(`ℹ️ 画作 ${picName} 暂无数据，保持默认纹理`);
      }
    }
  });
}

// 加载自定义纹理
function loadCustomTexture(app, picName) {
  try {
    const customArtwork = localStorage.getItem(`customArtwork_${picName}`);
    if (customArtwork) {
      const artworkData = JSON.parse(customArtwork);
      // 检测到已保存的自定义作品处理已简化
      updateCustomTexture(app, picName, artworkData.image);
    } else {
      // 暂无自定义作品，尝试加载默认图片
      // 找到默认图片数据处理已简化
      loadDefaultTextureFromPicData(app, picName);
    }
  } catch (error) {
    console.error('❌ 加载自定义纹理失败:', picName, error);
  }
}

// 从 picData 加载默认纹理
function loadDefaultTextureFromPicData(app, picName) {
  // 动态导入 data.js 以获取图片数据
  import('@/assets/data.js').then((module) => {
    const { loadImageAsync, generatePicData } = module;
    
    // 🔧 新增：使用generatePicData获取数据，处理null返回值
    const pictureData = generatePicData(picName);
    
    // 🔧 新增：如果没有数据（返回null），则不加载任何纹理
    if (!pictureData) {
      console.log(`ℹ️ ${picName} 没有API数据，跳过纹理加载`);
      return;
    }
    
    if (pictureData && (pictureData.imagePath || pictureData.image || pictureData.url)) {
      // 优先使用动态图片URL（来自API）
      const imageUrl = pictureData.url || pictureData.image || pictureData.imagePath;
      
      // 🔧 新增：如果imageUrl为空，跳过加载
      if (!imageUrl) {
        console.log(`ℹ️ ${picName} 没有图片URL，跳过纹理加载`);
        return;
      }
      
      // 对于外部URL，直接使用；对于本地路径，使用 loadImageAsync 处理
      if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
        // 外部URL，直接使用
        console.log(`🌐 ${picName} 使用外部图片URL:`, imageUrl);
        updateCustomTexture(app, picName, imageUrl);
      } else {
        // 本地路径，使用 loadImageAsync 处理
        console.log(`📁 ${picName} 使用本地图片路径:`, imageUrl);
        loadImageAsync(imageUrl).then((processedUrl) => {
          updateCustomTexture(app, picName, processedUrl);
        }).catch((error) => {
          console.warn('⚠️ 图片加载失败，跳过纹理更新:', picName, error);
        });
      }
    } else {
      console.log(`ℹ️ ${picName} 暂无图片数据，跳过纹理加载`);
    }
  }).catch((error) => {
    console.error('❌ 导入 data.js 失败:', error);
  });
}

// 更新指定画作的纹理
function updateCustomTexture(app, picName, imageData) {
  const model = app.customPictureModels[picName];
  const originalMaterial = app.originalMaterials[picName];
  
  if (!model || !originalMaterial || !imageData) {
    console.warn('⚠️ 模型、原始材质或图片数据不存在:', picName);
    return;
  }

  // 🔥 添加缓存破坏机制的辅助函数
  function addCacheBuster(url) {
    if (url.startsWith('data:') || url.startsWith('blob:')) {
      // Base64 和 Blob URL 不需要缓存破坏
      return url;
    }
    
    const timestamp = Date.now();
    const separator = url.includes('?') ? '&' : '?';
    return `${url}${separator}_t=${timestamp}`;
  }

  // 预加载和纹理加载函数
  function loadTexture(src) {
    // 添加缓存破坏参数
    const cacheBustedSrc = addCacheBuster(src);
    
    // 创建纹理加载器
    const textureLoader = new THREE.TextureLoader();
    
    // 调试输出已移除
    
    // 从 base64 数据或URL创建纹理
    textureLoader.load(cacheBustedSrc, (loadedTexture) => {
      // 自定义纹理加载成功处理已简化
      
      // 设置纹理属性 - 已取消所有镜像设置
      loadedTexture.flipY = false;
      loadedTexture.wrapS = THREE.ClampToEdgeWrapping;
      loadedTexture.wrapT = THREE.ClampToEdgeWrapping;
      loadedTexture.minFilter = THREE.LinearFilter;
      loadedTexture.magFilter = THREE.LinearFilter;
      
      // 强制纹理更新
      loadedTexture.needsUpdate = true;
      
      // 克隆原始材质并应用新纹理
      const newMaterial = originalMaterial.clone();
      newMaterial.map = loadedTexture;
      newMaterial.needsUpdate = true;
      
      // 清理旧材质的纹理（释放内存）
      if (model.material && model.material.map && model.material.map !== originalMaterial.map) {
        model.material.map.dispose();
      }
      
      // 应用新材质到模型
      model.material = newMaterial;
      
      // 纹理更新完成（缓存已清理）处理已简化
    }, undefined, (error) => {
      console.error('❌ 纹理加载失败:', picName, error);
    });
  }

  try {
    // 支持Base64数据或文件路径
    let imageSrc = imageData;
    
    // 如果不是Base64格式，假设是文件路径或已解析的图片URL
    if (!imageData.startsWith('data:')) {
      // 检查是否是已经解析的图片URL（从loadImageAsync返回的）
      if (imageData.startsWith('blob:') || imageData.startsWith('http') || imageData.includes('webpack')) {
        // 直接使用已解析的URL
        loadTexture(imageData);
        return;
      }
      
      // 对于 @/ 路径，尝试通过import处理
      if (imageData.startsWith('@/')) {
        try {
          // 将 @/ 替换为相对路径以便import
          const importPath = imageData.replace('@/', '../');
          import(importPath).then((module) => {
            imageSrc = module.default || module;
            loadTexture(imageSrc);
          }).catch(() => {
            console.warn('⚠️ import失败，直接使用路径:', imageData);
            loadTexture(imageData);
          });
          return;
        } catch (error) {
          console.warn('⚠️ import处理失败:', error);
        }
      }
      
      // 对于其他路径，直接加载
      loadTexture(imageData);
      return;
    }
    
    loadTexture(imageSrc);
    
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
    // 纹理已重置为默认处理已简化
  } catch (error) {
    console.error('❌ 重置纹理失败:', picName, error);
  }
}


// 导出纹理管理函数，供其他模块使用
export { updateCustomTexture, resetCustomTexture, initCustomTextureSystem };

