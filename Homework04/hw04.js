/*-------------------------------------------------------------------------
08_Transformation.js

canvas의 중심에 한 edge의 길이가 0.3인 정사각형을 그리고, 
이를 크기 변환 (scaling), 회전 (rotation), 이동 (translation) 하는 예제임.
    T는 x, y 방향 모두 +0.5 만큼 translation
    R은 원점을 중심으로 2초당 1회전의 속도로 rotate
    S는 x, y 방향 모두 0.3배로 scale
이라 할 때, 
    keyboard 1은 TRS 순서로 적용
    keyboard 2는 TSR 순서로 적용
    keyboard 3은 RTS 순서로 적용
    keyboard 4는 RST 순서로 적용
    keyboard 5는 STR 순서로 적용
    keyboard 6은 SRT 순서로 적용
    keyboard 7은 원래 위치로 돌아옴
---------------------------------------------------------------------------*/
import { resizeAspectRatio, setupText, updateText, Axes } from '../util/util.js';
import { Shader, readShaderFile } from '../util/shader.js';

let isInitialized = false;
const canvas = document.getElementById('glCanvas');
const gl = canvas.getContext('webgl2');
let shader;
let axesVAO;
let squareVAO;
let sunAngle = 0;
let earthOrbitAngle = 0;
let earthRotationAngle = 0;
let moonOrbitAngle = 0;
let moonRotationAngle = 0;
let lastTime = 0;
let textOverlay;
let sunColorBuffer;
let earthColorBuffer;
let moonColorBuffer;

document.addEventListener('DOMContentLoaded', () => {
    if (isInitialized) {
        console.log("Already initialized");
        return;
    }

    main().then(success => {
        if (!success) {
            console.log('프로그램을 종료합니다.');
            return;
        }
        isInitialized = true;
        requestAnimationFrame(animate);
    }).catch(error => {
        console.error('프로그램 실행 중 오류 발생:', error);
    });
});

function initWebGL() {
    if (!gl) {
        console.error('WebGL 2 is not supported by your browser.');
        return false;
    }

    canvas.width = 700;
    canvas.height = 700;
    resizeAspectRatio(gl, canvas);
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(0.2, 0.3, 0.4, 1.0);
    
    return true;
}

function setupAxesBuffers(shader) {
    axesVAO = gl.createVertexArray();
    gl.bindVertexArray(axesVAO);

    const axesVertices = new Float32Array([
        -0.8, 0.0, 0.8, 0.0,  // x축
        0.0, -0.8, 0.0, 0.8   // y축
    ]);

    const axesColors = new Float32Array([
        1.0, 0.3, 0.0, 1.0, 1.0, 0.3, 0.0, 1.0,  // x축 색상
        0.0, 1.0, 0.5, 1.0, 0.0, 1.0, 0.5, 1.0   // y축 색상
    ]);

    const positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, axesVertices, gl.STATIC_DRAW);
    shader.setAttribPointer("a_position", 2, gl.FLOAT, false, 0, 0);

    const colorBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, colorBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, axesColors, gl.STATIC_DRAW);
    shader.setAttribPointer("a_color", 4, gl.FLOAT, false, 0, 0);

    gl.bindVertexArray(null);
}

function setupSquareBuffers(shader) {
    const squareVertices = new Float32Array([
        -0.5,  0.5,  // 좌상단
        -0.5, -0.5,  // 좌하단
         0.5, -0.5,  // 우하단
         0.5,  0.5   // 우상단
    ]);

    const indices = new Uint16Array([
        0, 1, 2,    // 첫 번째 삼각형
        0, 2, 3     // 두 번째 삼각형
    ]);

    squareVAO = gl.createVertexArray();
    gl.bindVertexArray(squareVAO);

    const positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, squareVertices, gl.STATIC_DRAW);
    shader.setAttribPointer("a_position", 2, gl.FLOAT, false, 0, 0);

    const indexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW);

    gl.bindVertexArray(null);
    
    sunColorBuffer = gl.createBuffer();
    const sunColor = new Float32Array([
        1.0, 0.0, 0.0, 1.0,
        1.0, 0.0, 0.0, 1.0,
        1.0, 0.0, 0.0, 1.0,
        1.0, 0.0, 0.0, 1.0
    ]);
    gl.bindBuffer(gl.ARRAY_BUFFER, sunColorBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, sunColor, gl.STATIC_DRAW);

    earthColorBuffer = gl.createBuffer();
    const earthColor = new Float32Array([
        0.0, 1.0, 1.0, 1.0,
        0.0, 1.0, 1.0, 1.0,
        0.0, 1.0, 1.0, 1.0,
        0.0, 1.0, 1.0, 1.0
    ]);
    gl.bindBuffer(gl.ARRAY_BUFFER, earthColorBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, earthColor, gl.STATIC_DRAW);

    moonColorBuffer = gl.createBuffer();
    const moonColor = new Float32Array([
        1.0, 1.0, 0.0, 1.0,
        1.0, 1.0, 0.0, 1.0,
        1.0, 1.0, 0.0, 1.0,
        1.0, 1.0, 0.0, 1.0
    ]);
    gl.bindBuffer(gl.ARRAY_BUFFER, moonColorBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, moonColor, gl.STATIC_DRAW);
}

