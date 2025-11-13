<template>
  <div class="present3d-container">
    <div class="header">
      <h1>{{ selectedResult.title || "3D Visualization" }}</h1>
      <div class="controls">
        <button @click="resetCamera" class="control-btn">
          <span class="material-icons">refresh</span>
          Reset Camera
        </button>
        <button @click="toggleWireframe" class="control-btn">
          <span class="material-icons">{{
            showWireframe ? "grid_off" : "grid_on"
          }}</span>
          Wireframe
        </button>
        <button @click="toggleGrid" class="control-btn">
          <span class="material-icons">{{
            showGrid ? "visibility_off" : "visibility"
          }}</span>
          Grid
        </button>
      </div>
    </div>

    <div v-if="parseError" class="error">
      <strong>Parse Error:</strong> {{ parseError }}
    </div>

    <div class="viewport" ref="viewport"></div>

    <details class="script-source">
      <summary>View ShapeScript Source</summary>
      <pre>{{ selectedResult.data.script }}</pre>
    </details>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from "vue";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import type { ToolResult } from "../types";
import type { Present3DToolData } from "../models/present3D";
import { parseShapeScript } from "../../utils/shapescript/parser";
import { astToThreeJS } from "../../utils/shapescript/toThreeJS";

const props = defineProps<{
  selectedResult: ToolResult<Present3DToolData>;
}>();

// State
const viewport = ref<HTMLDivElement | null>(null);
const parseError = ref<string | null>(null);
const showWireframe = ref(false);
const showGrid = ref(true);

let scene: THREE.Scene;
let camera: THREE.PerspectiveCamera;
let renderer: THREE.WebGLRenderer;
let controls: OrbitControls;
let animationId: number;
let gridHelper: THREE.GridHelper;
let sceneObjects: THREE.Object3D[] = [];

// Lifecycle
onMounted(() => {
  initScene();
  loadShapeScript();
  animate();
});

onUnmounted(() => {
  cleanup();
});

// Watch for script changes
watch(
  () => props.selectedResult.data.script,
  () => {
    loadShapeScript();
  },
);

// Watch for wireframe toggle - reload scene with new setting
watch(showWireframe, () => {
  loadShapeScript();
});

// Watch for grid toggle
watch(showGrid, (value) => {
  if (gridHelper) {
    gridHelper.visible = value;
  }
});

// Methods
function initScene() {
  if (!viewport.value) return;

  // Create scene
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x1a1a1a);

  // Create camera
  const width = viewport.value.clientWidth;
  const height = viewport.value.clientHeight;
  camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 1000);
  camera.position.set(5, 5, 10);
  camera.lookAt(0, 0, 0);

  // Create renderer
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(width, height);
  renderer.setPixelRatio(window.devicePixelRatio);
  viewport.value.appendChild(renderer.domElement);

  // Add controls
  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;

  // Add lights
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
  scene.add(ambientLight);

  const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
  directionalLight.position.set(10, 10, 10);
  scene.add(directionalLight);

  // Add grid helper
  gridHelper = new THREE.GridHelper(20, 20, 0x444444, 0x222222);
  gridHelper.visible = showGrid.value;
  scene.add(gridHelper);

  // Handle window resize
  window.addEventListener("resize", handleResize);
}

function handleResize() {
  if (!viewport.value) return;

  const width = viewport.value.clientWidth;
  const height = viewport.value.clientHeight;

  camera.aspect = width / height;
  camera.updateProjectionMatrix();

  renderer.setSize(width, height);
}

function loadShapeScript() {
  try {
    // Clear previous scene objects
    sceneObjects.forEach((obj) => scene.remove(obj));
    sceneObjects = [];

    // Parse ShapeScript into AST
    const script = props.selectedResult.data.script;
    const ast = parseShapeScript(script);

    // Convert AST to Three.js objects
    const group = astToThreeJS(ast, { wireframe: showWireframe.value });

    // Add to scene
    scene.add(group);
    sceneObjects.push(group);

    parseError.value = null;
  } catch (error) {
    parseError.value =
      error instanceof Error ? error.message : "Unknown error";
    console.error("ShapeScript parse error:", error);
  }
}

function animate() {
  animationId = requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
}

function resetCamera() {
  camera.position.set(5, 5, 10);
  camera.lookAt(0, 0, 0);
  controls.reset();
}

function toggleWireframe() {
  showWireframe.value = !showWireframe.value;
}

function toggleGrid() {
  showGrid.value = !showGrid.value;
}

function cleanup() {
  if (animationId) {
    cancelAnimationFrame(animationId);
  }
  if (renderer) {
    renderer.dispose();
  }
  if (controls) {
    controls.dispose();
  }
  window.removeEventListener("resize", handleResize);
}
</script>

<style scoped>
.present3d-container {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  background: #1a1a1a;
  color: #ffffff;
}

.header {
  padding: 1rem;
  background: #2a2a2a;
  border-bottom: 1px solid #444;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.header h1 {
  margin: 0;
  font-size: 1.5rem;
  font-weight: 600;
}

.controls {
  display: flex;
  gap: 0.5rem;
}

.control-btn {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.5rem 1rem;
  background: #3a3a3a;
  color: #ffffff;
  border: 1px solid #555;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.9rem;
  transition: background 0.2s;
}

.control-btn:hover {
  background: #4a4a4a;
}

.control-btn .material-icons {
  font-size: 1.2rem;
}

.viewport {
  flex: 1;
  min-height: 0;
  position: relative;
}

.error {
  padding: 1rem;
  background: #ff000020;
  color: #ff6666;
  font-family: monospace;
  border-bottom: 1px solid #ff000040;
}

.script-source {
  padding: 1rem;
  background: #00000040;
  border-top: 1px solid #444;
  font-family: monospace;
  font-size: 0.85rem;
}

.script-source summary {
  cursor: pointer;
  user-select: none;
  padding: 0.5rem;
  background: #2a2a2a;
  border-radius: 4px;
}

.script-source summary:hover {
  background: #3a3a3a;
}

.script-source pre {
  margin-top: 1rem;
  padding: 1rem;
  background: #1a1a1a;
  border-radius: 4px;
  overflow-x: auto;
  color: #aaa;
}
</style>
