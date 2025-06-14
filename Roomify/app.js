// Global variables
let scene, camera, renderer, controls;
let room, singleBlockModel, longBlockModel;
// New furniture models
let bedModel, chairModel, deskModel, drawerModel, lampModel, shelfModel, trashcanModel;
let placedObjects = [];
let isDragging = false;
let dragObject = null;
let dragPreviewObject = null;
let groundHighlight = null;
let mouse = new THREE.Vector2();
let raycaster = new THREE.Raycaster();
let originalCameraPosition;
let originalCameraTarget;
let isRotating = false;
let selectedObject = null;

// Edit mode variables
let isEditMode = false;
let isMoveMode = false;
let movePreviewObject = null;

// Preview renderers for sidebar
let singleBlockPreviewRenderer, longBlockPreviewRenderer;
let singleBlockPreviewScene, longBlockPreviewScene;
let singleBlockPreviewCamera, longBlockPreviewCamera;

// Constants
const ROOM_SIZE = 8;
const BLOCK_HEIGHT = 1;
const BLOCK_SCALE = 0.075; // Exactly between 0.05 and 0.1 for perfect size
const ROOM_SCALE = 0.005;  // Decreased from 0.01 to 0.005 (half size)

// Initialize the application
function init() {
    // Create scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x2c3e50);
    
    // Create camera - closer zoom
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(8, 6, 8);
    camera.lookAt(0, 0, 0);
    
    // Store original camera position and target for spring-back
    originalCameraPosition = camera.position.clone();
    originalCameraTarget = new THREE.Vector3(0, 0, 0);
    
    // Create renderer - now full screen
    const canvas = document.getElementById('three-canvas');
    renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight); // Full screen now
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    
    // Create controls
    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.screenSpacePanning = false;
    controls.minDistance = 6;
    controls.maxDistance = 20;
    controls.maxPolarAngle = Math.PI / 2;
    
    // Custom spring-back behavior
    controls.addEventListener('start', onControlsStart);
    controls.addEventListener('end', onControlsEnd);
    
    // Setup lighting
    setupLighting();
    
    // Create ground highlight indicator
    createGroundHighlight();
    
    // Load models
    loadModels();
    
    // Setup event listeners
    setupEventListeners();
    
    // Create floor grid
    createFloorGrid();
    
    // Start render loop
    animate();
}

function setupLighting() {
    // Ambient light
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    scene.add(ambientLight);
    
    // Main directional light
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1.0);
    directionalLight.position.set(10, 15, 5);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    directionalLight.shadow.camera.near = 0.5;
    directionalLight.shadow.camera.far = 50;
    directionalLight.shadow.camera.left = -15;
    directionalLight.shadow.camera.right = 15;
    directionalLight.shadow.camera.top = 15;
    directionalLight.shadow.camera.bottom = -15;
    scene.add(directionalLight);
    
    // Fill light
    const fillLight = new THREE.DirectionalLight(0xffffff, 0.3);
    fillLight.position.set(-5, 10, -5);
    scene.add(fillLight);
    
    // Rim light
    const rimLight = new THREE.DirectionalLight(0x85c1e9, 0.4);
    rimLight.position.set(0, 5, -10);
    scene.add(rimLight);
}

function createGroundHighlight() {
    // Start with a basic 1x1 plane - we'll recreate geometry as needed
    const geometry = new THREE.PlaneGeometry(1, 1);
    const material = new THREE.MeshBasicMaterial({
        color: 0x00ff00,
        transparent: true,
        opacity: 0.3,
        side: THREE.DoubleSide
    });
    groundHighlight = new THREE.Mesh(geometry, material);
    groundHighlight.rotation.x = -Math.PI / 2;
    groundHighlight.position.y = 0.02;
    groundHighlight.visible = false;
    scene.add(groundHighlight);
}

function createFloorGrid() {
    // Create floor - make it invisible but ensure it's raycast-able
    const floorGeometry = new THREE.PlaneGeometry(ROOM_SIZE, ROOM_SIZE);
    const floorMaterial = new THREE.MeshBasicMaterial({ 
        color: 0x566573,
        transparent: true,
        opacity: 0.01, // Very low but not zero for better raycasting
        visible: true,  // Explicitly set to true
        side: THREE.DoubleSide // Ensure both sides can be hit
    });
    const floor = new THREE.Mesh(floorGeometry, floorMaterial);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    floor.name = 'floor';
    scene.add(floor);
    
    // Create grid lines with proper positioning
    const gridHelper = new THREE.GridHelper(ROOM_SIZE, ROOM_SIZE, 0x7f8c8d, 0x95a5a6);
    gridHelper.position.y = 0.01;
    scene.add(gridHelper);
}

// Fixed grid snapping function that handles rotation
function snapToGrid(worldX, worldZ, itemType = 'single-block', rotationY = 0) {
    // The room is 8x8 with grid lines at integers: -4, -3, -2, -1, 0, 1, 2, 3, 4
    // Grid squares are 1x1 units
    
    let gridX, gridZ;
    
    if (itemType === 'single-block' || itemType === 'lamp' || itemType === 'trashcan' || itemType === 'drawer' || itemType === 'shelf' || itemType === 'chair') {
        // 1x1 objects always snap to center of grid squares (half-integer positions)
        gridX = Math.floor(worldX) + 0.5;
        gridZ = Math.floor(worldZ) + 0.5;
        
        // Clamp to room bounds: -3.5 to 3.5
        gridX = Math.max(-3.5, Math.min(3.5, gridX));
        gridZ = Math.max(-3.5, Math.min(3.5, gridZ));
        
    } else if (itemType === 'long-block' || itemType === 'desk') {
        // 2x1 or 1x2 objects (long-block) and 1x3 or 3x1 objects (desk) depend on rotation
        const normalizedRotation = ((rotationY % (2 * Math.PI)) + (2 * Math.PI)) % (2 * Math.PI);
        const isHorizontal = Math.abs(Math.sin(normalizedRotation)) > 0.9;
        
        if (isHorizontal) {
            if (itemType === 'long-block') {
                // Horizontal long-block (2x1): spans 2 grid squares horizontally
                // Center should be at (integer, half-integer)
                gridX = Math.round(worldX);
                gridZ = Math.floor(worldZ) + 0.5;
                
                // Clamp bounds: X needs space for 2 units, Z normal
                gridX = Math.max(-3, Math.min(3, gridX));
                gridZ = Math.max(-3.5, Math.min(3.5, gridZ));
            } else {
                // Horizontal desk (3x1): spans 3 grid squares horizontally
                // Center should be at (half-integer, half-integer)
                gridX = Math.floor(worldX) + 0.5;
                gridZ = Math.floor(worldZ) + 0.5;
                
                // Clamp bounds: X needs space for 3 units, Z normal
                gridX = Math.max(-2.5, Math.min(2.5, gridX));
                gridZ = Math.max(-3.5, Math.min(3.5, gridZ));
            }
        } else {
            if (itemType === 'long-block') {
                // Vertical long-block (1x2): spans 2 grid squares vertically  
                // Center should be at (half-integer, integer)
                gridX = Math.floor(worldX) + 0.5;
                gridZ = Math.round(worldZ);
                
                // Clamp bounds: X normal, Z needs space for 2 units
                gridX = Math.max(-3.5, Math.min(3.5, gridX));
                gridZ = Math.max(-3, Math.min(3, gridZ));
            } else {
                // Vertical desk (1x3): spans 3 grid squares vertically
                // Center should be at (half-integer, half-integer)
                gridX = Math.floor(worldX) + 0.5;
                gridZ = Math.floor(worldZ) + 0.5;
                
                // Clamp bounds: X normal, Z needs space for 3 units
                gridX = Math.max(-3.5, Math.min(3.5, gridX));
                gridZ = Math.max(-2.5, Math.min(2.5, gridZ));
            }
        }
        
    } else if (itemType === 'bed') {
        // Bed (3x4/4x3) depends on rotation
        const normalizedRotation = ((rotationY % (2 * Math.PI)) + (2 * Math.PI)) % (2 * Math.PI);
        const isHorizontal = Math.abs(Math.sin(normalizedRotation)) > 0.9;
        
         if (itemType === 'bed') {
            if (isHorizontal) {
                // Horizontal bed (4x3): 4 wide, 3 deep
                // 4 units wide: center at integer (covers 4 grid squares evenly)
                // 3 units deep: center at half-integer (covers 3 grid squares with center in middle)
                gridX = Math.round(worldX);        // Integer for 4-unit width
                gridZ = Math.floor(worldZ) + 0.5; // Half-integer for 3-unit depth
                
                // Clamp bounds: X needs space for 4 units (-2 to +2), Z needs space for 3 units (-1.5 to +1.5)
                gridX = Math.max(-2, Math.min(2, gridX));
                gridZ = Math.max(-2.5, Math.min(2.5, gridZ));
            } else {
                // Vertical bed (3x4): 3 wide, 4 deep
                // 3 units wide: center at half-integer (covers 3 grid squares with center in middle)
                // 4 units deep: center at integer (covers 4 grid squares evenly)
                gridX = Math.floor(worldX) + 0.5; // Half-integer for 3-unit width
                gridZ = Math.round(worldZ);        // Integer for 4-unit depth
                
                // Clamp bounds: X needs space for 3 units (-1.5 to +1.5), Z needs space for 4 units (-2 to +2)
                gridX = Math.max(-2.5, Math.min(2.5, gridX));
                gridZ = Math.max(-2, Math.min(2, gridZ));
            }
        }
    } else if (itemType === 'chair') {
        // Changed chair to 1x1 footprint
        return { width: 1, depth: 1 };
    } else if (itemType === 'desk') {
        // Changed desk to 1x3 footprint
        const normalizedRotation = ((rotationY % (2 * Math.PI)) + (2 * Math.PI)) % (2 * Math.PI);
        const isHorizontal = Math.abs(Math.sin(normalizedRotation)) > 0.9;
        
        if (isHorizontal) {
            return { width: 3, depth: 1 }; // When rotated 90/270 degrees
        } else {
            return { width: 1, depth: 3 }; // Default orientation
        }
    }
    
    return { x: gridX, z: gridZ };
}

