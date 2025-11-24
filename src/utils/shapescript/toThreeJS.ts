import * as THREE from "three";
import {
  Brush,
  Evaluator as CSGEvaluator,
  ADDITION,
  SUBTRACTION,
  INTERSECTION,
} from "three-bvh-csg";
import {
  SceneNode,
  ShapeNode,
  CSGNode,
  ForLoopNode,
  IfNode,
  SwitchNode,
  DefineNode,
  Expression,
  Vector3,
  Color,
} from "./types";
import { Evaluator, SymbolTable } from "./evaluator";

export interface ConversionOptions {
  wireframe?: boolean;
}

export class Converter {
  private options: ConversionOptions;
  private evaluator: Evaluator;
  private symbols: SymbolTable;

  constructor(options: ConversionOptions = {}) {
    this.options = options;
    this.symbols = new SymbolTable();
    this.evaluator = new Evaluator(this.symbols);
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
      case "if":
        return this.convertIf(node);
      case "switch":
        return this.convertSwitch(node);
      case "define":
        this.handleDefine(node);
        return null; // Define doesn't create geometry
      default:
        return null;
    }
  }

  private convertBlock(node: { children: SceneNode[] }): THREE.Group {
    const group = new THREE.Group();

    // Create new scope for block
    this.symbols.pushScope();

    for (const child of node.children) {
      const object = this.convertNode(child);
      if (object) {
        group.add(object);
      }
    }

    // Pop scope
    this.symbols.popScope();

    return group;
  }

  private convertShape(node: ShapeNode): THREE.Mesh {
    const geometry = this.createGeometry(node);
    const material = this.createMaterial(node);
    const mesh = new THREE.Mesh(geometry, material);

    // Apply transforms (evaluate expressions)
    if (node.properties.position) {
      const pos = this.evaluateVector3(node.properties.position);
      mesh.position.set(...pos);
    }

    if (node.properties.rotation) {
      const rot = this.evaluateVector3(node.properties.rotation);
      mesh.rotation.set(...rot);
    }

    // Note: size is already baked into geometry, don't apply as scale

    return mesh;
  }

  private createGeometry(node: ShapeNode): THREE.BufferGeometry {
    let size: Vector3 = [1, 1, 1];

    if (node.properties.size) {
      size = this.evaluateVector3(node.properties.size);
    }

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
        const radiusTop = node.properties.radiusTop
          ? this.evaluateNumber(node.properties.radiusTop)
          : size[0];
        const radiusBottom = node.properties.radiusBottom
          ? this.evaluateNumber(node.properties.radiusBottom)
          : size[0];
        const height = node.properties.height
          ? this.evaluateNumber(node.properties.height)
          : size[1];
        return new THREE.CylinderGeometry(radiusTop, radiusBottom, height, 32);
      }

      case "cone": {
        const radius = size[0];
        const height = node.properties.height
          ? this.evaluateNumber(node.properties.height)
          : size[1];
        return new THREE.ConeGeometry(radius, height, 32);
      }

      case "torus": {
        const outerRadius = node.properties.outerRadius
          ? this.evaluateNumber(node.properties.outerRadius)
          : size[0];
        const innerRadius = node.properties.innerRadius
          ? this.evaluateNumber(node.properties.innerRadius)
          : 0.4;
        return new THREE.TorusGeometry(outerRadius, innerRadius, 16, 32);
      }

      default:
        return new THREE.BoxGeometry(1, 1, 1);
    }
  }

  private createMaterial(node: ShapeNode): THREE.Material {
    const color = node.properties.color
      ? this.evaluateColor(node.properties.color)
      : [0.8, 0.8, 0.8];

    const threeColor = new THREE.Color(color[0], color[1], color[2]);

    const opacity = node.properties.opacity
      ? this.evaluateNumber(node.properties.opacity)
      : 1;
    const transparent = opacity < 1;

    return new THREE.MeshStandardMaterial({
      color: threeColor,
      opacity,
      transparent,
      wireframe: this.options.wireframe ?? false,
    });
  }

  private convertCSG(node: CSGNode): THREE.Object3D {
    if (node.children.length === 0) {
      return new THREE.Group();
    }

    try {
      const csgEvaluator = new CSGEvaluator();

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
            result = csgEvaluator.evaluate(result, brush, ADDITION);
            break;
          case "difference":
            result = csgEvaluator.evaluate(result, brush, SUBTRACTION);
            break;
          case "intersection":
            result = csgEvaluator.evaluate(result, brush, INTERSECTION);
            break;
          case "xor": {
            // XOR = (A - B) + (B - A)
            const aMinusB = csgEvaluator.evaluate(
              result.clone(),
              brush.clone(),
              SUBTRACTION,
            );
            const bMinusA = csgEvaluator.evaluate(
              brush.clone(),
              result.clone(),
              SUBTRACTION,
            );
            result = csgEvaluator.evaluate(aMinusB, bMinusA, ADDITION);
            break;
          }
          case "stencil":
            // Stencil keeps shape of first but 'paints' the intersecting areas
            result = csgEvaluator.evaluate(result, brush, INTERSECTION);
            break;
        }
      }

      // Ensure the result has a proper material
      if (!result.material) {
        result.material = brushes[0].material;
      }

      // Update matrix world one final time
      result.updateMatrixWorld(true);

      return result;
    } catch {
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

    // Create new scope for loop
    this.symbols.pushScope();

    // Check if it's a values iteration or range iteration
    if (node.iterableValues) {
      // for i in values
      const values = this.evaluator.evaluate(node.iterableValues);
      const valueArray = Array.isArray(values) ? values : [values];

      for (let idx = 0; idx < valueArray.length; idx++) {
        this.symbols.set(node.variable, valueArray[idx]);

        // Convert body nodes
        for (const bodyNode of node.body) {
          const object = this.convertNode(bodyNode);
          if (object) {
            group.add(object);
          }
        }
      }
    } else {
      // for i in from to to
      const from = this.evaluateNumber(node.from);
      const to = this.evaluateNumber(node.to);
      const step = node.step ? this.evaluateNumber(node.step) : 1;

      // Determine iteration direction
      const iterations: number[] = [];
      if (step > 0) {
        for (let i = from; i <= to; i += step) {
          iterations.push(i);
        }
      } else if (step < 0) {
        for (let i = from; i >= to; i += step) {
          iterations.push(i);
        }
      }

      for (let idx = 0; idx < iterations.length; idx++) {
        const i = iterations[idx];
        this.symbols.set(node.variable, i);

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
        // This maintains compatibility with the old behavior
        if (iterations.length > 1) {
          const fraction = idx / iterations.length;
          const angle = fraction * Math.PI * 2;
          iterationGroup.rotation.y = angle;
        }

        group.add(iterationGroup);
      }
    }

    // Pop scope
    this.symbols.popScope();

    return group;
  }

  private convertIf(node: IfNode): THREE.Group {
    const group = new THREE.Group();

    // Evaluate condition
    const condition = this.evaluator.evaluateToBoolean(node.condition);

    // Create new scope
    this.symbols.pushScope();

    if (condition) {
      // Execute then body
      for (const child of node.thenBody) {
        const object = this.convertNode(child);
        if (object) {
          group.add(object);
        }
      }
    } else if (node.elseBody) {
      // Execute else body
      for (const child of node.elseBody) {
        const object = this.convertNode(child);
        if (object) {
          group.add(object);
        }
      }
    }

    // Pop scope
    this.symbols.popScope();

    return group;
  }

  private convertSwitch(node: SwitchNode): THREE.Group {
    const group = new THREE.Group();

    // Evaluate switch value
    const switchValue = this.evaluator.evaluate(node.value);

    // Create new scope
    this.symbols.pushScope();

    let matched = false;

    // Check each case
    for (const caseNode of node.cases) {
      for (const caseValue of caseNode.values) {
        const evalCaseValue = this.evaluator.evaluate(caseValue);

        // Simple equality check
        if (this.valuesEqual(switchValue, evalCaseValue)) {
          // Execute case body
          for (const child of caseNode.body) {
            const object = this.convertNode(child);
            if (object) {
              group.add(object);
            }
          }
          matched = true;
          break;
        }
      }

      if (matched) break;
    }

    // If no case matched, execute default case
    if (!matched && node.defaultCase) {
      for (const child of node.defaultCase) {
        const object = this.convertNode(child);
        if (object) {
          group.add(object);
        }
      }
    }

    // Pop scope
    this.symbols.popScope();

    return group;
  }

  private handleDefine(node: DefineNode): void {
    const value = this.evaluator.evaluate(node.value);
    this.symbols.set(node.name, value);
  }

  // Helper methods

  private evaluateNumber(value: number | Expression | undefined): number {
    if (value === undefined) return 0;
    if (typeof value === "number") return value;
    return this.evaluator.evaluateToNumber(value);
  }

  private evaluateVector3(value: Vector3 | Expression | undefined): Vector3 {
    if (value === undefined) return [0, 0, 0];
    if (Array.isArray(value) && typeof value[0] === "number") {
      return value as Vector3;
    }
    return this.evaluator.evaluateToVector3(value as Expression);
  }

  private evaluateColor(value: Color | Expression | undefined): Color {
    if (value === undefined) return [0.8, 0.8, 0.8];
    if (Array.isArray(value) && typeof value[0] === "number") {
      return value as Color;
    }
    return this.evaluator.evaluateToColor(value as Expression);
  }

  private valuesEqual(a: any, b: any): boolean {
    if (typeof a !== typeof b) return false;
    if (Array.isArray(a) && Array.isArray(b)) {
      if (a.length !== b.length) return false;
      for (let i = 0; i < a.length; i++) {
        if (!this.valuesEqual(a[i], b[i])) return false;
      }
      return true;
    }
    return a === b;
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
