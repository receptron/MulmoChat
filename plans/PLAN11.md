# PLAN11: 3D Visualization Tool with ShapeScript

## Overview

Implement a new tool plugin (`present3D`) that allows the LLM to present 3D visualizations to users using ShapeScript syntax. This follows the same plugin architecture pattern as the existing `presentDocument` (markdown) tool.

## Goals

1. Enable LLM to create 3D visualizations through natural conversation
2. Support a wide range of use cases: mathematical visualizations, molecular structures, data visualization, geometric demonstrations, architecture, games
3. Maintain token efficiency in LLM output
4. Provide interactive 3D viewing experience (rotate, zoom, pan)
5. Keep implementation simple and maintainable

## Why ShapeScript?

### Advantages

1. **Token Efficient**: Minimal syntax, no quotes for numbers, compact representation
   ```shapescript
   cube { position 1 0 0 color 1 0 0 }
   ```
   vs JSON:
   ```json
   {"type":"cube","position":[1,0,0],"color":"#ff0000"}
   ```

2. **Human-Readable**: Natural language-like syntax that LLMs can easily generate
3. **Powerful**: Supports CSG operations, loops, functions, procedural generation
4. **Well-Designed**: Created by Nick Lockwood specifically for code-based 3D modeling
5. **Documented**: Clear syntax and examples available

### ShapeScript Core Features We'll Support

#### Primitives
- `cube` - Box primitive
- `sphere` - Sphere primitive
- `cylinder` - Cylinder primitive
- `cone` - Cone primitive
- `torus` - Torus/donut primitive (if needed)

#### CSG Operations
- `union` - Merge shapes
- `difference` - Subtract shapes
- `intersection` - Common volume
- `xor` - Exclusive or
- `stencil` - Apply material patterns

#### Transforms
- `position x y z` - Translation
- `rotation x y z` - Rotation (radians)
- `size x y z` - Scale

#### Materials
- `color r g b` - RGB color (0-1 range)
- `opacity value` - Transparency (0-1)
- `texture "path"` - Texture mapping (future)

#### Advanced Features
- `for` loops - Procedural generation
- `define` blocks - Custom reusable components
- `option` - Parameterizable definitions

## Architecture

### Plugin Structure

Following the existing plugin pattern from `src/tools/models/markdown.ts`:

```
src/tools/models/
  └── present3D.ts          # Main plugin implementation

src/tools/views/
  └── present3D.vue         # Full canvas view component

src/tools/previews/
  └── present3D.vue         # Sidebar thumbnail preview

src/utils/
  └── shapescript/
      ├── parser.ts         # ShapeScript parser
      ├── types.ts          # AST type definitions
      └── toThreeJS.ts      # AST → Three.js converter
```

### Data Flow

1. **User request** → LLM generates ShapeScript code
2. **LLM calls** `present3D` function with title + script
3. **Plugin executes** → Parses ShapeScript → Validates
4. **Returns ToolResult** with parsed data
5. **View component** receives result → Converts to Three.js → Renders 3D scene
6. **User interacts** with 3D viewer (orbit controls, zoom, pan)

## API Design

### Tool Definition

```typescript
{
  type: "function",
  name: "present3D",
  description: "Display interactive 3D visualizations using ShapeScript language",
  parameters: {
    type: "object",
    properties: {
      title: {
        type: "string",
        description: "Title for the 3D visualization"
      },
      script: {
        type: "string",
        description: `ShapeScript code defining the 3D scene.

Examples:

Simple sphere:
sphere { color 1 0 0 size 2 }

Multiple objects:
cube { position -2 0 0 color 1 0 0 }
sphere { color 0 1 0 }
cone { position 2 0 0 color 0 0 1 }

Hollow sphere (CSG):
difference {
    sphere { color 1 0.5 0 }
    sphere { size 0.8 }
}

Procedural ring:
for i to 8 {
    cube { position 3 0 0 size 0.5 }
    rotate 0 1/8 0
}

