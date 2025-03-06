const canvas = document.getElementById("glCanvas");
const gl = canvas.getContext("webgl2");

if (!gl) {
    console.error('WebGL 2 is not supported by your browser.');
}

canvas.width = 500;
canvas.height = 500;

gl.enable(gl.SCISSOR_TEST);

render(500);

function render(size) {
    gl.viewport(0, size/2, size/2, size/2);
    gl.scissor(0, size/2, size/2, size/2);
    gl.clearColor(1.0, 0, 0, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    gl.viewport(size/2, size/2, size/2, size/2);
    gl.scissor(size/2, size/2, size/2, size/2);
    gl.clearColor(0, 1.0, 0, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    
    gl.viewport(0, 0, size/2, size/2);
    gl.scissor(0, 0, size/2, size/2);
    gl.clearColor(0, 0, 1.0, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    gl.viewport(size/2, 0, size/2, size/2);
    gl.scissor(size/2, 0, size/2, size/2);
    gl.clearColor(1.0, 1.0, 0, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT);
}

window.addEventListener('resize', () => {
    const size = Math.min(window.innerHeight, window.innerWidth)
    canvas.width = size;
    canvas.height = size;
    render(size);
});