// Helper function to get object dimensions based on type and current rotation
function getObjectDimensions(type, rotationY = 0) {
    if (type === 'single-block') {
        return { width: 1, depth: 1 };
    } else if (type === 'long-block') {
        // Normalize rotation
        const normalizedRotation = ((rotationY % (2 * Math.PI)) + (2 * Math.PI)) % (2 * Math.PI);
        
        // Long blocks are "horizontal" when rotation is π/2 or 3π/2 (90° or 270°)
        // Long blocks are "vertical" when rotation is 0 or π (0° or 180°)
        const isHorizontal = Math.abs(Math.sin(normalizedRotation)) > 0.9;
        
        if (isHorizontal) {
            return { width: 2, depth: 1 };
        } else {
            return { width: 1, depth: 2 };
        }
    } else if (type === 'bed') {
        // Normalize rotation for bed - Changed to 4x3 footprint
        const normalizedRotation = ((rotationY % (2 * Math.PI)) + (2 * Math.PI)) % (2 * Math.PI);
        const isHorizontal = Math.abs(Math.sin(normalizedRotation)) > 0.9;
        
        if (isHorizontal) {
            return { width: 4, depth: 3 }; // When rotated 90/270 degrees
        } else {
            return { width: 3, depth: 4 }; // Default orientation
        }
    } else if (type === 'desk') {
        // Changed desk to 1x3 footprint
        const normalizedRotation = ((rotationY % (2 * Math.PI)) + (2 * Math.PI)) % (2 * Math.PI);
        const isHorizontal = Math.abs(Math.sin(normalizedRotation)) > 0.9;
        
        if (isHorizontal) {
            return { width: 3, depth: 1 }; // When rotated 90/270 degrees
        } else {
            return { width: 1, depth: 3 }; // Default orientation
        }
    } else if (type === 'chair') {
        // Changed chair to 1x1 footprint
        return { width: 1, depth: 1 };
    } else if (type === 'drawer') {
        // Changed drawer to 1x1 footprint
        return { width: 1, depth: 1 };
    } else if (type === 'lamp') {
        return { width: 1, depth: 1 };
    } else if (type === 'shelf') {
        // Changed shelf to 1x1 footprint
        return { width: 1, depth: 1 };
    } else if (type === 'trashcan') {
        return { width: 1, depth: 1 };
    }
    return { width: 1, depth: 1 }; // Default
}

// Updated collision detection function that accounts for rotation
function checkCollision(newX, newZ, newType, newRotation = 0) {
    const newDimensions = getObjectDimensions(newType, newRotation);
    
    for (let placedObject of placedObjects) {
        const objX = placedObject.position.x;
        const objZ = placedObject.position.z;
        const objType = placedObject.userData.type;
        const objRotation = placedObject.rotation.y;
        
        // Get existing object dimensions considering its rotation
        const objDimensions = getObjectDimensions(objType, objRotation);
        
        // Calculate object boundaries
        const newMinX = newX - newDimensions.width / 2;
        const newMaxX = newX + newDimensions.width / 2;
        const newMinZ = newZ - newDimensions.depth / 2;
        const newMaxZ = newZ + newDimensions.depth / 2;
        
        const objMinX = objX - objDimensions.width / 2;
        const objMaxX = objX + objDimensions.width / 2;
        const objMinZ = objZ - objDimensions.depth / 2;
        const objMaxZ = objZ + objDimensions.depth / 2;
        
        // Check for overlap using AABB (Axis-Aligned Bounding Box) collision detection
        const overlapX = newMaxX > objMinX && newMinX < objMaxX;
        const overlapZ = newMaxZ > objMinZ && newMinZ < objMaxZ;
        
        if (overlapX && overlapZ) {
            return true; // Collision detected
        }
    }
    
    return false; // No collision
}