Supported primitives: cube, sphere, cylinder, cone
Supported CSG: union, difference, intersection, xor
Transforms: position, rotation, size
Materials: color, opacity`
      }
    },
    required: ["title", "script"]
  }
}
```

### Tool Result Interface

```typescript
interface Present3DToolData {
  script: string;      // Original ShapeScript code
  ast?: SceneNode;     // Parsed AST (optional, for debugging)
}

interface ToolResult<Present3DToolData> {
  message: string;     // "Created 3D visualization: {title}"
  title: string;
  data: Present3DToolData;
  uuid?: string;       // For potential caching/sharing
  instructions: string; // Follow-up instructions for LLM
}
```

## ShapeScript Parser Design

### AST Structure

```typescript
// Core AST node types
type SceneNode = ShapeNode | CSGNode | BlockNode;

interface ShapeNode {
  type: 'shape';
  primitive: 'cube' | 'sphere' | 'cylinder' | 'cone' | 'torus';
  properties: {
    position?: [number, number, number];
    rotation?: [number, number, number];
    size?: [number, number, number];
    color?: [number, number, number];
    opacity?: number;
  };
  children?: SceneNode[];
}

interface CSGNode {
  type: 'csg';
  operation: 'union' | 'difference' | 'intersection' | 'xor' | 'stencil';
  children: SceneNode[];
}

interface BlockNode {
  type: 'block';
  children: SceneNode[];
}

interface ForLoopNode {
  type: 'for';
  variable: string;
  from: number;
  to: number;
  body: SceneNode[];
}

interface DefineNode {
  type: 'define';
  name: string;
  options: Record<string, any>;
  body: SceneNode[];
}
```

### Parser Implementation Strategy

**Phase 1**: Simple Recursive Descent Parser
- Tokenize input into meaningful chunks
- Parse primitives and properties
- Build AST bottom-up
- Handle nested blocks with recursion

**Phase 2**: Add CSG Support
- Parse CSG operations (union, difference, etc.)
- Maintain shape hierarchy

**Phase 3**: Add Control Flow
- Parse `for` loops
- Parse `define` blocks
- Variable substitution

### Example Parsing

Input:
```shapescript
cube { position -1 0 0 color 1 0 0 }
sphere { color 0 1 0 }
```

Output AST:
```typescript
[
  {
    type: 'shape',
    primitive: 'cube',
    properties: {
      position: [-1, 0, 0],
      color: [1, 0, 0]
    }
  },
  {
    type: 'shape',
    primitive: 'sphere',
    properties: {
      color: [0, 1, 0]
    }
  }
]
```

## Three.js Rendering

### Technology Stack

- **Three.js**: Core 3D rendering engine
- **TresJS** (Optional): Vue 3 integration for declarative 3D
- **OrbitControls**: Camera controls for interaction
- **CSG Library**: For boolean operations (three-bvh-csg or similar)

### AST to Three.js Conversion

```typescript
function astToThreeJS(nodes: SceneNode[]): THREE.Group {
  const group = new THREE.Group();

  for (const node of nodes) {
    const object = convertNode(node);
    if (object) group.add(object);
  }

  return group;
}

function convertNode(node: SceneNode): THREE.Object3D | null {
  switch (node.type) {
    case 'shape':
      return createPrimitive(node);
    case 'csg':
      return createCSG(node);
    case 'block':
      return convertBlock(node);
    default:
      return null;
  }
}

function createPrimitive(node: ShapeNode): THREE.Mesh {
  const geometry = createGeometry(node.primitive);
  const material = createMaterial(node.properties);
  const mesh = new THREE.Mesh(geometry, material);

  if (node.properties.position) {
    mesh.position.set(...node.properties.position);
  }
  if (node.properties.rotation) {
    mesh.rotation.set(...node.properties.rotation);
  }
  if (node.properties.size) {
    mesh.scale.set(...node.properties.size);
  }

  return mesh;
}
```

