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

// Watch for wireframe toggle
watch(showWireframe, (value) => {
  sceneObjects.forEach((obj) => {
    if (obj instanceof THREE.Mesh && obj.material) {
      const material = obj.material as THREE.MeshStandardMaterial;
      material.wireframe = value;
    }
  });
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

    // Parse ShapeScript
    const script = props.selectedResult.data.script;
    const objects = parseShapeScript(script);

    // Add objects to scene
    objects.forEach((obj) => {
      scene.add(obj);
      sceneObjects.push(obj);
    });

    parseError.value = null;
  } catch (error) {
    parseError.value =
      error instanceof Error ? error.message : "Unknown error";
    console.error("ShapeScript parse error:", error);
  }
}

// Simple ShapeScript parser (MVP - Phase 1)
function parseShapeScript(script: string): THREE.Object3D[] {
  const objects: THREE.Object3D[] = [];

  // Simple regex-based parser for MVP
  // Matches: primitive { property value property value ... }
  const primitiveRegex = /(cube|sphere|cylinder|cone)\s*\{([^}]*)\}/g;

  let match;
  while ((match = primitiveRegex.exec(script)) !== null) {
    const primitiveType = match[1];
    const propertiesStr = match[2];

    const properties = parseProperties(propertiesStr);
    const mesh = createPrimitive(primitiveType, properties);

    if (mesh) {
      objects.push(mesh);
    }
  }

  return objects;
}

function parseProperties(propertiesStr: string): Record<string, any> {
  const properties: Record<string, any> = {};

  // Parse position X Y Z
  const positionMatch = propertiesStr.match(/position\s+([-\d.]+)(?:\s+([-\d.]+))?(?:\s+([-\d.]+))?/);
  if (positionMatch) {
    properties.position = [
      parseFloat(positionMatch[1]),
      parseFloat(positionMatch[2] || "0"),
      parseFloat(positionMatch[3] || "0")
    ];
  }

  // Parse rotation X Y Z (in radians)
  const rotationMatch = propertiesStr.match(/rotation\s+([-\d.]+)(?:\s+([-\d.]+))?(?:\s+([-\d.]+))?/);
  if (rotationMatch) {
    properties.rotation = [
      parseFloat(rotationMatch[1]),
      parseFloat(rotationMatch[2] || "0"),
      parseFloat(rotationMatch[3] || "0")
    ];
  }

  // Parse size X Y Z
  const sizeMatch = propertiesStr.match(/size\s+([-\d.]+)(?:\s+([-\d.]+))?(?:\s+([-\d.]+))?/);
  if (sizeMatch) {
    const s1 = parseFloat(sizeMatch[1]);
    const s2 = parseFloat(sizeMatch[2] || sizeMatch[1]);
    const s3 = parseFloat(sizeMatch[3] || sizeMatch[1]);
    properties.size = [s1, s2, s3];
  }

  // Parse color R G B (0-1 range)
  const colorMatch = propertiesStr.match(/color\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)/);
  if (colorMatch) {
    properties.color = [
      parseFloat(colorMatch[1]),
      parseFloat(colorMatch[2]),
      parseFloat(colorMatch[3])
    ];
  }

  // Parse opacity
  const opacityMatch = propertiesStr.match(/opacity\s+([\d.]+)/);
  if (opacityMatch) {
    properties.opacity = parseFloat(opacityMatch[1]);
  }

  return properties;
}

function createPrimitive(
  type: string,
  properties: Record<string, any>
): THREE.Mesh | null {
  let geometry: THREE.BufferGeometry;

  // Default size
  const size = properties.size || [1, 1, 1];

  // Create geometry based on type
  switch (type) {
    case "cube":
      geometry = new THREE.BoxGeometry(size[0], size[1], size[2]);
      break;
    case "sphere":
      geometry = new THREE.SphereGeometry(size[0], 32, 32);
      break;
    case "cylinder":
      geometry = new THREE.CylinderGeometry(size[0], size[0], size[1], 32);
      break;
    case "cone":
      geometry = new THREE.ConeGeometry(size[0], size[1], 32);
      break;
    default:
      console.warn(`Unknown primitive type: ${type}`);
      return null;
  }

  // Create material
  const color = properties.color
    ? new THREE.Color(properties.color[0], properties.color[1], properties.color[2])
    : new THREE.Color(0.8, 0.8, 0.8);

  const material = new THREE.MeshStandardMaterial({
    color,
    opacity: properties.opacity !== undefined ? properties.opacity : 1,
    transparent: properties.opacity !== undefined && properties.opacity < 1,
    wireframe: showWireframe.value,
  });

  const mesh = new THREE.Mesh(geometry, material);

  // Apply transforms
  if (properties.position) {
    mesh.position.set(
      properties.position[0],
      properties.position[1],
      properties.position[2]
    );
  }

  if (properties.rotation) {
    mesh.rotation.set(
      properties.rotation[0],
      properties.rotation[1],
      properties.rotation[2]
    );
  }

  return mesh;
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
