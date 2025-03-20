#version 300 es

layout (location = 0) in vec3 aPos;

uniform vec2 uPosition;  // Position of the square

void main() {
    // Add the position offset to move the square
    gl_Position = vec4(aPos.x + uPosition.x, aPos.y + uPosition.y, aPos.z, 1.0);
} 