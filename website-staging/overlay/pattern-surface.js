// A 2D raster compositor: samples Blender surface maps, never loads a 3D model.
const vertex = `#version 300 es
in vec2 position; out vec2 uv;
void main(){uv=position*.5+.5; gl_Position=vec4(position,0.,1.);}`;
const fragment = `#version 300 es
precision highp float;
in vec2 uv; out vec4 color;
uniform sampler2D hiMap,loMap,normalMap,shadeMap,pattern;
uniform vec2 sheetSize, aspect;
uniform vec4 crop;
uniform vec3 origin,span;
uniform float scale;
vec2 slope(vec2 p,vec2 n,float face){
 float d=dot(n,n); if(d<.00001)return p;
 return p+n*dot(p,n)*((1./max(abs(face),.1)-1.)/d);
}
void main(){
 vec2 at=(crop.xy+vec2(uv.x,1.-uv.y)*crop.zw)/sheetSize;
 vec4 shade=texture(shadeMap,at);
 if(shade.a<.003){color=vec4(0.);return;}
 vec3 h=floor(texture(hiMap,at).rgb*255.+.5);
 vec3 l=floor(texture(loMap,at).rgb*15.+.5);
 vec3 p=(origin+(h*16.+l)/4095.*span)/scale;
 vec3 n=normalize(texture(normalMap,at).rgb*2.-1.);
 vec3 w=pow(abs(n),vec3(8.));w/=max(w.x+w.y+w.z,.00001);
 vec3 c=texture(pattern,slope(p.zy,n.zy,n.x)*aspect).rgb*w.x
       +texture(pattern,slope(p.xz,n.xz,n.y)*aspect).rgb*w.y
       +texture(pattern,slope(p.xy,n.xy,n.z)*aspect).rgb*w.z;
 // Baked neutral lighting retains the bevels, contact shadows and case depth.
 color=vec4(c*shade.rgb,shade.a);
}`;
export function createSurfaceCompositor() {
  const canvas = document.createElement("canvas");
  const gl = canvas.getContext("webgl2", {
    alpha: true,
    premultipliedAlpha: false,
    antialias: false,
    preserveDrawingBuffer: true,
  });
  if (!gl) throw new Error("Patterned alerts need WebGL 2 raster compositing.");
  function shader(type, source) {
    const s = gl.createShader(type);
    gl.shaderSource(s, source);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS))
      throw new Error(gl.getShaderInfoLog(s));
    return s;
  }
  const program = gl.createProgram();
  gl.attachShader(program, shader(gl.VERTEX_SHADER, vertex));
  gl.attachShader(program, shader(gl.FRAGMENT_SHADER, fragment));
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS))
    throw new Error(gl.getProgramInfoLog(program));
  gl.useProgram(program);
  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
    gl.STATIC_DRAW,
  );
  const loc = gl.getAttribLocation(program, "position");
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  const uniforms = Object.fromEntries(
    [
      "hiMap",
      "loMap",
      "normalMap",
      "shadeMap",
      "pattern",
      "sheetSize",
      "crop",
      "origin",
      "span",
      "scale",
      "aspect",
    ].map((n) => [n, gl.getUniformLocation(program, n)]),
  );
  gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.NONE);
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
  function texture(image, repeat = false) {
    if (
      image.width > gl.getParameter(gl.MAX_TEXTURE_SIZE) ||
      image.height > gl.getParameter(gl.MAX_TEXTURE_SIZE)
    )
      throw new Error("Pattern atlas exceeds graphics limit.");
    const t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texParameteri(
      gl.TEXTURE_2D,
      gl.TEXTURE_MIN_FILTER,
      repeat ? gl.LINEAR_MIPMAP_LINEAR : gl.NEAREST,
    );
    gl.texParameteri(
      gl.TEXTURE_2D,
      gl.TEXTURE_MAG_FILTER,
      repeat ? gl.LINEAR : gl.NEAREST,
    );
    gl.texParameteri(
      gl.TEXTURE_2D,
      gl.TEXTURE_WRAP_S,
      repeat ? gl.REPEAT : gl.CLAMP_TO_EDGE,
    );
    gl.texParameteri(
      gl.TEXTURE_2D,
      gl.TEXTURE_WRAP_T,
      repeat ? gl.REPEAT : gl.CLAMP_TO_EDGE,
    );
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
    if (repeat) gl.generateMipmap(gl.TEXTURE_2D);
    return t;
  }
  return {
    texture,
    deleteTexture: (t) => gl.deleteTexture(t),
    draw(maps, pattern, meta, frame, scale) {
      if (gl.isContextLost())
        throw new Error(
          "Robot pattern graphics context lost; refresh this source.",
        );
      const [x, y, w, h] = frame.sheet;
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
      gl.viewport(0, 0, w, h);
      gl.useProgram(program);
      const names = ["hiMap", "loMap", "normalMap", "shadeMap", "pattern"];
      [...maps.textures, pattern.texture].forEach((t, i) => {
        gl.activeTexture(gl.TEXTURE0 + i);
        gl.bindTexture(gl.TEXTURE_2D, t);
        gl.uniform1i(uniforms[names[i]], i);
      });
      gl.uniform2f(uniforms.sheetSize, ...maps.size);
      gl.uniform4f(uniforms.crop, x, y, w, h);
      gl.uniform3f(uniforms.origin, ...meta.origin);
      gl.uniform3f(uniforms.span, ...meta.span);
      gl.uniform1f(uniforms.scale, scale);
      gl.uniform2f(uniforms.aspect, 1, pattern.aspect);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      return canvas;
    },
  };
}
