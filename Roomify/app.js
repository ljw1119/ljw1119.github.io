// Global variables
let scene, camera, renderer, controls;
let room;
// New furniture models
let bedModel, chairModel, deskModel, drawerModel, lampModel, shelfModel, trashcanModel;
// Additional furniture models
let airConditionerModel, boardModel, clockModel;
let closetModel;
let doorModel, door2Model;
let frameModel, frame2Model, frame3Model;
let posterModel, poster2Model, poster3Model;
let rackModel, rack2Model;
let sofaModel, sofa2Model;
let tableModel, table2Model;
let tvModel;
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
let isSpringBackActive = false;
let springBackTimeoutId = null;
let selectedObject = null;
let isWallView = false;
let wallBoxes = []; // Array to store wall click boxes
let griddisplay = true; // Grid display toggle

// Edit mode variables
let isEditMode = false;
let isMoveMode = false;
let movePreviewObject = null;

// Optimized preview system - single shared renderer
let sharedPreviewRenderer = null;
let previewData = {}; // Store model and container references
let activePreview = null;

// Constants
const ROOM_SIZE = 8;
const BLOCK_HEIGHT = 1;
const BLOCK_SCALE = 0.075; // Exactly between 0.05 and 0.1 for perfect size
const ROOM_SCALE = 0.005;  // Decreased from 0.01 to 0.005 (half size)

// Add original FOV as a global variable
let originalFOV = 75; // Default FOV value
const WALL_VIEW_FOV = 55; // Narrower FOV for wall view

// Add wall grid variables
let wallGrids = [];
let wallHighlight = null;
let placedWallObjects = [];
const WALL_GRID_WIDTH = 8; // 8 columns across width
const WALL_GRID_HEIGHT = 4; // 4 rows (top 3/4 of 4-unit wall height)
const WALL_TILE_SIZE = 1; // 1x1 tile size
let currentWall = null; // Track which wall we're viewing

// Initialize the application
function init() {
    // Create scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x3c8491);
    
    // Create camera - closer zoom
    camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
    
    originalCameraPosition = new THREE.Vector3(8, 7, 8);
    originalCameraTarget = new THREE.Vector3(0, 1, 0);

    camera.position.set(originalCameraPosition.x,originalCameraPosition.y, originalCameraPosition.z);

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
    controls.dampingFactor = 0.1; // Increased from 0.05 for smoother feel
    controls.screenSpacePanning = false;
    controls.minDistance = 6;
    controls.maxDistance = 20;
    const deg = Math.PI / 180;
    controls.maxPolarAngle = deg * 90;
    controls.minPolarAngle = deg * 10; // Allow some downward angle
    // Remove azimuth constraints to allow full 360-degree rotation
    // controls.maxAzimuthAngle = deg * 90; 
    // controls.minAzimuthAngle = deg * 0;
    controls.target.set(originalCameraTarget.x, originalCameraTarget.y, originalCameraTarget.z);
    
    // Custom spring-back behavior
    controls.addEventListener('start', onControlsStart);
    controls.addEventListener('end', onControlsEnd);
    controls.addEventListener('change', onControlsChange);
    
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
    
    // Create wall highlight
    createWallHighlight();
    
    // Create wall grids
    createWallGrids();
    
    // Create wall click boxes
    createWallClickBoxes();
    
    // Start render loop
    animate();
}

