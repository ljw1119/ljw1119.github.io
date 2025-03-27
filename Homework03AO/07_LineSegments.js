/*-------------------------------------------------------------------------
07_LineSegments.js

left mouse button을 click하면 선분을 그리기 시작하고, 
button up을 하지 않은 상태로 마우스를 움직이면 임시 선분을 그리고, 
button up을 하면 최종 선분을 저장하고 임시 선분을 삭제함.

임시 선분의 color는 회색이고, 최종 선분의 color는 빨간색임.

이 과정을 반복하여 여러 개의 선분 (line segment)을 그릴 수 있음. 
---------------------------------------------------------------------------*/
import { resizeAspectRatio, setupText, updateText, Axes } from '../util/util.js';
import { Shader, readShaderFile } from '../util/shader.js';

// Global variables
const canvas = document.getElementById('glCanvas');
const gl = canvas.getContext('webgl2');
let isInitialized = false;  // main이 실행되는 순간 true로 change
let shader;
let vao;
let positionBuffer; // 2D position을 위한 VBO (Vertex Buffer Object)
let isDrawing = false; // mouse button을 누르고 있는 동안 true로 change
let startPoint = null;  // mouse button을 누른 위치
let tempEndPoint = null; // mouse를 움직이는 동안의 위치
let lines = []; // 그려진 선분들을 저장하는 array
let textOverlay; // 1st line - circle 정보 표시
let textOverlay2; // 2nd line - line segment 정보 표시
let textOverlay3; // intersection
let axes = new Axes(gl, 0.85); // x, y axes 그려주는 object (see util.js)

// Circle 관련 변수
let circleCenter = null;  // 원의 중심점
let circleRadius = 0;     // 원의 반지름
let circleVertices = [];  // 원을 그리기 위한 정점 배열
let drawingCircle = false; // 원을 그리는 중인지 여부
let circleDrawn = false;  // 원이 그려졌는지 여부
let drawingLine = false;  // 선분을 그리는 중인지 여부

