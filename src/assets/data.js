//import axios from 'axios'
// 🔥 移除对imgurl.js的依赖
// import imageMap4 from '../../public/imgurl.js'
let picData

// 🚀 数据同步系统
let dataUpdateCallbacks = [];

// 🚀 动态检测到的画作位置列表（从3D场景中获取）
let detectedPicturePositions = [];

// 注册数据更新回调
export function registerDataUpdateCallback(callback) {
  dataUpdateCallbacks.push(callback);
  return () => {
    const index = dataUpdateCallbacks.indexOf(callback);
    if (index > -1) {
      dataUpdateCallbacks.splice(index, 1);
    }
  };
}

// 通知所有组件数据已更新
function notifyDataUpdate() {
  console.log('🔄 通知组件数据已更新，当前作品数量:', Object.keys(picData).length);
  
  // 🚀 新增：如果已有检测到的画作位置，刷新专属展位状态
  if (detectedPicturePositions.length > 0) {
    refreshCustomUploadPositions();
    getGalleryStatus();
  }
  
  dataUpdateCallbacks.forEach(callback => {
    try {
      callback(picData);
    } catch (error) {
      console.error('❌ 数据更新回调执行失败:', error);
    }
  });
}

// 数组转换样式
function transform(pro){
	const transformedData = pro.reduce((acc, item) => {
		  acc[item.name] = {
			name: item.name,
			title: item.title,
			author: item.author,
			description: item.intro,
			imagePath: item.url,
			image: null,
			userid: item.userid
		  };
		  return acc;
		}, {});
	return transformedData
}

// 获取远端数据	
function loadDataSync() {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', 'https://www.cidea.cn/api/work', false); // false:同步
    xhr.send();
    if (xhr.status === 200) {
		var data = xhr.responseText
		var data2 = JSON.parse(data)
		picData = transform(data2.data)
		console.log('✅ 远程图片数据加载成功:', Object.keys(picData).length, '个作品');
		// 通知组件数据已更新
		notifyDataUpdate();
    } else {
        console.error('❌ 远程数据加载失败，将使用默认数据');
        // 如果远程数据加载失败，可以设置一些默认数据
        picData = {};
		notifyDataUpdate();
    }
}

// 🚀 动态更新 picData 的函数
export function updatePicData(newData) {
  if (Array.isArray(newData)) {
    picData = transform(newData);
  } else if (typeof newData === 'object') {
    picData = { ...picData, ...newData };
  }
  console.log('🔄 picData 已更新，当前作品数量:', Object.keys(picData).length);
  notifyDataUpdate();
}

// 🚀 添加单个作品
export function addArtwork(artwork) {
  if (artwork && artwork.name) {
    picData[artwork.name] = {
      name: artwork.name,
      title: artwork.title || '新作品',
      author: artwork.author || '未知作者',
      description: artwork.description || '暂无描述',
      imagePath: artwork.imagePath || artwork.url || '',
      image: artwork.image || null,
      userid: artwork.userid || null
    };
    console.log('➕ 添加作品:', artwork.name);
    notifyDataUpdate();
  }
}

// 🚀 删除单个作品
export function removeArtwork(artworkName) {
  if (picData[artworkName]) {
    delete picData[artworkName];
    console.log('➖ 删除作品:', artworkName);
    notifyDataUpdate();
  }
}

// 🚀 刷新远程数据
export function refreshRemoteData() {
  console.log('🔄 刷新远程数据...');
  loadDataSync();
}

// 初始加载数据
loadDataSync();

export { picData }

// 🎨 图片懒加载缓存
const imageCache = new Map();

// 🚀 路径转换函数：将@/路径转换为实际可访问路径
function convertImagePath(imagePath) {
  if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
    return imagePath; // 网络路径直接返回
  }
  
  if (imagePath.startsWith('@/assets/image/art/')) {
    // 将@/assets/image/art/路径转换为生产环境路径
    const fileName = imagePath.replace('@/assets/image/art/', '');
    
    // 开发环境使用webpack处理的路径
    if (process.env.NODE_ENV === 'development') {
      try {
        return require(`@/assets/image/art/${fileName}`);
      } catch (error) {
        console.warn('⚠️ 开发环境图片加载失败，使用静态路径:', fileName);
        return `/img/${fileName}`;
      }
    } else {
      // 生产环境直接使用静态路径
      return `/img/${fileName}`;
    }
  }
  
  // 其他路径保持原样
  return imagePath;
}

