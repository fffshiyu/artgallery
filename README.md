# 3D Gallery Exhibition Project / 3D展厅漫游项目

A modern 3D virtual gallery exhibition built with Vue.js and Three.js, featuring interactive camera controls, immersive navigation, and multimedia displays.

基于Vue.js和Three.js构建的现代化3D虚拟展厅漫游项目，具有交互式相机控制、沉浸式导航和多媒体展示功能。

## ✨ Features / 功能特性

- 🎨 3D Virtual Gallery Navigation / 3D虚拟展厅导航
- 🖱️ Mouse Interactive Controls / 鼠标交互控制
- 🎮 WASD Keyboard Movement / WASD键盘移动
- 🛡️ Collision Detection System / 碰撞检测系统
- 📱 Responsive Design / 响应式设计
- 🎯 Picture Display System / 图片展示系统
- 🎮 Smooth Camera Animations / 流畅的相机动画
- 🌟 Modern UI/UX Design / 现代化UI/UX设计

## 🚀 Quick Start / 快速开始

### Prerequisites / 前置要求

- Node.js v14+ (recommended v16-v18)
- npm or yarn

### Installation / 安装

```bash
npm install
```

### Running the Project / 运行项目

#### Option 1: Using the startup script (Recommended) / 选项1：使用启动脚本（推荐）

```bash
# Make the script executable / 给脚本执行权限
chmod +x start.sh

# Run the project / 运行项目
./start.sh
```

#### Option 2: Manual startup / 选项2：手动启动

If you encounter Node.js v17+ compatibility issues, use:
如果遇到Node.js v17+兼容性问题，请使用：

```bash
export NODE_OPTIONS="--openssl-legacy-provider"
npm run serve
```

#### Option 3: Standard startup / 选项3：标准启动

```bash
npm run serve
```

### Build for Production / 生产环境打包

```bash
npm run build
```

## 🎮 Controls / 操作控制

- **WASD** - Camera Movement / 相机移动
- **Mouse** - Look Around / 环视
- **Double Click** - Move to Location / 双击移动到指定位置
- **Mouse Wheel** - Zoom In/Out / 缩放

## 🛠️ Technology Stack / 技术栈

- **Frontend Framework**: Vue.js 2.6
- **3D Graphics**: Three.js
- **UI Components**: Element UI
- **Build Tool**: Vue CLI
- **Data Visualization**: ECharts, D3.js
- **Animations**: TweenJS

## 📱 Browser Support / 浏览器支持

- Chrome (recommended)
- Firefox
- Safari
- Edge

## 🔧 Troubleshooting / 故障排除

### Node.js Compatibility Issue / Node.js兼容性问题

If you encounter the error `error:0308010C:digital envelope routines::unsupported`, this is due to Node.js v17+ compatibility with older webpack versions.

如果遇到 `error:0308010C:digital envelope routines::unsupported` 错误，这是由于Node.js v17+与旧版webpack的兼容性问题。

**Solution / 解决方案:**
Use the provided startup script or set the NODE_OPTIONS environment variable:
使用提供的启动脚本或设置NODE_OPTIONS环境变量：

```bash
export NODE_OPTIONS="--openssl-legacy-provider"
```

## 📄 License / 许可证

This project is for educational and demonstration purposes.
本项目仅用于教育和演示目的。
