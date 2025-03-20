/*-------------------------------------------------------------------------
Moving Square

- Red square can be moved with arrow keys
- Square stays within canvas boundaries
- Canvas size: 600 x 600
---------------------------------------------------------------------------*/
import { resizeAspectRatio, setupText, updateText } from '../util/util.js';
import { Shader, readShaderFile } from '../util/shader.js';

const canvas = document.getElementById('glCanvas');
const gl = canvas.getContext('webgl2');
let shader;
let vao;
let positionX = 0.0;    // Square's X position
let positionY = 0.0;    // Square's Y position
const moveStep = 0.01;  // Movement step size
const squareSize = 0.2; // Square size (length of one side)
let textOverlay;        // for text output

function initWebGL() {
    if (!gl) {
        console.error('WebGL 2 is not supported by your browser.');
        return false;
    }

    canvas.width = 600;  // Changed to 600x600 as required
    canvas.height = 600;

    resizeAspectRatio(gl, canvas);

    // Initialize WebGL settings
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(0.1, 0.2, 0.3, 1.0);
    
    return true;
}

async function initShader() {
    const vertexShaderSource = await readShaderFile('shVert.glsl');
    const fragmentShaderSource = await readShaderFile('shFrag.glsl');
    return new Shader(gl, vertexShaderSource, fragmentShaderSource);
}

function setupKeyboardEvents() {
    document.addEventListener('keydown', (event) => {
        // Calculate the limits for the square to stay within canvas
        const maxX = 1.0 - squareSize/2;  // Fixed boundary calculation
        const minX = -1.0 + squareSize/2; // Fixed boundary calculation
        const maxY = 1.0 - squareSize/2;  // Fixed boundary calculation
        const minY = -1.0 + squareSize/2; // Fixed boundary calculation
        
        if (event.key === 'ArrowRight') {
            if (positionX < maxX) positionX += moveStep;
        } else if (event.key === 'ArrowLeft') {
            if (positionX > minX) positionX -= moveStep;
        } else if (event.key === 'ArrowUp') {
            if (positionY < maxY) positionY += moveStep;
        } else if (event.key === 'ArrowDown') {
            if (positionY > minY) positionY -= moveStep;
        }
    });
}

function setupBuffers(shader) {
    // Define vertices for a square using TRIANGLE_FAN
    const halfSize = squareSize / 2;
    const vertices = new Float32Array([
        0.0, 0.0, 0.0,                // Center point
        -halfSize, -halfSize, 0.0,    // Bottom-left
        halfSize, -halfSize, 0.0,     // Bottom-right
        halfSize, halfSize, 0.0,      // Top-right
        -halfSize, halfSize, 0.0,     // Top-left
        -halfSize, -halfSize, 0.0     // Bottom-left again (to complete the loop)
    ]);

    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);

    const vertexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

    // Use the shader's helper method to set attributes
    shader.setAttribPointer('aPos', 3, gl.FLOAT, false, 0, 0);
    
    return vao;
}

function render(vao, shader) {
    gl.clear(gl.COLOR_BUFFER_BIT);

    shader.use();
    
    // Use the shader's helper methods to set uniforms
    shader.setVec2("uPosition", [positionX, positionY]);
    shader.setVec4("uColor", [1.0, 0.0, 0.0, 1.0]);  // Red color

    gl.bindVertexArray(vao);
    gl.drawArrays(gl.TRIANGLE_FAN, 0, 6);  // Drawing using TRIANGLE_FAN with 6 vertices

    requestAnimationFrame(() => render(vao, shader));
}

async function main() {
    try {
        console.log("Starting main function");
        
        // WebGL initialization
        if (!initWebGL()) {
            throw new Error('WebGL initialization failed');
        }
        console.log("WebGL initialized");

        // Initialize shader
        shader = await initShader();
        console.log("Shader initialized");

        // Setup text overlay
        textOverlay = setupText(canvas, "Use arrow keys to move the rectangle", 1);
        console.log("Text overlay setup complete");
        
        // Setup keyboard events
        setupKeyboardEvents();
        console.log("Keyboard events setup complete");
        
        // Complete initialization
        vao = setupBuffers(shader);
        console.log("Buffers setup complete");
        
        shader.use();
        console.log("Starting render loop");
        
        // Start rendering
        render(vao, shader);

        return true;

    } catch (error) {
        console.error('Failed to initialize program:', error);
        alert('Program initialization failed: ' + error.message);
        return false;
    }
}

// call main function
main().then(success => {
    if (!success) {
        console.log('Program terminated.');
        return;
    }
    console.log('Program running successfully.');
}).catch(error => {
    console.error('Error during program execution:', error);
});