function loadModels() {
    const loader = new THREE.FBXLoader();
    
    // Add loading manager to track all loads
    const loadingManager = new THREE.LoadingManager();
    loadingManager.onLoad = () => {
        console.log('All models loaded successfully');
    };
    loadingManager.onError = (url) => {
        console.error('Error loading:', url);
    };
    
    // Load room model - use full relative path
    loader.load('./Resources/Room_1.fbx', (fbx) => {
        room = fbx;
        room.scale.setScalar(ROOM_SCALE);
        room.position.set(0, 0, 0);
        
        // Process room materials
        room.traverse((child) => {
            if (child.isMesh) {
                child.castShadow = true;
                child.receiveShadow = true;
                
                console.log('Room mesh found:', child.name, 'Material:', child.material?.name || 'No material');
                
                if (child.material) {
                    // Don't override materials, just enhance them
                    if (child.material.map) {
                        child.material.needsUpdate = true;
                    }
                }
            }
        });
        
        scene.add(room);
        console.log('Room loaded and added to scene');
    }, (progress) => {
        const percent = (progress.loaded / progress.total * 100).toFixed(1);
        console.log(`Room loading: ${percent}%`);
    }, (error) => {
        console.error('Failed to load room FBX:', error);
        createFallbackRoom();
    });
    
    // Load single block model - use full relative path
    loader.load('./Resources/Unit_block.fbx', (fbx) => {
        console.log('Single block FBX loaded, processing...');
        
        // Scale the original model
        fbx.scale.setScalar(BLOCK_SCALE);
        
        // Create a wrapper group to properly center the model
        const wrapper = new THREE.Group();
        
        // Calculate bounding box of the scaled model
        const box = new THREE.Box3().setFromObject(fbx);
        const center = box.getCenter(new THREE.Vector3());
        
        // Move the FBX model so its center aligns with the wrapper's origin
        fbx.position.set(-center.x, -center.y, -center.z);
        
        // Add the centered FBX to the wrapper
        wrapper.add(fbx);
        
        // Process materials
        fbx.traverse((child) => {
            if (child.isMesh) {
                child.castShadow = true;
                child.receiveShadow = true;
                
                console.log('Single block mesh:', child.name, 'Material:', child.material?.name || 'No material');
                console.log('Material type:', child.material?.type);
                console.log('Material color:', child.material?.color);
                
                if (child.material) {
                    child.material.needsUpdate = true;
                    
                    if (child.material.color) {
                        console.log('Original color:', child.material.color.getHexString());
                    }
                }
            }
        });
        
        // Use the wrapper as the model
        singleBlockModel = wrapper;
        
        createModelPreview(singleBlockModel, 'single-block-preview');
        console.log('Single block model ready');
    }, (progress) => {
        const percent = (progress.loaded / progress.total * 100).toFixed(1);
        console.log(`Single block loading: ${percent}%`);
    }, (error) => {
        console.error('Failed to load single block FBX:', error);
        createFallbackBlock('single');
    });
    
    // Load long block model - use full relative path
    loader.load('./Resources/Unit_block_long.fbx', (fbx) => {
        console.log('Long block FBX loaded, processing...');
        
        // Scale the original model
        fbx.scale.setScalar(BLOCK_SCALE);
        
        // Create a wrapper group to properly center the model
        const wrapper = new THREE.Group();
        
        // Calculate bounding box of the scaled model
        const box = new THREE.Box3().setFromObject(fbx);
        const center = box.getCenter(new THREE.Vector3());
        
        // Move the FBX model so its center aligns with the wrapper's origin
        fbx.position.set(-center.x, -center.y, -center.z);
        
        // Add the centered FBX to the wrapper
        wrapper.add(fbx);
        
        // Rotate the wrapper 90 degrees around Y axis for long blocks
        wrapper.rotation.y = Math.PI / 2; // 90 degrees in radians
        
        // Process materials
        fbx.traverse((child) => {
            if (child.isMesh) {
                child.castShadow = true;
                child.receiveShadow = true;
                
                console.log('Long block mesh:', child.name, 'Material:', child.material?.name || 'No material');
                
                if (child.material) {
                    child.material.needsUpdate = true;
                    
                    if (child.material.color) {
                        console.log('Original color:', child.material.color.getHexString());
                    }
                }
            }
        });
        
        // Use the wrapper as the model
        longBlockModel = wrapper;
        
        createModelPreview(longBlockModel, 'long-block-preview');
        console.log('Long block model ready');
    }, (progress) => {
        const percent = (progress.loaded / progress.total * 100).toFixed(1);
        console.log(`Long block loading: ${percent}%`);
    }, (error) => {
        console.error('Failed to load long block FBX:', error);
        createFallbackBlock('long');
    });

    // Load furniture models
    const furnitureItems = [
        { file: 'Bed.fbx', variable: 'bedModel', scale: 0.07 },          // Reduced from 0.08 - make bed tiny bit smaller
        { file: 'Chair.fbx', variable: 'chairModel', scale: 0.1 },      // Keep same
        { file: 'Desk.fbx', variable: 'deskModel', scale: 0.08 },        // Increased from 0.06 - make desk tiny bit bigger  
        { file: 'Drawer.fbx', variable: 'drawerModel', scale: 0.08 },    // Keep same
        { file: 'Lamp.fbx', variable: 'lampModel', scale: 0.08 },        // Keep same
        { file: 'Shelf.fbx', variable: 'shelfModel', scale: 0.07 },      // Keep same
        { file: 'Trashcan.fbx', variable: 'trashcanModel', scale: 0.06 } // Keep same
    ];

    furnitureItems.forEach(item => {
        loader.load(`./Resources/${item.file}`, (fbx) => {
            console.log(`${item.file} loaded, processing...`);
            
            // Scale the original model
            fbx.scale.setScalar(item.scale);
            
            // Rotate the FBX model FIRST, before calculating center
            fbx.rotation.x = -(Math.PI / 2); // -90 degrees in radians
            
            // Create a wrapper group to properly center the model
            const wrapper = new THREE.Group();
            
            // Calculate bounding box of the scaled AND rotated model
            const box = new THREE.Box3().setFromObject(fbx);
            const center = box.getCenter(new THREE.Vector3());
            
            // Move the FBX model so its center aligns with the wrapper's origin
            fbx.position.set(-center.x, -center.y, -center.z);
            
            // Add the centered FBX to the wrapper
            wrapper.add(fbx);
            
            // Process materials
            fbx.traverse((child) => {
                if (child.isMesh) {
                    child.castShadow = true;
                    child.receiveShadow = true;
                    
                    if (child.material) {
                        child.material.needsUpdate = true;
                    }
                }
            });
            
            // Assign to the appropriate global variable based on filename
            const furnitureType = item.file.toLowerCase().replace('.fbx', '');
            console.log(`Assigning ${furnitureType} model to global variable`);
            
            switch(furnitureType) {
                case 'bed':
                    bedModel = wrapper;
                    console.log('Bed model assigned:', bedModel);
                    break;
                case 'chair':
                    chairModel = wrapper;
                    console.log('Chair model assigned:', chairModel);
                    break;
                case 'desk':
                    deskModel = wrapper;
                    console.log('Desk model assigned:', deskModel);
                    break;
                case 'drawer':
                    drawerModel = wrapper;
                    console.log('Drawer model assigned:', drawerModel);
                    break;
                case 'lamp':
                    lampModel = wrapper;
                    console.log('Lamp model assigned:', lampModel);
                    break;
                case 'shelf':
                    shelfModel = wrapper;
                    console.log('Shelf model assigned:', shelfModel);
                    break;
                case 'trashcan':
                    trashcanModel = wrapper;
                    console.log('Trashcan model assigned:', trashcanModel);
                    break;
                default:
                    console.error(`Unknown furniture type: ${furnitureType}`);
            }
            
            // Create model preview
            createModelPreview(wrapper, `${furnitureType}-preview`);
            console.log(`${item.file} model ready and preview created`);
        }, (progress) => {
            const percent = (progress.loaded / progress.total * 100).toFixed(1);
            console.log(`${item.file} loading: ${percent}%`);
        }, (error) => {
            console.error(`Failed to load ${item.file}:`, error);
        });
    });
}