### CSG Implementation

Options:
1. **three-bvh-csg**: Fast, modern, well-maintained
2. **Three-CSGMesh**: Older but stable
3. **Custom implementation**: For simple cases only

We'll use **three-bvh-csg** for best performance.

## Implementation Phases

### Phase 1: Minimal Viable Product (MVP)
**Goal**: Basic 3D visualization working end-to-end

**Tasks**:
1. Create plugin file `src/tools/models/present3D.ts`
   - Define tool definition
   - Implement basic execute function
   - Return ToolResult with script data

2. Create view component `src/tools/views/present3D.vue`
   - Set up Three.js scene
   - Add OrbitControls
   - Render basic primitives (cube, sphere, cylinder, cone)
   - Parse simple property syntax (position, color, size)

3. Create preview component `src/tools/previews/present3D.vue`
   - Render thumbnail version of 3D scene
   - Static camera angle

4. Register plugin in `src/tools/index.ts`

**Deliverables**:
- LLM can generate simple scenes with primitives
- User can view and interact with 3D scene
- Basic colors and transforms work

**Example**:
```shapescript
cube { position -1 0 0 color 1 0 0 }
sphere { color 0 1 0 }
cone { position 1 0 0 color 0 0 1 }
```

### Phase 2: ShapeScript Parser
**Goal**: Robust parsing of ShapeScript syntax

**Tasks**:
1. Create `src/utils/shapescript/types.ts`
   - Define AST interfaces
   - Type definitions

2. Create `src/utils/shapescript/parser.ts`
   - Tokenizer
   - Recursive descent parser
   - Property parsing (position, rotation, size, color, opacity)
   - Nested block support
   - Error handling with helpful messages

3. Create `src/utils/shapescript/toThreeJS.ts`
   - AST → Three.js converter
   - Geometry creation
   - Material creation
   - Transform application

4. Update view component to use parser
   - Replace ad-hoc parsing with proper parser
   - Add error display for parse errors

**Deliverables**:
- Clean separation: parsing vs rendering
- Better error messages
- Support for nested blocks

### Phase 3: CSG Operations
**Goal**: Support boolean operations for complex shapes

**Tasks**:
1. Install and integrate `three-bvh-csg`
2. Extend parser to handle CSG blocks (difference, union, intersection)
3. Implement CSG node conversion in toThreeJS
4. Add examples to tool description

**Deliverables**:
- LLM can create complex shapes via CSG
- Hollow objects, intersections, subtractions work

**Example**:
```shapescript
difference {
    sphere { color 1 0.5 0 }
    cube { size 1.2 }
}
```

### Phase 4: Advanced Features (Optional)
**Goal**: Procedural generation and reusable components

**Tasks**:
1. Add `for` loop support to parser
2. Add `define` block support
3. Variable substitution
4. Parameter passing

**Deliverables**:
- LLM can generate procedural patterns
- Reusable components via define

**Example**:
```shapescript
for i to 12 {
    cube {
        position 3 0 0
        size 0.3
        color 1 0 0
    }
    rotate 0 1/12 0
}
```

## File Structure

```
src/
├── tools/
│   ├── models/
│   │   └── present3D.ts          # Main plugin
│   ├── views/
│   │   └── present3D.vue         # Full 3D viewer
│   ├── previews/
│   │   └── present3D.vue         # Thumbnail preview
│   └── index.ts                   # Register plugin
│
├── utils/
│   └── shapescript/
│       ├── parser.ts              # ShapeScript → AST
│       ├── types.ts               # AST type definitions
│       └── toThreeJS.ts           # AST → Three.js
│
└── types/
    └── shapescript.d.ts           # Type declarations
```

## Dependencies

### Required
```json
{
  "three": "^0.160.0",
  "@types/three": "^0.160.0"
}
```

