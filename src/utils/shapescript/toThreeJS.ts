import * as THREE from "three";
import {
  Brush,
  Evaluator,
  ADDITION,
  SUBTRACTION,
  INTERSECTION,
} from "three-bvh-csg";
import {
  SceneNode,
  ShapeNode,
  CSGNode,
  ForLoopNode,
  Vector3,
  Color,
} from "./types";

export interface ConversionOptions {
  wireframe?: boolean;
}

export class Converter {
  private options: ConversionOptions;

  constructor(options: ConversionOptions = {}) {
    this.options = options;
  }

  convert(nodes: SceneNode[]): THREE.Group {
    const group = new THREE.Group();

    for (const node of nodes) {
      const object = this.convertNode(node);
      if (object) {
        group.add(object);
      }
    }

    return group;
  }

  private convertNode(node: SceneNode): THREE.Object3D | null {
    switch (node.type) {
      case "shape":
        return this.convertShape(node);
      case "csg":
        return this.convertCSG(node);
      case "block":
        return this.convertBlock(node);
      case "for":
        return this.convertForLoop(node);
      default:
        console.warn(`Unknown node type:`, node);
        return null;
    }
  }

  private convertBlock(node: { children: SceneNode[] }): THREE.Group {
    const group = new THREE.Group();

    for (const child of node.children) {
      const object = this.convertNode(child);
      if (object) {
        group.add(object);
      }
    }

    return group;
  }

  private convertShape(node: ShapeNode): THREE.Mesh {
    const geometry = this.createGeometry(node);
    const material = this.createMaterial(node);
    const mesh = new THREE.Mesh(geometry, material);

    // Apply transforms
    if (node.properties.position) {
      mesh.position.set(...node.properties.position);
    }

    if (node.properties.rotation) {
      mesh.rotation.set(...node.properties.rotation);
    }

    // Note: size is already baked into geometry, don't apply as scale

    return mesh;
  }

  private createGeometry(node: ShapeNode): THREE.BufferGeometry {
    let size = node.properties.size || [1, 1, 1];

    // If only one dimension specified (others are 0), make it uniform
    if (size[1] === 0 && size[2] === 0 && size[0] !== 0) {
      size = [size[0], size[0], size[0]];
    }

    switch (node.primitive) {
      case "cube":
        return new THREE.BoxGeometry(size[0], size[1], size[2]);

      case "sphere":
        return new THREE.SphereGeometry(size[0], 32, 32);

      case "cylinder": {
        const radiusTop = node.properties.radiusTop ?? size[0];
        const radiusBottom = node.properties.radiusBottom ?? size[0];
        const height = node.properties.height ?? size[1];
        return new THREE.CylinderGeometry(radiusTop, radiusBottom, height, 32);
      }

      case "cone": {
        const radius = size[0];
        const height = node.properties.height ?? size[1];
        return new THREE.ConeGeometry(radius, height, 32);
      }

      case "torus": {
        const outerRadius = node.properties.outerRadius ?? size[0];
        const innerRadius = node.properties.innerRadius ?? 0.4;
        return new THREE.TorusGeometry(outerRadius, innerRadius, 16, 32);
      }

      default:
        console.warn(`Unknown primitive: ${node.primitive}`);
        return new THREE.BoxGeometry(1, 1, 1);
    }
  }

  private createMaterial(node: ShapeNode): THREE.Material {
    const color = node.properties.color
      ? new THREE.Color(
          node.properties.color[0],
          node.properties.color[1],
          node.properties.color[2],
        )
      : new THREE.Color(0.8, 0.8, 0.8);

    const opacity = node.properties.opacity ?? 1;
    const transparent = opacity < 1;

    return new THREE.MeshStandardMaterial({
      color,
      opacity,
      transparent,
      wireframe: this.options.wireframe ?? false,
    });
  }