function createModelPreview(model, containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    // Create preview scene
    const previewScene = new THREE.Scene();
    previewScene.background = new THREE.Color(0x17202a);
    
    // Create preview camera
    const previewCamera = new THREE.PerspectiveCamera(50, 50/40, 0.1, 100); // Adjusted aspect ratio for smaller preview
    previewCamera.position.set(2, 2, 2);
    previewCamera.lookAt(0, 0, 0);
    
    // Create preview renderer
    const previewRenderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    previewRenderer.setSize(50, 40); // Smaller size for floating nav
    previewRenderer.shadowMap.enabled = true;
    previewRenderer.shadowMap.type = THREE.PCFSoftShadowMap;
    
    // Add lighting to preview scene
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    previewScene.add(ambientLight);
    
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(2, 2, 1);
    directionalLight.castShadow = true;
    previewScene.add(directionalLight);
    
    // Clone and add model to preview scene
    const previewModel = model.clone();
    previewModel.position.set(0, 0, 0); // Model should already be centered from loading
    
    // Calculate model bounds for camera framing only
    const box = new THREE.Box3().setFromObject(previewModel);
    const size = box.getSize(new THREE.Vector3());
    
    // Adjust camera based on model size but don't move the model
    const maxDim = Math.max(size.x, size.y, size.z);
    previewCamera.position.set(maxDim * 1.5, maxDim * 1.2, maxDim * 1.5);
    previewCamera.lookAt(0, 0, 0);
    
    previewScene.add(previewModel);
    
    // Add canvas to container
    container.appendChild(previewRenderer.domElement);
    
    // Store references for animation
    if (containerId === 'single-block-preview') {
        singleBlockPreviewRenderer = previewRenderer;
        singleBlockPreviewScene = previewScene;
        singleBlockPreviewCamera = previewCamera;
    } else {
        longBlockPreviewRenderer = previewRenderer;
        longBlockPreviewScene = previewScene;
        longBlockPreviewCamera = previewCamera;
    }
    
    // Render the preview
    previewRenderer.render(previewScene, previewCamera);
    
    // Add rotation animation
    function animatePreview() {
        if (previewModel) {
            previewModel.rotation.y += 0.01;
            previewRenderer.render(previewScene, previewCamera);
        }
        requestAnimationFrame(animatePreview);
    }
    animatePreview();
}

function createFallbackRoom() {
    console.log('Creating fallback room geometry');
    const group = new THREE.Group();
    
    const wallGeometry = new THREE.BoxGeometry(ROOM_SIZE, 4, 0.2);
    const wallMaterial = new THREE.MeshLambertMaterial({ color: 0x5d6d7e });
    
    const backWall = new THREE.Mesh(wallGeometry, wallMaterial);
    backWall.position.set(0, 2, -ROOM_SIZE/2);
    backWall.castShadow = true;
    backWall.receiveShadow = true;
    group.add(backWall);
    
    const leftWallGeometry = new THREE.BoxGeometry(0.2, 4, ROOM_SIZE);
    const leftWall = new THREE.Mesh(leftWallGeometry, wallMaterial);
    leftWall.position.set(-ROOM_SIZE/2, 2, 0);
    leftWall.castShadow = true;
    leftWall.receiveShadow = true;
    group.add(leftWall);
    
    room = group;
    scene.add(room);
}

function createFallbackBlock(type) {
    console.log(`Creating fallback ${type} block`);
    const width = type === 'long' ? 2 : 1;
    const geometry = new THREE.BoxGeometry(width, BLOCK_HEIGHT, 1);
    const material = new THREE.MeshLambertMaterial({ 
        color: type === 'long' ? 0x2980b9 : 0x3498db  // Blue colors instead of orange
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    
    if (type === 'long') {
        // Rotate long block 90 degrees to match the FBX version
        mesh.rotation.y = Math.PI / 2;
        longBlockModel = mesh;
        createModelPreview(mesh, 'long-block-preview');
    } else {
        singleBlockModel = mesh;
        createModelPreview(mesh, 'single-block-preview');
    }
}

function onControlsStart() {
    isRotating = true;
}

function onControlsEnd() {
    isRotating = false;
    setTimeout(() => {
        if (!isRotating) {
            springBackCamera();
        }
    }, 1500);
}

function springBackCamera() {
    const duration = 1000;
    const startPosition = camera.position.clone();
    const startTarget = controls.target.clone();
    const startTime = performance.now();
    
    function animateCamera() {
        const elapsed = performance.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        
        camera.position.lerpVectors(startPosition, originalCameraPosition, eased);
        controls.target.lerpVectors(startTarget, originalCameraTarget, eased);
        controls.update();
        
        if (progress < 1) {
            requestAnimationFrame(animateCamera);
        }
    }
    
    animateCamera();
}

function setupEventListeners() {
    window.addEventListener('resize', onWindowResize);
    renderer.domElement.addEventListener('click', onMouseClick);
    renderer.domElement.addEventListener('mousemove', onMouseMove);
    setupDragAndDrop();
    window.addEventListener('keydown', onKeyDown);
}

function setupDragAndDrop() {
    const draggableItems = document.querySelectorAll('.draggable-item');
    
    draggableItems.forEach(item => {
        item.addEventListener('dragstart', (e) => {
            const itemType = item.dataset.type;
            e.dataTransfer.setData('text/plain', itemType);
            e.dataTransfer.effectAllowed = 'copy';
            
            // Hide default drag image and cursor icons
            e.dataTransfer.setDragImage(new Image(), 0, 0);
            
            // Start drag preview
            startDragPreview(itemType);
            
            // Prevent default cursor behavior
            e.preventDefault = () => {};
        });
        
        item.addEventListener('dragend', (e) => {
            endDragPreview();
        });
        
        item.draggable = true;
    });
    
    const canvas = renderer.domElement;
    
    canvas.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
        canvas.style.cursor = 'copy';
        
        if (isDragging && dragPreviewObject) {
            updateDragPreview(e);
        }
    });
    
    canvas.addEventListener('dragleave', (e) => {
        canvas.style.cursor = 'default';
        if (groundHighlight) {
            groundHighlight.visible = false;
        }
    });
    
    canvas.addEventListener('drop', (e) => {
        e.preventDefault();
        canvas.style.cursor = 'default';
        
        // Check if drag preview indicates a collision
        if (dragPreviewObject && dragPreviewObject.userData.hasCollision) {
            console.log('Cannot drop object: collision detected');
            endDragPreview();
            return;
        }
        
        const itemType = e.dataTransfer.getData('text/plain');
        const rect = canvas.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        const y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
        
        addObjectToScene(itemType, x, y);
        endDragPreview();
    });
}