function setupLighting() {
    // Ambient light
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    scene.add(ambientLight);

    // Main directional light
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
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

function createWallHighlight() {
    // Create wall highlight for wall object placement
    const geometry = new THREE.PlaneGeometry(1, 1);
    const material = new THREE.MeshBasicMaterial({
        color: 0x00ff00,
        transparent: true,
        opacity: 0.3,
        side: THREE.DoubleSide
    });
    wallHighlight = new THREE.Mesh(geometry, material);
    wallHighlight.visible = false;
    scene.add(wallHighlight);
}

function updateWallHighlightSize(itemType) {
    if (!wallHighlight) return;
    
    // Dispose old geometry to prevent memory leaks
    if (wallHighlight.geometry) {
        wallHighlight.geometry.dispose();
    }
    
    // Create new geometry based on item type
    let width = 1, height = 1;
    if (itemType === 'airconditioner') {
        width = 2; // 2 tiles wide
        height = 1; // 1 tile tall
    } else if (itemType === 'board') {
        width = 2; // 2 tiles wide
        height = 2; // 2 tiles tall
    } else if (itemType === 'frame2') {
        width = 2; // 2 tiles wide
        height = 2; // 2 tiles tall (2x2 = 4 tiles total)
    } else if (itemType === 'frame3') {
        width = 2; // 2 tiles wide
        height = 1; // 1 tile tall
    } else if (itemType === 'rack2') {
        width = 2; // 2 tiles wide
        height = 1; // 1 tile tall
    } else {
        width = 1; // Default 1x1
        height = 1;
    }
    
    const geometry = new THREE.PlaneGeometry(width, height);
    wallHighlight.geometry = geometry;
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
    gridHelper.name = 'gridHelper';
    gridHelper.position.y = 0.01;
    scene.add(gridHelper);
    griddisplay = true; // Set grid display to true
}

function createWallGrids() {
    // Create visual grids for both walls (8x4 grid system, positioned lower)
    const gridWidth = WALL_GRID_WIDTH * WALL_TILE_SIZE; // 8 units wide
    const gridHeight = WALL_GRID_HEIGHT * WALL_TILE_SIZE; // 4 units high
    
    // Wall 1 (X-axis wall) - create individual grid squares without internal lines
    const wall1GridGroup = new THREE.Group();
    wall1GridGroup.name = 'wall1Grid';
    wall1GridGroup.visible = false;
    
    // Create individual square outlines for wall 1
    for (let i = 0; i < WALL_GRID_WIDTH; i++) {
        for (let j = 0; j < WALL_GRID_HEIGHT; j++) {
            const squareGeometry = new THREE.PlaneGeometry(WALL_TILE_SIZE, WALL_TILE_SIZE);
            const edges = new THREE.EdgesGeometry(squareGeometry);
            const lineMaterial = new THREE.LineBasicMaterial({ 
                color: 0x2c3e50, 
                transparent: true, 
                opacity: 0.5 
            });
            const square = new THREE.LineSegments(edges, lineMaterial);
            
            // Position each square
            const x = (i - WALL_GRID_WIDTH/2 + 0.5) * WALL_TILE_SIZE;
            const y = (j - WALL_GRID_HEIGHT/2 + 0.5) * WALL_TILE_SIZE;
            square.position.set(x, y, 0);
            wall1GridGroup.add(square);
        }
    }
    
    wall1GridGroup.position.set(-3.9, 4, 0); // x=-3.9 (in front of wall), y=4 (lower position), z=0 (centered)
    wall1GridGroup.rotation.y = Math.PI / 2; // Rotate 90 degrees to face the correct direction
    scene.add(wall1GridGroup);
    
    // Wall 2 (Z-axis wall) - create individual grid squares without internal lines
    const wall2GridGroup = new THREE.Group();
    wall2GridGroup.name = 'wall2Grid';
    wall2GridGroup.visible = false;
    
    // Create individual square outlines for wall 2
    for (let i = 0; i < WALL_GRID_WIDTH; i++) {
        for (let j = 0; j < WALL_GRID_HEIGHT; j++) {
            const squareGeometry = new THREE.PlaneGeometry(WALL_TILE_SIZE, WALL_TILE_SIZE);
            const edges = new THREE.EdgesGeometry(squareGeometry);
            const lineMaterial = new THREE.LineBasicMaterial({ 
                color: 0x2c3e50, 
                transparent: true, 
                opacity: 0.5 
            });
            const square = new THREE.LineSegments(edges, lineMaterial);
            
            // Position each square
            const x = (i - WALL_GRID_WIDTH/2 + 0.5) * WALL_TILE_SIZE;
            const y = (j - WALL_GRID_HEIGHT/2 + 0.5) * WALL_TILE_SIZE;
            square.position.set(x, y, 0);
            wall2GridGroup.add(square);
        }
    }
    
    wall2GridGroup.position.set(0, 4, -3.9); // x=0 (centered), y=4 (lower position), z=-3.9 (in front of wall)
    scene.add(wall2GridGroup);
    
    // Store wall grids for easy access
    wallGrids = [
        { wall: 'wall1', grid: wall1GridGroup },
        { wall: 'wall2', grid: wall2GridGroup }
    ];
}

function gridOnOff() {
    if (griddisplay) {
        scene.remove(scene.getObjectByName('gridHelper'));
        console.log('Grid lines removed');
        griddisplay = false;
    }
    else {
        createFloorGrid();
    }
}

// Wall grid snapping function
function snapToWallGrid(worldX, worldY, wallName, itemType = 'frame') {
    let gridX, gridY;
    
    if (wallName === 'wall1') {
        // Wall 1 has 8x4 grid: X from -3.5 to 3.5 (centers), Y from 2.5 to 5.5 (centers)
        
        if (itemType === 'airconditioner') {
            // AC is 2x1 (2 tiles horizontally) - snap to center of 2-tile span
            const snapX = Math.round(worldX); // Snap to integer positions for 2-wide objects
            const snapY = Math.round(worldY - 0.5) + 0.5; // Snap to .5 positions for height
            
            // Constrain to valid positions (accounting for 2-tile width)
            // For 8-wide grid (-4 to 4), 2-wide object can be centered from -3 to 3
            gridX = Math.max(-3, Math.min(3, snapX));
            gridY = Math.max(2.5, Math.min(5.5, snapY));
        } else if (itemType === 'board' || itemType === 'frame2') {
            // Board and Frame2 are 2x2 - snap to center of 2x2 area
            const snapX = Math.round(worldX); // Snap to integer positions for 2-wide objects
            const snapY = Math.round(worldY); // Snap to integer positions for 2-tall objects
            
            // Constrain to valid positions (accounting for 2x2 size)
            // For 8-wide grid (-4 to 4), 2-wide object can be centered from -3 to 3
            gridX = Math.max(-3, Math.min(3, snapX));
            gridY = Math.max(3, Math.min(5, snapY)); // 3 to 5 (centers of 2-tall spans)
        } else if (itemType === 'frame3') {
            // Frame3 is 2x1 - snap to center of 2-tile horizontal span
            const snapX = Math.round(worldX); // Snap to integer positions for 2-wide objects
            const snapY = Math.round(worldY - 0.5) + 0.5; // Snap to .5 positions for height
            
            // Constrain to valid positions (accounting for 2-tile width)
            gridX = Math.max(-3, Math.min(3, snapX));
            gridY = Math.max(2.5, Math.min(5.5, snapY));
        } else if (itemType === 'rack2') {
            // Rack2 is 2x1 - snap to center of 2-tile horizontal span
            const snapX = Math.round(worldX); // Snap to integer positions for 2-wide objects
            const snapY = Math.round(worldY - 0.5) + 0.5; // Snap to .5 positions for height
            
            // Constrain to valid positions (accounting for 2-tile width)
            // For 8-wide grid (-4 to 4), 2-wide object can be centered from -3 to 3
            gridX = Math.max(-3, Math.min(3, snapX));
            gridY = Math.max(2.5, Math.min(5.5, snapY));
        } else {
            // Default 1x1 objects - snap to grid square centers
            const snapX = Math.round(worldX - 0.5) + 0.5; // Snap to .5 positions
            const snapY = Math.round(worldY - 0.5) + 0.5; // Snap to .5 positions
            
            // Constrain to valid grid square centers (8 columns x 4 rows)
            gridX = Math.max(-3.5, Math.min(3.5, snapX));
            gridY = Math.max(2.5, Math.min(5.5, snapY));
        }
    } else if (wallName === 'wall2') {
        // Wall 2 has 8x4 grid: X from -3.5 to 3.5 (centers), Y from 2.5 to 5.5 (centers)
        
        if (itemType === 'airconditioner') {
            // AC is 2x1 (2 tiles horizontally) - snap to center of 2-tile span
            const snapX = Math.round(worldX); // Snap to integer positions for 2-wide objects
            const snapY = Math.round(worldY - 0.5) + 0.5; // Snap to .5 positions for height
            
            // Constrain to valid positions (accounting for 2-tile width)
            // For 8-wide grid (-4 to 4), 2-wide object can be centered from -3 to 3
            gridX = Math.max(-3, Math.min(3, snapX));
            gridY = Math.max(2.5, Math.min(5.5, snapY));
        } else if (itemType === 'board' || itemType === 'frame2') {
            // Board and Frame2 are 2x2 - snap to center of 2x2 area
            const snapX = Math.round(worldX); // Snap to integer positions for 2-wide objects
            const snapY = Math.round(worldY); // Snap to integer positions for 2-tall objects
            
            // Constrain to valid positions (accounting for 2x2 size)
            // For 8-wide grid (-4 to 4), 2-wide object can be centered from -3 to 3
            gridX = Math.max(-3, Math.min(3, snapX));
            gridY = Math.max(3, Math.min(5, snapY)); // 3 to 5 (centers of 2-tall spans)
        } else if (itemType === 'frame3') {
            // Frame3 is 2x1 - snap to center of 2-tile horizontal span
            const snapX = Math.round(worldX); // Snap to integer positions for 2-wide objects
            const snapY = Math.round(worldY - 0.5) + 0.5; // Snap to .5 positions for height
            
            // Constrain to valid positions (accounting for 2-tile width)
            gridX = Math.max(-3, Math.min(3, snapX));
            gridY = Math.max(2.5, Math.min(5.5, snapY));
        } else if (itemType === 'rack2') {
            // Rack2 is 2x1 - snap to center of 2-tile horizontal span
            const snapX = Math.round(worldX); // Snap to integer positions for 2-wide objects
            const snapY = Math.round(worldY - 0.5) + 0.5; // Snap to .5 positions for height
            
            // Constrain to valid positions (accounting for 2-tile width)
            // For 8-wide grid (-4 to 4), 2-wide object can be centered from -3 to 3
            gridX = Math.max(-3, Math.min(3, snapX));
            gridY = Math.max(2.5, Math.min(5.5, snapY));
        } else {
            // Default 1x1 objects - snap to grid square centers
            const snapX = Math.round(worldX - 0.5) + 0.5; // Snap to .5 positions
            const snapY = Math.round(worldY - 0.5) + 0.5; // Snap to .5 positions
            
            // Constrain to valid grid square centers (8 columns x 4 rows)
            gridX = Math.max(-3.5, Math.min(3.5, snapX));
            gridY = Math.max(2.5, Math.min(5.5, snapY));
        }
    }
    
    return { x: gridX, y: gridY };
}

// Fixed grid snapping function that handles rotation
function snapToGrid(worldX, worldZ, itemType = 'single-block', rotationY = 0) {
    // The room is 8x8 with grid lines at integers: -4, -3, -2, -1, 0, 1, 2, 3, 4
    // Grid squares are 1x1 units
    
    let gridX, gridZ;
        
    if (itemType === 'desk' || itemType === 'tv') {
        // 1x3 or 3x1 objects (desk) depend on rotation
        const isHorizontal = Math.abs(Math.sin(rotationY)) > 0.9;
        
        if (isHorizontal) {
            gridX = Math.round(worldX) + 0.5;
            gridZ = Math.floor(worldZ) + 0.5;
                
            gridX = Math.max(-3.5, Math.min(3.5, gridX));
            gridZ = Math.max(-2.5, Math.min(2.5, gridZ));
        } else {
            gridX = Math.floor(worldX) + 0.5; 
            gridZ = Math.round(worldZ) + 0.5;
            
            gridX = Math.max(-2.5, Math.min(2.5, gridX));
            gridZ = Math.max(-3.5, Math.min(3.5, gridZ));
        }
    } 
    else if(itemType === 'closet') {
        // 1x1 single tile object (closet3 renamed to closet)
        gridX = Math.floor(worldX) + 0.5;
        gridZ = Math.floor(worldZ) + 0.5;
        
        // Clamp to room bounds: -3.5 to 3.5
        gridX = Math.max(-3.5, Math.min(3.5, gridX));
        gridZ = Math.max(-3.5, Math.min(3.5, gridZ));
    }
    else if(itemType === 'sofa2') {
        // 2x1 or 1x2 objects (sofa2) - 2 tiles long
        // Since sofa2 gets default 90° rotation, it starts as 1x2 (vertical)
        const normalizedRotation = ((rotationY % (2 * Math.PI)) + (2 * Math.PI)) % (2 * Math.PI);
        const isHorizontal = Math.abs(Math.sin(normalizedRotation)) > 0.9;
        
        if (isHorizontal) {
            // After 90° rotation: 1 tile wide, 2 tiles deep (vertical orientation)
            gridX = Math.floor(worldX) + 0.5; // Standard grid center for width
            gridZ = Math.round(worldZ); // Snap to integer positions for 2-deep objects
                
            gridX = Math.max(-3.5, Math.min(3.5, gridX));
            gridZ = Math.max(-3, Math.min(3, gridZ)); // 2-tile depth: -3 to 3
        } else {
            // No rotation: 2 tiles wide, 1 tile deep (horizontal orientation)
            gridX = Math.round(worldX); // Snap to integer positions for 2-wide objects
            gridZ = Math.floor(worldZ) + 0.5; // Standard grid center for depth
            
            gridX = Math.max(-3, Math.min(3, gridX)); // 2-tile width: -3 to 3
            gridZ = Math.max(-3.5, Math.min(3.5, gridZ));
        }
    } 
    else if (itemType === 'bed') {
        const isHorizontal = Math.abs(Math.sin(rotationY)) > 0.9;
        if (isHorizontal) {
            gridX = Math.round(worldX);
            gridZ = Math.floor(worldZ);
                
            gridX = Math.max(-3, Math.min(3, gridX));
            gridZ = Math.max(-2, Math.min(2, gridZ));
        } else {
            gridX = Math.floor(worldX); 
            gridZ = Math.round(worldZ);
            
            gridX = Math.max(-2, Math.min(2, gridX));
            gridZ = Math.max(-3, Math.min(3, gridZ));
        }
    }
    else { 
        // 1x1 objects always snap to center of grid squares (half-integer positions)
        gridX = Math.floor(worldX) + 0.5;
        gridZ = Math.floor(worldZ) + 0.5;
        
        // Clamp to room bounds: -3.5 to 3.5
        gridX = Math.max(-3.5, Math.min(3.5, gridX));
        gridZ = Math.max(-3.5, Math.min(3.5, gridZ));
    }
    return { x: gridX, z: gridZ };
}

// Helper function to get object dimensions based on type and current rotation
function getObjectDimensions(type, rotationY = 0) {
    if (type === 'bed') {
        const normalizedRotation = ((rotationY % (2 * Math.PI)) + (2 * Math.PI)) % (2 * Math.PI);
        const isHorizontal = Math.abs(Math.sin(normalizedRotation)) > 0.9;
        return isHorizontal ? { width: 2, depth: 4 } : { width: 4, depth: 2 };
    } else if (type === 'desk') {
        const normalizedRotation = ((rotationY % (2 * Math.PI)) + (2 * Math.PI)) % (2 * Math.PI);
        const isHorizontal = Math.abs(Math.sin(normalizedRotation)) > 0.9;
        return isHorizontal ? { width: 1, depth: 3 } : { width: 3, depth: 1 };
    } else if (type === 'closet') {
        // Closet is 1x1 (single tile)
        return { width: 1, depth: 1 };
    } else if (type === 'sofa2') {
        // Sofa2 gets default 90° rotation, so it starts as 1x2 (vertical)
        // We need to account for the default rotation + any additional rotation
        const normalizedRotation = ((rotationY % (2 * Math.PI)) + (2 * Math.PI)) % (2 * Math.PI);
        const isHorizontal = Math.abs(Math.sin(normalizedRotation)) > 0.9;
        // After 90° default rotation: horizontal means 1x2, not horizontal means 2x1
        return isHorizontal ? { width: 1, depth: 2 } : { width: 2, depth: 1 };
    } else if (type === 'tv') {
        const normalizedRotation = ((rotationY % (2 * Math.PI)) + (2 * Math.PI)) % (2 * Math.PI);
        const isHorizontal = Math.abs(Math.sin(normalizedRotation)) > 0.9;
        return isHorizontal ? { width: 1, depth: 3 } : { width: 3, depth: 1 };
    }
    else {
        return { width: 1, depth: 1 };
    }
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

function checkWallCollision(newX, newY, wallName, newType) {
    // Get dimensions for the new object
    const getWallObjectDimensions = (type) => {
        if (type === 'airconditioner') {
            return { width: 2, height: 1 }; // 2 tiles wide, 1 tile tall
        } else if (type === 'board') {
            return { width: 2, height: 2 }; // 2 tiles wide, 2 tiles tall
        } else if (type === 'frame2') {
            return { width: 2, height: 2 }; // 2x2 tiles (4 tiles total)
        } else if (type === 'frame3') {
            return { width: 2, height: 1 }; // 2 tiles wide, 1 tile tall
        } else if (type === 'rack2') {
            return { width: 2, height: 1 }; // 2 tiles wide, 1 tile tall
        } else {
            return { width: 1, height: 1 }; // Default 1x1
        }
    };
    
    const newDimensions = getWallObjectDimensions(newType);
    
    // Check collision with other wall objects
    for (let wallObj of placedWallObjects) {
        if (wallObj.userData.wallName !== wallName) continue;
        
        const objX = wallObj.userData.gridX;
        const objY = wallObj.userData.gridY;
        const objType = wallObj.userData.type;
        const objDimensions = getWallObjectDimensions(objType);
        
        // Calculate boundaries for both objects
        const newMinX = newX - newDimensions.width / 2;
        const newMaxX = newX + newDimensions.width / 2;
        const newMinY = newY - newDimensions.height / 2;
        const newMaxY = newY + newDimensions.height / 2;
        
        const objMinX = objX - objDimensions.width / 2;
        const objMaxX = objX + objDimensions.width / 2;
        const objMinY = objY - objDimensions.height / 2;
        const objMaxY = objY + objDimensions.height / 2;
        
        // Check for overlap
        const overlapX = newMaxX > objMinX && newMinX < objMaxX;
        const overlapY = newMaxY > objMinY && newMinY < objMaxY;
        
        if (overlapX && overlapY) {
            return true; // Collision detected
        }
    }
    return false;
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
        room.castShadow = true;
        room.receiveShadow = true;
        scene.add(room);
        console.log('Room loaded and added to scene');
    }, (progress) => {
        const percent = (progress.loaded / progress.total * 100).toFixed(1);
        console.log(`Room loading: ${percent}%`);
    }, (error) => {
        console.error('Failed to load room FBX:', error);
    });

    // Load all furniture models
    const furnitureItems = [
        // Existing models
        { file: 'Bed.fbx', variable: 'bedModel', scale: 0.07 },
        { file: 'Chair.fbx', variable: 'chairModel', scale: 0.1 },
        { file: 'Desk.fbx', variable: 'deskModel', scale: 0.08 },
        { file: 'Drawer.fbx', variable: 'drawerModel', scale: 0.08 },
        { file: 'Lamp.fbx', variable: 'lampModel', scale: 0.08 },
        { file: 'Shelf.fbx', variable: 'shelfModel', scale: 0.07 },
        { file: 'Trashcan.fbx', variable: 'trashcanModel', scale: 0.08 },
        { file: 'AirConditioner.fbx', variable: 'airConditionerModel', scale: 0.08 },
        { file: 'Board.fbx', variable: 'boardModel', scale: 0.08 },
        { file: 'Clock.fbx', variable: 'clockModel', scale: 0.08 },
        { file: 'Closet3.fbx', variable: 'closetModel', scale: 0.06 },
        { file: 'Door.fbx', variable: 'doorModel', scale: 0.08 },
        { file: 'Door2.fbx', variable: 'door2Model', scale: 0.08 },
        { file: 'Frame.fbx', variable: 'frameModel', scale: 0.08 },
        { file: 'Frame2.fbx', variable: 'frame2Model', scale: 0.08 },
        { file: 'Frame3.fbx', variable: 'frame3Model', scale: 0.08 },
        { file: 'Poster.fbx', variable: 'posterModel', scale: 0.08 },
        { file: 'Poster2.fbx', variable: 'poster2Model', scale: 0.08 },
        { file: 'Poster3.fbx', variable: 'poster3Model', scale: 0.08 },
        { file: 'Rack.fbx', variable: 'rackModel', scale: 0.06 },
        { file: 'Rack2.fbx', variable: 'rack2Model', scale: 0.06 },
        { file: 'Sofa.fbx', variable: 'sofaModel', scale: 0.08 },
        { file: 'Sofa2.fbx', variable: 'sofa2Model', scale: 0.08 },
        { file: 'Table.fbx', variable: 'tableModel', scale: 0.08 },
        { file: 'Table2.fbx', variable: 'table2Model', scale: 0.08 },
        { file: 'TV.fbx', variable: 'tvModel', scale: 0.08 }
    ];

    furnitureItems.forEach(item => {
        loader.load(`./Resources/${item.file}`, (fbx) => {
            console.log(`${item.file} loaded, processing...`);
            
            // Scale the original model
            fbx.scale.setScalar(item.scale);
            
            // Rotate the FBX model FIRST, before calculating center
            fbx.rotation.x = -(Math.PI / 2); // -90 degrees in radians
            fbx.castShadow = true;
            
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
            
            // Use eval to dynamically assign to the correct variable
            eval(`${item.variable} = wrapper`);
            
            // Create model preview - handle special case for closet3 -> closet rename
            const previewId = furnitureType === 'closet3' ? 'closet-preview' : `${furnitureType}-preview`;
            createModelPreview(wrapper, previewId);
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
    
    // Store model reference for lazy loading
    previewData[containerId] = {
        model: model,
        container: container,
        canvas: null,
        isVisible: false
    };
    
    // Create placeholder instead of immediately rendering
    const placeholder = document.createElement('div');
    placeholder.style.width = '50px';
    placeholder.style.height = '40px';
    placeholder.style.background = 'rgba(23, 32, 42, 0.8)';
    placeholder.style.border = '1px solid #34495e';
    placeholder.style.borderRadius = '4px';
    placeholder.style.display = 'flex';
    placeholder.style.alignItems = 'center';
    placeholder.style.justifyContent = 'center';
    placeholder.style.color = '#7f8c8d';
    placeholder.style.fontSize = '10px';
    placeholder.textContent = '3D';
    
    container.appendChild(placeholder);
    
    // Set up intersection observer for lazy loading
    setupLazyPreview(containerId);
}

function setupLazyPreview(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    // Create intersection observer to detect when preview becomes visible
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting && !previewData[containerId].isVisible) {
                previewData[containerId].isVisible = true;
                loadPreview(containerId);
            }
        });
    }, {
        rootMargin: '50px' // Load slightly before coming into view
    });
    
    observer.observe(container);
}

