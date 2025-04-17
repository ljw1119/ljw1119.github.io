export class RegularOctahedron {
    constructor(gl, options = {}) {
        this.gl = gl;

        // Creating VAO and buffers
        this.vao = gl.createVertexArray();
        this.vbo = gl.createBuffer();
        this.ebo = gl.createBuffer();

        const height = 1/Math.sqrt(2); // height of the octahedron
        // Initializing data
        this.vertices = new Float32Array([
            // Bottom faces (4 triangles)
            // Triangle 1 (-z)
            -0.5, 0.0, -0.5,    0.0, -height, 0.0,  0.5, 0.0, -0.5,
            // Triangle 2 (+x)
            0.5, 0.0, -0.5,     0.0, -height, 0.0,  0.5, 0.0, 0.5,
            // Triangle 3 (+z)
            0.5, 0.0, 0.5,      0.0, -height, 0.0,  -0.5, 0.0, 0.5,
            // Triangle 4 (-x)
            -0.5, 0.0, 0.5,     0.0, -height, 0.0,  -0.5, 0.0, -0.5,

            // Top faces (4 triangles)
            // Triangle 1 (-z)
            -0.5, 0.0, -0.5,    0.0, height, 0.0,  0.5, 0.0, -0.5,
            // Triangle 2 (+x)
            0.5, 0.0, -0.5,     0.0, height, 0.0,  0.5, 0.0, 0.5,
            // Triangle 3 (+z)
            0.5, 0.0, 0.5,      0.0, height, 0.0,  -0.5, 0.0, 0.5,
            // Triangle 4 (-x)
            -0.5, 0.0, 0.5,     0.0, height, 0.0,  -0.5, 0.0, -0.5,
        ]);

        const norm = 1 / Math.sqrt(3); // Normalized normal vector for the octahedron faces
        this.normals = new Float32Array([
            // Bottom faces
            // Triangle 1
            0, -norm, -norm,    0, -norm, -norm,    0, -norm, -norm,
            // Triangle 2
            norm, -norm, 0,     norm, -norm, 0,     norm, -norm, 0,
            // Triangle 3
            0, -norm, norm,     0, -norm, norm,     0, -norm, norm,
            // Triangle 4
            -norm, -norm, 0,    -norm, -norm, 0,   -norm, -norm, 0,

            // Top faces
            // Triangle 5
            0, norm, -norm,    0, norm, -norm,    0, norm, -norm,
            // Triangle 6
            norm, norm, 0,     norm, norm, 0,     norm, norm, 0,
            // Triangle 7
            0, norm, norm,     0, norm, norm,     0, norm, norm,
            // Triangle 8
            -norm, norm, 0,    -norm, norm, 0,   -norm, norm, 0,
        ]);


        this.colors = new Float32Array(24 * 4);
        for (let i = 0; i < 24 * 4; i += 4) {
            this.colors[i] = 0;
            this.colors[i + 1] = 0;
            this.colors[i + 2] = 0;
            this.colors[i + 3] = 1;
        }

        this.texCoords = new Float32Array([
            // Bottom hemisphere - Map texture coordinates to span across all faces
            // front face (v0,v3,v5)
            0, 0.5,      0.5, 0,   0.25, 0.5,
            // right face (v3,v2,v5)
            0.25, 0.5,   0.5, 0,   0.5, 0.5,
            // back face (v2,v1,v5)
            0.5, 0.5,    0.5, 0,   0.75, 0.5,
            // left face (v1,v0,v5)
            0.75, 0.5,   0.5, 0,   1, 0.5,

            // front face (v0,v3,v4)
            0, 0.5,     0.5, 1,   0.25, 0.5,
            // right face (v3,v2,v4)
            0.25, 0.5,   0.5, 1,   0.5, 0.5,
            // back face (v2,v1,v4)
            0.5, 0.5,   0.5, 1,   0.75, 0.5,
            // left face (v1,v0,v4)
            0.75, 0.5,   0.5, 1,   1, 0.5
        ]);

        this.indices = new Uint16Array([
            // Bottom faces
            0, 1, 2,
            3, 4, 5,
            6, 7, 8,
            9, 10, 11,

            // Top faces
            12, 14, 13,
            15, 17, 16,
            18, 20, 19,
            21, 23, 22,
        ]);

        this.vertexNormals = new Float32Array(this.normals);
        this.faceNormals = new Float32Array(this.normals);

        this.initBuffers();
    }

    copyVertexNormalsToNormals() {
        this.normals.set(this.vertexNormals);
    }

    copyFaceNormalsToNormals() {
        this.normals.set(this.faceNormals);
    }

    initBuffers() {
        const gl = this.gl;

        // 버퍼 크기 계산
        const vSize = this.vertices.byteLength;
        const nSize = this.normals.byteLength;
        const cSize = this.colors.byteLength;
        const tSize = this.texCoords.byteLength;
        const totalSize = vSize + nSize + cSize + tSize;

        gl.bindVertexArray(this.vao);

        // VBO에 데이터 복사
        gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
        gl.bufferData(gl.ARRAY_BUFFER, totalSize, gl.STATIC_DRAW);
        gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.vertices);
        gl.bufferSubData(gl.ARRAY_BUFFER, vSize, this.normals);
        gl.bufferSubData(gl.ARRAY_BUFFER, vSize + nSize, this.colors);
        gl.bufferSubData(gl.ARRAY_BUFFER, vSize + nSize + cSize, this.texCoords);

        // EBO에 인덱스 데이터 복사
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.ebo);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, this.indices, gl.STATIC_DRAW);

        // vertex attributes 설정
        gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);  // position
        gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 0, vSize);  // norm
        gl.vertexAttribPointer(2, 4, gl.FLOAT, false, 0, vSize + nSize);  // color
        gl.vertexAttribPointer(3, 2, gl.FLOAT, false, 0, vSize + nSize + cSize);  // texCoord

        // vertex attributes 활성화
        gl.enableVertexAttribArray(0);
        gl.enableVertexAttribArray(1);
        gl.enableVertexAttribArray(2);
        gl.enableVertexAttribArray(3);

        // 버퍼 바인딩 해제
        gl.bindBuffer(gl.ARRAY_BUFFER, null);
        gl.bindVertexArray(null);
    }

    updateNormals() {
        const gl = this.gl;
        const vSize = this.vertices.byteLength;

        gl.bindVertexArray(this.vao);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);

        // normals 데이터만 업데이트
        gl.bufferSubData(gl.ARRAY_BUFFER, vSize, this.normals);

        gl.bindBuffer(gl.ARRAY_BUFFER, null);
        gl.bindVertexArray(null);
    }

    draw(shader) {
        const gl = this.gl;
        shader.use();
        gl.bindVertexArray(this.vao);
        gl.drawElements(gl.TRIANGLES, 24, gl.UNSIGNED_SHORT, 0);
        gl.bindVertexArray(null);
    }

    delete() {
        const gl = this.gl;
        gl.deleteBuffer(this.vbo);
        gl.deleteBuffer(this.ebo);
        gl.deleteVertexArray(this.vao);
    }
} 