function startDragPreview(itemType) {
    isDragging = true;
    
    let modelToPreview;
    if (itemType === 'single-block' && singleBlockModel) {
        modelToPreview = singleBlockModel.clone();
    } else if (itemType === 'long-block' && longBlockModel) {
        modelToPreview = longBlockModel.clone();
    } else if (itemType === 'bed' && bedModel) {
        modelToPreview = bedModel.clone();
    } else if (itemType === 'chair' && chairModel) {
        modelToPreview = chairModel.clone();
    } else if (itemType === 'desk' && deskModel) {
        modelToPreview = deskModel.clone();
    } else if (itemType === 'drawer' && drawerModel) {
        modelToPreview = drawerModel.clone();
    } else if (itemType === 'lamp' && lampModel) {
        modelToPreview = lampModel.clone();
    } else if (itemType === 'shelf' && shelfModel) {
        modelToPreview = shelfModel.clone();
    } else if (itemType === 'trashcan' && trashcanModel) {
        modelToPreview = trashcanModel.clone();
    }
    
    if (modelToPreview) {
        // Determine the appropriate scale based on object type
        let objectScale;
        if (itemType === 'single-block' || itemType === 'long-block') {
            objectScale = BLOCK_SCALE;
        } else if (itemType === 'bed') {
            objectScale = 0.07;  // Keep same
        } else if (itemType === 'chair') {
            objectScale = 0.06;  // Updated to match user's change
        } else if (itemType === 'desk') {
            objectScale = 0.06;  // Keep same
        } else if (itemType === 'drawer') {
            objectScale = 0.06;  // Keep same
        } else if (itemType === 'shelf') {
            objectScale = 0.08;  // Keep same
        } else if (itemType === 'lamp') {
            objectScale = 0.08;  // Keep same
        } else if (itemType === 'trashcan') {
            objectScale = 0.06;  // Keep same
        } else {
            objectScale = BLOCK_SCALE; // Default fallback
        }
        
        // Scale the preview model to the correct size
        modelToPreview.scale.setScalar(objectScale);
        
        // Pre-calculate Y offset to avoid jittering during drag
        const box = new THREE.Box3().setFromObject(modelToPreview);
        const yOffset = -box.min.y; // Store the Y offset
        
        modelToPreview.traverse((child) => {
            if (child.isMesh && child.material) {
                try {
                    // Handle both single materials and material arrays
                    if (Array.isArray(child.material)) {
                        child.material = child.material.map(mat => {
                            if (mat && typeof mat.clone === 'function') {
                                const clonedMat = mat.clone();
                                clonedMat.transparent = true;
                                clonedMat.opacity = 0.6;
                                return clonedMat;
                            } else {
                                // Create a fallback material if cloning fails
                                const fallbackMat = new THREE.MeshLambertMaterial({
                                    color: 0x3498db,
                                    transparent: true,
                                    opacity: 0.6
                                });
                                return fallbackMat;
                            }
                        });
                    } else {
                        // Single material
                        if (child.material && typeof child.material.clone === 'function') {
                            child.material = child.material.clone();
                            child.material.transparent = true;
                            child.material.opacity = 0.6;
                        } else {
                            // Create a fallback material if cloning fails
                            child.material = new THREE.MeshLambertMaterial({
                                color: 0x3498db,
                                transparent: true,
                                opacity: 0.6
                            });
                        }
                    }
                } catch (error) {
                    console.warn('Failed to clone material for preview, using fallback:', error);
                    // Create a fallback material
                    child.material = new THREE.MeshLambertMaterial({
                        color: 0x3498db,
                        transparent: true,
                        opacity: 0.6
                    });
                }
            }
        });
        
        dragPreviewObject = modelToPreview;
        dragPreviewObject.userData.itemType = itemType;
        dragPreviewObject.userData.yOffset = yOffset; // Store the pre-calculated offset
        scene.add(dragPreviewObject);
    }
}

function updateDragPreview(event) {
    if (!dragPreviewObject) return;
    
    const rect = renderer.domElement.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    const y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    
    mouse.set(x, y);
    raycaster.setFromCamera(mouse, camera);
    
    const floorIntersects = raycaster.intersectObjects(scene.children.filter(obj => 
        obj.name === 'floor' || (obj.geometry && obj.geometry.type === 'PlaneGeometry')
    ));
    
    if (floorIntersects.length > 0) {
        const intersectPoint = floorIntersects[0].point;
        const itemType = dragPreviewObject.userData.itemType;
        
        // Use fixed grid snapping with proper rotation
        // New long blocks start with π/2 rotation (horizontal)
        const objectRotation = itemType === 'long-block' ? Math.PI / 2 : 0;
        const gridPos = snapToGrid(intersectPoint.x, intersectPoint.z, itemType, objectRotation);
        
        // Check for collision
        const hasCollision = checkCollision(gridPos.x, gridPos.z, itemType, objectRotation);
        
        // Use the pre-calculated Y offset to avoid jittering
        const yPosition = dragPreviewObject.userData.yOffset;
        
        dragPreviewObject.position.set(gridPos.x, yPosition, gridPos.z);
        
        // Update ground highlight size based on item type and rotation
        const dimensions = getObjectDimensions(itemType, objectRotation);
        updateGroundHighlightSize(dimensions.width, dimensions.depth);
        
        // Change color based on collision status
        if (hasCollision) {
            groundHighlight.material.color.setHex(0xff0000); // Red for collision
            dragPreviewObject.userData.hasCollision = true;
        } else {
            groundHighlight.material.color.setHex(0x00ff00); // Green for valid placement
            dragPreviewObject.userData.hasCollision = false;
        }
        
        groundHighlight.position.set(gridPos.x, 0.02, gridPos.z);
        groundHighlight.visible = true;
    } else {
        groundHighlight.visible = false;
    }
}

function endDragPreview() {
    isDragging = false;
    
    if (dragPreviewObject) {
        scene.remove(dragPreviewObject);
        dragPreviewObject = null;
    }
    
    if (groundHighlight) {
        groundHighlight.visible = false;
        updateGroundHighlightSize(1, 1); // Reset to 1x1
        groundHighlight.material.color.setHex(0x00ff00); // Reset to green
    }
}