// 🚀 新版图片加载函数 - 基于picData，无需imgurl.js
const loadImageAsync = function(imagePath){
  return new Promise((resolve, reject) => {
    // 检查缓存
    if (imageCache.has(imagePath)) {
      console.log("📁 从缓存加载图片:", imagePath);
      resolve(imageCache.get(imagePath));
      return;
    }

    console.log("⬇️ 开始懒加载图片:", imagePath);

    try {
      // 转换图片路径
      const actualImagePath = convertImagePath(imagePath);
      console.log("🔄 路径转换:", imagePath, "→", actualImagePath);
      
      // 如果是网络URL，直接使用
      if (actualImagePath.startsWith('http://') || actualImagePath.startsWith('https://')) {
        console.log("🌐 检测到网络图片URL，直接使用:", actualImagePath);
        imageCache.set(imagePath, actualImagePath);
        resolve(actualImagePath);
        return;
      }
      
      // 检查图片是否可以加载
      const img = new Image();
      img.onload = () => {
        console.log("✅ 图片懒加载成功:", actualImagePath);
        imageCache.set(imagePath, actualImagePath);
        resolve(actualImagePath);
      };
      
      img.onerror = () => {
        console.warn("⚠️ 图片加载失败，尝试fallback策略:", actualImagePath);
        // fallback到默认图片
        handleMissingImage(imagePath).then(fallbackUrl => {
          imageCache.set(imagePath, fallbackUrl);
          resolve(fallbackUrl);
        }).catch(error => {
          console.error("❌ 图片处理失败:", imagePath, error);
          reject(error);
        });
      };
      
      img.src = actualImagePath;
      
    } catch (error) {
      console.error("❌ 图片懒加载过程出错:", imagePath, error);
      // fallback到自动处理策略
      handleMissingImage(imagePath).then(fallbackUrl => {
        imageCache.set(imagePath, fallbackUrl);
        resolve(fallbackUrl);
      }).catch(fallbackError => {
        reject(fallbackError);
      });
    }
  });
}

// 🚀 新增：生成占位图片
function generatePlaceholderImage() {
  // 创建一个简单的canvas占位图
  const canvas = document.createElement('canvas');
  canvas.width = 300;
  canvas.height = 200;
  const ctx = canvas.getContext('2d');
  
  // 绘制渐变背景
  const gradient = ctx.createLinearGradient(0, 0, 300, 200);
  gradient.addColorStop(0, '#f0f0f0');
  gradient.addColorStop(1, '#d0d0d0');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 300, 200);
  
  // 绘制文字
  ctx.fillStyle = '#666';
  ctx.font = '16px Arial';
  ctx.textAlign = 'center';
  ctx.fillText('图片加载中...', 150, 100);
  ctx.fillText('Image Loading...', 150, 120);
  
  // 转换为data URL
  const dataUrl = canvas.toDataURL('image/png');
  console.log("🎨 生成占位图片 data URL");
  return dataUrl;
}

// 🚀 增强的处理缺失图片策略
async function handleMissingImage(imagePath) {
  console.log("🔧 开始处理缺失图片:", imagePath);
  
  // 策略1: 尝试使用默认图片
  const defaultImages = [
    "/img/file-1752296537128.webp",
    "/img/file-1752296537127.webp",
    "/img/file-1752296537126.webp",
    "/img/file-1752296537125.webp"
  ];
  
  for (const defaultImg of defaultImages) {
    try {
      const img = new Image();
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
        img.src = defaultImg;
      });
      console.log("🖼️ 使用默认占位图片:", defaultImg);
      return defaultImg;
    } catch (error) {
      console.log("⚠️ 默认图片不可用:", defaultImg);
    }
  }
  
  // 策略2: 生成Canvas占位图
  console.log("🎨 所有默认图片都不可用，生成Canvas占位图");
  return generatePlaceholderImage();
}