### Optional (for TresJS approach)
```json
{
  "@tresjs/core": "^4.0.0",
  "@tresjs/cientos": "^4.0.0"
}
```

### For CSG (Phase 3)
```json
{
  "three-bvh-csg": "^0.0.16"
}
```

## View Component Design

### Structure

```vue
<template>
  <div class="present3d-container">
    <div class="header">
      <h2>{{ result.title }}</h2>
    </div>

    <div class="viewport" ref="viewport">
      <!-- Three.js canvas renders here -->
    </div>

    <div v-if="parseError" class="error">
      {{ parseError }}
    </div>

    <div class="controls">
      <button @click="resetCamera">Reset Camera</button>
      <button @click="toggleWireframe">Wireframe</button>
      <button @click="toggleGrid">Grid</button>
    </div>

    <details class="script-source">
      <summary>View ShapeScript Source</summary>
      <pre>{{ result.data.script }}</pre>
    </details>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { parseShapeScript } from '@/utils/shapescript/parser';
import { astToThreeJS } from '@/utils/shapescript/toThreeJS';

// Props
const props = defineProps<{
  result: ToolResult<Present3DToolData>;
}>();

// State
const viewport = ref<HTMLDivElement | null>(null);
const parseError = ref<string | null>(null);
let scene: THREE.Scene;
let camera: THREE.PerspectiveCamera;
let renderer: THREE.WebGLRenderer;
let controls: OrbitControls;
let animationId: number;

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
watch(() => props.result.data.script, () => {
  loadShapeScript();
});

// Methods
function initScene() {
  // Create scene
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x1a1a1a);

  // Create camera
  camera = new THREE.PerspectiveCamera(
    50,
    viewport.value!.clientWidth / viewport.value!.clientHeight,
    0.1,
    1000
  );
  camera.position.set(5, 5, 10);
  camera.lookAt(0, 0, 0);

  // Create renderer
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(viewport.value!.clientWidth, viewport.value!.clientHeight);
  viewport.value!.appendChild(renderer.domElement);

  // Add controls
  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;

  // Add lights
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
  scene.add(ambientLight);

  const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
  directionalLight.position.set(10, 10, 10);
  scene.add(directionalLight);

  // Add grid helper
  const gridHelper = new THREE.GridHelper(20, 20);
  scene.add(gridHelper);
}

function loadShapeScript() {
  try {
    // Clear previous objects (except lights and helpers)
    const objectsToRemove = scene.children.filter(
      obj => obj.type === 'Mesh' || obj.type === 'Group'
    );
    objectsToRemove.forEach(obj => scene.remove(obj));

    // Parse ShapeScript
    const ast = parseShapeScript(props.result.data.script);

    // Convert to Three.js
    const group = astToThreeJS(ast);
    scene.add(group);

    parseError.value = null;
  } catch (error) {
    parseError.value = error.message;
    console.error('ShapeScript parse error:', error);
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

function cleanup() {
  cancelAnimationFrame(animationId);
  renderer.dispose();
  controls.dispose();
}
</script>

<style scoped>
.present3d-container {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
}

.viewport {
  flex: 1;
  min-height: 0;
  position: relative;
}

.controls {
  padding: 1rem;
  display: flex;
  gap: 0.5rem;
}

.error {
  padding: 1rem;
  background: #ff000020;
  color: #ff6666;
  font-family: monospace;
}

.script-source {
  padding: 1rem;
  background: #00000020;
}
</style>
```

## Preview Component Design

Similar structure but:
- Smaller canvas (200x150px or similar)
- Fixed camera position (no controls)
- Single render (no animation loop)
- Simplified lighting

## Testing Strategy

### Unit Tests
1. **Parser tests** (`parser.test.ts`)
   - Test primitive parsing
   - Test property parsing (position, color, etc.)
   - Test CSG block parsing
   - Test for loop parsing
   - Test error cases (invalid syntax)