function addObjectToScene(itemType, mouseX, mouseY) {
    console.log(`Attempting to add object of type: ${itemType}`);
    let modelToAdd;
    
    if (itemType === 'single-block' && singleBlockModel) {
        modelToAdd = singleBlockModel.clone();
        console.log('Single block model cloned');
    } else if (itemType === 'long-block' && longBlockModel) {
        modelToAdd = longBlockModel.clone();
        console.log('Long block model cloned');
    } else if (itemType === 'bed' && bedModel) {
        modelToAdd = bedModel.clone();
        console.log('Bed model cloned');
    } else if (itemType === 'chair' && chairModel) {
        modelToAdd = chairModel.clone();
        console.log('Chair model cloned');
    } else if (itemType === 'desk' && deskModel) {
        modelToAdd = deskModel.clone();
        console.log('Desk model cloned');
    } else if (itemType === 'drawer' && drawerModel) {
        modelToAdd = drawerModel.clone();
        console.log('Drawer model cloned');
    } else if (itemType === 'lamp' && lampModel) {
        modelToAdd = lampModel.clone();
        console.log('Lamp model cloned');
    } else if (itemType === 'shelf' && shelfModel) {
        modelToAdd = shelfModel.clone();
        console.log('Shelf model cloned');
    } else if (itemType === 'trashcan' && trashcanModel) {
        modelToAdd = trashcanModel.clone();
        console.log('Trashcan model cloned');
    } else {
        console.error(`Model not available for type: ${itemType}. Available models:`, {
            singleBlockModel: !!singleBlockModel,
            longBlockModel: !!longBlockModel,
            bedModel: !!bedModel,
            chairModel: !!chairModel,
            deskModel: !!deskModel,
            drawerModel: !!drawerModel,
            lampModel: !!lampModel,
            shelfModel: !!shelfModel,
            trashcanModel: !!trashcanModel
        });
        return;
    }
    
    if (!modelToAdd) {
        console.error(`Failed to clone model for type: ${itemType}`);
        return;
    }
    
    console.log('Model to add:', modelToAdd);
    
    if (modelToAdd) {
        // Ensure all materials are properly cloned and visible
        modelToAdd.traverse((child) => {
            if (child.isMesh) {
                if (child.material) {
                    try {
                        // Handle both single materials and material arrays
                        if (Array.isArray(child.material)) {
                            child.material = child.material.map(mat => {
                                if (mat && typeof mat.clone === 'function') {
                                    const clonedMat = mat.clone();
                                    clonedMat.transparent = false;
                                    clonedMat.opacity = 1.0;
                                    clonedMat.visible = true;
                                    return clonedMat;
                                } else {
                                    // Create a fallback material if cloning fails
                                    const fallbackMat = new THREE.MeshLambertMaterial({
                                        color: 0x8e44ad,
                                        transparent: false,
                                        opacity: 1.0
                                    });
                                    return fallbackMat;
                                }
                            });
                        } else {
                            // Single material
                            if (child.material && typeof child.material.clone === 'function') {
                                child.material = child.material.clone();
                                child.material.transparent = false;
                                child.material.opacity = 1.0;
                                child.material.visible = true;
                            } else {
                                // Create a fallback material if cloning fails
                                child.material = new THREE.MeshLambertMaterial({
                                    color: 0x8e44ad,
                                    transparent: false,
                                    opacity: 1.0
                                });
                            }
                        }
                    } catch (error) {
                        console.warn('Failed to clone material for placed object, using fallback:', error);
                        // Create a fallback material
                        child.material = new THREE.MeshLambertMaterial({
                            color: 0x8e44ad,
                            transparent: false,
                            opacity: 1.0
                        });
                    }
                }
                child.visible = true;
                child.castShadow = true;
                child.receiveShadow = true;
            }
        });
        
        // Ensure the wrapper itself is visible
        modelToAdd.visible = true;
        
        mouse.set(mouseX, mouseY);
        raycaster.setFromCamera(mouse, camera);
        
        // Get all objects that could be the floor
        const floorObjects = scene.children.filter(obj => 
            obj.name === 'floor' || (obj.geometry && obj.geometry.type === 'PlaneGeometry')
        );
        
        const floorIntersects = raycaster.intersectObjects(floorObjects);
        
        if (floorIntersects.length > 0) {
            const intersectPoint = floorIntersects[0].point;
            
            // Use fixed grid snapping with proper rotation
            // New long blocks start with π/2 rotation (horizontal)
            const objectRotation = itemType === 'long-block' ? Math.PI / 2 : 0;
            const gridPos = snapToGrid(intersectPoint.x, intersectPoint.z, itemType, objectRotation);
            
            // Check for collision before placing
            if (checkCollision(gridPos.x, gridPos.z, itemType, objectRotation)) {
                console.log('Cannot place object: collision detected');
                return; // Exit without placing the object
            }
            
            // Determine the appropriate scale based on object type
            let objectScale;
            if (itemType === 'single-block' || itemType === 'long-block') {
                objectScale = BLOCK_SCALE;
            } else if (itemType === 'bed') {
                objectScale = 0.07;  // Reduced from 0.08 - tiny bit smaller
            } else if (itemType === 'chair') {
                objectScale = 0.06;  // Updated to match user's change
            } else if (itemType === 'desk') {
                objectScale = 0.06;  // Updated to match user's change
            } else if (itemType === 'drawer') {
                objectScale = 0.06;  // Keep same
            } else if (itemType === 'shelf') {
                objectScale = 0.08;  // Keep same
            } else if (itemType === 'lamp') {
                objectScale = 0.08;  // Keep same
            } else if (itemType === 'trashcan') {
                objectScale = 0.06;  // Keep same
            } else {
                objectScale = BLOCK_SCALE; // Default fallback
            }
            
            // Set the scale FIRST before calculating position
            modelToAdd.scale.setScalar(objectScale);
            
            // Now calculate proper Y position with the correct scale
            const box = new THREE.Box3().setFromObject(modelToAdd);
            const min = box.min;
            const yOffset = -min.y; // Offset to place bottom of model on ground
            
            // Position the object
            modelToAdd.position.set(gridPos.x, yOffset, gridPos.z);
            modelToAdd.rotation.y = objectRotation;
            modelToAdd.userData = { 
                type: itemType,
                id: Date.now() + Math.random()
            };
            
            // Add to scene and tracking array
            scene.add(modelToAdd);
            placedObjects.push(modelToAdd);
            
            // Start with scale 0 for animation
            modelToAdd.scale.setScalar(0);
            animateObjectPlacement(modelToAdd, objectScale);
        }
    }
}

function animateObjectPlacement(object, scale) {
    const targetScale = scale;
    const duration = 300;
    const startTime = performance.now();
    
    function animate() {
        const elapsed = performance.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        
        const currentScale = eased * targetScale;
        object.scale.setScalar(currentScale);
        
        if (progress < 1) {
            requestAnimationFrame(animate);
        } else {
            // Ensure the object is visible and has the correct scale
            object.visible = true;
            object.scale.setScalar(targetScale);
        }
    }
    
    animate();
}

function onMouseClick(event) {
    if (isDragging) return;
    
    // Handle move mode confirmation
    if (isMoveMode) {
        confirmMove();
        return;
    }
    
    const rect = renderer.domElement.getBoundingClientRect();
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    
    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(placedObjects, true);
    
    if (intersects.length > 0) {
        let clickedObject = intersects[0].object;
        while (clickedObject.parent && !placedObjects.includes(clickedObject)) {
            clickedObject = clickedObject.parent;
        }
        
        if (placedObjects.includes(clickedObject)) {
            selectObject(clickedObject);
        }
    } else {
        deselectObject();
    }
}

function selectObject(object) {
    deselectObject();
    
    selectedObject = object;
    isEditMode = true;
    
    // Show edit menu
    const editMenu = document.getElementById('edit-menu');
    if (editMenu) {
        editMenu.style.display = 'block';
        setTimeout(() => editMenu.classList.add('show'), 10);
    }
    
    const box = new THREE.Box3().setFromObject(object);
    const size = box.getSize(new THREE.Vector3());
    const geometry = new THREE.BoxGeometry(size.x * 1.2, size.y * 1.2, size.z * 1.2);
    const material = new THREE.MeshBasicMaterial({
        color: 0x3498db,
        wireframe: true,
        transparent: true,
        opacity: 0.7
    });
    
    const selectionBox = new THREE.Mesh(geometry, material);
    selectionBox.position.copy(object.position);
    selectionBox.name = 'selectionBox';
    scene.add(selectionBox);
    
    animateSelectionBox(selectionBox);
}

function animateSelectionBox(selectionBox) {
    const startY = selectionBox.position.y;
    
    function animate() {
        if (scene.getObjectByName('selectionBox') === selectionBox) {
            const time = performance.now() * 0.003;
            selectionBox.position.y = startY + Math.sin(time) * 0.1;
            selectionBox.rotation.y += 0.02;
            requestAnimationFrame(animate);
        }
    }
    
    animate();
}

function deselectObject() {
    if (selectedObject) {
        const selectionBox = scene.getObjectByName('selectionBox');
        if (selectionBox) {
            scene.remove(selectionBox);
        }
        selectedObject = null;
    }
    
    // Exit edit and move modes
    isEditMode = false;
    exitMoveMode();
    
    // Hide edit menu
    const editMenu = document.getElementById('edit-menu');
    if (editMenu) {
        editMenu.style.display = 'none';
        editMenu.classList.remove('show');
    }
}

function onMouseMove(event) {
    const rect = renderer.domElement.getBoundingClientRect();
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    
    if (isDragging && dragPreviewObject) {
        updateDragPreview(event);
    } else if (isMoveMode && movePreviewObject) {
        updateMovePreview(event);
    }
}

