import * as THREE from 'three';

/**
 * Wind im Vertex-Shader für InstancedMeshes: Auslenkung wächst mit (Höhe/hoehe)²,
 * Phase aus der Instanzposition, langsame Böen. Dieselbe Funktion für Material und
 * Schatten (customDepthMaterial), sonst stehen die Schatten still.
 */
export function windShader(zeit: { value: number }, hoehe: number, staerke: number) {
  return (shader: THREE.WebGLProgramParametersWithUniforms) => {
    shader.uniforms.uZeit = zeit;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uZeit;')
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        {
          vec3 basis = (instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
          float h = clamp(position.y / ${hoehe.toFixed(3)}, 0.0, 1.0);
          float phase = basis.x * 0.7 + basis.z * 0.5;
          float boe = 0.55 + 0.45 * sin(uZeit * 0.23 + basis.x * 0.11 - basis.z * 0.07);
          float aus = (sin(uZeit * 1.4 + phase) * 0.6 + sin(uZeit * 2.3 + phase * 1.7) * 0.25) * boe;
          // Auslenkung in Weltrichtung, zurückgerechnet in den lokalen Raum der Instanz
          // (Drehung um Y + gleichmäßige Skalierung): sonst kippt jeder Baum woandershin.
          vec3 d = vec3(${(0.06 * staerke).toFixed(4)}, 0.0, ${(0.035 * staerke).toFixed(4)}) * aus * h * h;
          vec3 sx = instanceMatrix[0].xyz;
          vec3 sz = instanceMatrix[2].xyz;
          transformed.x += dot(sx, d) / dot(sx, sx);
          transformed.z += dot(sz, d) / dot(sz, sz);
        }`,
      );
  };
}
