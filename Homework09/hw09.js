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

const textureLoader = new THREE.TextureLoader();

// Sun
const matSun = new THREE.MeshLambertMaterial({color: 0x44ff44});
const geoSun = new THREE.SphereGeometry(10);
const sun = new THREE.Mesh(geoSun, matSun);
scene.add(sun);

// Mercury
const MerTex = textureLoader.load('Mercury.jpg');
const matMer = new THREE.MeshStandardMaterial({
    map: MerTex,
    roughness: 0.8,
    metalness: 0.2
});
const geoMer = new THREE.SphereGeometry(1.5);
const mercury = new THREE.Mesh(geoMer, matMer);
mercury.position.x = 20; 
mercury.castShadow = true;
scene.add(mercury);

// Venus
const VenTex = textureLoader.load('Venus.jpg');
const matVen = new THREE.MeshStandardMaterial({
    map: VenTex,
    roughness: 0.8,
    metalness: 0.2
});
const geoVen = new THREE.SphereGeometry(3); // width, height, depth
const venus = new THREE.Mesh(geoVen, matVen);
venus.position.x = 35; 
venus.castShadow = true;
scene.add(venus);

// Earth
const EarTex = textureLoader.load('Earth.jpg');
const matEar = new THREE.MeshStandardMaterial({
    map: EarTex,
    roughness: 0.8,
    metalness: 0.2
});
const geoEar = new THREE.SphereGeometry(3.5); // width, height, depth
const earth = new THREE.Mesh(geoEar, matEar);
earth.position.x = 50;
earth.castShadow = true;
scene.add(earth);

// Mars
const MarTex = textureLoader.load('Mars.jpg');
const matMar = new THREE.MeshStandardMaterial({
    map: MarTex,
    roughness: 0.8,
    metalness: 0.2
});
const geoMar = new THREE.SphereGeometry(2.5); // width, height, depth
const mars = new THREE.Mesh(geoMar, matMar);
mars.position.x = 65;
mars.castShadow = true;
scene.add(mars);

// GUI
const gui = new GUI();

const controls = new function () {
    this.scaleX = 1;  // scaleX 값을 담아 둘 변수: scaleX
    this.scaleY = 1;
    this.scaleZ = 1;

    this.positionX = 0;
    this.positionY = 4;
    this.positionZ = 0;

    this.rotationX = 0;
    this.rotationY = 0;
    this.rotationZ = 0;
    this.scale = 1;

    this.translateX = 0;
    this.translateY = 0;
    this.translateZ = 0;

    this.visible = true;

    this.translate = function () { // translate button 클릭 시 실행되는 함수

        cube.translateX(controls.translateX);
        cube.translateY(controls.translateY);
        cube.translateZ(controls.translateZ);

        controls.positionX = cube.position.x;
        controls.positionY = cube.position.y;
        controls.positionZ = cube.position.z;
    }
};

const guiScale = gui.addFolder('scale'); // scale 폴더 시작
guiScale.add(controls, 'scaleX', 0, 5);
guiScale.add(controls, 'scaleY', 0, 5);
guiScale.add(controls, 'scaleZ', 0, 5);

const guiPosition = gui.addFolder('position'); // position 폴더 시작
const contX = guiPosition.add(controls, 'positionX', -10, 10); // contX: controller
const contY = guiPosition.add(controls, 'positionY', -4, 20);
const contZ = guiPosition.add(controls, 'positionZ', -10, 10);

contX.listen();  // contX 값이 변하는지를 체크
contX.onChange(function (value) { // contX 값이 변하면 실행되는 함수
    cube.position.x = controls.positionX;
});

contY.listen();
contY.onChange(function (value) {
    cube.position.y = controls.positionY;
});

contZ.listen();
contZ.onChange(function (value) {
    cube.position.z = controls.positionZ;
});

const guiRotation = gui.addFolder('rotation');
guiRotation.add(controls, 'rotationX', -4, 4);
guiRotation.add(controls, 'rotationY', -4, 4);
guiRotation.add(controls, 'rotationZ', -4, 4);

const guiTranslate = gui.addFolder('translate');
guiTranslate.add(controls, 'translateX', -10, 10);
guiTranslate.add(controls, 'translateY', -10, 10);
guiTranslate.add(controls, 'translateZ', -10, 10);
guiTranslate.add(controls, 'translate');

gui.add(controls, 'visible');

render();

function render() {

    orbitControls.update();
    stats.update();

    cube.visible = controls.visible;

    // 한 frame 내에서 object의 transformation 순서
    // Three.js 는 항상 scale -> rotation -> translation 순서로 변환을 적용한다.
    // 만일 이 순서를 바꾸기 원한다면, object의 parent-child 관계를 이용하여 
    // 변환 순서를 바꾸어 주어야 한다. 
    // 
    // Example: translate -> rotate 순서로 바꾸기
    //
    // const pivot = new THREE.Object3D(); // rotation의 중심이 될 parent object (dummy)
    // scene.add(pivot);
    //
    // const satellite = new THREE.Mesh(new THREE.SphereGeometry(0.2), 
    //                                  new THREE.MeshBasicMaterial({ color: 0xff0000 }));
    // satellite.position.set(3, 0, 0);  // 중심 (pivot) 으로부터 반지름 거리만큼 이동
    // pivot.add(satellite);             // satellite의 parent object로 pivot을 지정
    // 
    // 애니메이션에서 pivot만 회전:
    // function animate() {
    //   requestAnimationFrame(animate);
    //   pivot.rotation.y += 0.01;
    //   renderer.render(scene, camera);
    // }

    cube.rotation.x = controls.rotationX;
    cube.rotation.y = controls.rotationY;
    cube.rotation.z = controls.rotationZ;

    cube.scale.set(controls.scaleX, controls.scaleY, controls.scaleZ);

    renderer.render(scene, camera);
    requestAnimationFrame(render);
}