function onKeyDown(event) {
    console.log('Key pressed:', event.key);
    
    if ((event.key === 'Delete' || event.key === 'Backspace') && selectedObject) {
        deleteSelectedObject();
    } else if (event.key.toLowerCase() === 'r' && selectedObject && isEditMode && !isMoveMode) {
        event.preventDefault();
        console.log('R key pressed - attempting rotation');
        try {
            rotateSelectedObject();
        } catch (error) {
            console.error('Error in rotation:', error);
        }
    } else if (event.key.toLowerCase() === 'm' && selectedObject && isEditMode && !isMoveMode) {
        event.preventDefault();
        enterMoveMode();
    } else if (event.key === 'Escape' && isMoveMode) {
        event.preventDefault();
        exitMoveMode();
    }
}

function deleteSelectedObject() {
    if (selectedObject) {
        scene.remove(selectedObject);
        const index = placedObjects.indexOf(selectedObject);
        if (index > -1) {
            placedObjects.splice(index, 1);
        }
        deselectObject();
    }
}

function onWindowResize() {
    const width = window.innerWidth; // Full screen now
    const height = window.innerHeight;
    
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
}

function animate() {
    requestAnimationFrame(animate);
    
    controls.update();
    renderer.render(scene, camera);
}

function clearRoom() {
    placedObjects.forEach(obj => scene.remove(obj));
    placedObjects = [];
    deselectObject();
    
    const instructions = document.getElementById('instructions');
    instructions.style.transform = 'scale(1.05)';
    instructions.style.background = 'rgba(231, 76, 60, 0.9)';
    setTimeout(() => {
        instructions.style.transform = 'scale(1)';
        instructions.style.background = 'rgba(44, 62, 80, 0.9)';
    }, 200);
}

function resetCamera() {
    springBackCamera();
}

// Debug function to inspect placed objects
function debugPlacedObjects() {
    console.log('=== DEBUGGING PLACED OBJECTS ===');
    console.log('Total placed objects:', placedObjects.length);
    console.log('Scene children count:', scene.children.length);
    
    placedObjects.forEach((obj, index) => {
        console.log(`Object ${index}:`, {
            type: obj.userData?.type,
            position: obj.position,
            scale: obj.scale,
            visible: obj.visible,
            inScene: scene.children.includes(obj),
            boundingBox: new THREE.Box3().setFromObject(obj)
        });
    });
    
    console.log('Camera position:', camera.position);
    console.log('Camera looking at:', controls.target);
}

// Debug function to check model loading status
function debugModels() {
    console.log('=== DEBUGGING MODEL LOADING STATUS ===');
    console.log('Available models:', {
        singleBlockModel: !!singleBlockModel,
        longBlockModel: !!longBlockModel,
        bedModel: !!bedModel,
        chairModel: !!chairModel,
        deskModel: !!deskModel,
        drawerModel: !!drawerModel,
        lampModel: !!lampModel,
        shelfModel: !!shelfModel,
        trashcanModel: !!trashcanModel
    });
    
    console.log('Model details:');
    if (bedModel) console.log('Bed model:', bedModel);
    if (chairModel) console.log('Chair model:', chairModel);
    if (deskModel) console.log('Desk model:', deskModel);
    if (drawerModel) console.log('Drawer model:', drawerModel);
    if (lampModel) console.log('Lamp model:', lampModel);
    if (shelfModel) console.log('Shelf model:', shelfModel);
    if (trashcanModel) console.log('Trashcan model:', trashcanModel);
}

// Make debug functions available globally
window.debugPlacedObjects = debugPlacedObjects;
window.debugModels = debugModels;

// Fixed rotation function
function rotateSelectedObject() {
    console.log('=== ROTATION FUNCTION CALLED ===');
    
    if (!selectedObject) {
        console.log('No selected object');
        return;
    }
    
    if (!isEditMode) {
        console.log('Not in edit mode');
        return;
    }
    
    const objType = selectedObject.userData.type;
    console.log('Object type:', objType);
    console.log('Current rotation:', selectedObject.rotation.y, 'radians, degrees:', (selectedObject.rotation.y * 180 / Math.PI));
    console.log('Current position:', selectedObject.position);
    
    if (objType === 'single-block' || objType === 'chair' || objType === 'lamp' || objType === 'trashcan') {
        // Single blocks and 1x1 furniture just rotate in place
        selectedObject.rotation.y += Math.PI / 2;
        flashSelectionBox(true);
        console.log(`${objType} rotated`);
        return;
    }
    
    if (objType === 'long-block' || objType === 'desk' || objType === 'drawer' || objType === 'shelf' || objType === 'bed') {
        const currentRotation = selectedObject.rotation.y;
        const newRotation = currentRotation + Math.PI / 2;
        
        // Determine current and new orientations based on object type
        const normalizedCurrent = ((currentRotation % (2 * Math.PI)) + (2 * Math.PI)) % (2 * Math.PI);
        const normalizedNew = ((newRotation % (2 * Math.PI)) + (2 * Math.PI)) % (2 * Math.PI);
        
        const currentIsHorizontal = Math.abs(Math.sin(normalizedCurrent)) > 0.9;
        const newIsHorizontal = Math.abs(Math.sin(normalizedNew)) > 0.9;
        
        console.log('Current is horizontal:', currentIsHorizontal);
        console.log('New will be horizontal:', newIsHorizontal);
        
        const currentPos = selectedObject.position;
        let newX = currentPos.x;
        let newZ = currentPos.z;
        
        // Calculate new position if orientation changes
        if (currentIsHorizontal !== newIsHorizontal) {
            console.log('Orientation changing - repositioning needed');
            
            // Use snapToGrid to get the correct position for the new orientation
            const gridPos = snapToGrid(currentPos.x, currentPos.z, objType, newRotation);
            newX = gridPos.x;
            newZ = gridPos.z;
            
            console.log('New position after grid snap:', {x: newX, z: newZ});
            
            // Check for collision at new position
            const objIndex = placedObjects.indexOf(selectedObject);
            const tempPlacedObjects = placedObjects.slice();
            tempPlacedObjects.splice(objIndex, 1);
            
            // Check collision with new dimensions
            const newDimensions = getObjectDimensions(objType, newRotation);
            
            let hasCollision = false;
            for (let obj of tempPlacedObjects) {
                const objDimensions = getObjectDimensions(obj.userData.type, obj.rotation.y);
                
                // AABB collision check
                const newMinX = newX - newDimensions.width / 2;
                const newMaxX = newX + newDimensions.width / 2;
                const newMinZ = newZ - newDimensions.depth / 2;
                const newMaxZ = newZ + newDimensions.depth / 2;
                
                const objMinX = obj.position.x - objDimensions.width / 2;
                const objMaxX = obj.position.x + objDimensions.width / 2;
                const objMinZ = obj.position.z - objDimensions.depth / 2;
                const objMaxZ = obj.position.z + objDimensions.depth / 2;
                
                if (newMaxX > objMinX && newMinX < objMaxX && newMaxZ > objMinZ && newMinZ < objMaxZ) {
                    hasCollision = true;
                    break;
                }
            }
            
            if (hasCollision) {
                console.log('Collision detected - cannot rotate');
                flashSelectionBox(false);
                return;
            }
            
            // Move the object to new position
            selectedObject.position.set(newX, selectedObject.position.y, newZ);
            
            // Update selection box position
            const selectionBox = scene.getObjectByName('selectionBox');
            if (selectionBox) {
                selectionBox.position.copy(selectedObject.position);
            }
        }
        
        // Perform the rotation
        selectedObject.rotation.y = newRotation;
        
        // Show ground highlight with correct orientation
        if (groundHighlight) {
            const newDimensions = getObjectDimensions(objType, newRotation);
            updateGroundHighlightSize(newDimensions.width, newDimensions.depth);
            
            groundHighlight.position.set(newX, 0.02, newZ);
            groundHighlight.material.color.setHex(0x00ff00);
            groundHighlight.visible = true;
            
            setTimeout(() => {
                if (groundHighlight) {
                    groundHighlight.visible = false;
                    updateGroundHighlightSize(1, 1);
                }
            }, 1000);
        }
        
        flashSelectionBox(true);
        console.log(`${objType} rotated to`, (newRotation * 180 / Math.PI) % 360, 'degrees at position', {x: newX, z: newZ});
    }
    
    console.log('=== ROTATION COMPLETE ===');
}