2. **AST to Three.js tests** (`toThreeJS.test.ts`)
   - Test primitive creation
   - Test material creation
   - Test transform application
   - Test CSG operations

### Integration Tests
1. Full pipeline: ShapeScript → AST → Three.js → Render
2. Test with example scripts
3. Test error handling

### Manual Testing
1. Test with LLM-generated scripts
2. Test various primitives and combinations
3. Test CSG operations
4. Test performance with complex scenes
5. Test camera controls and interaction

### Example Test Cases

```typescript
describe('ShapeScript Parser', () => {
  test('parses simple sphere', () => {
    const input = 'sphere { color 1 0 0 }';
    const ast = parseShapeScript(input);
    expect(ast).toEqual([
      {
        type: 'shape',
        primitive: 'sphere',
        properties: {
          color: [1, 0, 0]
        }
      }
    ]);
  });

  test('parses CSG difference', () => {
    const input = `
      difference {
        sphere
        cube { size 0.8 }
      }
    `;
    const ast = parseShapeScript(input);
    expect(ast[0].type).toBe('csg');
    expect(ast[0].operation).toBe('difference');
    expect(ast[0].children).toHaveLength(2);
  });
});
```

## Example Conversations

### Example 1: Simple Shapes

**User**: "Show me three colored spheres"

**LLM Response**:
```shapescript
sphere {
    position -2 0 0
    color 1 0 0
    size 1
}

sphere {
    position 0 0 0
    color 0 1 0
    size 1
}

sphere {
    position 2 0 0
    color 0 0 1
    size 1
}
```

### Example 2: CSG Operation

**User**: "Create a sphere with a cube-shaped hole"

**LLM Response**:
```shapescript
difference {
    sphere {
        color 1 0.5 0
        size 2
    }
    cube {
        size 1.5
    }
}
```

### Example 3: Mathematical Visualization

**User**: "Show me a ring of cubes"

**LLM Response**:
```shapescript
for i to 12 {
    cube {
        position 3 0 0
        size 0.4
        color 0.5 0.5 1
    }
    rotate 0 1/12 0
}
```

### Example 4: Molecular Structure

**User**: "Show me a simple water molecule structure"

**LLM Response**:
```shapescript
// Oxygen atom (red)
sphere {
    position 0 0 0
    color 1 0 0
    size 0.5
}

// Hydrogen atom 1 (white)
sphere {
    position 0.8 0.6 0
    color 1 1 1
    size 0.3
}

// Hydrogen atom 2 (white)
sphere {
    position 0.8 -0.6 0
    color 1 1 1
    size 0.3
}

// Bonds (cylinders)
cylinder {
    position 0.4 0.3 0
    rotation 0 0 0.8
    size 0.05 0.9 0.05
    color 0.8 0.8 0.8
}

cylinder {
    position 0.4 -0.3 0
    rotation 0 0 -0.8
    size 0.05 0.9 0.05
    color 0.8 0.8 0.8
}
```

## System Prompt Addition

Add to the plugin's `systemPrompt`:

```typescript
systemPrompt: `Use the present3D tool to create interactive 3D visualizations when the user requests:
- 3D models or shapes
- Mathematical visualizations (surfaces, functions, geometric patterns)
- Molecular or atomic structures
- Data visualization in 3D (scatter plots, surface plots)
- Architectural layouts
- Game boards or 3D game states
- Any spatial or geometric concepts

Use ShapeScript syntax which is concise and readable:
- Primitives: cube, sphere, cylinder, cone
- Properties: position, rotation, size, color, opacity
- CSG operations: difference, union, intersection for complex shapes
- Loops: for i to N { ... } for procedural patterns
- Colors use RGB 0-1 range: color 1 0 0 for red

Examples:
Simple: sphere { color 1 0 0 size 2 }
Multiple: cube { position -1 0 0 } sphere { position 1 0 0 }
Hollow: difference { sphere { size 2 } sphere { size 1.8 } }
Pattern: for i to 8 { cube { position 3 0 0 } rotate 0 1/8 0 }`,
```