function render(deltaTime) {
    gl.clear(gl.COLOR_BUFFER_BIT);

    shader.use();

    // 축 그리기
    const axesModelMatrix = mat4.create();
    shader.setMat4("u_model", axesModelMatrix);
    gl.bindVertexArray(axesVAO);
    gl.drawArrays(gl.LINES, 0, 4);

    drawSun(deltaTime);
    
    drawEarth(deltaTime);
    
    drawMoon(deltaTime);
}

function drawSun(deltaTime) {
    const sunModelMatrix = mat4.create();
    
    sunAngle += (Math.PI / 4) * deltaTime;
    
    mat4.rotate(sunModelMatrix, sunModelMatrix, sunAngle, [0, 0, 1]);
    mat4.scale(sunModelMatrix, sunModelMatrix, [0.2, 0.2, 1.0]);
    
    shader.use();
    shader.setMat4("u_model", sunModelMatrix);
    
    gl.bindVertexArray(squareVAO);
    gl.bindBuffer(gl.ARRAY_BUFFER, sunColorBuffer);
    shader.setAttribPointer("a_color", 4, gl.FLOAT, false, 0, 0);
    
    gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);
}

function drawEarth(deltaTime) {
    const earthModelMatrix = mat4.create();
    
    earthOrbitAngle += (Math.PI / 6) * deltaTime;
    earthRotationAngle += Math.PI * deltaTime;
    
    mat4.rotate(earthModelMatrix, earthModelMatrix, earthOrbitAngle, [0, 0, 1]);
    mat4.translate(earthModelMatrix, earthModelMatrix, [0.7, 0, 0]);
    mat4.rotate(earthModelMatrix, earthModelMatrix, earthRotationAngle, [0, 0, 1]);
    mat4.scale(earthModelMatrix, earthModelMatrix, [0.1, 0.1, 1.0]);
    
    shader.use();
    shader.setMat4("u_model", earthModelMatrix);
    
    gl.bindVertexArray(squareVAO);
    gl.bindBuffer(gl.ARRAY_BUFFER, earthColorBuffer);
    shader.setAttribPointer("a_color", 4, gl.FLOAT, false, 0, 0);
    
    gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);
}

function drawMoon(deltaTime) {
    const moonModelMatrix = mat4.create();
    
    moonOrbitAngle += (2 * Math.PI) * deltaTime;
    moonRotationAngle += Math.PI * deltaTime;
    
    mat4.rotate(moonModelMatrix, moonModelMatrix, earthOrbitAngle, [0, 0, 1]);
    mat4.translate(moonModelMatrix, moonModelMatrix, [0.7, 0, 0]);
    mat4.rotate(moonModelMatrix, moonModelMatrix, moonOrbitAngle, [0, 0, 1]);
    mat4.translate(moonModelMatrix, moonModelMatrix, [0.2, 0, 0]);
    mat4.rotate(moonModelMatrix, moonModelMatrix, moonRotationAngle, [0, 0, 1]);
    mat4.scale(moonModelMatrix, moonModelMatrix, [0.05, 0.05, 1.0]);
    
    shader.use();
    shader.setMat4("u_model", moonModelMatrix);
    
    gl.bindVertexArray(squareVAO);
    gl.bindBuffer(gl.ARRAY_BUFFER, moonColorBuffer);
    shader.setAttribPointer("a_color", 4, gl.FLOAT, false, 0, 0);
    
    gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);
}

function animate(currentTime) {
    if (!lastTime) lastTime = currentTime;
    const deltaTime = (currentTime - lastTime) / 1000;
    lastTime = currentTime;

    render(deltaTime);
    requestAnimationFrame(animate);
}

async function initShader() {
    const vertexShaderSource = await readShaderFile('shVert.glsl');
    const fragmentShaderSource = await readShaderFile('shFrag.glsl');
    return new Shader(gl, vertexShaderSource, fragmentShaderSource);
}

async function main() {
    try {
        if (!initWebGL()) {
            throw new Error('WebGL 초기화 실패');
        }
        
        shader = await initShader();
        setupAxesBuffers(shader);
        setupSquareBuffers(shader);
        textOverlay = setupText(canvas, '', 1);
        shader.use();
        return true;
    } catch (error) {
        console.error('Failed to initialize program:', error);
        alert('프로그램 초기화에 실패했습니다.');
        return false;
    }
}
