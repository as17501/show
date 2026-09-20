import '../../../assets/project-nav.css';
import './style.css';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { createApple, createKnife, equatorRadius } from './apple';

function get<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Missing element #${id}`);
  return element as T;
}

type Part = 'skin' | 'flesh' | 'seed';
type View = '3d' | 'section' | 'seeds';
const viewport = get<HTMLDivElement>('viewport');
const slider = get<HTMLInputElement>('separation');
const cutButton = get<HTMLButtonElement>('cut');
const status = get('view-status');
const announcement = get('announcement');
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

function start() {
  const scene = new THREE.Scene();
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(0x000000, 0);
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
  renderer.domElement.setAttribute('aria-label', '三维苹果：拖动旋转，双指或滚轮缩放。切开、分开与视角操作可通过观察台内的按钮和滑块完成。');
  viewport.appendChild(renderer.domElement);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const room = new RoomEnvironment();
  const environment = pmrem.fromScene(room, .04);
  scene.environment = environment.texture;
  scene.environmentIntensity = .42;
  room.dispose(); pmrem.dispose();
  const camera = new THREE.PerspectiveCamera(36, 1, .1, 50);
  const homePosition = new THREE.Vector3(4.1, 3.05, 5.7);
  const homeTarget = new THREE.Vector3(0, .25, 0);
  const openPosition = new THREE.Vector3(4.5, 3.8, 6.4);
  const openTarget = new THREE.Vector3(-.1, .65, 0);
  camera.position.copy(homePosition);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.copy(homeTarget); controls.enableDamping = true; controls.dampingFactor = .08;
  controls.enablePan = false; controls.minDistance = 4.5; controls.maxDistance = 11;
  controls.minPolarAngle = .02; controls.maxPolarAngle = Math.PI * .78;
  controls.autoRotateSpeed = .8;
  scene.add(new THREE.HemisphereLight('#fff9e5', '#9d9878', 1.5));
  const key = new THREE.DirectionalLight('#fff8e7', 2.2); key.position.set(-3, 7, 5);
  key.castShadow = true; key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.left = key.shadow.camera.bottom = -5;
  key.shadow.camera.right = key.shadow.camera.top = 5;
  key.shadow.normalBias = .025; key.shadow.bias = -.0001; key.shadow.radius = 4;
  scene.add(key);
  const fill = new THREE.DirectionalLight('#f3f8df', .9); fill.position.set(4, 3, -4); scene.add(fill);
  const apple = createApple(); scene.add(apple.root);
  const knife = createKnife(); scene.add(knife);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), new THREE.ShadowMaterial({ opacity: .12 }));
  ground.rotation.x = -Math.PI / 2; ground.position.y = -1.49; ground.receiveShadow = true; scene.add(ground);
  const guidePoints = Array.from({ length: 181 }, (_, i) => {
    const phi = i / 180 * Math.PI * 2, r = equatorRadius(phi) + .014;
    return new THREE.Vector3(r * Math.cos(phi), 0, r * Math.sin(phi));
  });
  const guide = new THREE.Line(new THREE.BufferGeometry().setFromPoints(guidePoints), new THREE.LineDashedMaterial({ color: '#ffecd0', dashSize: .065, gapSize: .055, transparent: true, opacity: .65 }));
  guide.computeLineDistances(); scene.add(guide);

  let view: View = '3d', selectedPart: Part = 'skin', separation = 0, targetSeparation = 0;
  let cutting = false, cutStart = 0, cameraTween = false;
  let desiredCamera = homePosition.clone(), desiredTarget = homeTarget.clone();
  let pointerStart = { x: 0, y: 0 };
  let previousTime = performance.now(), frame = 0, disposed = false, contextLost = false;
  const copy: Record<Part, { title: string; text: string; question: string; prompt: string }> = {
    skin: { title: '先看看它的外衣', text: '红红的果皮包住整个苹果。猜一猜，切开后，里面会是什么样子？', question: '先猜一猜', prompt: '苹果的种子，是散在果肉里，还是藏在中间呢？' },
    flesh: { title: '果肉里，藏着小星星', text: '浅黄色的是果肉。沿着苹果的腰横切，中心的种子室就像一朵小花，也像一颗小星星。', question: '找一找小星星', prompt: '看看苹果的中心，这个模型的小星星有几个角？' },
    seed: { title: '种子是竖着藏在里面的', text: '先点「看种子方向」，观察种子沿果梗到果底方向的排列。再横切：本例切过了种子，只露出棕边、浅色内芯的小截面，不是完整种子平放在果肉上。', question: '一颗，不是两颗', prompt: '同一颗种子被切过后，两面露出的是它相接的截面，不能当成两颗完整种子来数。' },
  };

  function selectPart(part: Part, reveal = true) {
    selectedPart = part;
    const content = copy[part];
    get('discovery-title').textContent = content.title; get('discovery-text').textContent = content.text;
    get('question-title').textContent = content.question; get('question-text').textContent = content.prompt;
    document.querySelectorAll<HTMLButtonElement>('.part').forEach(button => {
      const active = button.dataset.part === part;
      button.classList.toggle('active', active); button.setAttribute('aria-pressed', String(active));
    });
    apple.seedMaterial.emissive.set(part === 'seed' ? '#795024' : '#000000');
    apple.seedMaterial.emissiveIntensity = part === 'seed' ? .22 : 0;
    if (reveal && part !== 'skin' && targetSeparation < .5 && view === '3d') beginCut();
    announcement.textContent = `${content.title}。${content.text}`;
  }

  function updateUI() {
    slider.value = String(Math.round(targetSeparation * 100));
    get<HTMLOutputElement>('separation-value').value = `${slider.value}%`;
    const opened = targetSeparation > .025;
    get('cut-text').textContent = cutting ? '正在切开…' : opened ? '合拢苹果' : '切开苹果';
    cutButton.disabled = cutting;
    slider.disabled = cutting || view !== '3d';
    get('separation-hint').textContent = cutting ? '正在切开…' : view !== '3d' ? '立体观察可调' : '看清里面';
    get('cut-label').hidden = opened || cutting || view !== '3d';
    get('part-labels').hidden = view === 'seeds' || !opened || cutting;
    get('seed-inspection-note').hidden = view !== 'seeds';
    get('section-note').hidden = view === 'seeds' || !opened || cutting;
    status.textContent = cutting ? '沿着腰部横切中…' : view === 'seeds' ? '透视示意 · 完整种子的竖向排列' : view === 'section' ? '下半个苹果 · 俯视横截面' : opened ? '上下两半 · 看见里面' : '完整的苹果';
    get('view-3d').classList.toggle('active', view === '3d'); get('view-3d').setAttribute('aria-pressed', String(view === '3d'));
    get('view-section').classList.toggle('active', view === 'section'); get('view-section').setAttribute('aria-pressed', String(view === 'section'));
    get('view-seeds').classList.toggle('active', view === 'seeds'); get('view-seeds').setAttribute('aria-pressed', String(view === 'seeds'));
    document.querySelector('.experiment')?.classList.toggle('section-view', view === 'section');
    viewport.dataset.view = view; viewport.dataset.separation = slider.value; viewport.dataset.cutting = String(cutting);
  }

  function moveCamera(position: THREE.Vector3, target: THREE.Vector3) {
    controls.autoRotate = false; get('rotate').setAttribute('aria-pressed', 'false');
    desiredCamera = position; desiredTarget = target;
    if (reducedMotion.matches) {
      camera.position.copy(position); controls.target.copy(target); controls.update(); cameraTween = false;
    } else cameraTween = true;
  }

  function switchView(next: View) {
    cutting = false; knife.visible = false; view = next;
    apple.setSeedInspection(next === 'seeds');
    if (next === 'seeds') {
      targetSeparation = separation = 0;
      moveCamera(new THREE.Vector3(2.2, 1.1, 6.4), new THREE.Vector3(0, .12, 0));
      controls.enableRotate = true;
      selectPart('seed', false);
      announcement.textContent = '透视示意：果肉暂时隐藏，观察同一组完整种子的竖向排列。这里还没有切开苹果。';
    } else if (next === 'section') {
      targetSeparation = 1;
      // The upper half is intentionally hidden in this view; otherwise it occludes the cut face.
      moveCamera(new THREE.Vector3(0, 6.6, .001), new THREE.Vector3(0, -.2, 0));
      controls.enableRotate = false;
      if (selectedPart === 'skin') selectPart('flesh', false);
      announcement.textContent = '已隐藏上半个苹果，正从上往下观察下半个苹果的横截面。';
    } else {
      moveCamera(targetSeparation > .025 ? openPosition.clone() : homePosition.clone(), targetSeparation > .025 ? openTarget.clone() : homeTarget.clone()); controls.enableRotate = true;
    }
    updateUI();
  }

  function beginCut() {
    if (cutting) return;
    if (view !== '3d') switchView('3d');
    controls.autoRotate = false; get('rotate').setAttribute('aria-pressed', 'false');
    moveCamera(openPosition.clone(), openTarget.clone());
    if (reducedMotion.matches || separation > .025) {
      targetSeparation = 1; if (selectedPart === 'skin') selectPart('flesh', false); updateUI(); return;
    }
    cutting = true; cutStart = performance.now(); knife.visible = true; knife.position.set(-2, 0, 0);
    moveCamera(openPosition.clone(), openTarget.clone()); updateUI();
  }

  cutButton.addEventListener('click', () => {
    if (targetSeparation > .025) {
      if (view === 'section') switchView('3d');
      targetSeparation = 0; moveCamera(homePosition.clone(), homeTarget.clone()); selectPart('skin', false); updateUI(); announcement.textContent = '苹果重新合拢了。';
    } else beginCut();
  });
  slider.addEventListener('input', () => {
    if (cutting || view !== '3d') return;
    controls.autoRotate = false; get('rotate').setAttribute('aria-pressed', 'false');
    const wasClosed = targetSeparation === 0;
    targetSeparation = Number(slider.value) / 100;
    if (wasClosed && targetSeparation > 0) moveCamera(openPosition.clone(), openTarget.clone());
    if (targetSeparation > .1 && selectedPart === 'skin') selectPart('flesh', false);
    if (targetSeparation === 0) selectPart('skin', false);
    updateUI();
  });
  get('view-3d').addEventListener('click', () => switchView('3d'));
  get('view-section').addEventListener('click', () => switchView('section'));
  get('view-seeds').addEventListener('click', () => switchView('seeds'));
  get('reset').addEventListener('click', () => {
    cutting = false; knife.visible = false; targetSeparation = 0;
    switchView('3d'); selectPart('skin', false); updateUI(); announcement.textContent = '已重置为完整苹果。';
  });
  get('rotate').addEventListener('click', () => {
    if (view === 'section') switchView('3d');
    cameraTween = false; controls.autoRotate = !controls.autoRotate;
    get('rotate').setAttribute('aria-pressed', String(controls.autoRotate));
  });
  document.querySelectorAll<HTMLButtonElement>('[data-part]').forEach(button => {
    button.addEventListener('click', () => selectPart(button.dataset.part as Part));
  });
  controls.addEventListener('start', () => { cameraTween = false; });
  const raycaster = new THREE.Raycaster();
  renderer.domElement.addEventListener('pointerdown', event => { pointerStart = { x: event.clientX, y: event.clientY }; });
  renderer.domElement.addEventListener('pointerup', event => {
    if (Math.hypot(event.clientX - pointerStart.x, event.clientY - pointerStart.y) > 5) return;
    const rect = viewport.getBoundingClientRect();
    raycaster.setFromCamera(new THREE.Vector2((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1), camera);
    const hits = raycaster.intersectObject(apple.root, true);
    const hit = hits.find(item => {
      let object: THREE.Object3D | null = item.object;
      while (object) { if (!object.visible) return false; object = object.parent; }
      return Boolean(item.object.userData.part) && !(view === 'seeds' && item.object.userData.part === 'skin');
    });
    if (hit) selectPart(hit.object.userData.part as Part);
  });

  function resize() {
    const width = viewport.clientWidth, height = viewport.clientHeight;
    if (!width || !height) return;
    camera.aspect = width / height;
    // Keep the whole apple in frame in a narrow/mobile viewport.
    camera.fov = camera.aspect < 1.15 ? 44 : 36;
    camera.updateProjectionMatrix(); renderer.setSize(width, height);
  }
  const resizeObserver = new ResizeObserver(resize); resizeObserver.observe(viewport); resize();
  const projected = new THREE.Vector3();
  function positionLabel(selector: string, point: THREE.Vector3, object: THREE.Object3D, offsetX: number) {
    const label = document.querySelector<HTMLElement>(selector);
    if (!label) return;
    projected.copy(point); object.localToWorld(projected); projected.project(camera);
    const x = (projected.x * .5 + .5) * viewport.clientWidth + offsetX;
    const y = (-projected.y * .5 + .5) * viewport.clientHeight;
    label.style.left = `${THREE.MathUtils.clamp(x, 10, viewport.clientWidth - label.offsetWidth - 10)}px`;
    label.style.top = `${THREE.MathUtils.clamp(y, 64, viewport.clientHeight - 72)}px`;
    label.style.right = 'auto';
  }

  function animate(now: number) {
    if (disposed || contextLost) return;
    frame = requestAnimationFrame(animate);
    if (document.hidden) { previousTime = now; return; }
    const dt = Math.min((now - previousTime) / 1000, .05); previousTime = now;
    if (cutting) {
      const p = Math.min((now - cutStart) / 1100, 1);
      knife.position.x = -2.1 + 4.2 * (p * p * (3 - 2 * p));
      if (p === 1) {
        cutting = false; knife.visible = false; targetSeparation = 1;
        if (selectedPart === 'skin') selectPart('flesh', false);
        updateUI(); announcement.textContent = '苹果已经横切成上下两半。现在可以观察中间的果肉和种子。';
      }
    }
    const ease = reducedMotion.matches ? 1 : 1 - Math.exp(-dt * 6);
    separation = THREE.MathUtils.lerp(separation, targetSeparation, ease);
    if (Math.abs(separation - targetSeparation) < .0005) separation = targetSeparation;
    apple.lower.position.y = -.22 * separation;
    // Back-left separation avoids hiding the lower cross-section from the initial camera.
    apple.upper.position.set(-.58 * separation, 1.48 * separation, -.5 * separation);
    apple.upper.rotation.z = -.16 * separation;
    apple.upper.rotation.x = -.13 * separation;
    apple.upper.visible = view !== 'section';
    apple.upperInterior.visible = apple.lowerInterior.visible = view === 'seeds' || separation > .006;
    guide.visible = separation < .005 && view === '3d';
    if (cameraTween) {
      camera.position.lerp(desiredCamera, ease); controls.target.lerp(desiredTarget, ease);
      if (camera.position.distanceTo(desiredCamera) < .004) cameraTween = false;
    }
    controls.update(dt);
    apple.root.updateMatrixWorld(true);
    positionLabel('.label-skin', view === 'section' ? new THREE.Vector3(-.8, .02, -.75) : new THREE.Vector3(-1.02, .45, .35), view === 'section' ? apple.lower : apple.upper, -65);
    positionLabel('.label-flesh', new THREE.Vector3(-.66, .02, .52), apple.lower, -65);
    positionLabel('.label-seed', new THREE.Vector3(.25, .03, .20), apple.lower, 42);
    renderer.render(scene, camera);
    viewport.dataset.ready = 'true';
    viewport.dataset.actualSeparation = separation.toFixed(3);
  }
  renderer.domElement.addEventListener('webglcontextlost', event => {
    event.preventDefault(); contextLost = true; cancelAnimationFrame(frame); showError();
  });
  renderer.domElement.addEventListener('webglcontextrestored', () => window.location.reload());
  updateUI(); frame = requestAnimationFrame(animate);

  function dispose() {
    if (disposed) return;
    disposed = true; cancelAnimationFrame(frame); resizeObserver.disconnect(); controls.dispose();
    const geometries = new Set<THREE.BufferGeometry>(); const materials = new Set<THREE.Material>(); const textures = new Set<THREE.Texture>();
    scene.traverse(object => {
      if (object instanceof THREE.Mesh || object instanceof THREE.Line) {
        geometries.add(object.geometry);
        const objectMaterials = Array.isArray(object.material) ? object.material : [object.material];
        for (const material of objectMaterials) {
          materials.add(material);
          for (const value of Object.values(material)) if (value instanceof THREE.Texture) textures.add(value);
        }
      }
    });
    geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose()); textures.forEach(t => t.dispose());
    environment.dispose(); renderer.dispose();
  }
  window.addEventListener('pagehide', event => { if (!event.persisted) dispose(); });
}

function showError() {
  get('scene-error').hidden = false;
  document.querySelectorAll<HTMLButtonElement | HTMLInputElement>('button, input').forEach(control => { control.disabled = true; });
  get('cut-label').hidden = true; get('part-labels').hidden = true;
  announcement.textContent = '三维演示未能启动，请检查浏览器是否支持 WebGL 2。';
}
try { start(); } catch (error) { console.error('Apple scene initialization failed:', error); showError(); }
