export class RegularOctahedron {
    constructor(gl, options = {}) {
        this.gl = gl;

        // Creating VAO and buffers
        this.vao = gl.createVertexArray();
        this.vbo = gl.createBuffer();
        this.ebo = gl.createBuffer();

        // Initializing data
        this.vertices = new Float32Array([
            // Bottom faces (4 triangles)
            // Triangle 1 (-x, -z)
            -0.7071, 0.0, -0.7071, 0.0, -1.0, 0.0, 0.7071, 0.0, -0.7071,
            // Triangle 2 (-x, +z)
            -0.7071, 0.0, 0.7071, 0.0, -1.0, 0.0, -0.7071, 0.0, -0.7071,
            // Triangle 3 (+x, +z)
            0.7071, 0.0, 0.7071, 0.0, -1.0, 0.0, -0.7071, 0.0, 0.7071,
            // Triangle 4 (+x, -z)
            0.7071, 0.0, -0.7071, 0.0, -1.0, 0.0, 0.7071, 0.0, 0.7071,

            // Top faces (4 triangles)
            // Triangle 5 (-x, -z)
            -0.7071, 0.0, -0.7071, 0.0, 1.0, 0.0, 0.7071, 0.0, -0.7071,
            // Triangle 6 (-x, +z)
            -0.7071, 0.0, 0.7071, 0.0, 1.0, 0.0, -0.7071, 0.0, -0.7071,
            // Triangle 7 (+x, +z)
            0.7071, 0.0, 0.7071, 0.0, 1.0, 0.0, -0.7071, 0.0, 0.7071,
            // Triangle 8 (+x, -z)
            0.7071, 0.0, -0.7071, 0.0, 1.0, 0.0, 0.7071, 0.0, 0.7071,
        ]);

        this.normals = new Float32Array([
            // Bottom faces
            // Triangle 1
            -0.5774, -0.5774, -0.5774, -0.5774, -0.5774, -0.5774, -0.5774, -0.5774, -0.5774,
            // Triangle 2
            -0.5774, -0.5774, 0.5774, -0.5774, -0.5774, 0.5774, -0.5774, -0.5774, 0.5774,
            // Triangle 3
            0.5774, -0.5774, 0.5774, 0.5774, -0.5774, 0.5774, 0.5774, -0.5774, 0.5774,
            // Triangle 4
            0.5774, -0.5774, -0.5774, 0.5774, -0.5774, -0.5774, 0.5774, -0.5774, -0.5774,

            // Top faces
            // Triangle 5
            -0.5774, 0.5774, -0.5774, -0.5774, 0.5774, -0.5774, -0.5774, 0.5774, -0.5774,
            // Triangle 6
            -0.5774, 0.5774, 0.5774, -0.5774, 0.5774, 0.5774, -0.5774, 0.5774, 0.5774,
            // Triangle 7
            0.5774, 0.5774, 0.5774, 0.5774, 0.5774, 0.5774, 0.5774, 0.5774, 0.5774,
            // Triangle 8
            0.5774, 0.5774, -0.5774, 0.5774, 0.5774, -0.5774, 0.5774, 0.5774, -0.5774,
        ]);

        // if color is provided, set all vertices' color to the given color
        if (options.color) {
            this.colors = new Float32Array(24 * 4);
            for (let i = 0; i < 24 * 4; i += 4) {
                this.colors[i] = options.color[0];
                this.colors[i + 1] = options.color[1];
                this.colors[i + 2] = options.color[2];
                this.colors[i + 3] = options.color[3];
            }
        }
        else {
            this.colors = new Float32Array([
                // Bottom faces - different colors for each face
                // Triangle 1 - red
                1, 0, 0, 1, 1, 0, 0, 1, 1, 0, 0, 1,
                // Triangle 2 - green
                0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1,
                // Triangle 3 - blue
                0, 0, 1, 1, 0, 0, 1, 1, 0, 0, 1, 1,
                // Triangle 4 - yellow
                1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 0, 1,

                // Top faces
                // Triangle 5 - cyan
                0, 1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1,
                // Triangle 6 - magenta
                1, 0, 1, 1, 1, 0, 1, 1, 1, 0, 1, 1,
                // Triangle 7 - white
                1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
                // Triangle 8 - dark gray
                0.3, 0.3, 0.3, 1, 0.3, 0.3, 0.3, 1, 0.3, 0.3, 0.3, 1,
            ]);
        }

        this.texCoords = new Float32Array([
            // Bottom hemisphere - Map texture coordinates to span across all faces
            // front face (v0,v3,v5)
            0, 0.5,   0.5, 0,   0.25, 0.5,
            // right face (v3,v2,v5)
            0.25, 0.5,   0.5, 0,   0.5, 0.5,
            // back face (v2,v1,v5)
            0.5, 0.5,   0.5, 0,   0.75, 0.5,
            // left face (v1,v0,v5)
            0.75, 0.5,   0.5, 0,   1, 0.5,

            // front face (v0,v3,v4)
            0, 0.5,   0.5, 1,   0.25, 0.5,
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
        gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 0, vSize);  // normal
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