// Project in model space, using the same physical scale on every surface.
// The three planar projections are blended by surface normal at beveled edges.
export function installPatternMapping(material, scale, aspect = { value: 1 }) {
  material.onBeforeCompile = shader => {
    shader.uniforms.patternScale = scale;
    shader.uniforms.patternAspect = aspect;
    shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 patternPosition;\nvarying vec3 patternNormal;');
    shader.vertexShader = shader.vertexShader.replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\npatternPosition = (modelMatrix * vec4(transformed, 1.0)).xyz;\npatternNormal = normalize(mat3(modelMatrix) * objectNormal);');
    shader.fragmentShader = shader.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 patternPosition;\nvarying vec3 patternNormal;\nuniform float patternScale;\nuniform float patternAspect;\nvec2 correctSlope(vec2 uv, vec2 sideNormal, float faceNormal) {\n  float sideSquared = dot(sideNormal, sideNormal);\n  if (sideSquared < 0.00001) return uv;\n  return uv + sideNormal * dot(uv, sideNormal) * ((1.0 / max(abs(faceNormal), 0.1) - 1.0) / sideSquared);\n}');
    shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', `
#ifdef USE_MAP
  vec3 face = normalize(cross(dFdx(patternPosition), dFdy(patternPosition)));
  vec3 weights = pow(abs(face), vec3(8.0));
  weights /= max(weights.x + weights.y + weights.z, 0.00001);
  vec3 p = patternPosition / patternScale;
  vec2 pixels = vec2(1.0, patternAspect);
  vec4 colorX = texture2D(map, correctSlope(p.zy, face.zy, face.x) * pixels);
  vec4 colorY = texture2D(map, correctSlope(p.xz, face.xz, face.y) * pixels);
  vec4 colorZ = texture2D(map, correctSlope(p.xy, face.xy, face.z) * pixels);
  diffuseColor *= colorX * weights.x + colorY * weights.y + colorZ * weights.z;
#endif`);
  };
  material.customProgramCacheKey = () => 'robot-pattern-triplanar-v2';
  material.needsUpdate = true;
}
