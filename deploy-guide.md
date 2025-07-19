# 3D 画廊项目 Vercel 部署指南

## 🚀 快速部署步骤

### 方法一：通过 GitHub 自动部署（推荐）

1. **确保代码已推送到 GitHub**
   ```bash
   git add .
   git commit -m "准备部署到 Vercel"
   git push origin main
   ```

2. **访问 Vercel 网站**
   - 前往 [vercel.com](https://vercel.com)
   - 使用 GitHub 账号登录

3. **导入项目**
   - 点击 "New Project"
   - 选择您的 GitHub 仓库
   - 点击 "Import"

4. **配置项目设置**
   - **Project Name**: `3d-gallery` 或您喜欢的名称
   - **Framework Preset**: Vue.js
   - **Root Directory**: `./` (保持默认)
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
   - **Install Command**: `npm install`

5. **部署**
   - 点击 "Deploy" 按钮
   - 等待构建完成（约2-5分钟）

### 方法二：通过 Vercel CLI

1. **安装 Vercel CLI**
   ```bash
   npm i -g vercel
   ```

2. **登录 Vercel**
   ```bash
   vercel login
   ```

3. **部署项目**
   ```bash
   vercel --prod
   ```

## 📁 项目配置文件

### vercel.json
已创建配置文件，包含：
- 静态构建配置
- SPA 路由处理
- 构建产物目录设置

### package.json
确认构建脚本：
- `npm run build` - 生产构建
- `npm run serve` - 开发服务器

## 🔧 部署后检查

1. **静态资源加载**
   - 3D 模型文件 (`.glb`, `.gltf`)
   - 纹理文件 (`.hdr`, `.png`, `.jpg`)
   - 音频文件 (`.mp3`)
   - Draco 解码器文件

2. **功能测试**
   - 3D 场景加载
   - 虚拟摇杆控制
   - 碰撞检测
   - 音乐播放
   - 截图功能
   - 画作点击交互

## 🌐 自定义域名（可选）

1. 在 Vercel 项目设置中添加域名
2. 配置 DNS 记录
3. 等待 SSL 证书自动配置

## 📊 性能优化建议

1. **静态资源优化**
   - 压缩大型 3D 模型文件
   - 优化纹理图片尺寸
   - 启用 Draco 压缩

2. **加载优化**
   - 实现资源预加载
   - 添加加载进度显示
   - 优化初始包大小

## 🐛 常见问题

### 构建失败
- 检查 Node.js 版本兼容性
- 确认所有依赖已正确安装
- 查看构建日志错误信息

### 静态资源 404
- 确认 `public` 目录结构正确
- 检查文件路径大小写
- 验证 `vercel.json` 配置

### 3D 模型不显示
- 检查模型文件大小（Vercel 有文件大小限制）
- 确认 Three.js 加载器配置
- 查看浏览器控制台错误

## 📞 支持

如果遇到部署问题，可以：
1. 查看 Vercel 构建日志
2. 检查浏览器开发者工具
3. 参考 Vercel 官方文档

---

🎉 部署完成后，您的 3D 画廊将在全球 CDN 上运行！ 