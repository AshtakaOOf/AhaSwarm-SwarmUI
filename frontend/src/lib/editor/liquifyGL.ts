import type { Rect } from './layer';

// same maths as the cpu path in pixels.ts (grid-interpolated field, premultiplied catmull-rom), run per pixel on the gpu
const VERT = `#version 300 es
in vec2 pos;
void main() { gl_Position = vec4(pos, 0.0, 1.0); }`;

const FRAG = `#version 300 es
precision highp float;
precision highp int;
uniform sampler2D src;
uniform sampler2D field;
uniform ivec2 size;
uniform int step;
out vec4 color;
vec4 tap(int x, int y) { return texelFetch(src, ivec2(clamp(x, 0, size.x - 1), clamp(y, 0, size.y - 1)), 0); }
vec4 cubic(float t) {
    float t2 = t * t, t3 = t2 * t;
    return vec4(-t3 + 2.0 * t2 - t, 3.0 * t3 - 5.0 * t2 + 2.0, -3.0 * t3 + 4.0 * t2 + t, t3 - t2) * 0.5;
}
void main() {
    int x = int(gl_FragCoord.x), y = size.y - 1 - int(gl_FragCoord.y);
    ivec2 c = ivec2(x / step, y / step);
    vec2 f = vec2(x - c.x * step, y - c.y * step) / float(step);
    vec2 d00 = texelFetch(field, c, 0).rg, d10 = texelFetch(field, c + ivec2(1, 0), 0).rg;
    vec2 d01 = texelFetch(field, c + ivec2(0, 1), 0).rg, d11 = texelFetch(field, c + ivec2(1, 1), 0).rg;
    vec2 l0 = mix(d00, d01, f.y), l1 = mix(d10, d11, f.y);
    vec2 s = vec2(float(x), float(y)) - mix(l0, l1, f.x);
    vec2 i = floor(s), t = s - i;
    ivec2 ii = ivec2(i);
    if (t.x == 0.0 && t.y == 0.0 && ii.x >= 0 && ii.y >= 0 && ii.x < size.x && ii.y < size.y) {
        color = texelFetch(src, ii, 0);
        return;
    }
    vec4 wx = cubic(t.x), wy = cubic(t.y), acc = vec4(0.0);
    for (int m = 0; m < 4; m++) {
        int yy = ii.y - 1 + m;
        acc += wy[m] * (wx[0] * tap(ii.x - 1, yy) + wx[1] * tap(ii.x, yy) + wx[2] * tap(ii.x + 1, yy) + wx[3] * tap(ii.x + 2, yy));
    }
    if (acc.a < 0.5 / 255.0) {
        color = vec4(0.0);
        return;
    }
    float a = min(acc.a, 1.0);
    color = vec4(clamp(acc.rgb / acc.a, 0.0, 1.0) * a, a);
}`;

export class LiquifyGL {
    readonly canvas: HTMLCanvasElement;
    private gl: WebGL2RenderingContext;
    private fieldTex: WebGLTexture;

    // throws when webgl2 or a big enough texture isn't available, so the caller can fall back to the cpu
    constructor(source: HTMLCanvasElement, private w: number, private h: number, private gw: number, private gh: number, step: number) {
        this.canvas = document.createElement('canvas');
        this.canvas.width = w;
        this.canvas.height = h;
        const gl = this.canvas.getContext('webgl2', { premultipliedAlpha: true, preserveDrawingBuffer: true, antialias: false, alpha: true });
        if (!gl) throw new Error('no webgl2');
        const max = gl.getParameter(gl.MAX_TEXTURE_SIZE) as number;
        if (w > max || h > max || gw > max || gh > max) throw new Error('layer too big for a texture');
        this.gl = gl;
        const prog = gl.createProgram()!;
        for (const [type, code] of [[gl.VERTEX_SHADER, VERT], [gl.FRAGMENT_SHADER, FRAG]] as const) {
            const sh = gl.createShader(type)!;
            gl.shaderSource(sh, code);
            gl.compileShader(sh);
            if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(sh) ?? 'shader failed');
            gl.attachShader(prog, sh);
        }
        gl.linkProgram(prog);
        if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog) ?? 'link failed');
        gl.useProgram(prog);
        gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
        const loc = gl.getAttribLocation(prog, 'pos');
        gl.enableVertexAttribArray(loc);
        gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this.texture());
        gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, source);
        gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);

        gl.activeTexture(gl.TEXTURE1);
        this.fieldTex = this.texture();
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RG32F, gw, gh, 0, gl.RG, gl.FLOAT, new Float32Array(gw * gh * 2));

        gl.uniform1i(gl.getUniformLocation(prog, 'src'), 0);
        gl.uniform1i(gl.getUniformLocation(prog, 'field'), 1);
        gl.uniform2i(gl.getUniformLocation(prog, 'size'), w, h);
        gl.uniform1i(gl.getUniformLocation(prog, 'step'), step);
        gl.viewport(0, 0, w, h);
        gl.enable(gl.SCISSOR_TEST);
        gl.disable(gl.BLEND);
        gl.clearColor(0, 0, 0, 0);
        // the first frame shows the untouched layer
        gl.scissor(0, 0, w, h);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
        if (gl.getError() !== gl.NO_ERROR) throw new Error('webgl setup failed');
    }

    private texture(): WebGLTexture {
        const gl = this.gl, t = gl.createTexture()!;
        gl.bindTexture(gl.TEXTURE_2D, t);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        return t;
    }

    // uploads the field nodes under r (plus the far corners) and redraws r
    draw(field: Float32Array, r: Rect, step: number): void {
        const gl = this.gl, cx0 = Math.floor(r.x / step), cy0 = Math.floor(r.y / step);
        const cx1 = Math.min(this.gw - 1, Math.ceil((r.x + r.w) / step)), cy1 = Math.min(this.gh - 1, Math.ceil((r.y + r.h) / step));
        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, this.fieldTex);
        gl.pixelStorei(gl.UNPACK_ROW_LENGTH, this.gw);
        gl.texSubImage2D(gl.TEXTURE_2D, 0, cx0, cy0, cx1 - cx0 + 1, cy1 - cy0 + 1, gl.RG, gl.FLOAT, field, (cy0 * this.gw + cx0) * 2);
        gl.pixelStorei(gl.UNPACK_ROW_LENGTH, 0);
        gl.scissor(r.x, this.h - r.y - r.h, r.w, r.h);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
    }

    dispose(): void {
        this.gl.getExtension('WEBGL_lose_context')?.loseContext();
        this.canvas.width = this.canvas.height = 1;
    }
}