document.addEventListener('DOMContentLoaded', () => {
    if (isInitialized) { // true인 경우는 main이 이미 실행되었다는 뜻이므로 다시 실행하지 않음
        console.log("Already initialized");
        return;
    }

    main().then(success => { // call main function
        if (!success) {
            console.log('프로그램을 종료합니다.');
            return;
        }
        isInitialized = true;
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
    gl.clearColor(0.1, 0.2, 0.3, 1.0);

    return true;
}

function setupBuffers() {
    vao = gl.createVertexArray();
    gl.bindVertexArray(vao);

    positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);

    shader.setAttribPointer('a_position', 2, gl.FLOAT, false, 0, 0); // x, y 2D 좌표

    gl.bindVertexArray(null);
}

// 좌표 변환 함수: 캔버스 좌표를 WebGL 좌표로 변환
// 캔버스 좌표: 캔버스 좌측 상단이 (0, 0), 우측 하단이 (canvas.width, canvas.height)
// WebGL 좌표 (NDC): 캔버스 좌측 하단이 (-1, -1), 우측 상단이 (1, 1)
function convertToWebGLCoordinates(x, y) {
    return [
        (x / canvas.width) * 2 - 1,  // x/canvas.width 는 0 ~ 1 사이의 값, 이것을 * 2 - 1 하면 -1 ~ 1 사이의 값
        -((y / canvas.height) * 2 - 1) // y canvas 좌표는 상하를 뒤집어 주어야 하므로 -1을 곱함
    ];
}

// 원 정점 생성 함수
function generateCircleVertices(centerX, centerY, radius, segments = 100) {
    const vertices = [];
    for (let i = 0; i <= segments; i++) {
        const angle = 2 * Math.PI * i / segments;
        const x = centerX + radius * Math.cos(angle);
        const y = centerY + radius * Math.sin(angle);
        vertices.push(x, y);
    }
    return vertices;
}

// 거리 계산 함수
function distance(x1, y1, x2, y2) {
    return Math.sqrt((x2 - x1) * (x2 - x1) + (y2 - y1) * (y2 - y1));
}

// 원과 선분의 교점 계산 함수
function calculateIntersections(circleCenterX, circleCenterY, radius, lineStartX, lineStartY, lineEndX, lineEndY) {
    // 선분의 방향 벡터
    const dx = lineEndX - lineStartX;
    const dy = lineEndY - lineStartY;
    
    // 원의 중심에서 선분의 시작점까지의 벡터
    const a = dx * dx + dy * dy;
    const b = 2 * (dx * (lineStartX - circleCenterX) + dy * (lineStartY - circleCenterY));
    const c = (lineStartX - circleCenterX) * (lineStartX - circleCenterX) + 
              (lineStartY - circleCenterY) * (lineStartY - circleCenterY) - 
              radius * radius;
    
    // 판별식
    const discriminant = b * b - 4 * a * c;
    
    if (discriminant < 0) {
        // 교점 없음
        return [];
    }
    
    // 교점 계산
    const t1 = (-b + Math.sqrt(discriminant)) / (2 * a);
    const t2 = (-b - Math.sqrt(discriminant)) / (2 * a);
    
    const intersections = [];
    
    // 선분 내에 있는 교점만 추가
    if (t1 >= 0 && t1 <= 1) {
        intersections.push([
            lineStartX + t1 * dx,
            lineStartY + t1 * dy
        ]);
    }
    
    if (t2 >= 0 && t2 <= 1 && discriminant > 0) {
        intersections.push([
            lineStartX + t2 * dx,
            lineStartY + t2 * dy
        ]);
    }
    
    return intersections;
}

function setupMouseEvents() {
    function handleMouseDown(event) {
        event.preventDefault(); // 이미 존재할 수 있는 기본 동작을 방지
        event.stopPropagation(); // event가 상위 요소 (div, body, html 등)으로 전파되지 않도록 방지

        const rect = canvas.getBoundingClientRect(); // canvas를 나타내는 rect 객체를 반환
        const x = event.clientX - rect.left;  // canvas 내 x 좌표
        const y = event.clientY - rect.top;   // canvas 내 y 좌표
        
        let [glX, glY] = convertToWebGLCoordinates(x, y);
        
        if (!circleDrawn) {
            // 원 그리기 시작
            circleCenter = [glX, glY];
            drawingCircle = true;
        } else if (!drawingLine && lines.length < 1) {
            // 선분 그리기 시작
            startPoint = [glX, glY];
            drawingLine = true;
        }
    }

    function handleMouseMove(event) {
        const rect = canvas.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        
        let [glX, glY] = convertToWebGLCoordinates(x, y);
        
        if (drawingCircle && circleCenter) {
            // 원의 반지름 계산
            circleRadius = distance(circleCenter[0], circleCenter[1], glX, glY);
            // 원의 정점 생성
            circleVertices = generateCircleVertices(circleCenter[0], circleCenter[1], circleRadius);
            render();
        } else if (drawingLine) {
            // 임시 선분 끝점 갱신
            tempEndPoint = [glX, glY];
            render();
        }
    }

    function handleMouseUp() {
        if (drawingCircle && circleCenter) {
            // 원 그리기 완료
            drawingCircle = false;
            circleDrawn = true;
            updateText(textOverlay, `Circle: center (${circleCenter[0].toFixed(2)}, ${circleCenter[1].toFixed(2)}), radius = ${circleRadius.toFixed(2)}`);
            updateText(textOverlay2, "");
            render();
        } else if (drawingLine && tempEndPoint) {
            // 선분 그리기 완료
            lines.push([...startPoint, ...tempEndPoint]);
            drawingLine = false;
            
            updateText(textOverlay2, `Line segment: (${startPoint[0].toFixed(2)}, ${startPoint[1].toFixed(2)}) ~ (${tempEndPoint[0].toFixed(2)}, ${tempEndPoint[1].toFixed(2)})`);
            
            // 교점 계산
            const intersections = calculateIntersections(
                circleCenter[0], circleCenter[1], circleRadius,
                startPoint[0], startPoint[1], tempEndPoint[0], tempEndPoint[1]
            );
            
            if (intersections.length > 0) {
                let intersectionText = `Intersection Points: ${intersections.length} `;
                for (let i = 0; i < intersections.length; i++) {
                    intersectionText += `Point ${i+1}: (${intersections[i][0].toFixed(2)}, ${intersections[i][1].toFixed(2)})`;
                    if (i < intersections.length - 1) {
                        intersectionText += ", ";
                    }
                }
                updateText(textOverlay3, intersectionText);
            } else {
                updateText(textOverlay3, "No intersections");
            }
            
            startPoint = null;
            tempEndPoint = null;
            render();
        }
    }

    canvas.addEventListener("mousedown", handleMouseDown);
    canvas.addEventListener("mousemove", handleMouseMove);
    canvas.addEventListener("mouseup", handleMouseUp);
}

function render() {
    gl.clear(gl.COLOR_BUFFER_BIT);
    shader.use();

    // 원 그리기
    if ((drawingCircle || circleDrawn) && circleVertices.length > 0) {
        shader.setVec4("u_color", [1.0, 0.0, 1.0, 1.0]); // 보라색으로 원 그리기
        gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(circleVertices), gl.STATIC_DRAW);
        gl.bindVertexArray(vao);
        gl.drawArrays(gl.LINE_STRIP, 0, circleVertices.length / 2);
    }

    // 선분 그리기
    if (lines.length > 0) {
        shader.setVec4("u_color", [0.5, 0.5, 1.0, 1.0]); // 파란색
        gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(lines[0]), gl.STATIC_DRAW);
        gl.bindVertexArray(vao);
        gl.drawArrays(gl.LINES, 0, 2);
    }

    // 임시 선분 그리기
    if (drawingLine && startPoint && tempEndPoint) {
        shader.setVec4("u_color", [0.5, 0.5, 0.5, 1.0]); // 회색
        gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([...startPoint, ...tempEndPoint]), gl.STATIC_DRAW);
        gl.bindVertexArray(vao);
        gl.drawArrays(gl.LINES, 0, 2);
    }

    // 교점 그리기
    if (lines.length > 0 && circleDrawn) {
        const intersections = calculateIntersections(
            circleCenter[0], circleCenter[1], circleRadius,
            lines[0][0], lines[0][1], lines[0][2], lines[0][3]
        );
        
        if (intersections.length > 0) {
            shader.setVec4("u_color", [1.0, 1.0, 0.0, 1.0]); // 노란색
            for (const point of intersections) {
                gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
                gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(point), gl.STATIC_DRAW);
                gl.bindVertexArray(vao);
                gl.drawArrays(gl.POINTS, 0, 1);
            }
        }
    }

    // axes 그리기
    axes.draw(mat4.create(), mat4.create());
}

async function initShader() {
    const vertexShaderSource = await readShaderFile('shVert.glsl');
    const fragmentShaderSource = await readShaderFile('shFrag.glsl');
    shader = new Shader(gl, vertexShaderSource, fragmentShaderSource);
}

async function main() {
    try {
        if (!initWebGL()) {
            throw new Error('WebGL 초기화 실패');
            return false; 
        }

        // 셰이더 초기화
        await initShader();
        
        // 나머지 초기화
        setupBuffers();
        shader.use();

        // 텍스트 초기화
        textOverlay = setupText(canvas, "", 1);
        textOverlay2 = setupText(canvas, "", 2);
        textOverlay3 = setupText(canvas, "", 3);
        
        // 마우스 이벤트 설정
        setupMouseEvents();
        
        // 초기 렌더링
        render();

        return true;
        
    } catch (error) {
        console.error('Failed to initialize program:', error);
        alert('프로그램 초기화에 실패했습니다.');
        return false;
    }
}