export { loadImageAsync }

// ==================== 自定义上传功能相关 ====================

// 🚀 新增：设置检测到的画作位置列表
export function setDetectedPicturePositions(positions) {
  detectedPicturePositions = positions;
  console.log('🎯 更新检测到的画作位置列表:', positions.length, '个位置');
}

// 🚀 新增：获取检测到的画作位置列表
export function getDetectedPicturePositions() {
  return detectedPicturePositions;
}

// 动态获取当前可自定义上传的画作列表
export function getCustomUploadPictures() {
  // 🔥 修改：基于动态检测和API数据状态来确定可上传位置
  const customUploadPositions = [];
  
  // 遍历所有检测到的画作位置
  detectedPicturePositions.forEach(picName => {
    // 检查是否有API数据
    const hasApiData = picData && picData[picName] && !picData[picName].isUploadPlaceholder;
    
    // 检查是否有自定义上传的数据
    const hasCustomData = localStorage.getItem(`customArtwork_${picName}`);
    
    // 如果没有API数据，则设为可上传位置
    if (!hasApiData) {
      customUploadPositions.push(picName);
    }
  });
  
  console.log('🎨 动态计算可上传位置:', customUploadPositions.length, '个位置');
  return customUploadPositions;
}

// 🚀 新增：刷新可上传位置列表（当API数据变化时调用）
export function refreshCustomUploadPositions() {
  const customUploadPositions = getCustomUploadPictures();
  console.log('🔄 刷新可上传位置列表:', customUploadPositions.length, '个位置');
  console.log('📋 当前专属展位:', customUploadPositions);
  return customUploadPositions;
}

// 🚀 新增：获取所有展位的状态概览
export function getGalleryStatus() {
  const status = {
    total: detectedPicturePositions.length,
    withApiData: 0,
    customUpload: 0,
    withCustomArtwork: 0,
    available: 0
  };
  
  detectedPicturePositions.forEach(picName => {
    const hasApiData = picData && picData[picName] && !picData[picName].isUploadPlaceholder;
    const hasCustomArtwork = localStorage.getItem(`customArtwork_${picName}`);
    
    if (hasApiData) {
      status.withApiData++;
    } else {
      status.customUpload++;
      if (hasCustomArtwork) {
        status.withCustomArtwork++;
      } else {
        status.available++;
      }
    }
  });
  
  console.log('📊 画廊状态概览:', status);
  return status;
}

// 检查指定画作是否可以自定义上传
export function isCustomUploadable(picName) {
  return getCustomUploadPictures().includes(picName);
}

// ==================== 生成画作数据函数 ====================

// 为其他未定义的画作生成默认数据
export function generatePicData(picName) {
  // 🔥 新增：添加调试日志
  console.log(`🔍 generatePicData调用 - picName: ${picName}`);
  
  // 如果已经存在数据，直接返回
  if (picData[picName]) {
    console.log(`✅ 从picData返回 ${picName}:`, picData[picName]);
    return picData[picName];
  }

  // 检查是否有自定义上传的作品
  const customArtwork = localStorage.getItem(`customArtwork_${picName}`);
  if (customArtwork) {
    try {
      const parsed = JSON.parse(customArtwork);
      console.log(`📁 从localStorage返回 ${picName}:`, parsed);
      return parsed;
    } catch (error) {
      console.error('❌ 解析自定义作品数据失败:', error);
    }
  }

  // 🔥 修改：检查是否是检测到的画作位置
  const isDetectedPicture = detectedPicturePositions.includes(picName);
  console.log(`🎨 ${picName} 是否为检测到的画作位置:`, isDetectedPicture);

  // 🔥 修改：只为检测到的画作位置且没有API数据的位置提供占位数据
  if (isDetectedPicture) {
    // 检查是否有API数据
    const hasApiData = picData && picData[picName] && !picData[picName].isUploadPlaceholder;
    
    if (!hasApiData) {
      // 没有API数据，生成专属展位数据
      const uploadData = {
        name: picName,
        title: "你的专属展位",
        author: "等待你的作品",
        description:
          "这里是为你特别准备的展示空间！点击这里可以上传你的艺术作品，填写作品名称和作者信息，让你的创意在这个虚拟画廊中闪闪发光。支持 JPG、PNG、GIF 格式，并且可以裁剪调整，快来展示你的艺术才华吧！",
        imagePath: "", // 🔥 不分配任何本地图片
        image: null,
        url: "",
        isUploadPlaceholder: true,
      };
      console.log(`🎯 生成专属展位数据 ${picName}:`, uploadData);
      return uploadData;
    } else {
      // 有API数据，但generatePicData被调用说明可能有问题
      console.log(`⚠️ ${picName} 有API数据但generatePicData被调用，可能存在数据同步问题`);
      return picData[picName];
    }
  }

  // 🔥 修改：对于其他画作（不在检测列表中），返回空数据
  console.log(`❌ ${picName} 不是检测到的画作位置，返回null`);
  return null; // 返回null表示该位置没有画作数据
}

