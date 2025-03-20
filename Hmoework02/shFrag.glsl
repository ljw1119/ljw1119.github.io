#version 300 es
precision mediump float;

uniform vec4 uColor;  // Square color
out vec4 FragColor;

void main() {
    FragColor = uColor;
} 