## Performance Considerations

1. **Parser Performance**
   - Cache parsed AST if script hasn't changed
   - Use efficient string operations
   - Avoid unnecessary regex

2. **Rendering Performance**
   - Use BufferGeometry instead of Geometry
   - Implement LOD (Level of Detail) for complex scenes
   - Frustum culling for large scenes
   - Instancing for repeated objects

3. **CSG Performance**
   - CSG operations can be slow for high-poly meshes
   - Use lower detail settings for CSG operands
   - Consider showing "Computing..." message for complex CSG

## Error Handling

1. **Parse Errors**
   - Show line number and helpful message
   - Suggest corrections if possible
   - Fall back to displaying error without crashing

2. **Runtime Errors**
   - Catch WebGL errors gracefully
   - Handle unsupported features
   - Validate property values (color 0-1, etc.)

3. **LLM Feedback**
   - If parse fails, send error back to LLM in instructions
   - LLM can retry with corrected syntax

## Future Enhancements

### Phase 5+
1. **Textures**: Support for image textures
2. **Animations**: Built-in rotation, oscillation, paths
3. **Lighting Control**: Custom lights in ShapeScript
4. **Export**: Export to glTF, OBJ, STL formats
5. **Import**: Load external models
6. **Physics**: Simple physics simulation
7. **VR Support**: WebXR for VR viewing
8. **Collaborative**: Share 3D scenes via URL
9. **Screenshots**: Capture rendered view
10. **Advanced Materials**: PBR materials, environment maps

### Integration Ideas
1. **Image Generation Integration**: Generate textures with Gemini
2. **Code Execution**: Generate ShapeScript via code execution
3. **Data Visualization**: Convert CSV/JSON data to 3D plots
4. **Math Expression**: Parse mathematical expressions for surfaces

## Success Metrics

1. **Functional**
   - LLM can successfully generate valid ShapeScript
   - 95%+ of generated scripts parse correctly
   - All primitives render correctly
   - CSG operations work reliably

2. **Performance**
   - Parser handles 1000+ line scripts < 100ms
   - Scene renders at 60fps for typical use cases
   - CSG operations complete < 1s for simple shapes

3. **User Experience**
   - Smooth camera controls
   - Intuitive interaction
   - Clear error messages
   - Fast load times

4. **Token Efficiency**
   - 30-50% fewer tokens vs JSON for equivalent scenes
   - LLM generates compact, readable scripts

## Open Questions

1. **Parser Library**: Write custom parser or use existing (PEG.js, Nearley)?
   - **Recommendation**: Start custom (simple recursive descent), consider library if complexity grows

2. **TresJS vs Raw Three.js**: Use Vue 3 integration or raw Three.js?
   - **Recommendation**: Start with raw Three.js for control, consider TresJS in Phase 5

3. **CSG Library**: three-bvh-csg vs alternatives?
   - **Recommendation**: three-bvh-csg (actively maintained, good performance)

4. **Default Camera Position**: Where to position camera by default?
   - **Recommendation**: (5, 5, 10) looking at origin, auto-fit to scene bounds

5. **Coordinate System**: Y-up or Z-up?
   - **Recommendation**: Y-up (Three.js default, matches ShapeScript)

## Timeline Estimate

- **Phase 1 (MVP)**: 2-3 days
  - Day 1: Plugin setup, basic view component
  - Day 2: Three.js integration, basic primitives
  - Day 3: Testing, refinement

- **Phase 2 (Parser)**: 2-3 days
  - Day 1: Parser design and tokenizer
  - Day 2: Parser implementation
  - Day 3: AST to Three.js converter

- **Phase 3 (CSG)**: 1-2 days
  - Day 1: CSG library integration
  - Day 2: Testing and examples

