import * as THREE from 'three'
import { roomViews } from '../roomAssets'
import { roomObjects, type RoomObjectConfig } from './objects'

export type Inspection = RoomObjectConfig | null
export type RoomScene = { setActive: (value: boolean) => void; inspect: (id: string) => void; leaveInspection: () => void; undo: () => void; reset: () => void; dispose: () => void }
type Snapshot = { id: string; position: THREE.Vector3; quaternion: THREE.Quaternion }
type Item = { config: RoomObjectConfig; mesh: THREE.Mesh; target: THREE.Vector3; initial: Snapshot; shadow?: THREE.Mesh }
const clamp = THREE.MathUtils.clamp

export async function createRoom(host: HTMLElement, markers: Map<string, HTMLButtonElement>, callbacks: {
  ready: () => void; inspect: (item: Inspection) => void; interact: () => void; history: (count: number) => void; error: (error: unknown) => void
}, reduced: boolean, signal: AbortSignal): Promise<RoomScene> {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'low-power' })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, navigator.maxTouchPoints > 0 ? 1.5 : 2))
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.setClearColor('#302317')
  const canvas = renderer.domElement
  canvas.tabIndex = 0; canvas.setAttribute('aria-label', 'Explore the room. Drag to look, hold stationery to move. Arrow keys look around; plus and minus zoom.'); canvas.style.touchAction = 'none'
  host.appendChild(canvas)
  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(58, 1, .08, 30)
  camera.position.set(0, 1.5, 0)
  const textures = new Set<THREE.Texture>(), items: Item[] = []
  const disposables = new Set<THREE.BufferGeometry | THREE.Material>()
  const geometry = <T extends THREE.BufferGeometry>(value: T) => { disposables.add(value); return value }
  const material = <T extends THREE.Material>(value: T) => { disposables.add(value); return value }
  const loader = new THREE.TextureLoader()
  let disposed = false, active = false, raf = 0, ready = false
  let yaw = 0, pitch = 0, targetYaw = 0, targetPitch = 0, zoom = 0, targetZoom = 0
  let inspection: Item | null = null
  const history: Snapshot[][] = []
  const raycaster = new THREE.Raycaster(), pointer = new THREE.Vector2(), direction = new THREE.Vector3(), projected = new THREE.Vector3()
  const pointers = new Map<number, { x: number; y: number }>()
  let gesture: { id: number; x: number; y: number; startX: number; startY: number; hit: Item | null; moved: boolean; timer: number } | null = null
  let grabbed: Item | null = null, beforeGrab: Snapshot | null = null, pinchDistance = 0
  const grabPlane = new THREE.Plane(), grabOffset = new THREE.Vector3(), intersection = new THREE.Vector3()
  const snapshot = (item: Item): Snapshot => ({ id: item.config.id, position: item.mesh.position.clone(), quaternion: item.mesh.quaternion.clone() })
  const restore = (state: Snapshot) => {
    const item = items.find(item => item.config.id === state.id)
    if (item) { item.target.copy(state.position); item.mesh.position.copy(state.position); item.mesh.quaternion.copy(state.quaternion) }
  }
  const addHistory = (states: Snapshot[]) => { history.push(states); if (history.length > 50) history.shift(); callbacks.history(history.length) }
  const load = async (url: string) => {
    const texture = await loader.loadAsync(url)
    if (disposed) { texture.dispose(); throw new DOMException('Room closed', 'AbortError') }
    texture.colorSpace = THREE.SRGBColorSpace; texture.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy()); textures.add(texture)
    return texture
  }
  const resize = () => {
    const { width, height } = host.getBoundingClientRect()
    if (!width || !height || disposed) return
    renderer.setSize(width, height); camera.aspect = width / height
    // Same cover projection as the entry image, including portrait devices.
    camera.fov = THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(29)) * Math.min(1, (1672 / 941) / camera.aspect)))
    camera.updateProjectionMatrix()
  }
  const observer = new ResizeObserver(resize); observer.observe(host); resize()
  const ray = (x: number, y: number) => {
    const rect = canvas.getBoundingClientRect(); pointer.set((x - rect.left) / rect.width * 2 - 1, -(y - rect.top) / rect.height * 2 + 1)
    raycaster.setFromCamera(pointer, camera)
  }
  const pick = (x: number, y: number) => {
    ray(x, y)
    const hits = raycaster.intersectObjects(items.map(item => item.mesh), false)
    // Independent paper has alpha margins. Do not grab the invisible corners.
    const hit = hits.find(hit => !hit.uv || (hit.uv.y > .15 && hit.uv.y < .98))
    return hit ? items.find(item => item.mesh === hit.object) ?? null : null
  }
  const inspect = (id: string) => {
    if (!active || grabbed) return
    const item = items.find(item => item.config.id === id); if (!item) return
    inspection = item
    const target = item.config.movable ? item.mesh.position : new THREE.Vector3(...item.config.inspectCameraTarget)
    direction.copy(target).sub(new THREE.Vector3(0, 1.5, 0))
    targetYaw = clamp(Math.atan2(direction.x, -direction.z), -1.25, 2.15)
    targetPitch = clamp(Math.atan2(direction.y, Math.hypot(direction.x, direction.z)), -.52, .46)
    targetZoom = .25; callbacks.interact(); callbacks.inspect(item.config)
  }
  const leaveInspection = () => { inspection = null; targetZoom = 0; callbacks.inspect(null) }
  const beginGrab = () => {
    const g = gesture
    if (!g || !g.hit?.config.movable || g.moved || pointers.size !== 1 || !active) return
    grabbed = g.hit; beforeGrab = snapshot(grabbed); leaveInspection()
    camera.getWorldDirection(direction)
    grabbed.target.copy(grabbed.mesh.position).addScaledVector(direction, -.09); grabbed.target.y += .07
    grabPlane.setFromNormalAndCoplanarPoint(direction, grabbed.target)
    ray(g.x, g.y)
    if (raycaster.ray.intersectPlane(grabPlane, intersection)) grabOffset.copy(grabbed.target).sub(intersection)
    canvas.style.cursor = 'grabbing'; callbacks.interact()
  }
  const finishGrab = (cancel: boolean) => {
    if (grabbed && beforeGrab) {
      if (cancel) restore(beforeGrab)
      else {
        grabbed.target.y = grabbed.initial.position.y
        grabbed.mesh.position.copy(grabbed.target)
        if (grabbed.mesh.position.distanceTo(beforeGrab.position) > .015) addHistory([beforeGrab])
      }
    }
    grabbed = null; beforeGrab = null; canvas.style.cursor = 'grab'
  }
  const cancelGesture = () => {
    if (gesture) clearTimeout(gesture.timer)
    finishGrab(true); gesture = null; pointers.clear(); pinchDistance = 0
  }
  const down = (event: PointerEvent) => {
    if (!active || !ready || (event.pointerType === 'mouse' && event.button !== 0)) return
    event.preventDefault(); canvas.focus({ preventScroll: true }); canvas.setPointerCapture(event.pointerId)
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY }); callbacks.interact()
    if (pointers.size > 1) {
      if (gesture) clearTimeout(gesture.timer)
      finishGrab(true); gesture = null
      const pair = [...pointers.values()]; pinchDistance = Math.hypot(pair[0].x - pair[1].x, pair[0].y - pair[1].y); return
    }
    gesture = { id: event.pointerId, x: event.clientX, y: event.clientY, startX: event.clientX, startY: event.clientY, hit: pick(event.clientX, event.clientY), moved: false, timer: 0 }
    if (gesture.hit?.config.movable) gesture.timer = window.setTimeout(beginGrab, 360)
  }
  const move = (event: PointerEvent) => {
    if (!active || !ready) return
    if (!pointers.has(event.pointerId)) { if (event.pointerType === 'mouse') canvas.style.cursor = pick(event.clientX, event.clientY) ? 'pointer' : 'grab'; return }
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY })
    if (pointers.size > 1) {
      const pair = [...pointers.values()], distance = Math.hypot(pair[0].x - pair[1].x, pair[0].y - pair[1].y)
      if (pinchDistance) targetZoom = clamp(targetZoom + (distance - pinchDistance) * .002, -.12, .38)
      pinchDistance = distance; return
    }
    const g = gesture; if (!g || g.id !== event.pointerId) return
    if (grabbed) {
      ray(event.clientX, event.clientY)
      if (raycaster.ray.intersectPlane(grabPlane, intersection)) {
        grabbed.target.copy(intersection).add(grabOffset)
        grabbed.target.x = clamp(grabbed.target.x, -1.65, 1.65); grabbed.target.y = clamp(grabbed.target.y, grabbed.initial.position.y + .06, grabbed.initial.position.y + .38); grabbed.target.z = clamp(grabbed.target.z, -3.55, -2.55)
        for (const other of items) if (other !== grabbed && other.config.movable && Math.hypot(other.target.x - grabbed.target.x, other.target.z - grabbed.target.z) < .42) {
          grabbed.target.x = clamp(other.target.x + (grabbed.target.x >= other.target.x ? .44 : -.44), -1.65, 1.65)
        }
      }
    } else {
      if (Math.hypot(event.clientX - g.startX, event.clientY - g.startY) > 7) { clearTimeout(g.timer); g.moved = true }
      if (g.moved) {
        if (inspection) leaveInspection()
        const speed = 1.6 / Math.max(320, canvas.clientWidth)
        targetYaw = clamp(targetYaw - (event.clientX - g.x) * speed, -1.25, 2.15)
        targetPitch = clamp(targetPitch + (event.clientY - g.y) * speed, -.52, .46)
      }
    }
    g.x = event.clientX; g.y = event.clientY
  }
  const up = (event: PointerEvent) => {
    const g = gesture
    if (g?.id === event.pointerId) {
      clearTimeout(g.timer)
      if (grabbed) finishGrab(event.type !== 'pointerup')
      else if (!g.moved && event.type === 'pointerup' && g.hit) inspect(g.hit.config.id)
      gesture = null
    }
    pointers.delete(event.pointerId); pinchDistance = 0
    if (!gesture && pointers.size === 1) {
      const [id, point] = [...pointers.entries()][0]
      gesture = { id, x: point.x, y: point.y, startX: point.x, startY: point.y, hit: null, moved: true, timer: 0 }
    }
    if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId)
  }
  const wheel = (event: WheelEvent) => { if (active && ready) { event.preventDefault(); targetZoom = clamp(targetZoom - clamp(event.deltaY, -80, 80) * .0015, -.12, .38); callbacks.interact() } }
  const undo = () => { cancelGesture(); const states = history.pop(); if (states) { states.forEach(restore); callbacks.history(history.length) } }
  const reset = () => {
    cancelGesture(); const changed = items.filter(item => item.config.movable && (item.mesh.position.distanceTo(item.initial.position) > .015 || item.mesh.quaternion.angleTo(item.initial.quaternion) > .01))
    if (changed.length) { addHistory(changed.map(snapshot)); changed.forEach(item => restore(item.initial)) }
    leaveInspection(); targetYaw = 0; targetPitch = 0; targetZoom = 0
  }
  const key = (event: KeyboardEvent) => {
    if (!active || event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement || (event.target instanceof HTMLElement && event.target.isContentEditable)) return
    if ((event.metaKey || event.ctrlKey) && !event.shiftKey && event.key.toLowerCase() === 'z') { event.preventDefault(); undo() }
    else if (event.key === 'Escape') { cancelGesture(); leaveInspection() }
    else if (event.target === canvas) {
      const handled = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', '+', '=', '-'].includes(event.key)
      if (!handled) return
      event.preventDefault(); callbacks.interact()
      if (event.key === 'ArrowLeft') targetYaw = clamp(targetYaw - .12, -1.25, 2.15)
      if (event.key === 'ArrowRight') targetYaw = clamp(targetYaw + .12, -1.25, 2.15)
      if (event.key === 'ArrowUp') targetPitch = clamp(targetPitch + .08, -.52, .46)
      if (event.key === 'ArrowDown') targetPitch = clamp(targetPitch - .08, -.52, .46)
      if (['+', '=', '-'].includes(event.key)) targetZoom = clamp(targetZoom + (event.key === '-' ? -.04 : .04), -.12, .38)
    }
  }
  const contextLost = (event: Event) => { event.preventDefault(); active = false; cancelGesture(); callbacks.error(new Error('WebGL context lost')) }
  canvas.addEventListener('pointerdown', down); canvas.addEventListener('pointermove', move); canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up); canvas.addEventListener('lostpointercapture', up); canvas.addEventListener('wheel', wheel, { passive: false }); canvas.addEventListener('webglcontextlost', contextLost)
  window.addEventListener('keydown', key); window.addEventListener('blur', cancelGesture)
  const visibility = () => { if (document.hidden) cancelGesture(); else { previousTime = performance.now(); if (!raf && !disposed) raf = requestAnimationFrame(frame) } }
  document.addEventListener('visibilitychange', visibility)
  const dispose = () => {
    if (disposed) return
    disposed = true; cancelGesture(); cancelAnimationFrame(raf); observer.disconnect()
    canvas.removeEventListener('pointerdown', down); canvas.removeEventListener('pointermove', move); canvas.removeEventListener('pointerup', up); canvas.removeEventListener('pointercancel', up); canvas.removeEventListener('lostpointercapture', up); canvas.removeEventListener('wheel', wheel); canvas.removeEventListener('webglcontextlost', contextLost)
    window.removeEventListener('keydown', key); window.removeEventListener('blur', cancelGesture); document.removeEventListener('visibilitychange', visibility)
    textures.forEach(texture => texture.dispose()); disposables.forEach(resource => resource.dispose()); scene.clear(); renderer.dispose(); renderer.forceContextLoss(); canvas.remove()
  }
  signal.addEventListener('abort', dispose, { once: true })
  let previousTime = performance.now()
  function frame(time: number) {
    raf = 0; if (disposed || document.hidden) return
    const dt = Math.min(.05, (time - previousTime) / 1000); previousTime = time
    const t = reduced ? 1 : 1 - Math.exp(-dt * 9)
    yaw = THREE.MathUtils.lerp(yaw, targetYaw, t); pitch = THREE.MathUtils.lerp(pitch, targetPitch, t); zoom = THREE.MathUtils.lerp(zoom, targetZoom, t)
    direction.set(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch))
    camera.position.set(0, 1.5, 0).addScaledVector(direction, zoom)
    camera.lookAt(direction.clone().multiplyScalar(5).add(camera.position)); camera.updateMatrixWorld()
    items.forEach(item => {
      item.mesh.position.lerp(item.target, t)
      if (item.shadow) { item.shadow.position.set(item.mesh.position.x, .065, item.mesh.position.z); item.shadow.scale.setScalar(grabbed === item ? 1.12 : 1) }
      const marker = markers.get(item.config.id); if (!marker) return
      projected.copy(item.mesh.position).project(camera)
      const visible = active && projected.z < 1 && Math.abs(projected.x) < .93 && Math.abs(projected.y) < .86
      marker.hidden = !visible; marker.style.left = `${(projected.x + 1) * 50}%`; marker.style.top = `${(1 - projected.y) * 50}%`
      marker.style.opacity = item.config.movable ? '.7' : '.45'
    })
    if (active || !ready) renderer.render(scene, camera)
    if (active || !ready) raf = requestAnimationFrame(frame)
  }
  try {
    const viewTextures = await Promise.all(roomViews.map(view => load(view.asset)))
    if (signal.aborted) throw new DOMException('Room closed', 'AbortError')
    // Rectilinear image projections on a curved shell. Adjacent views overlap only
    // at narrow, feathered joins; camera bounds avoid the incomplete rear join.
    const shellMaterial = material(new THREE.ShaderMaterial({
      uniforms: { a: { value: viewTextures[0] }, b: { value: viewTextures[1] }, c: { value: viewTextures[2] }, d: { value: viewTextures[3] } },
      side: THREE.BackSide,
      vertexShader: `varying vec3 world; void main(){ world=(modelMatrix*vec4(position,1.)).xyz; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
      fragmentShader: `varying vec3 world; uniform sampler2D a,b,c,d;
      vec3 project(sampler2D tex,vec3 ray,float yaw){float s=sin(yaw),c=cos(yaw);vec3 p=vec3(c*ray.x+s*ray.z,ray.y,-s*ray.x+c*ray.z);float depth=max(.08,-p.z);vec2 uv=vec2(.5+p.x/(depth*1.97),.5+p.y/(depth*1.1086));return texture2D(tex,clamp(uv,vec2(.003),vec2(.997))).rgb;}
      void main(){vec3 ray=normalize(world-vec3(0.,1.5,0.));float yaw=atan(ray.x,-ray.z);vec3 color;
      if(yaw<-.67){color=mix(project(a,ray,-1.05),project(b,ray,0.),smoothstep(-.77,-.67,yaw));}
      else if(yaw<.77){color=mix(project(b,ray,0.),project(c,ray,1.35),smoothstep(.67,.77,yaw));}
      else{color=mix(project(c,ray,1.35),project(d,ray,2.65),smoothstep(1.91,2.11,yaw));}
      float vertical=abs(atan(ray.y,length(ray.xz)));float fade=smoothstep(.48,.75,vertical);color=mix(color,vec3(.12,.075,.043),fade*.92);gl_FragColor=vec4(color,1.);
      #include <colorspace_fragment>
      }`
    }))
    const shell = new THREE.Mesh(geometry(new THREE.CylinderGeometry(5.7, 5.7, 9, 128, 1, true)), shellMaterial); shell.position.y = 1.5; scene.add(shell)
    // Real dark timber uprights conceal joins between imperfect reference views.
    const timber = material(new THREE.MeshBasicMaterial({ color: '#302217' }))
    for (const angle of [-.72, .72, 2.01]) {
      const upright = new THREE.Mesh(geometry(new THREE.BoxGeometry(.42, 8, .12)), timber)
      upright.position.set(Math.sin(angle) * 5.55, 1.5, -Math.cos(angle) * 5.55); upright.rotation.y = -angle; scene.add(upright)
    }
    const wood = material(new THREE.ShaderMaterial({ side: THREE.DoubleSide,
      vertexShader: `varying vec2 uvWorld; void main(){uvWorld=position.xy;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
      fragmentShader: `varying vec2 uvWorld;void main(){float grain=sin(uvWorld.y*48.+sin(uvWorld.x*3.)*.8)*.003;float join=step(.985,fract(uvWorld.y*1.8));vec3 c=vec3(.055,.027,.013)+grain-join*.008;gl_FragColor=vec4(c,1.); #include <colorspace_fragment> }`.replace(' #include', '\n#include')
    }))
    const floor = new THREE.Mesh(geometry(new THREE.PlaneGeometry(13, 13)), wood); floor.rotation.x = -Math.PI / 2; floor.position.y = -2.2; scene.add(floor)
    const ceiling = new THREE.Mesh(geometry(new THREE.PlaneGeometry(13, 13)), material(new THREE.MeshBasicMaterial({ color: '#39291e', side: THREE.DoubleSide }))); ceiling.rotation.x = Math.PI / 2; ceiling.position.y = 5.2; scene.add(ceiling)
    // Shallow real desk surface beneath the independent stationery, unobtrusive
    // against the projected tabletop and limited to its placement area.
    const desk = new THREE.Mesh(geometry(new THREE.BoxGeometry(4, .05, 1.45)), material(new THREE.MeshBasicMaterial({ color: '#704022', transparent: true, opacity: .05 }))); desk.position.set(0, .035, -3.1); scene.add(desk)
    for (const config of roomObjects) {
      const texture = config.asset ? await load(config.asset) : undefined
      const mesh = new THREE.Mesh(geometry(new THREE.PlaneGeometry(1, 1)), material(new THREE.MeshBasicMaterial({ map: texture, transparent: true, opacity: texture ? 1 : 0, alphaTest: texture ? .15 : 0, side: THREE.DoubleSide, depthWrite: !!texture })))
      mesh.position.set(...config.initialPosition); mesh.scale.set(...config.scale); mesh.rotation.set(...config.rotation); mesh.name = config.id
      const item: Item = { config, mesh, target: mesh.position.clone(), initial: { id: config.id, position: mesh.position.clone(), quaternion: mesh.quaternion.clone() } }
      if (config.movable) {
        const shadow = new THREE.Mesh(geometry(new THREE.PlaneGeometry(config.scale[0] * .94, config.scale[1] * .65)), material(new THREE.ShaderMaterial({ transparent: true, depthWrite: false, vertexShader: `varying vec2 shadowUv;void main(){shadowUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`, fragmentShader: `varying vec2 shadowUv;void main(){float a=(1.-smoothstep(.1,.5,length(shadowUv-.5)))*.23;gl_FragColor=vec4(.025,.012,.006,a);\n#include <colorspace_fragment>\n}` }))); shadow.rotation.x = -Math.PI / 2; scene.add(shadow); item.shadow = shadow
      }
      items.push(item); scene.add(mesh)
    }
    scene.updateMatrixWorld(true); renderer.render(scene, camera); ready = true; callbacks.ready()
    return { setActive(value) { active = value; if (!value) cancelGesture(); else { previousTime = performance.now(); if (!raf) raf = requestAnimationFrame(frame); canvas.focus({ preventScroll: true }) } }, inspect, leaveInspection, undo, reset, dispose }
  } catch (error) { dispose(); throw error }
}