function loadPreview(containerId) {
    const data = previewData[containerId];
    if (!data || data.canvas) return; // Already loaded
    
    // Initialize shared renderer if not created
    if (!sharedPreviewRenderer) {
        initSharedPreviewRenderer();
    }
    
    // Create canvas for this preview
    const canvas = document.createElement('canvas');
    canvas.width = 50;
    canvas.height = 40;
    canvas.style.width = '50px';
    canvas.style.height = '40px';
    canvas.style.borderRadius = '4px';
    
    // Replace placeholder with canvas
    const container = data.container;
    container.innerHTML = '';
    container.appendChild(canvas);
    
    // Store canvas reference
    data.canvas = canvas;
    
    // Render initial frame
    renderPreview(containerId);
    
    // Start animation for this preview
    startPreviewAnimation(containerId);
}

function initSharedPreviewRenderer() {
    // Create a temporary canvas for the shared renderer
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = 50;
    tempCanvas.height = 40;
    
    sharedPreviewRenderer = new THREE.WebGLRenderer({ 
        canvas: tempCanvas,
        antialias: true, 
        alpha: true,
        preserveDrawingBuffer: true
    });
    sharedPreviewRenderer.setSize(50, 40);
    sharedPreviewRenderer.shadowMap.enabled = false; // Disable shadows for performance
}

