export type RoomObjectConfig = {
  id: string
  label: string
  asset?: string
  initialPosition: [number, number, number]
  scale: [number, number, number]
  rotation: [number, number, number]
  inspectCameraTarget: [number, number, number]
  movable: boolean
  friendIndex?: number
  openEvent?: 'hidden_reply_letter_open'
}
const media = (name: string) => `${import.meta.env.BASE_URL}media/${name}`
// Characters/books in the room images are inspection hotspots, never movable cutouts.
export const roomObjects: RoomObjectConfig[] = [
  { id: 'claire-envelope', label: 'Claire’s envelope', asset: media('sealed.webp'), initialPosition: [-.65, .35, -3.05], scale: [.85, .66, 1], rotation: [-.85, 0, -.12], inspectCameraTarget: [-.65, .35, -3.05], movable: true },
  { id: 'botanical-paper', label: 'Botanical stationery', asset: media('card.webp'), initialPosition: [.7, .28, -3.15], scale: [.78, .46, 1], rotation: [-.95, 0, .12], inspectCameraTarget: [.7, .28, -3.15], movable: true },
  { id: 'olive', label: 'Talk to Olive', initialPosition: [-2.1, .8, -4.45], scale: [.65, .75, 1], rotation: [0, 0, 0], inspectCameraTarget: [-2.1, .8, -4.45], movable: false, friendIndex: 0 },
  { id: 'orion', label: 'Talk to Orion', initialPosition: [2.1, 2.5, -4.45], scale: [.65, .7, 1], rotation: [0, 0, 0], inspectCameraTarget: [2.1, 2.5, -4.45], movable: false, friendIndex: 1 },
  { id: 'bunnie', label: 'Talk to 大灰', initialPosition: [2, .7, -4.45], scale: [.65, .75, 1], rotation: [0, 0, 0], inspectCameraTarget: [2, .7, -4.45], movable: false, friendIndex: 2 },
  { id: 'bear', label: 'Talk to 茶小熊', initialPosition: [-.15, .75, -4.65], scale: [.65, .75, 1], rotation: [0, 0, 0], inspectCameraTarget: [-.15, .75, -4.65], movable: false, friendIndex: 3 },
  { id: 'reading-corner', label: 'The reading corner', initialPosition: [4.55, 1.15, -1.8], scale: [1, 1.4, 1], rotation: [0, -1.2, 0], inspectCameraTarget: [4.55, 1.15, -1.8], movable: false },
]
