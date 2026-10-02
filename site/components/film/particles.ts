import type * as Three from "three";

/**
 * Green points for dividend payments, drawn with three.js.
 *
 * Two modes, blended by `inside` (0 to 1):
 *   0  payments stream in from the edges along curves and settle into the dial (`target`)
 *   1  inside the vault: the points drift past the camera like dust in a lit room
 * All motion is computed in the vertex shader from time and per-point constants, so a frame costs
 * one draw call whatever the count.
 */

export type ParticleControls = {
  /** 0 = stream into the dial, 1 = drift inside the vault */
  inside: number;
  /** Overall strength, 0 to 1 */
  opacity: number;
};

const VERTEX = /* glsl */ `
  attribute vec3 aStart;
  attribute float aPhase;
  attribute float aSpeed;
  attribute float aSize;
  uniform float uTime;
  uniform vec3 uTarget;
  uniform float uInside;
  uniform float uPixelRatio;
  varying float vAlpha;

  void main() {
    // Stream: a quadratic curve from the start point to the dial, bowed by the phase
    float t = fract(uTime * aSpeed + aPhase);
    vec3 ctrl = mix(aStart, uTarget, 0.45) + vec3(0.0, (aPhase - 0.5) * 3.0, 0.0);
    vec3 flow = mix(mix(aStart, ctrl, t), mix(ctrl, uTarget, t), t);
    float flowAlpha = smoothstep(0.0, 0.12, t) * (1.0 - smoothstep(0.82, 1.0, t));

    // Inside: points on a wide tunnel, sliding towards the camera
    float angle = aPhase * 6.2831853 * 7.0;
    float radius = 1.6 + aSize * 2.6 + fract(aPhase * 13.7) * 3.0;
    float z = mix(-34.0, 9.5, fract(uTime * aSpeed * 0.55 + aPhase));
    vec3 dust = vec3(cos(angle) * radius * 1.5, sin(angle) * radius * 0.85, z);
    // Fade out well before the camera, or near points become screen-sized blobs
    float dustAlpha = smoothstep(-34.0, -20.0, z) * (1.0 - smoothstep(1.0, 5.0, z));

    vec3 position = mix(flow, dust, uInside);
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = min(mix(1.0, 1.9, aSize) * 26.0 / -mv.z, 7.0) * uPixelRatio;
    vAlpha = mix(flowAlpha, dustAlpha * 0.75, uInside);
  }
`;

const FRAGMENT = /* glsl */ `
  uniform vec3 uColor;
  uniform float uOpacity;
  varying float vAlpha;

  void main() {
    float d = length(gl_PointCoord - 0.5);
    float core = smoothstep(0.5, 0.0, d);
    gl_FragColor = vec4(uColor, core * core * vAlpha * uOpacity);
  }
`;

const CAMERA_Z = 10;
const FOV = 50;

export class ParticleField {
  private renderer: Three.WebGLRenderer;
  private scene: Three.Scene;
  private camera: Three.PerspectiveCamera;
  private material: Three.ShaderMaterial;
  private geometry: Three.BufferGeometry;
  private frame = 0;
  private running = false;
  private start = performance.now();

  constructor(
    THREE: typeof Three,
    private canvas: HTMLCanvasElement,
    private controls: ParticleControls,
    /** Where the dial is on screen, in CSS pixels; null keeps the last target */
    private dialCenter: () => { x: number; y: number } | null,
    count: number,
  ) {
    this.renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: false, powerPreference: "low-power" });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 100);
    this.camera.position.z = CAMERA_Z;

    const start = new Float32Array(count * 3);
    const phase = new Float32Array(count);
    const speed = new Float32Array(count);
    const size = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      // Start beyond the edges of the screen, mostly to the right, above and below, so the
      // stream doesn't cross the headline on the left
      const angle = (Math.random() * 1.4 - 0.7) * Math.PI;
      const r = 9 + Math.random() * 6;
      start[i * 3] = Math.cos(angle) * r * 1.3;
      start[i * 3 + 1] = Math.sin(angle) * r * 0.75;
      start[i * 3 + 2] = -6 + Math.random() * 8;
      phase[i] = Math.random();
      speed[i] = 0.045 + Math.random() * 0.07;
      size[i] = Math.random() ** 2;
    }
    this.geometry = new THREE.BufferGeometry();
    // `position` is unused by the shader but three.js needs it to size the draw call
    this.geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(count * 3), 3));
    this.geometry.setAttribute("aStart", new THREE.BufferAttribute(start, 3));
    this.geometry.setAttribute("aPhase", new THREE.BufferAttribute(phase, 1));
    this.geometry.setAttribute("aSpeed", new THREE.BufferAttribute(speed, 1));
    this.geometry.setAttribute("aSize", new THREE.BufferAttribute(size, 1));

    this.material = new THREE.ShaderMaterial({
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uTime: { value: 0 },
        uTarget: { value: new THREE.Vector3(3, 0, 0) },
        uInside: { value: 0 },
        uOpacity: { value: 0 },
        uPixelRatio: { value: this.renderer.getPixelRatio() },
        uColor: { value: new THREE.Color("#9bd96b") },
      },
    });
    const points = new THREE.Points(this.geometry, this.material);
    points.frustumCulled = false;
    this.scene.add(points);
    this.resize();
  }

  resize() {
    const { clientWidth: w, clientHeight: h } = this.canvas;
    if (!w || !h) return;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  play() {
    if (this.running) return;
    this.running = true;
    const tick = () => {
      if (!this.running) return;
      this.render();
      this.frame = requestAnimationFrame(tick);
    };
    this.frame = requestAnimationFrame(tick);
  }

  pause() {
    this.running = false;
    cancelAnimationFrame(this.frame);
  }

  private render() {
    const u = this.material.uniforms;
    u.uTime.value = (performance.now() - this.start) / 1000;
    u.uInside.value = this.controls.inside;
    u.uOpacity.value = this.controls.opacity;

    // The dial's screen position, mapped onto the z = 0 plane the stream ends on
    const dial = this.dialCenter();
    if (dial) {
      const { clientWidth: w, clientHeight: h } = this.canvas;
      const halfH = Math.tan((FOV / 2) * (Math.PI / 180)) * CAMERA_Z;
      const halfW = halfH * (w / h);
      (u.uTarget.value as Three.Vector3).set(((dial.x / w) * 2 - 1) * halfW, (1 - (dial.y / h) * 2) * halfH, 0);
    }
    this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    this.pause();
    this.geometry.dispose();
    this.material.dispose();
    this.renderer.dispose();
  }
}
