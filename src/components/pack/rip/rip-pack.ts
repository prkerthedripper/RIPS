/*
  The pack you can actually tear.

  The shell is split in two at the tear line by the fragment shader: below the
  line it is the pouch left in your hands, above it is a hinged flap that peels
  back as the tear front crosses it. The tear front is a live value driven by
  the pointer, so the foil separates exactly as far as you have dragged.
*/

import * as THREE from "three";
import {
  PACK_DIMS,
  buildButton,
  buildEmblem,
  buildSeal,
  buildShell,
  createFoilSet,
  type PackLook,
} from "../three/pack-scene";

const { width: WIDTH, halfWidth: HALF_W, thickness: THICKNESS } = PACK_DIMS;

/** Height of the tear line, just under the crimped top seal. */
export const TEAR_Y = PACK_DIMS.halfHeight - PACK_DIMS.seal - 0.012;

export type RipUniforms = {
  uFront: { value: number };
  uPeel: { value: number };
  uTearY: { value: number };
};

export function createRipUniforms(): RipUniforms {
  return {
    uFront: { value: -HALF_W },
    uPeel: { value: 0 },
    uTearY: { value: TEAR_Y },
  };
}

const JAG = `
float ripLine(float x) {
  return uTearY + 0.012 * sin(x * 38.0) + 0.006 * sin(x * 97.0 + 1.7) + 0.003 * sin(x * 211.0 + 0.4);
}
`;

