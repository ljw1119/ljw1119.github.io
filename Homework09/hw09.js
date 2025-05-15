// 04-mesh-properties.js
// - GUI.listen, GUI.onChange 기능
// - object의 transformation 순서: 항상 scale -> rotate -> translate로 고정
// - object transformation의 순서 바꾸는 방법 (pivot parent 이용)

import * as THREE from 'three';  
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import Stats from 'three/addons/libs/stats.module.js';
import { GUI } from 'three/addons/libs/lil-gui.module.min.js';

const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.x = -30;
camera.position.y = 40;
camera.position.z = 30;
camera.lookAt(scene.position);
scene.add(camera);

// renderer
const renderer = new THREE.WebGLRenderer();
renderer.setClearColor(new THREE.Color(0x000000));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
document.body.appendChild(renderer.domElement);

// stats
const stats = new Stats();
document.body.appendChild(stats.dom);

// orbit controls
const orbitControls = new OrbitControls(camera, renderer.domElement);
orbitControls.enableDamping = true;


// add subtle ambient lighting
const ambientLight = new THREE.AmbientLight(0x3c3c3c);
scene.add(ambientLight);

// add directional light
const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
directionalLight.position.set(10, 10, 50);
directionalLight.castShadow = true;
scene.add(directionalLight);

// add spotlight for the shadows
const spotLight = new THREE.SpotLight(0xffffff, 300, 180, Math.PI/8);
spotLight.shadow.mapSize.height = 2048;
spotLight.shadow.mapSize.width = 2048;
spotLight.position.set(-40, 30, 30);
spotLight.target.position.set(0, 0, 0);
spotLight.castShadow = true;
scene.add(spotLight);

// --- Solar System Parameters ---
const PLANETS = [
  {
    name: 'Mercury',
    radius: 1.5,
    distance: 20,
    color: '#a6a6a6',
    texture: 'Mercury.jpg',
    rotationSpeed: 0.02,
    orbitSpeed: 0.02,
  },
  {
    name: 'Venus',
    radius: 3,
    distance: 35,
    color: '#e39e1c',
    texture: 'Venus.jpg',
    rotationSpeed: 0.015,
    orbitSpeed: 0.015,
  },
  {
    name: 'Earth',
    radius: 3.5,
    distance: 50,
    color: '#3498db',
    texture: 'Earth.jpg',
    rotationSpeed: 0.01,
    orbitSpeed: 0.01,
  },
  {
    name: 'Mars',
    radius: 2.5,
    distance: 65,
    color: '#c0392b',
    texture: 'Mars.jpg',
    rotationSpeed: 0.008,
    orbitSpeed: 0.008,
  },
];

// --- Texture Loader ---
const textureLoader = new THREE.TextureLoader();

// --- Sun ---
const sunGeometry = new THREE.SphereGeometry(10, 32, 32);
const sunMaterial = new THREE.MeshBasicMaterial({ color: 0xFFFF00 });
const sun = new THREE.Mesh(sunGeometry, sunMaterial);
sun.position.set(0, 10, 0);
sun.castShadow = false;
sun.receiveShadow = false;
scene.add(sun);

// --- Planets ---
const planetObjects = [];
const planetControls = {};

PLANETS.forEach((planet, idx) => {
  // Pivot for orbit
  const pivot = new THREE.Object3D();
  scene.add(pivot);

  // Texture
  const texture = textureLoader.load(planet.texture);
  const material = new THREE.MeshStandardMaterial({
    map: texture,
    roughness: 0.8,
    metalness: 0.2,
    color: planet.color,
  });
  const geometry = new THREE.SphereGeometry(planet.radius, 32, 32);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.position.set(planet.distance, 10, 0); // y=10 to match sun
  pivot.add(mesh);

  planetObjects.push({
    name: planet.name,
    mesh,
    pivot,
    rotationSpeed: planet.rotationSpeed,
    orbitSpeed: planet.orbitSpeed,
    currentOrbit: Math.random() * Math.PI * 2, // randomize start
  });

  // GUI controls for this planet
  planetControls[planet.name] = {
    rotationSpeed: planet.rotationSpeed,
    orbitSpeed: planet.orbitSpeed,
  };
});

// --- GUI ---
const gui = new GUI();

// Per-planet GUI folders
planetObjects.forEach((planetObj) => {
  const folder = gui.addFolder(planetObj.name);
  folder.add(planetControls[planetObj.name], 'rotationSpeed', 0, 0.05, 0.001).name('Rotation Speed');
  folder.add(planetControls[planetObj.name], 'orbitSpeed', 0, 0.05, 0.001).name('Orbit Speed');
});

// Camera toggle GUI
let perspectiveCamera = camera;
let orthoCamera = null;
let usingPerspective = true;

function createOrthoCamera() {
  const aspect = window.innerWidth / window.innerHeight;
  const d = 80;
  const ortho = new THREE.OrthographicCamera(
    -d * aspect, d * aspect, d, -d, 0.1, 500
  );
  ortho.position.copy(perspectiveCamera.position);
  ortho.lookAt(scene.position);
  return ortho;
}

const cameraFolder = gui.addFolder('Camera');
const cameraParams = { type: 'Perspective' };
cameraFolder.add(cameraParams, 'type', ['Perspective', 'Orthographic']).name('Type').onChange((val) => {
  usingPerspective = (val === 'Perspective');
  if (!orthoCamera) orthoCamera = createOrthoCamera();
  // Sync position
  if (usingPerspective) {
    perspectiveCamera.position.copy(orthoCamera.position);
    perspectiveCamera.lookAt(scene.position);
    orbitControls.object = perspectiveCamera;
  } else {
    orthoCamera.position.copy(perspectiveCamera.position);
    orthoCamera.lookAt(scene.position);
    orbitControls.object = orthoCamera;
  }
});

// --- Window Resize ---
window.addEventListener('resize', () => {
  const aspect = window.innerWidth / window.innerHeight;
  perspectiveCamera.aspect = aspect;
  perspectiveCamera.updateProjectionMatrix();
  if (orthoCamera) {
    const d = 80;
    orthoCamera.left = -d * aspect;
    orthoCamera.right = d * aspect;
    orthoCamera.top = d;
    orthoCamera.bottom = -d;
    orthoCamera.updateProjectionMatrix();
  }
  renderer.setSize(window.innerWidth, window.innerHeight);
});

function render() {
  orbitControls.update();
  stats.update();

  // Animate planets
  planetObjects.forEach((planetObj) => {
    // Orbit
    planetObj.currentOrbit += planetControls[planetObj.name].orbitSpeed;
    const x = Math.cos(planetObj.currentOrbit) * PLANETS.find(p => p.name === planetObj.name).distance;
    const z = Math.sin(planetObj.currentOrbit) * PLANETS.find(p => p.name === planetObj.name).distance;
    planetObj.mesh.position.set(x, 10, z);
    // Rotation
    planetObj.mesh.rotation.y += planetControls[planetObj.name].rotationSpeed;
  });

  // Camera
  const cam = usingPerspective ? perspectiveCamera : orthoCamera;
  renderer.render(scene, cam);
  requestAnimationFrame(render);
}

render();