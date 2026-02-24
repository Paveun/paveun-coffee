<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import * as THREE from "three";

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

    renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: false,
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    // Shader Material for dark fluid
    const MAX_RIPPLES = 10;
    const initialPositions = Array(MAX_RIPPLES)
      .fill(null)
      .map(() => new THREE.Vector2(-10000, -10000));
    const initialTimes = Array(MAX_RIPPLES).fill(-100.0);

    const uniforms = {
      u_time: { value: 0.0 },
      u_resolution: {
        value: new THREE.Vector2(window.innerWidth, window.innerHeight),
      },
      u_mouse: {
        value: new THREE.Vector2(window.innerWidth / 2, window.innerHeight / 2),
      },
      u_clicks_pos: { value: initialPositions },
      u_clicks_time: { value: initialTimes },
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
      uniform vec2 u_mouse;
      uniform vec2 u_clicks_pos[10];
      uniform float u_clicks_time[10];
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
          vec2 st = vUv;
          st.x *= u_resolution.x/u_resolution.y;

          // Interactive ripple based on mouse hover
          vec2 mouse = u_mouse.xy / u_resolution.xy;
          mouse.x *= u_resolution.x/u_resolution.y;
          float distToMouse = distance(st, mouse);
          st += (mouse - st) * exp(-distToMouse * 3.0) * 0.05; // Gentle pull towards mouse
          
          // Click expanding ripples
          for (int i = 0; i < 10; i++) {
              vec2 clickPos = u_clicks_pos[i].xy / u_resolution.xy;
              clickPos.x *= u_resolution.x/u_resolution.y;
              float distToClick = distance(st, clickPos);
              float timeSinceClick = u_time - u_clicks_time[i];
              
              if (timeSinceClick > 0.0 && timeSinceClick < 5.0) {
                  float rippleRadius = timeSinceClick * 0.8; // Faster expanding
                  float rippleIntensity = exp(-timeSinceClick * 0.8); // Slower decay
                  float ring = sin((distToClick - rippleRadius) * 30.0); // Wider ring
                  float ringMask = exp(-abs(distToClick - rippleRadius) * 20.0);
                  st += normalize(st - clickPos + 0.0001) * ring * ringMask * rippleIntensity * 0.25; // Much stronger distortion
              }
          }

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
      depthTest: false,
    });

    geometry = new THREE.PlaneGeometry(2, 2);
    const mesh = new THREE.Mesh(geometry, material);
    scene.add(mesh);

    const handleResize = () => {
      renderer.setSize(window.innerWidth, window.innerHeight);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      uniforms.u_resolution.value.set(window.innerWidth, window.innerHeight);
    };

    let clickIndex = 0;
    const addClick = (x: number, y: number) => {
      uniforms.u_clicks_pos.value[clickIndex].set(x, window.innerHeight - y);
      uniforms.u_clicks_time.value[clickIndex] = uniforms.u_time.value;
      clickIndex = (clickIndex + 1) % MAX_RIPPLES;
    };

    const handleMouseMove = (e: MouseEvent) => {
      // Y-axis is inverted in WebGL
      uniforms.u_mouse.value.set(e.clientX, window.innerHeight - e.clientY);
    };
    const handleMouseDown = (e: MouseEvent) => {
      addClick(e.clientX, e.clientY);
    };

    window.addEventListener("resize", handleResize);
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mousedown", handleMouseDown);
    window.addEventListener("touchstart", (e) => {
      uniforms.u_mouse.value.set(
        e.touches[0].clientX,
        window.innerHeight - e.touches[0].clientY,
      );
      addClick(e.touches[0].clientX, e.touches[0].clientY);
    });
    window.addEventListener("touchmove", (e) => {
      uniforms.u_mouse.value.set(
        e.touches[0].clientX,
        window.innerHeight - e.touches[0].clientY,
      );
    });

    const clock = new THREE.Clock(); // for smooth uniform time

    const animate = () => {
      animationId = requestAnimationFrame(animate);
      uniforms.u_time.value = clock.getElapsedTime() * 0.5; // Scale time for slower movement
      renderer.render(scene, camera);
    };

    animate();

    return () => {
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mousedown", handleMouseDown);
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
    font-family: "Outfit", sans-serif;
    font-size: 8vw;
    font-weight: 300;
    letter-spacing: 0.1em;
    color: #e8d8c8;
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
