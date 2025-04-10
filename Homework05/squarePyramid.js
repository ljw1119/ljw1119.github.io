export class squarePyramid {
    constructor(gl, options = {}) {
        this.gl = gl;
        
        // Creating VAO and buffers
        this.vao = gl.createVertexArray();
        this.vbo = gl.createBuffer();
        this.ebo = gl.createBuffer();

        // Initializing data
        this.vertices = new Float32Array([
            // bottom face
            -0.5, 0.0, -0.5,   0.5, 0.0, -0.5,   0.5, 0.0, 0.5,   -0.5, 0.0, 0.5,
            // front face  (v0,v3,v4)
            -0.5, 0.0, -0.5,   -0.5, 0.0, 0.5,   0.0, 1.0, 0.0,
            // right face  (v3,v2,v4)
            -0.5, 0.0, 0.5,   0.5, 0.0, 0.5,   0.0, 1.0, 0.0,
            // back face   (v2,v1,v4)
            0.5, 0.0, 0.5,   0.5, 0.0, -0.5,   0.0, 1.0, 0.0,
            // left face   (v1,v0,v4)
            0.5, 0.0, -0.5,   -0.5, 0.0, -0.5,   0.0, 1.0, 0.0
        ]);

        this.normals = new Float32Array([
            0, -1, 0,   0, -1, 0,   0, -1, 0,   0, -1, 0,
            // front face (v0,v3,v4) 
            0, 0.4472, -0.8944,   0, 0.4472, -0.8944,   0, 0.4472, -0.8944,
            // right face (v3,v2,v4) 
            -0.8944, 0.4472, 0,   -0.8944, 0.4472, 0,   -0.8944, 0.4472, 0,
            // back face (v2,v1,v4) 
            0, 0.4472, 0.8944,   0, 0.4472, 0.8944,   0, 0.4472, 0.8944,
            // left face (v1,v0,v4) 
            0.8944, 0.4472, 0,   0.8944, 0.4472, 0,   0.8944, 0.4472, 0
        ]);

        // if color is provided, set all vertices' color to the given color
        if (options.color) {
            this.colors = new Float32Array(16 * 4);
            for (let i = 0; i < 16 * 4; i += 4) {
                this.colors[i] = options.color[0];
                this.colors[i+1] = options.color[1];
                this.colors[i+2] = options.color[2];
                this.colors[i+3] = options.color[3];
            }
        }
        else {
            this.colors = new Float32Array([
                // bottom face (v7,v4,v3,v2) - blue
                0, 0, 1, 1,   0, 0, 1, 1,   0, 0, 1, 1,   0, 0, 1, 1,
                // front face (v0,v3,v4) - red
                1, 0, 0, 1,   1, 0, 0, 1,   1, 0, 0, 1,
                // right face (v3,v2,v4) - yellow
                1, 1, 0, 1,   1, 1, 0, 1,   1, 1, 0, 1,
                // back face (v2,v1,v4) - green
                1, 0, 1, 1,   1, 0, 1, 1,   1, 0, 1, 1,
                // left face (v1,v0,v4) - cyan
                0, 1, 1, 1,   0, 1, 1, 1,   0, 1, 1, 1
            ]);
        }

        this.texCoords = new Float32Array([
            // bottom face (v0,v1,v2,v3)
            0, 0,   1, 0,   1, 1,   0, 1,
            // front face (v0,v3,v4)
            0, 0,   1, 0,   0.5, 1,
            // right face (v3,v2,v4)
            0, 0,   1, 0,   0.5, 1,
            // back face (v2,v1,v4)
            0, 0,   1, 0,   0.5, 1,
            // left face (v1,v0,v4)
            0, 0,   1, 0,   0.5, 1
        ]);

        this.indices = new Uint16Array([
            // bottom face (square)
            0, 1, 2,   2, 3, 0,
            // front face (triangle)
            4, 5, 6,
            // right face (triangle)
            7, 8, 9,
            // back face (triangle)
            10, 11, 12,
            // left face (triangle)
            13, 14, 15
        ]);

        this.sameVertices = new Uint16Array([
            0, 4, 14, 
            1, 11, 13,
            2, 8, 10,
            3, 5, 7, 
            6, 9, 12, 15  
        ]);

        this.vertexNormals = new Float32Array(48);
        this.faceNormals = new Float32Array(48);
        this.faceNormals.set(this.normals);

        // compute vertex normals 
        for (let i = 0; i < 16; i += 4) {
            let vn_x = 0, vn_y = 0, vn_z = 0;
            let count = 0;
            
            for (let j = 0; j < this.sameVertices.length; j++) {
                if (Math.floor(j/4) === Math.floor(i/4)) {
                    let idx = this.sameVertices[j];
                    vn_x += this.normals[idx*3];
                    vn_y += this.normals[idx*3 + 1];
                    vn_z += this.normals[idx*3 + 2];
                    count++;
                }
            }
            
            if (count > 0) {
                vn_x /= count;
                vn_y /= count;
                vn_z /= count;
            }

            for (let j = 0; j < this.sameVertices.length; j++) {
                if (Math.floor(j/4) === Math.floor(i/4)) {
                    let idx = this.sameVertices[j];
                    this.vertexNormals[idx*3] = vn_x;
                    this.vertexNormals[idx*3 + 1] = vn_y;
                    this.vertexNormals[idx*3 + 2] = vn_z;
                }
            }
        }

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
        gl.drawElements(gl.TRIANGLES, 18, gl.UNSIGNED_SHORT, 0);
        gl.bindVertexArray(null);
    }

    delete() {
        const gl = this.gl;
        gl.deleteBuffer(this.vbo);
        gl.deleteBuffer(this.ebo);
        gl.deleteVertexArray(this.vao);
    }
} 