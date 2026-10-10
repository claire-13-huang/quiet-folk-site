// URL-only module: importing it does not fetch artwork or the WebGL bundle.
export const roomViews = [
  { asset: new URL('../图片/3d图3.png', import.meta.url).href, yaw: -1.05 },
  { asset: new URL('../图片/3d衔接图.png', import.meta.url).href, yaw: 0 },
  { asset: new URL('../图片/3d图1.png', import.meta.url).href, yaw: 1.35 },
  { asset: new URL('../图片/3d图2.png', import.meta.url).href, yaw: 2.65 },
] as const
export const roomEntry = roomViews[1].asset