function renderPreview(containerId) {
    const data = previewData[containerId];
    if (!data || !data.canvas || !sharedPreviewRenderer) return;
    
    // Create temporary scene for this model
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x17202a);
    
    // Create camera
    const camera = new THREE.PerspectiveCamera(50, 50/40, 0.1, 100);
    
    // Add lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);
    
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(2, 2, 1);
    scene.add(directionalLight);
    
    // Clone and add model
    const previewModel = data.model.clone();
    previewModel.position.set(0, 0, 0);
    
    // Calculate optimal camera position
    const box = new THREE.Box3().setFromObject(previewModel);
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    camera.position.set(maxDim, maxDim, maxDim);
    camera.lookAt(0, 0, 0);
    
    scene.add(previewModel);
    
    // Store rotation for animation
    if (!data.rotation) data.rotation = 0;
    previewModel.rotation.y = data.rotation;
    
    // Render to shared renderer
    sharedPreviewRenderer.render(scene, camera);
    
    // Copy rendered image to preview canvas
    const ctx = data.canvas.getContext('2d');
    ctx.drawImage(sharedPreviewRenderer.domElement, 0, 0);
    
    // Clean up temporary scene
    scene.remove(previewModel);
    scene.remove(ambientLight);
    scene.remove(directionalLight);
}

function startPreviewAnimation(containerId) {
    const data = previewData[containerId];
    if (!data) return;
    
    function animate() {
        if (data.isVisible && data.canvas) {
            data.rotation = (data.rotation || 0) + 0.01;
            renderPreview(containerId);
            setTimeout(() => requestAnimationFrame(animate), 50); // Slower animation for performance
        }
    }
    animate();
}

function onControlsStart() {
    isRotating = true;
    isSpringBackActive = false; // Stop any ongoing spring-back
    
    // Clear any pending spring-back timeout
    if (springBackTimeoutId) {
        clearTimeout(springBackTimeoutId);
        springBackTimeoutId = null;
    }
}

function onControlsEnd() {
    isRotating = false;
    
    // Clear any existing timeout first
    if (springBackTimeoutId) {
        clearTimeout(springBackTimeoutId);
    }
    
    // Set a new timeout for spring-back
    springBackTimeoutId = setTimeout(() => {
        if (!isRotating && !isWallView) {
            springBackCamera();
        }
        springBackTimeoutId = null;
    }, 1500);
}

function onControlsChange() {
    // Only cancel spring-back if user is actively interacting (not during spring-back animation)
    if (isSpringBackActive && isRotating) {
        isSpringBackActive = false; // Cancel any ongoing spring-back
    }
}

function springBackCamera() {
    // Don't start spring-back if user is interacting or in special modes
    if (isRotating || isWallView || isEditMode || isDragging || isMoveMode) {
        return;
    }
    
    isSpringBackActive = true;
    const duration = 1000;
    const startPosition = camera.position.clone();
    const startTarget = controls.target.clone();
    const startTime = performance.now();
    const startFOV = camera.fov;
    
    // Temporarily disable controls damping to prevent conflicts
    const originalDamping = controls.enableDamping;
    controls.enableDamping = false;
    
    function animateCamera() {
        // Stop animation if user starts interacting
        if (isRotating || isWallView || isEditMode || isDragging || isMoveMode) {
            isSpringBackActive = false;
            controls.enableDamping = originalDamping; // Restore damping
            return;
        }
        
        if (!isSpringBackActive) {
            controls.enableDamping = originalDamping; // Restore damping
            return; // Animation was cancelled
        }
        
        const elapsed = performance.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        
        camera.position.lerpVectors(startPosition, originalCameraPosition, eased);
        controls.target.lerpVectors(startTarget, originalCameraTarget, eased);
        
        // Restore FOV if it was changed
        if (startFOV !== originalFOV) {
            camera.fov = startFOV + (originalFOV - startFOV) * eased;
            camera.updateProjectionMatrix();
        }
        
        if (progress < 1) {
            requestAnimationFrame(animateCamera);
        } else {
            isSpringBackActive = false;
            controls.enableDamping = originalDamping; // Restore damping
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
        
        // Determine if we should add to wall or floor
        if (isWallView && currentWall) {
            addWallObjectToScene(itemType, x, y);
        } else {
            addObjectToScene(itemType, x, y);
        }
        endDragPreview();
    });
}