// Flash selection box for feedback
function flashSelectionBox(success) {
    const selectionBox = scene.getObjectByName('selectionBox');
    if (!selectionBox) return;
    
    const originalColor = selectionBox.material.color.getHex();
    const flashColor = success ? 0x00ff00 : 0xff0000; // Green for success, red for failure
    
    selectionBox.material.color.setHex(flashColor);
    setTimeout(() => {
        if (selectionBox && selectionBox.material) {
            selectionBox.material.color.setHex(originalColor);
        }
    }, 200);
}

// Enter move mode for selected object
function enterMoveMode() {
    if (!selectedObject || !isEditMode) return;
    
    isMoveMode = true;
    
    // Create a transparent preview of the object
    const originalObject = selectedObject;
    movePreviewObject = originalObject.clone();
    
    // Make the preview semi-transparent
    movePreviewObject.traverse((child) => {
        if (child.isMesh && child.material) {
            try {
                // Handle both single materials and material arrays
                if (Array.isArray(child.material)) {
                    child.material = child.material.map(mat => {
                        if (mat && typeof mat.clone === 'function') {
                            const clonedMat = mat.clone();
                            clonedMat.transparent = true;
                            clonedMat.opacity = 0.6;
                            return clonedMat;
                        } else {
                            // Create a fallback material if cloning fails
                            const fallbackMat = new THREE.MeshLambertMaterial({
                                color: 0x3498db,
                                transparent: true,
                                opacity: 0.6
                            });
                            return fallbackMat;
                        }
                    });
                } else {
                    // Single material
                    if (child.material && typeof child.material.clone === 'function') {
                        child.material = child.material.clone();
                        child.material.transparent = true;
                        child.material.opacity = 0.6;
                    } else {
                        // Create a fallback material if cloning fails
                        child.material = new THREE.MeshLambertMaterial({
                            color: 0x3498db,
                            transparent: true,
                            opacity: 0.6
                        });
                    }
                }
            } catch (error) {
                console.warn('Failed to clone material for move preview, using fallback:', error);
                // Create a fallback material
                child.material = new THREE.MeshLambertMaterial({
                    color: 0x3498db,
                    transparent: true,
                    opacity: 0.6
                });
            }
        }
    });
    
    // Hide the original object but keep it in the scene for reference
    originalObject.visible = false;
    
    // Set up move preview
    movePreviewObject.userData = {
        ...originalObject.userData,
        originalObject: originalObject,
        isMoving: true
    };
    
    scene.add(movePreviewObject);
    
    // Update the canvas cursor
    renderer.domElement.style.cursor = 'move';
    
    console.log('Entered move mode - move mouse to reposition, click to confirm');
}

// Exit move mode
function exitMoveMode() {
    if (!isMoveMode) return;
    
    isMoveMode = false;
    
    if (movePreviewObject) {
        const originalObject = movePreviewObject.userData.originalObject;
        if (originalObject) {
            originalObject.visible = true;
        }
        scene.remove(movePreviewObject);
        movePreviewObject = null;
    }
    
    // Hide ground highlight and reset
    if (groundHighlight) {
        groundHighlight.visible = false;
        updateGroundHighlightSize(1, 1); // Reset to 1x1
        groundHighlight.material.color.setHex(0x00ff00); // Reset to green
    }
    
    // Reset cursor
    renderer.domElement.style.cursor = 'default';
}

// Update move preview position
function updateMovePreview(event) {
    if (!isMoveMode || !movePreviewObject) return;
    
    const rect = renderer.domElement.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    const y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    
    mouse.set(x, y);
    raycaster.setFromCamera(mouse, camera);
    
    const floorIntersects = raycaster.intersectObjects(scene.children.filter(obj => 
        obj.name === 'floor' || (obj.geometry && obj.geometry.type === 'PlaneGeometry')
    ));
    
    if (floorIntersects.length > 0) {
        const intersectPoint = floorIntersects[0].point;
        const itemType = movePreviewObject.userData.type;
        const objectRotation = movePreviewObject.rotation.y;
        
        // Use fixed grid snapping with current rotation
        const gridPos = snapToGrid(intersectPoint.x, intersectPoint.z, itemType, objectRotation);
        
        // Check for collision, excluding the original object
        const originalObject = movePreviewObject.userData.originalObject;
        const objIndex = placedObjects.indexOf(originalObject);
        const tempPlacedObjects = placedObjects.slice();
        tempPlacedObjects.splice(objIndex, 1);
        
        const originalPlacedObjects = placedObjects;
        placedObjects = tempPlacedObjects;
        
        const hasCollision = checkCollision(gridPos.x, gridPos.z, itemType, objectRotation);
        
        placedObjects = originalPlacedObjects;
        
        // Update preview position
        movePreviewObject.position.set(gridPos.x, movePreviewObject.position.y, gridPos.z);
        
        // Update ground highlight based on current rotation
        const dimensions = getObjectDimensions(itemType, objectRotation);
        updateGroundHighlightSize(dimensions.width, dimensions.depth);
        
        // Change color based on collision status
        if (hasCollision) {
            groundHighlight.material.color.setHex(0xff0000); // Red for collision
            movePreviewObject.userData.hasCollision = true;
        } else {
            groundHighlight.material.color.setHex(0x00ff00); // Green for valid placement
            movePreviewObject.userData.hasCollision = false;
        }
        
        groundHighlight.position.set(gridPos.x, 0.02, gridPos.z);
        groundHighlight.visible = true;
    } else {
        groundHighlight.visible = false;
    }
}

// Confirm move operation
function confirmMove() {
    if (!isMoveMode || !movePreviewObject) return;
    
    const originalObject = movePreviewObject.userData.originalObject;
    if (!originalObject) return;
    
    // Check if move is valid (no collision)
    if (movePreviewObject.userData.hasCollision) {
        console.log('Cannot move object: collision detected');
        exitMoveMode();
        return;
    }
    
    // Update the original object position
    originalObject.position.copy(movePreviewObject.position);
    
    // Exit move mode
    exitMoveMode();
    
    // Update selection box position
    const selectionBox = scene.getObjectByName('selectionBox');
    if (selectionBox) {
        selectionBox.position.copy(originalObject.position);
    }
    
    console.log('Object moved successfully');
}

// Helper function to update ground highlight size
function updateGroundHighlightSize(width, depth) {
    if (!groundHighlight) return;
    
    // Remove the old geometry
    groundHighlight.geometry.dispose();
    
    // Create new geometry with the correct dimensions
    groundHighlight.geometry = new THREE.PlaneGeometry(width, depth);
    
    console.log(`Ground highlight updated to ${width}x${depth}`);
}

window.addEventListener('DOMContentLoaded', init); 