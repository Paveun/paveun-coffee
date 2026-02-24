<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import * as THREE from 'three';

  let canvas: HTMLCanvasElement;
  let animationId: number;
  let renderer: THREE.WebGLRenderer;
  let material: THREE.ShaderMaterial;
  let geometry: THREE.PlaneGeometry;

  onMount(() => {
    // Setup Three.js
    const scene = new THREE.Scene();
    
    // Orthographic camera for 2D shader background
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
    camera.position.z = 1;

    renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: false });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    // Shader Material for dark fluid
    const uniforms = {
      u_time: { value: 0.0 },
      u_resolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) }
    };

    const vertexShader = `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = vec4(position, 1.0);
      }
    `;

    const fragmentShader = `
      uniform float u_time;
      uniform vec2 u_resolution;
      varying vec2 vUv;

      // Random function
      float random (in vec2 _st) {
          return fract(sin(dot(_st.xy, vec2(12.9898,78.233))) * 43758.5453123);
      }

      // 2D Noise
      float noise (in vec2 _st) {
          vec2 i = floor(_st);
          vec2 f = fract(_st);

          float a = random(i);
          float b = random(i + vec2(1.0, 0.0));
          float c = random(i + vec2(0.0, 1.0));
          float d = random(i + vec2(1.0, 1.0));

          vec2 u = f * f * (3.0 - 2.0 * f);

          return mix(a, b, u.x) +
                  (c - a)* u.y * (1.0 - u.x) +
                  (d - b) * u.x * u.y;
      }

      // Fractal Brownian Motion
      #define NUM_OCTAVES 5
      float fbm ( in vec2 _st) {
          float v = 0.0;
          float a = 0.5;
          vec2 shift = vec2(100.0);
          mat2 rot = mat2(cos(0.5), sin(0.5),
                          -sin(0.5), cos(0.50));
          for (int i = 0; i < NUM_OCTAVES; ++i) {
              v += a * noise(_st);
              _st = rot * _st * 2.0 + shift;
              a *= 0.5;
          }
          return v;
      }

      void main() {
          vec2 st = gl_FragCoord.xy/u_resolution.xy;
          st.x *= u_resolution.x/u_resolution.y;

          vec2 q = vec2(0.);
          q.x = fbm( st + 0.00 * u_time);
          q.y = fbm( st + vec2(1.0));

          vec2 r = vec2(0.);
          r.x = fbm( st + 1.0*q + vec2(1.7,9.2)+ 0.15*u_time );
          r.y = fbm( st + 1.0*q + vec2(8.3,2.8)+ 0.126*u_time);

          float f = fbm(st+r);

          // Dark coffee colors formulation
          vec3 color = mix(
              vec3(0.05, 0.05, 0.05), // very dark charcoal space
              vec3(0.18, 0.11, 0.08), // dark espresso base
              clamp((f*f)*4.0, 0.0, 1.0)
          );

          color = mix(
              color,
              vec3(0.08, 0.04, 0.03), // deep coffee folds
              clamp(length(q), 0.0, 1.0)
          );
          
          color = mix(
              color,
              vec3(0.25, 0.16, 0.12), // lighter crema edge movement
              clamp(length(r.x) * 0.5, 0.0, 1.0)
          );

          gl_FragColor = vec4(color, 1.0);
      }
    `;

    material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms,
      depthWrite: false,
      depthTest: false
    });

    geometry = new THREE.PlaneGeometry(2, 2);
    const mesh = new THREE.Mesh(geometry, material);
    scene.add(mesh);

    const handleResize = () => {
      renderer.setSize(window.innerWidth, window.innerHeight);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      uniforms.u_resolution.value.set(window.innerWidth, window.innerHeight);
    };

    window.addEventListener('resize', handleResize);

    const clock = new THREE.Clock(); // for smooth uniform time

    const animate = () => {
      animationId = requestAnimationFrame(animate);
      uniforms.u_time.value = clock.getElapsedTime() * 0.5; // Scale time for slower movement
      renderer.render(scene, camera);
    };

    animate();

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  });

  onDestroy(() => {
    if (animationId) cancelAnimationFrame(animationId);
    if (geometry) geometry.dispose();
    if (material) material.dispose();
    if (renderer) renderer.dispose();
  });
</script>

<svelte:head>
  <title>Paveun</title>
</svelte:head>

<main>
  <canvas bind:this={canvas}></canvas>
  <div class="overlay">
    <h1>Paveun</h1>
  </div>
</main>

<style>
  main {
    position: relative;
    width: 100vw;
    height: 100vh;
    overflow: hidden;
    background-color: #111111;
  }

  canvas {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    z-index: 1;
    display: block;
  }

  .overlay {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    z-index: 2;
    display: flex;
    justify-content: center;
    align-items: center;
    pointer-events: none;
  }

  h1 {
    font-family: 'Outfit', sans-serif;
    font-size: 8vw;
    font-weight: 300;
    letter-spacing: 0.1em;
    color: #E8D8C8;
    margin: 0;
    text-transform: uppercase;
    text-shadow: 0 8px 32px rgba(0, 0, 0, 0.6);
    user-select: none;
  }

  @media (max-width: 768px) {
    h1 {
      font-size: 15vw;
    }
  }
</style>