function startDragPreview(itemType) {
    isDragging = true;
    
    let modelToPreview;
    if (itemType === 'bed' && bedModel) {
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
    } else if (itemType === 'airconditioner' && airConditionerModel) {
        modelToPreview = airConditionerModel.clone();
    } else if (itemType === 'board' && boardModel) {
        modelToPreview = boardModel.clone();
    } else if (itemType === 'clock' && clockModel) {
        modelToPreview = clockModel.clone();
    } else if (itemType === 'closet' && closetModel) {
        modelToPreview = closetModel.clone();
    } else if (itemType === 'door' && doorModel) {
        modelToPreview = doorModel.clone();
    } else if (itemType === 'door2' && door2Model) {
        modelToPreview = door2Model.clone();
    } else if (itemType === 'frame' && frameModel) {
        modelToPreview = frameModel.clone();
    } else if (itemType === 'frame2' && frame2Model) {
        modelToPreview = frame2Model.clone();
    } else if (itemType === 'frame3' && frame3Model) {
        modelToPreview = frame3Model.clone();
    } else if (itemType === 'poster' && posterModel) {
        modelToPreview = posterModel.clone();
    } else if (itemType === 'poster2' && poster2Model) {
        modelToPreview = poster2Model.clone();
    } else if (itemType === 'poster3' && poster3Model) {
        modelToPreview = poster3Model.clone();
    } else if (itemType === 'rack' && rackModel) {
        modelToPreview = rackModel.clone();
    } else if (itemType === 'rack2' && rack2Model) {
        modelToPreview = rack2Model.clone();
    } else if (itemType === 'sofa' && sofaModel) {
        modelToPreview = sofaModel.clone();
    } else if (itemType === 'sofa2' && sofa2Model) {
        modelToPreview = sofa2Model.clone();
    } else if (itemType === 'table' && tableModel) {
        modelToPreview = tableModel.clone();
    } else if (itemType === 'table2' && table2Model) {
        modelToPreview = table2Model.clone();
    } else if (itemType === 'tv' && tvModel) {
        modelToPreview = tvModel.clone();
    }
    
    if (modelToPreview) {
        // Determine the appropriate scale based on object type
        let objectScale;
        if (itemType === 'bed') {
            objectScale = 0.07;
        } else if (itemType === 'chair') {
            objectScale = 0.06;
        } else if (itemType === 'desk') {
            objectScale = 0.06;
        } else if (itemType === 'drawer') {
            objectScale = 0.06;
        } else if (itemType === 'shelf') {
            objectScale = 0.08;
        } else if (itemType === 'lamp') {
            objectScale = 0.08;
        } else if (itemType === 'trashcan') {
            objectScale = 0.05;
        } else if (itemType === 'airconditioner') {
            objectScale = isWallView ? 0.06 : 0.08;
        } else if (itemType === 'clock') {
            objectScale = isWallView ? 0.06 : 0.08;
        } else if (itemType === 'closet') {
            objectScale = 0.06;
        } else if (itemType === 'door' || itemType === 'door2') {
            objectScale = 0.08;
        } else if (itemType === 'frame' || itemType === 'frame2' || itemType === 'frame3') {
            objectScale = isWallView ? 0.055 : 0.08;
        } else if (itemType === 'poster' || itemType === 'poster2' || itemType === 'poster3') {
            objectScale = isWallView ? 0.06 : 0.08;
        } else if (itemType === 'board') {
            objectScale = isWallView ? 0.06 : 0.08;
        } else if (itemType === 'rack' || itemType === 'rack2') {
            objectScale = 0.06; // Scaled down for better size
        } else if (itemType === 'sofa' || itemType === 'sofa2') {
            objectScale = 0.06;
        } else if (itemType === 'table' || itemType === 'table2') {
            objectScale = 0.08;
        } else if (itemType === 'tv') {
            objectScale = 0.08;
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
                                const fallbackMat = new THREE.MeshBasicMaterial({
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
                            child.material = new THREE.MeshBasicMaterial({
                                color: 0x3498db,
                                transparent: true,
                                opacity: 0.6
                            });
                        }
                    }
                } catch (error) {
                    console.warn('Failed to clone material for preview, using fallback:', error);
                    // Create a fallback material
                    child.material = new THREE.MeshBasicMaterial({
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
        
        // Apply the same default rotation that will be applied when placing the object
        let previewRotation = 0;
        if (itemType === 'long-block') {
            previewRotation = Math.PI / 2;
        } else if (itemType === 'closet') {
            previewRotation = Math.PI / 2; // 90 degrees to the right
        } else if (itemType === 'sofa2') {
            previewRotation = Math.PI / 2; // 90 degrees to the right
        }
        
        dragPreviewObject.rotation.y = previewRotation;
        dragPreviewObject.userData.defaultRotation = previewRotation; // Store for later use
        
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
    
    if (isWallView && currentWall) {
        // Wall mode - raycast against wall surfaces
        const wallIntersects = raycaster.intersectObjects(wallBoxes);
        
        if (wallIntersects.length > 0) {
            const intersectPoint = wallIntersects[0].point;
            const itemType = dragPreviewObject.userData.itemType;
            
            // Convert 3D intersection to wall grid coordinates
            let wallX, wallY;
            if (currentWall === 'wall1') {
                wallX = intersectPoint.z;
                wallY = intersectPoint.y;
            } else if (currentWall === 'wall2') {
                wallX = intersectPoint.x;
                wallY = intersectPoint.y;
            }
            
            // Snap to wall grid
            const gridPos = snapToWallGrid(wallX, wallY, currentWall, itemType);
            
            // Check for collision
            const hasCollision = checkWallCollision(gridPos.x, gridPos.y, currentWall, itemType);
            
            // Position the preview object on the wall
            let worldX, worldY, worldZ;
            if (currentWall === 'wall1') {
                worldX = -3.92; // Closer to wall, not too far forward
                worldY = gridPos.y;
                worldZ = gridPos.x;
                
                // Apply correct rotation for preview
                if (itemType === 'frame' || itemType === 'frame2' || itemType === 'frame3' || itemType === 'board') {
                    dragPreviewObject.rotation.set(0, Math.PI, 0);
                } else if (itemType === 'rack' || itemType === 'rack2') {
                    dragPreviewObject.rotation.set(0, Math.PI / 2 + Math.PI / 2, 0); // Face outward + 90 degrees
                } else {
                    dragPreviewObject.rotation.y = Math.PI / 2;
                }
            } else if (currentWall === 'wall2') {
                worldX = gridPos.x;
                worldY = gridPos.y;
                worldZ = -3.92; // Closer to wall, not too far forward
                
                // Apply correct rotation for preview
                if (itemType === 'frame' || itemType === 'frame2' || itemType === 'frame3' || itemType === 'board') {
                    dragPreviewObject.rotation.set(0, Math.PI / 2, 0);
                } else if (itemType === 'rack' || itemType === 'rack2') {
                    dragPreviewObject.rotation.set(0, Math.PI / 2, 0); // Face outward + 90 degrees
                } else {
                    dragPreviewObject.rotation.y = 0;
                }
            }
            
            dragPreviewObject.position.set(worldX, worldY, worldZ);
            
            // Update wall highlight size and color
            updateWallHighlightSize(itemType);
            if (hasCollision) {
                wallHighlight.material.color.setHex(0xff0000); // Red for collision
                dragPreviewObject.userData.hasCollision = true;
            } else {
                wallHighlight.material.color.setHex(0x00ff00); // Green for valid placement
                dragPreviewObject.userData.hasCollision = false;
            }
            
            // Position wall highlight
            wallHighlight.position.set(worldX - 0.02, worldY, worldZ);
            if (currentWall === 'wall1') {
                wallHighlight.rotation.set(0, Math.PI / 2, 0);
            } else if (currentWall === 'wall2') {
                wallHighlight.rotation.set(0, 0, 0);
            }
            wallHighlight.visible = true;
            
            // Hide ground highlight in wall mode
            groundHighlight.visible = false;
        } else {
            wallHighlight.visible = false;
        }
    } else {
        // Floor mode - original functionality
        const floorIntersects = raycaster.intersectObjects(scene.children.filter(obj => 
            obj.name === 'floor' || (obj.geometry && obj.geometry.type === 'PlaneGeometry')
        ));
        
        if (floorIntersects.length > 0) {
            const intersectPoint = floorIntersects[0].point;
            const itemType = dragPreviewObject.userData.itemType;
            
            // Use fixed grid snapping with proper rotation
            // Use the preview object's current rotation for consistency
            const objectRotation = dragPreviewObject.rotation.y;
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
            
            // Hide wall highlight in floor mode
            wallHighlight.visible = false;
        } else {
            groundHighlight.visible = false;
        }
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
    
    if (wallHighlight) {
        wallHighlight.visible = false;
        updateWallHighlightSize('default'); // Reset to 1x1
        wallHighlight.material.color.setHex(0x00ff00); // Reset to green
    }
}

function addObjectToScene(itemType, mouseX, mouseY) {
    console.log(`Attempting to add object of type: ${itemType}`);
    let modelToAdd;
    
    if (itemType === 'bed' && bedModel) {
        modelToAdd = bedModel.clone();
    } else if (itemType === 'chair' && chairModel) {
        modelToAdd = chairModel.clone();
    } else if (itemType === 'desk' && deskModel) {
        modelToAdd = deskModel.clone();
    } else if (itemType === 'drawer' && drawerModel) {
        modelToAdd = drawerModel.clone();
    } else if (itemType === 'lamp' && lampModel) {
            // Create a group to hold both the model and the light
            const lampGroup = new THREE.Group();
            
            // Clone the lamp model
            modelToAdd = lampModel.clone();
            modelToAdd.castShadow = true;
            modelToAdd.receiveShadow = true;
            
            // Create point light
            const pointLight = new THREE.PointLight(0xd47a22, 1, 10);
            pointLight.position.set(0, 9, 0);
            pointLight.castShadow = true;
            
            // Add both to the group
            lampGroup.add(modelToAdd);
            lampGroup.add(pointLight);
            
            // Store the light reference in the group's userData
            lampGroup.userData.pointLight = pointLight;
            lampGroup.userData.type = 'lamp';
            
            modelToAdd = lampGroup;
    } else if (itemType === 'shelf' && shelfModel) {
        modelToAdd = shelfModel.clone();
    } else if (itemType === 'trashcan' && trashcanModel) {
        modelToAdd = trashcanModel.clone();
    } else if (itemType === 'airconditioner' && airConditionerModel) {
        modelToAdd = airConditionerModel.clone();
    } else if (itemType === 'board' && boardModel) {
        modelToAdd = boardModel.clone();
    } else if (itemType === 'clock' && clockModel) {
        modelToAdd = clockModel.clone();
    } else if (itemType === 'closet' && closetModel) {
        modelToAdd = closetModel.clone();
    } else if (itemType === 'door' && doorModel) {
        modelToAdd = doorModel.clone();
    } else if (itemType === 'door2' && door2Model) {
        modelToAdd = door2Model.clone();
    } else if (itemType === 'frame' && frameModel) {
        modelToAdd = frameModel.clone();
    } else if (itemType === 'frame2' && frame2Model) {
        modelToAdd = frame2Model.clone();
    } else if (itemType === 'frame3' && frame3Model) {
        modelToAdd = frame3Model.clone();
    } else if (itemType === 'poster' && posterModel) {
        modelToAdd = posterModel.clone();
    } else if (itemType === 'poster2' && poster2Model) {
        modelToAdd = poster2Model.clone();
    } else if (itemType === 'poster3' && poster3Model) {
        modelToAdd = poster3Model.clone();
    } else if (itemType === 'rack' && rackModel) {
        modelToAdd = rackModel.clone();
    } else if (itemType === 'rack2' && rack2Model) {
        modelToAdd = rack2Model.clone();
    } else if (itemType === 'sofa' && sofaModel) {
        modelToAdd = sofaModel.clone();
    } else if (itemType === 'sofa2' && sofa2Model) {
        modelToAdd = sofa2Model.clone();
    } else if (itemType === 'table' && tableModel) {
        modelToAdd = tableModel.clone();
    } else if (itemType === 'table2' && table2Model) {
        modelToAdd = table2Model.clone();
    } else if (itemType === 'tv' && tvModel) {
        modelToAdd = tvModel.clone();
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
                                    return clonedMat;
                                } else {
                                    // Create a fallback material if cloning fails
                                    const fallbackMat = new THREE.MeshBasicMaterial({
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
                            } else {
                                // Create a fallback material if cloning fails
                                child.material = new THREE.MeshBasicMaterial({
                                    color: 0x8e44ad,
                                    transparent: false,
                                    opacity: 1.0
                                });
                            }
                        }
                    } catch (error) {
                        console.warn('Failed to clone material for placed object, using fallback:', error);
                        // Create a fallback material
                        child.material = new THREE.MeshBasicMaterial({
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
            // Apply the same default rotations that were applied to the preview
            let objectRotation = 0;
            if (itemType === 'long-block') {
                objectRotation = Math.PI / 2;
            } else if (itemType === 'closet') {
                objectRotation = Math.PI / 2; // 90 degrees to the right
            } else if (itemType === 'sofa2') {
                objectRotation = Math.PI / 2; // 90 degrees to the right
            }
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
                objectScale = 0.07;
            } else if (itemType === 'chair') {
                objectScale = 0.06;
            } else if (itemType === 'desk') {
                objectScale = 0.06;
            } else if (itemType === 'drawer') {
                objectScale = 0.06;
            } else if (itemType === 'shelf') {
                objectScale = 0.08;
            } else if (itemType === 'lamp') {
                objectScale = 0.08;
            } else if (itemType === 'trashcan') {
                objectScale = 0.05;
            } else if (itemType === 'airconditioner') {
                objectScale = 0.08;
            } else if (itemType === 'board') {
                objectScale = 0.08;
            } else if (itemType === 'clock') {
                objectScale = 0.08;
            } else if (itemType === 'closet') {
                objectScale = 0.06;
            } else if (itemType === 'door' || itemType === 'door2') {
                objectScale = 0.08;
            } else if (itemType === 'frame' || itemType === 'frame2' || itemType === 'frame3') {
                objectScale = 0.08;
            } else if (itemType === 'poster' || itemType === 'poster2' || itemType === 'poster3') {
                objectScale = 0.08;
            } else if (itemType === 'rack' || itemType === 'rack2') {
                objectScale = 0.08;
            } else if (itemType === 'sofa' || itemType === 'sofa2') {
                objectScale = 0.06;
            } else if (itemType === 'table' || itemType === 'table2') {
                objectScale = 0.08;
            } else if (itemType === 'tv') {
                objectScale = 0.08;
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

function addWallObjectToScene(itemType, mouseX, mouseY) {
    if (!isWallView || !currentWall) return;
    
    console.log(`Attempting to add wall object of type: ${itemType} to ${currentWall}`);
    let modelToAdd;
    
    // Clone the appropriate model based on item type
    if (itemType === 'frame' && frameModel) {
        modelToAdd = frameModel.clone();
    } else if (itemType === 'frame2' && frame2Model) {
        modelToAdd = frame2Model.clone();
    } else if (itemType === 'frame3' && frame3Model) {
        modelToAdd = frame3Model.clone();
    } else if (itemType === 'poster' && posterModel) {
        modelToAdd = posterModel.clone();
    } else if (itemType === 'poster2' && poster2Model) {
        modelToAdd = poster2Model.clone();
    } else if (itemType === 'poster3' && poster3Model) {
        modelToAdd = poster3Model.clone();
    } else if (itemType === 'board' && boardModel) {
        modelToAdd = boardModel.clone();
    } else if (itemType === 'clock' && clockModel) {
        modelToAdd = clockModel.clone();
    } else if (itemType === 'tv' && tvModel) {
        modelToAdd = tvModel.clone();
    } else if (itemType === 'airconditioner' && airConditionerModel) {
        modelToAdd = airConditionerModel.clone();
    } else if (itemType === 'rack' && rackModel) {
        modelToAdd = rackModel.clone();
    } else if (itemType === 'rack2' && rack2Model) {
        modelToAdd = rack2Model.clone();
    }
    
    if (!modelToAdd) {
        console.error(`Failed to clone wall model for type: ${itemType}`);
        return;
    }
    
    // Raycast to find intersection point on wall
    mouse.set(mouseX, mouseY);
    raycaster.setFromCamera(mouse, camera);
    
    const wallIntersects = raycaster.intersectObjects(wallBoxes);
    
    if (wallIntersects.length > 0) {
        const intersectPoint = wallIntersects[0].point;
        
        // Convert 3D intersection to wall grid coordinates
        let wallX, wallY;
        if (currentWall === 'wall1') {
            wallX = intersectPoint.z;
            wallY = intersectPoint.y;
        } else if (currentWall === 'wall2') {
            wallX = intersectPoint.x;
            wallY = intersectPoint.y;
        }
        
        // Snap to wall grid
        const gridPos = snapToWallGrid(wallX, wallY, currentWall, itemType);
        
        // Check for collision before placing
        if (checkWallCollision(gridPos.x, gridPos.y, currentWall, itemType)) {
            console.log('Cannot place wall object: collision detected');
            return;
        }
        
        // Scale the model appropriately for wall objects
        let objectScale = 0.06; // Default scale for wall objects
        if (itemType === 'frame' || itemType === 'frame2' || itemType === 'frame3') {
            objectScale = 0.055; // Slightly smaller scale for frames
        } else if (itemType === 'rack' || itemType === 'rack2') {
            objectScale = 0.06; // Scaled down for better size
        }
        modelToAdd.scale.setScalar(objectScale);
        
        // Position the object on the wall
        let worldX, worldY, worldZ;
        if (currentWall === 'wall1') {
            worldX = -3.92; // Closer to wall, not too far forward
            worldY = gridPos.y;
            worldZ = gridPos.x;
            // Rotate to face outward from wall + additional 90 degrees for frames/boards/racks
            if (itemType === 'frame' || itemType === 'frame2' || itemType === 'frame3' || itemType === 'board') {
                modelToAdd.rotation.set(0, Math.PI, 0); // Face outward and rotate 90 degrees
            } else if (itemType === 'rack' || itemType === 'rack2') {
                modelToAdd.rotation.set(0, Math.PI / 2 + Math.PI / 2, 0); // Face outward + 90 degrees
            } else {
                modelToAdd.rotation.y = Math.PI / 2; // Just face outward
            }
        } else if (currentWall === 'wall2') {
            worldX = gridPos.x;
            worldY = gridPos.y;
            worldZ = -3.92; // Closer to wall, not too far forward
            // Rotate for wall2 + additional 90 degrees for frames/boards/racks
            if (itemType === 'frame' || itemType === 'frame2' || itemType === 'frame3' || itemType === 'board') {
                modelToAdd.rotation.set(0, Math.PI / 2, 0); // Face outward and rotate 90 degrees
            } else if (itemType === 'rack' || itemType === 'rack2') {
                modelToAdd.rotation.set(0, Math.PI / 2, 0); // Face outward + 90 degrees
            } else {
                modelToAdd.rotation.y = 0; // Default rotation for wall2
            }
        }
        
        modelToAdd.position.set(worldX, worldY, worldZ);
        
        // Set up user data for wall objects
        modelToAdd.userData = {
            type: itemType,
            id: Date.now() + Math.random(),
            isWallObject: true,
            wallName: currentWall,
            gridX: gridPos.x,
            gridY: gridPos.y
        };
        
        // Ensure materials are properly set
        modelToAdd.traverse((child) => {
            if (child.isMesh) {
                if (child.material) {
                    try {
                        if (Array.isArray(child.material)) {
                            child.material = child.material.map(mat => {
                                if (mat && typeof mat.clone === 'function') {
                                    const clonedMat = mat.clone();
                                    clonedMat.transparent = false;
                                    clonedMat.opacity = 1.0;
                                    return clonedMat;
                                } else {
                                    return new THREE.MeshBasicMaterial({
                                        color: 0x8e44ad,
                                        transparent: false,
                                        opacity: 1.0
                                    });
                                }
                            });
                        } else {
                            if (child.material && typeof child.material.clone === 'function') {
                                child.material = child.material.clone();
                                child.material.transparent = false;
                                child.material.opacity = 1.0;
                            } else {
                                child.material = new THREE.MeshBasicMaterial({
                                    color: 0x8e44ad,
                                    transparent: false,
                                    opacity: 1.0
                                });
                            }
                        }
                    } catch (error) {
                        console.warn('Failed to clone wall object material, using fallback:', error);
                        child.material = new THREE.MeshBasicMaterial({
                            color: 0x8e44ad,
                            transparent: false,
                            opacity: 1.0
                        });
                    }
                }
                child.castShadow = true;
                child.receiveShadow = true;
            }
        });
        
        // Add to scene and tracking array
        scene.add(modelToAdd);
        placedWallObjects.push(modelToAdd);
        
        // Animate placement
        modelToAdd.scale.setScalar(0);
        animateObjectPlacement(modelToAdd, objectScale);
        
        console.log('Wall object placed successfully:', itemType, 'at position:', worldX, worldY, worldZ);
    }
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
    
    // Check for wall box clicks first - but only if not already in wall view
    if (!isWallView) {
        const wallBoxIntersects = raycaster.intersectObjects(wallBoxes);
        if (wallBoxIntersects.length > 0) {
            const wallBox = wallBoxIntersects[0].object;
            moveCameraToWall(wallBox);
            return;
        }
    }
    
    // If not clicking a wall box, proceed with object selection
    let allObjects = [...placedObjects, ...placedWallObjects];
    const intersects = raycaster.intersectObjects(allObjects, true);
    
    if (intersects.length > 0) {
        let clickedObject = intersects[0].object;
        while (clickedObject.parent && !allObjects.includes(clickedObject)) {
            clickedObject = clickedObject.parent;
        }
        
        if (allObjects.includes(clickedObject)) {
            console.log('Object selected:', clickedObject.userData.type, 'isWallObject:', clickedObject.userData.isWallObject);
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
    
    // Show appropriate edit menu based on object type
    if (object.userData.isWallObject) {
        const wallEditMenu = document.getElementById('wall-edit-menu');
        if (wallEditMenu) {
            wallEditMenu.style.display = 'block';
            setTimeout(() => wallEditMenu.classList.add('show'), 10);
        }
    } else {
        const editMenu = document.getElementById('edit-menu');
        if (editMenu) {
            editMenu.style.display = 'block';
            setTimeout(() => editMenu.classList.add('show'), 10);
        }
    }
    
    const box = new THREE.Box3().setFromObject(object);
    const size = box.getSize(new THREE.Vector3());
    const geometry = new THREE.BoxGeometry(size.x * 1.1, size.y * 1.1, size.z * 1.1);
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
            //selectionBox.rotation.y += 0.02;
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
    
    // Hide both edit menus
    const editMenu = document.getElementById('edit-menu');
    if (editMenu) {
        editMenu.style.display = 'none';
        editMenu.classList.remove('show');
    }
    
    const wallEditMenu = document.getElementById('wall-edit-menu');
    if (wallEditMenu) {
        wallEditMenu.style.display = 'none';
        wallEditMenu.classList.remove('show');
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
        // Don't allow rotation for wall objects
        if (selectedObject.userData.isWallObject) {
            console.log('Rotation not allowed for wall objects');
            return;
        }
        console.log('R key pressed - attempting rotation');
        try {
            rotateSelectedObject();
        } catch (error) {
            console.error('Error in rotation:', error);
        }
    } else if (event.key.toLowerCase() === 'm' && selectedObject && isEditMode && !isMoveMode) {
        event.preventDefault();
        enterMoveMode();
    } else if (event.key === 'Escape') {
        event.preventDefault();
        handleEscapeKey();
    }
}

function handleEscapeKey() {
    // Hierarchy: room view -> wall view -> wall object selection
    // Escape goes back one step at a time
    
    if (isMoveMode) {
        // If in move mode, exit move mode first (stay in current view)
        exitMoveMode();
    } else if (selectedObject && isEditMode) {
        // If object is selected, deselect it (stay in current view)
        deselectObject();
        // Note: deselectObject() preserves wall view state if we're in wall view
    } else if (isWallView) {
        // If in wall view without any selection, go back to room view
        resetCamera();
    }
}

function deleteSelectedObject() {
    if (selectedObject) {
        scene.remove(selectedObject);
        
        // Remove from appropriate array
        if (selectedObject.userData.isWallObject) {
            const index = placedWallObjects.indexOf(selectedObject);
            if (index > -1) {
                placedWallObjects.splice(index, 1);
            }
        } else {
            const index = placedObjects.indexOf(selectedObject);
            if (index > -1) {
                placedObjects.splice(index, 1);
            }
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
    
    placedWallObjects.forEach(obj => scene.remove(obj));
    placedWallObjects = [];
    
    deselectObject();
    
    const instructions = document.getElementById('instructions');
    instructions.style.transform = 'scale(1.05)';
    instructions.style.background = 'rgba(231, 76, 60, 0.9)';
    setTimeout(() => {
        instructions.style.transform = 'scale(1)';
        instructions.style.background = 'rgba(44, 62, 80, 0.9)';
    }, 200);
}

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
    
    if (objType === 'bed') {
        // Store old position and rotation
        const oldPosition = selectedObject.position.clone();
        const oldRotation = selectedObject.rotation.y;
        
        // Rotate 90 degrees
        selectedObject.rotation.y += Math.PI / 2;
        
        // Get new rotation normalized to 0-2π
        const newRotation = selectedObject.rotation.y % (2 * Math.PI);
        
        // Calculate new position based on rotation
        const isHorizontal = Math.abs(Math.sin(newRotation)) > 0.9;
        
        if (isHorizontal) {
            // Horizontal orientation
            if (oldPosition.z < -2.9) 
                selectedObject.position.set(oldPosition.x, oldPosition.y, -2);
        } else {
            // Vertical orientation
            if (oldPosition.x < -2.9) 
                selectedObject.position.set(-2, oldPosition.y, oldPosition.z);
        }
        flashSelectionBox(true);
    }
    else if (objType === 'desk' || objType === 'tv') {
        selectedObject.rotation.y += Math.PI / 2;
        const oldPosition = selectedObject.position.clone();
        const rot = selectedObject.rotation.y % (2 * Math.PI);
        if((rot > 1.5 && rot < 1.6) || (rot > 4.7 && rot < 4.8)) {
            if(selectedObject.position.z < -3.3) 
                selectedObject.position.set(oldPosition.x, oldPosition.y, -2.5);
        }
        else {
            if(selectedObject.position.x < -3.3)
                selectedObject.position.set(-2.5, oldPosition.y, oldPosition.z);
        }
        flashSelectionBox(true);
    }
    else if (objType === 'sofa2') {
        // Store old position and rotation
        const oldPosition = selectedObject.position.clone();
        const oldRotation = selectedObject.rotation.y;
        
        // Rotate 90 degrees
        selectedObject.rotation.y += Math.PI / 2;
        
        // Get new rotation normalized to 0-2π
        const newRotation = selectedObject.rotation.y % (2 * Math.PI);
        
        // Sofa2 starts with 90° default rotation, so we need to check its orientation
        // After the rotation, determine if it's horizontal or vertical
        const isHorizontal = Math.abs(Math.sin(newRotation)) > 0.9;
        
        // Check boundaries and adjust position if needed
        // Sofa2 is 2 tiles, so it needs boundary checking
        if (isHorizontal) {
            // 1 tile wide, 2 tiles deep (vertical orientation)
            // Check if it goes out of bounds in Z direction
            if (selectedObject.position.z > 3 || selectedObject.position.z < -3) {
                // Move to safe position
                selectedObject.position.z = Math.max(-3, Math.min(3, selectedObject.position.z));
            }
        } else {
            // 2 tiles wide, 1 tile deep (horizontal orientation)  
            // Check if it goes out of bounds in X direction
            if (selectedObject.position.x > 3 || selectedObject.position.x < -3) {
                // Move to safe position
                selectedObject.position.x = Math.max(-3, Math.min(3, selectedObject.position.x));
            }
        }
        
        // Snap to grid after rotation to ensure proper alignment
        const gridPos = snapToGrid(selectedObject.position.x, selectedObject.position.z, objType, selectedObject.rotation.y);
        selectedObject.position.x = gridPos.x;
        selectedObject.position.z = gridPos.z;
        
        // Check for collisions after rotation and repositioning (exclude self)
        const objIndex = placedObjects.indexOf(selectedObject);
        const tempPlacedObjects = placedObjects.slice();
        tempPlacedObjects.splice(objIndex, 1); // Remove self from collision check
        
        const originalPlacedObjects = placedObjects;
        placedObjects = tempPlacedObjects;
        
        const hasCollision = checkCollision(selectedObject.position.x, selectedObject.position.z, objType, selectedObject.rotation.y);
        
        placedObjects = originalPlacedObjects; // Restore original array
        
        if (hasCollision) {
            // If collision detected, revert to old position and rotation
            selectedObject.position.copy(oldPosition);
            selectedObject.rotation.y = oldRotation;
            flashSelectionBox(false); // Red flash for failure
            console.log('Sofa2 rotation blocked due to collision');
        } else {
            flashSelectionBox(true); // Green flash for success
            console.log('Sofa2 rotated successfully');
        }
    }
    else {
        // Single blocks and 1x1 furniture just rotate in place
        selectedObject.rotation.y += Math.PI / 2;
        flashSelectionBox(true);
        console.log(`${objType} rotated`);
        return;
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
    
    // For wall objects in wall view, we need to handle them differently
    if (selectedObject.userData.isWallObject && !isWallView) {
        console.log('Cannot move wall object while not in wall view');
        return;
    }
    
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
                            const fallbackMat = new THREE.MeshBasicMaterial({
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
                        child.material = new THREE.MeshBasicMaterial({
                            color: 0x3498db,
                            transparent: true,
                            opacity: 0.6
                        });
                    }
                }
            } catch (error) {
                console.warn('Failed to clone material for move preview, using fallback:', error);
                // Create a fallback material
                child.material = new THREE.MeshBasicMaterial({
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
    
    // Hide wall highlight and reset
    if (wallHighlight) {
        wallHighlight.visible = false;
        updateWallHighlightSize('default'); // Reset to 1x1
        wallHighlight.material.color.setHex(0x00ff00); // Reset to green
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
    
    // Handle wall objects differently
    if (movePreviewObject.userData.isWallObject && isWallView) {
        // Wall object movement logic
        const wallIntersects = raycaster.intersectObjects(wallBoxes);
        
        if (wallIntersects.length > 0) {
            const intersectPoint = wallIntersects[0].point;
            const itemType = movePreviewObject.userData.type;
            const wallName = movePreviewObject.userData.wallName;
            
            // Convert 3D intersection to wall grid coordinates
            let wallX, wallY;
            if (wallName === 'wall1') {
                wallX = intersectPoint.z;
                wallY = intersectPoint.y;
            } else if (wallName === 'wall2') {
                wallX = intersectPoint.x;
                wallY = intersectPoint.y;
            }
            
            // Snap to wall grid
            const gridPos = snapToWallGrid(wallX, wallY, wallName, itemType);
            
            // Check for collision, excluding the original object
            const originalObject = movePreviewObject.userData.originalObject;
            const objIndex = placedWallObjects.indexOf(originalObject);
            const tempPlacedWallObjects = placedWallObjects.slice();
            tempPlacedWallObjects.splice(objIndex, 1);
            
            const originalPlacedWallObjects = placedWallObjects;
            placedWallObjects = tempPlacedWallObjects;
            
            const hasCollision = checkWallCollision(gridPos.x, gridPos.y, wallName, itemType);
            
            placedWallObjects = originalPlacedWallObjects;
            
            // Position the preview object on the wall
            let worldX, worldY, worldZ;
            if (wallName === 'wall1') {
                worldX = -3.92;
                worldY = gridPos.y;
                worldZ = gridPos.x;
            } else if (wallName === 'wall2') {
                worldX = gridPos.x;
                worldY = gridPos.y;
                worldZ = -3.92;
            }
            
            movePreviewObject.position.set(worldX, worldY, worldZ);
            
            // Update wall highlight
            updateWallHighlightSize(itemType);
            if (hasCollision) {
                wallHighlight.material.color.setHex(0xff0000); // Red for collision
                movePreviewObject.userData.hasCollision = true;
            } else {
                wallHighlight.material.color.setHex(0x00ff00); // Green for valid placement
                movePreviewObject.userData.hasCollision = false;
            }
            
            // Position wall highlight
            wallHighlight.position.set(worldX - 0.02, worldY, worldZ);
            if (wallName === 'wall1') {
                wallHighlight.rotation.set(0, Math.PI / 2, 0);
            } else if (wallName === 'wall2') {
                wallHighlight.rotation.set(0, 0, 0);
            }
            wallHighlight.visible = true;
            
            // Hide ground highlight for wall objects
            if (groundHighlight) {
                groundHighlight.visible = false;
            }
        } else {
            wallHighlight.visible = false;
        }
        return;
    }
    
    // Floor object movement logic (existing code)
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
    
    // For wall objects, update grid coordinates in userData
    if (originalObject.userData.isWallObject) {
        const itemType = originalObject.userData.type;
        const wallName = originalObject.userData.wallName;
        
        // Convert world position back to grid coordinates for storage
        let wallX, wallY;
        if (wallName === 'wall1') {
            wallX = originalObject.position.z;
            wallY = originalObject.position.y;
        } else if (wallName === 'wall2') {
            wallX = originalObject.position.x;
            wallY = originalObject.position.y;
        }
        
        const gridPos = snapToWallGrid(wallX, wallY, wallName, itemType);
        originalObject.userData.gridX = gridPos.x;
        originalObject.userData.gridY = gridPos.y;
    }
    
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

function createWallClickBoxes() {
    // Create invisible click boxes for walls
    const boxGeometry = new THREE.BoxGeometry(8, 6, 0.1); // Width: 8, Height: 6, Depth: 0.1
    const boxMaterial = new THREE.MeshBasicMaterial({ 
        color: 0x000000, 
        transparent: true, 
        opacity: 0.0 
    });

    // Wall 1 (X-axis wall)
    const wall1Box = new THREE.Mesh(boxGeometry, boxMaterial);
    wall1Box.position.set(-4, 3, 0); // Center of the wall
    wall1Box.rotation.y = Math.PI / 2; // Rotate to face Z-axis.
    wall1Box.userData = {
        wallName: 'wall1',
        cameraPosition: new THREE.Vector3(0, 3, 0), // Position camera outside the wall
        cameraTarget: new THREE.Vector3(-4, 3, 0)    // Look at the center of the wall
    };
    scene.add(wall1Box);
    wallBoxes.push(wall1Box);

    // Wall 2 (Z-axis wall)
    const wall2Box = new THREE.Mesh(boxGeometry, boxMaterial);
    wall2Box.position.set(0, 3, -4); // Center of the wall
    wall2Box.userData = {
        wallName: 'wall2',
        cameraPosition: new THREE.Vector3(0, 3, 0), // Position camera outside the wall
        cameraTarget: new THREE.Vector3(0, 3, -4)    // Look at the center of the wall
    };
    scene.add(wall2Box);
    wallBoxes.push(wall2Box);
}

function moveCameraToWall(wallBox) {
    if (isWallView) return; // Prevent multiple wall views
    if (isEditMode) return;
     
    isWallView = true;
    currentWall = wallBox.userData.wallName; // Set which wall we're viewing
    
    // Store current camera state
    originalFOV = camera.fov; // Store original FOV
    
    // Get camera position and target from wall box userData
    const newPosition = wallBox.userData.cameraPosition;
    const newTarget = wallBox.userData.cameraTarget;
    
    // Show wall grids for the current wall
    wallGrids.forEach(wallGrid => {
        if (wallGrid.wall === currentWall) {
            wallGrid.grid.visible = true;
        } else {
            wallGrid.grid.visible = false;
        }
    });
    
    // Disable OrbitControls
    controls.enabled = false;
    
    // Switch to wall decoration items
    document.getElementById('furniture-items').parentElement.style.display = 'none';
    document.getElementById('wall-items').parentElement.style.display = 'block';
    document.getElementById('grid-toggle').style.display = 'none';
    
    // Animate camera movement and FOV change
    const duration = 1000; // 1 second
    const startTime = Date.now();
    const startPosition = camera.position.clone();
    const startTarget = controls.target.clone();
    const startFOV = camera.fov;
    
    function animateCamera() {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        
        // Use easeInOutQuad for smooth animation
        const easeProgress = progress < 0.5 ? 2 * progress * progress : 1 - Math.pow(-2 * progress + 2, 2) / 2;
        
        camera.position.lerpVectors(startPosition, newPosition, easeProgress);
        controls.target.lerpVectors(startTarget, newTarget, easeProgress);
        
        // Smoothly interpolate FOV
        camera.fov = startFOV + (WALL_VIEW_FOV - startFOV) * easeProgress;
        camera.updateProjectionMatrix();
        
        if (progress < 1) {
            requestAnimationFrame(animateCamera);
        }
    }
    
    animateCamera();
}

function resetCamera() {
    if (!isWallView) return;
    
    isWallView = false;
    currentWall = null; // Clear current wall
    
    // Re-enable OrbitControls
    controls.enabled = true;
    
    // Hide all wall grids
    wallGrids.forEach(wallGrid => {
        wallGrid.grid.visible = false;
    });
    
    // Hide wall highlight
    if (wallHighlight) {
        wallHighlight.visible = false;
    }
    
    // Switch back to furniture items
    document.getElementById('furniture-items').parentElement.style.display = 'block';
    document.getElementById('wall-items').parentElement.style.display = 'none';
    document.getElementById('grid-toggle').style.display = 'block';
    
   springBackCamera()
}

window.addEventListener('DOMContentLoaded', init); 