function injectShared(
  material: THREE.Material,
  uniforms: RipUniforms,
  key: string,
  options: { peel: boolean },
) {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uFront = uniforms.uFront;
    shader.uniforms.uPeel = uniforms.uPeel;
    shader.uniforms.uTearY = uniforms.uTearY;

    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        `#include <common>
         uniform float uFront;
         uniform float uPeel;
         uniform float uTearY;
         varying vec3 vRipLocal;`,
      )
      .replace("#include <begin_vertex>", options.peel ? `
        vRipLocal = position;
        vec3 transformed = vec3( position );
        {
          float d = smoothstep(uFront - 0.02, uFront - 0.44, position.x);
          float ang = -uPeel * 1.55 * d;
          float ca = cos(ang), sa = sin(ang);
          vec3 p = vec3(position.x, position.y - uTearY, position.z);
          p.yz = vec2(p.y * ca - p.z * sa, p.y * sa + p.z * ca);
          p.z += 0.006 * sin(position.x * 26.0) * d * uPeel;
          p.y += 0.004 * sin(position.x * 54.0) * d * uPeel;
          transformed = vec3(p.x, p.y + uTearY, p.z);
        }
      ` : `
        vRipLocal = position;
        #include <begin_vertex>
      `);

    if (options.peel) {
      shader.vertexShader = shader.vertexShader.replace(
        "#include <beginnormal_vertex>",
        `
        float ripD = smoothstep(uFront - 0.02, uFront - 0.44, position.x);
        float ripAng = -uPeel * 1.55 * ripD;
        float ripC = cos(ripAng), ripS = sin(ripAng);
        vec3 objectNormal = vec3( normal );
        objectNormal.yz = vec2(objectNormal.y * ripC - objectNormal.z * ripS,
                               objectNormal.y * ripS + objectNormal.z * ripC);
        `,
      );
    }

    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
         uniform float uFront;
         uniform float uTearY;
         varying vec3 vRipLocal;
         ${JAG}`,
      )
      .replace(
        "#include <clipping_planes_fragment>",
        `#include <clipping_planes_fragment>
         {
           float rl = ripLine(vRipLocal.x);
           ${options.peel
             ? "if (vRipLocal.y < rl || vRipLocal.x > uFront) discard;"
             : "if (vRipLocal.x < uFront && vRipLocal.y > rl) discard;"}
         }`,
      );
  };
  material.customProgramCacheKey = () => key;
  material.needsUpdate = true;
}

export type RipPack = {
  group: THREE.Group;
  lid: THREE.Group;
  body: THREE.Group;
  uniforms: RipUniforms;
  dispose: () => void;
};

/** A jagged cross-section of torn film along the tear line. */
function buildTornEdge(uniforms: RipUniforms) {
  const cols = 240;
  const rows = 3;
  const position: number[] = [];
  const uv: number[] = [];
  const index: number[] = [];

  for (let i = 0; i <= cols; i += 1) {
    const x = -HALF_W + (i / cols) * WIDTH;
    const line =
      TEAR_Y +
      0.012 * Math.sin(x * 38) +
      0.006 * Math.sin(x * 97 + 1.7) +
      0.003 * Math.sin(x * 211 + 0.4);
    for (let j = 0; j <= rows; j += 1) {
      const v = j / rows;
      const z = -THICKNESS / 2 + v * THICKNESS;
      const lift = 0.0022 * Math.sin(v * Math.PI) + 0.0012 * Math.sin(x * 63 + v * 7);
      position.push(x, line + lift, z);
      uv.push(i / cols, v);
    }
  }
  for (let i = 0; i < cols; i += 1) {
    for (let j = 0; j < rows; j += 1) {
      const a = i * (rows + 1) + j;
      const b = a + rows + 1;
      index.push(a, b, a + 1, a + 1, b, b + 1);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(position, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  geometry.setIndex(index);
  geometry.computeVertexNormals();

  const material = new THREE.MeshPhysicalMaterial({
    color: 0xd8cbe8,
    metalness: 1,
    roughness: 0.36,
    side: THREE.DoubleSide,
    envMapIntensity: 1.6,
  });
  injectShared(material, uniforms, "rip-edge", { peel: false });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = false;
  return mesh;
}

/** Dark interior of an opened pouch, so the opening reads as a cavity. */
function buildInterior() {
  const group = new THREE.Group();
  const lining = new THREE.MeshStandardMaterial({
    color: 0x150b24,
    roughness: 0.92,
    metalness: 0.15,
    emissive: new THREE.Color(0x2a1148),
    emissiveIntensity: 0.55,
    side: THREE.DoubleSide,
  });

  const back = new THREE.Mesh(new THREE.PlaneGeometry(1.12, 0.86), lining);
  back.position.set(0, TEAR_Y - 0.4, -THICKNESS / 2 + 0.002);
  group.add(back);

  for (const side of [-1, 1]) {
    const wall = new THREE.Mesh(new THREE.PlaneGeometry(0.86, 0.06), lining);
    wall.position.set(side * HALF_W * 0.86, TEAR_Y - 0.43, 0);
    wall.rotation.y = side * 0.14;
    group.add(wall);
  }

  const floor = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.2), lining);
  floor.position.set(0, TEAR_Y - 0.8, 0);
  floor.rotation.x = -Math.PI / 2;
  group.add(floor);

  return group;
}

export function createRipPack(look: PackLook): RipPack {
  const uniforms = createRipUniforms();
  const foilSet = createFoilSet(look);

  const bodyFoil = foilSet.foil.clone();
  injectShared(bodyFoil, uniforms, "rip-body", { peel: false });
  const lidFoil = foilSet.foil.clone();
  injectShared(lidFoil, uniforms, "rip-lid", { peel: true });

  const bodySeal = foilSet.seal.clone();
  injectShared(bodySeal, uniforms, "rip-seal-body", { peel: false });
  const lidSeal = foilSet.seal.clone();
  injectShared(lidSeal, uniforms, "rip-seal-lid", { peel: true });

  const bodyRim = foilSet.rim.clone();
  injectShared(bodyRim, uniforms, "rip-rim-body", { peel: false });
  const lidRim = foilSet.rim.clone();
  injectShared(lidRim, uniforms, "rip-rim-lid", { peel: true });

  const { body: shellGeometry, rim: rimGeometry } = buildShell();
  const topSeal = buildSeal(true);
  const bottomSeal = buildSeal(false);

  const group = new THREE.Group();
  group.name = "rip-pack";
  const body = new THREE.Group();
  const lid = new THREE.Group();

  const shellBody = new THREE.Mesh(shellGeometry, bodyFoil);
  shellBody.castShadow = true;
  shellBody.receiveShadow = true;
  body.add(shellBody);

  const rimBody = new THREE.Mesh(rimGeometry, bodyRim);
  rimBody.castShadow = true;
  body.add(rimBody);

  const sealBottom = new THREE.Mesh(bottomSeal, bodySeal);
  sealBottom.castShadow = true;
  body.add(sealBottom);

  const emblemY = PACK_DIMS.height * 0.09;
  const emblem = buildEmblem(look.colorway);
  emblem.position.set(0, emblemY, 0.048);
  body.add(emblem);

  const button = buildButton(look.colorway);
  button.position.set(0, -PACK_DIMS.height * 0.135, 0.035);
  body.add(button);

  const shellLid = new THREE.Mesh(shellGeometry, lidFoil);
  shellLid.castShadow = false;
  lid.add(shellLid);

  const rimLid = new THREE.Mesh(rimGeometry, lidRim);
  rimLid.castShadow = false;
  lid.add(rimLid);

  const sealTop = new THREE.Mesh(topSeal, lidSeal);
  sealTop.castShadow = false;
  lid.add(sealTop);

  group.add(body);
  group.add(lid);
  group.add(buildTornEdge(uniforms));
  group.add(buildInterior());

  return {
    group,
    lid,
    body,
    uniforms,
    dispose: () => {
      const geometries = new Set<THREE.BufferGeometry>();
      const materials = new Set<THREE.Material>();
      const textures = new Set<THREE.Texture>();
      group.traverse((object) => {
        const mesh = object as THREE.Mesh;
        if (mesh.geometry) geometries.add(mesh.geometry);
        const list = Array.isArray(mesh.material) ? mesh.material : mesh.material ? [mesh.material] : [];
        for (const material of list) {
          materials.add(material);
          for (const value of Object.values(material as unknown as Record<string, unknown>)) {
            if (value instanceof THREE.Texture && !value.userData.shared) textures.add(value);
          }
        }
      });
      for (const geometry of geometries) geometry.dispose();
      for (const texture of textures) texture.dispose();
      for (const material of materials) material.dispose();
    },
  };
}
