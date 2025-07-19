/**
 * 小地图观赏点数据
 *
 * 每个点包含：
 * - id: 唯一标识符
 * - name: 观赏点名称
 * - mapCoords: 在200x200像素小地图上的坐标 { x, y }
 * - worldCoords: 在Three.js世界中的目标坐标 { x, y, z }
 * - lookAt: 相机在到达目标点后朝向的坐标 { x, y, z }
 */
export const mapPoints = [
  {
    id: 'main-exhibition',
    name: '主展区',
    mapCoords: { x: 85, y: 45 }, // 视觉位置确定
    worldCoords: { x: 2.3, y: 2.5, z: -6.35 }, // 根据 mapCoords 精确计算
    lookAt: { x: 0.68, y: 2.5, z: -7.52 }, // 同步调整视角
  },
  {
    id: 'leisure-area',
    name: '休闲区',
    mapCoords: { x: 110, y: 120 }, // 视觉位置确定
    worldCoords: { x: 6.8, y: 2.5, z: 6.4 }, // 根据 mapCoords 精确计算
    lookAt: { x: 31.8, y: 2.5, z: 6.4 }, // 同步调整视角
  },
  {
    id: 'secondary-exhibition',
    name: '副展区',
    mapCoords: { x: 70, y: 155 }, // 视觉位置确定
    worldCoords: { x: -0.4, y: 2.5, z: 12.35 }, // 根据 mapCoords 精确计算
    lookAt: { x: -5.1, y: 2.5, z: 14.06 }, // 同步调整视角
  }
]; 