  private convertCSG(node: CSGNode): THREE.Object3D {
    if (node.children.length === 0) {
      console.warn("CSG node has no children");
      return new THREE.Group();
    }

    try {
      const evaluator = new Evaluator();

      // Convert all children to meshes
      const meshes: THREE.Mesh[] = [];
      for (const child of node.children) {
        const object = this.convertNode(child);
        if (object instanceof THREE.Mesh) {
          // Clone the mesh to avoid modifying the original
          const clonedMesh = object.clone();
          clonedMesh.updateMatrixWorld(true);
          meshes.push(clonedMesh);
        } else if (object instanceof THREE.Group) {
          // Extract meshes from group
          object.traverse((obj) => {
            if (obj instanceof THREE.Mesh) {
              const clonedMesh = obj.clone();
              clonedMesh.updateMatrixWorld(true);
              meshes.push(clonedMesh);
            }
          });
        }
      }

      if (meshes.length === 0) {
        console.warn("CSG node has no valid meshes");
        return new THREE.Group();
      }

      // Convert meshes to Brushes with materials
      const brushes = meshes.map((mesh) => {
        const brush = new Brush(mesh.geometry, mesh.material);
        brush.position.copy(mesh.position);
        brush.rotation.copy(mesh.rotation);
        brush.scale.copy(mesh.scale);
        brush.updateMatrixWorld(true);
        return brush;
      });

      // Perform CSG operation
      let result = brushes[0];

      for (let i = 1; i < brushes.length; i++) {
        const brush = brushes[i];

        switch (node.operation) {
          case "union":
            result = evaluator.evaluate(result, brush, ADDITION);
            break;
          case "difference":
            result = evaluator.evaluate(result, brush, SUBTRACTION);
            break;
          case "intersection":
            result = evaluator.evaluate(result, brush, INTERSECTION);
            break;
          case "xor":
            // XOR = (A - B) + (B - A)
            const aMinusB = evaluator.evaluate(
              result.clone(),
              brush.clone(),
              SUBTRACTION,
            );
            const bMinusA = evaluator.evaluate(
              brush.clone(),
              result.clone(),
              SUBTRACTION,
            );
            result = evaluator.evaluate(aMinusB, bMinusA, ADDITION);
            break;
          case "stencil":
            // Stencil keeps shape of first but uses material of intersection
            result = evaluator.evaluate(result, brush, INTERSECTION);
            break;
          default:
            console.warn(`Unknown CSG operation: ${node.operation}`);
        }
      }

      // Ensure the result has a proper material
      if (!result.material) {
        result.material = brushes[0].material;
      }

      // Update matrix world one final time
      result.updateMatrixWorld(true);

      return result;
    } catch (error) {
      console.error("CSG operation failed:", error);
      // Return original shapes as a group if CSG fails
      const fallbackGroup = new THREE.Group();
      for (const child of node.children) {
        const object = this.convertNode(child);
        if (object) {
          fallbackGroup.add(object);
        }
      }
      return fallbackGroup;
    }
  }

  private convertForLoop(node: ForLoopNode): THREE.Group {
    const group = new THREE.Group();

    const from = node.from;
    const to = node.to;
    const step = node.step ?? 1;

    for (let i = from; i <= to; i += step) {
      // Create a sub-group for this iteration
      const iterationGroup = new THREE.Group();

      // Convert body nodes
      for (const bodyNode of node.body) {
        const object = this.convertNode(bodyNode);
        if (object) {
          iterationGroup.add(object);
        }
      }

      // Apply rotation for circular patterns
      // This is a common use case: rotating objects around origin
      // The rotation is calculated as a fraction of a full circle
      if (to > from) {
        const fraction = (i - from) / (to - from + 1);
        const angle = fraction * Math.PI * 2;
        iterationGroup.rotation.y = angle;
      }

      group.add(iterationGroup);
    }

    return group;
  }
}

// Main export function
export function astToThreeJS(
  nodes: SceneNode[],
  options: ConversionOptions = {},
): THREE.Group {
  const converter = new Converter(options);
  return converter.convert(nodes);
}