- **Phase 4 (Advanced)**: 2-3 days
  - Day 1-2: For loops and define blocks
  - Day 3: Testing and documentation

**Total**: 7-11 days for full implementation

## References

- [ShapeScript Official Site](https://shapescript.info/)
- [ShapeScript GitHub](https://github.com/nicklockwood/ShapeScript)
- [Three.js Documentation](https://threejs.org/docs/)
- [three-bvh-csg](https://github.com/gkjohnson/three-bvh-csg)
- [TresJS](https://tresjs.org/)

## Test Prompts

Comprehensive list of test prompts organized by complexity and use case.

### Level 1: Basic Primitives

1. "Show me a red cube"
2. "Display a blue sphere"
3. "Create a green cylinder"
4. "Show me a yellow cone"
5. "Display a purple torus"
6. "Show me a large orange sphere"
7. "Create a small white cube"

### Level 2: Multiple Objects

8. "Show me three spheres in a row"
9. "Display a cube, sphere, and cone next to each other"
10. "Create a row of colored cubes: red, green, and blue"
11. "Show me five spheres of different colors"
12. "Display cubes arranged in a triangle formation"
13. "Create a pyramid structure with spheres"

### Level 3: Positioning and Transforms

14. "Show me a cube floating above a sphere"
15. "Create two spheres: one large at the center, one small above it"
16. "Display three cylinders at different heights"
17. "Show me cubes arranged in a 3x3 grid pattern"
18. "Create a tilted cube"
19. "Show me a rotated cylinder"
20. "Display a sphere with a cube orbiting around it"

### Level 4: CSG Operations - Difference

21. "Show me a cube with a spherical hole"
22. "Create a sphere with a cube-shaped hole"
23. "Display a hollow sphere"
24. "Show me a cylinder with a cylindrical hole through it"
25. "Create a cube with a cross-shaped hole"
26. "Display a donut shape using CSG"
27. "Show me a cube with multiple spherical indentations"

### Level 5: CSG Operations - Union and Intersection

28. "Show me two overlapping spheres merged together"
29. "Create a dumbbell shape using union"
30. "Display the intersection of a cube and sphere"
31. "Show me a rounded cube (intersection of sphere and cube)"
32. "Create a shape from three merged cylinders"
33. "Display overlapping cubes forming a cross"

### Level 6: Procedural Patterns - Rings

34. "Show me a ring of cubes"
35. "Create a circle of spheres"
36. "Display 8 cylinders arranged in a ring"
37. "Show me a ring of 12 colored cubes"
38. "Create a ring of cones pointing outward"
39. "Display a double ring pattern"

### Level 7: Procedural Patterns - Complex

40. "Show me a spiral of spheres"
41. "Create a helix pattern with cubes"
42. "Display a flower pattern using cylinders"
43. "Show me a radial burst pattern"
44. "Create concentric rings of different colored spheres"
45. "Display a starburst pattern with 16 rays"

### Level 8: Molecular Structures

46. "Show me a water molecule (H2O)"
47. "Display a methane molecule (CH4)"
48. "Create a carbon dioxide molecule (CO2)"
49. "Show me a simple ammonia molecule (NH3)"
50. "Display a benzene ring structure"
51. "Create a DNA double helix segment"
52. "Show me a simple protein alpha helix"

### Level 9: Geometric Visualizations

53. "Show me the Platonic solids"
54. "Display a tesseract (4D cube) projection"
55. "Create a Fibonacci spiral in 3D"
56. "Show me a Klein bottle approximation"
57. "Display a Möbius strip"
58. "Create a torus knot"
59. "Show me a fractal-like structure"

### Level 10: Architectural Structures

60. "Show me a simple house structure"
61. "Create a bridge with support pillars"
62. "Display a tower structure"
63. "Show me a simple building with windows"
64. "Create a pyramid with steps"
65. "Display an arch structure"
66. "Show me a simple temple with columns"

### Level 11: Game Boards and Pieces

67. "Show me a chess board"
68. "Create a tic-tac-toe board in 3D"
69. "Display a simple game die (cube with dots)"
70. "Show me a checkers board"
71. "Create a Rubik's cube structure"
72. "Display a simple maze layout"

### Level 12: Data Visualization

73. "Show me a bar chart in 3D with values: 5, 8, 3, 9, 2"
74. "Create a scatter plot with 10 random points"
75. "Display a 3D pie chart with three segments"
76. "Show me a stacked bar chart"
77. "Create a 3D histogram"
78. "Display a surface plot approximation"

### Level 13: Mechanical Parts

79. "Show me a simple gear wheel"
80. "Create a bolt and nut"
81. "Display a pulley system"
82. "Show me a simple spring coil"
83. "Create a bearing structure"
84. "Display interlocking gears"

### Level 14: Natural Forms

85. "Show me a simple tree structure"
86. "Create a snowflake pattern"
87. "Display a flower with petals"
88. "Show me a simple crystal structure"
89. "Create a honeycomb pattern"
90. "Display a shell spiral"

### Level 15: Abstract Art

91. "Create an abstract sculpture with geometric shapes"
92. "Show me a balanced composition of spheres and cubes"
93. "Display a minimalist geometric artwork"
94. "Create a deconstructed cube sculpture"
95. "Show me an impossible geometry structure"
96. "Display a modern art installation concept"

### Level 16: Educational Models

97. "Show me a model of planetary orbits"
98. "Create a simple atom model with electron shells"
99. "Display the solar system inner planets"
100. "Show me a model of crystal lattice structure"
101. "Create a visualization of a sound wave"
102. "Display a model of magnetic field lines"

### Edge Cases and Stress Tests

103. "Show me a single point (very small sphere)"
104. "Create 100 tiny spheres in random positions"
105. "Display nested CSG operations (cube with sphere hole with cube hole)"
106. "Show me extremely large and extremely small objects together"
107. "Create overlapping transparent spheres"
108. "Display objects with very thin dimensions"
109. "Show me a complex multi-level CSG operation"
110. "Create a scene with all primitive types at once"

### Opacity and Transparency

111. "Show me a semi-transparent cube"
112. "Create overlapping transparent spheres of different colors"
113. "Display a glass-like sphere"
114. "Show me transparent and opaque objects together"
115. "Create a ghost-like translucent shape"

### Color Gradients and Materials

116. "Show me spheres in rainbow colors"
117. "Create a gradient effect with multiple cubes"
118. "Display warm-colored vs cool-colored shapes"
119. "Show me grayscale objects"
120. "Create a monochromatic composition"

### Combined Complexity

121. "Create a complex cityscape with buildings"
122. "Show me a robot made from geometric shapes"
123. "Display a spacecraft design"
124. "Create a fantasy castle structure"
125. "Show me a vehicle made from basic shapes"
126. "Display a character face using geometric primitives"
127. "Create a musical instrument (like a guitar) from shapes"
128. "Show me a solar panel array"
129. "Display a bridge spanning across a gap"
130. "Create an artistic interpretation of a tornado"

### Error Recovery Tests

131. "Show me something 3D" (vague request - should generate something valid)
132. "Create a visualization of happiness" (abstract concept)
133. "Display the concept of infinity" (abstract)
134. "Show me the fourth dimension" (conceptual challenge)
135. "Create a visualization of time"

### Performance Tests

136. "Show me 50 spheres arranged in a grid"
137. "Create 20 rings of cubes"
138. "Display 100 small objects"
139. "Show me a highly detailed structure with many parts"
140. "Create a complex nested CSG with 5+ operations"

## Conclusion

This plan provides a clear path to implementing 3D visualization capabilities in MulmoChat using ShapeScript syntax. The phased approach allows for incremental delivery of value while maintaining code quality and user experience. ShapeScript's design makes it ideal for LLM-generated content, balancing simplicity with power.