// 🚀 新增：自动文件管理系统
let autoImageManager = null;

// 🚀 新增：初始化自动图片管理器
export function initAutoImageManager() {
  if (autoImageManager) return autoImageManager;
  
  autoImageManager = {
    // 存储已知的图片文件
    knownImages: new Set(),
    // 默认模板图片
    templateImages: [
      'file-1752296537128.webp',
      'file-1752296537127.webp', 
      'file-1752296537126.webp',
      'file-1752296537125.webp'
    ],
    
    // 检测并处理新图片
    async detectAndCreateImage(imagePath) {
      const fileName = imagePath.split('/').pop();
      
      if (this.knownImages.has(fileName)) {
        console.log("ℹ️ 图片已存在:", fileName);
        return true;
      }
      
      console.log("🔍 检测到新图片文件需求:", fileName);
      
      // 尝试自动创建图片文件
      if (fileName.includes('file-') && fileName.endsWith('.webp')) {
        const created = await this.createMissingImageFile(fileName);
        if (created) {
          this.knownImages.add(fileName);
          return true;
        }
      }
      
      return false;
    },
    
    // 创建缺失的图片文件 (模拟文件操作)
    async createMissingImageFile(fileName) {
      console.log("📁 模拟创建图片文件:", fileName);
      
      // 在实际应用中，这里可以：
      // 1. 从服务器下载图片
      // 2. 复制模板图片
      // 3. 生成占位图片
      
      // 现在我们只是标记为已处理，实际的文件操作需要服务端支持
      console.log("✅ 图片文件已模拟创建:", fileName);
      return true;
    }
  };
  
  console.log("🚀 自动图片管理器已初始化");
  return autoImageManager;
}

// 🚀 开发调试：全局暴露动态展位系统状态查询函数
if (typeof window !== 'undefined') {
  window.galleryDebug = {
    // 查看所有检测到的画作位置
    getDetectedPositions: () => {
      console.log('🔍 检测到的画作位置:', detectedPicturePositions);
      return detectedPicturePositions;
    },
    
    // 查看当前可上传的专属展位
    getCustomUploadPositions: () => {
      const positions = getCustomUploadPictures();
      console.log('🎨 当前专属展位:', positions);
      return positions;
    },
    
    // 查看画廊整体状态
    getGalleryStatus: () => {
      return getGalleryStatus();
    },
    
    // 查看API数据
    getApiData: () => {
      console.log('📡 API数据:', picData);
      return picData;
    },
    
    // 刷新专属展位状态
    refresh: () => {
      console.log('🔄 手动刷新专属展位状态...');
      return refreshCustomUploadPositions();
    },
    
    // 模拟API数据变化
    simulateApiUpdate: (newData) => {
      console.log('🧪 模拟API数据更新...');
      updatePicData(newData);
    }
  };
  
  console.log('🛠️ 动态展位系统调试工具已挂载到 window.galleryDebug');
  console.log('💡 使用方法:');
  console.log('  window.galleryDebug.getDetectedPositions() - 查看检测到的画作位置');
  console.log('  window.galleryDebug.getCustomUploadPositions() - 查看专属展位');
  console.log('  window.galleryDebug.getGalleryStatus() - 查看画廊状态');
  console.log('  window.galleryDebug.refresh() - 刷新专属展位状态');
}
