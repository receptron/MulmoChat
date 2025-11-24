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
  ExtrudeNode,
  LatheNode,
  LoftNode,
  FillNode,
  HullNode,
  DetailNode,
  PathNode,
  PathCommand,
  CustomShapeNode,
  ColorNode,
  RotateNode,
  TranslateNode,
  ScaleNode,
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
  private detailLevel: number = 32; // Default detail level for curved shapes

  // Transform state stack for relative transforms
  private transformStack: {
    position: THREE.Vector3;
    rotation: THREE.Euler;
    scale: THREE.Vector3;
    color?: THREE.Color;
  }[] = [];

  constructor(options: ConversionOptions = {}) {
    this.options = options;
    this.symbols = new SymbolTable();
    this.evaluator = new Evaluator(this.symbols);
    // Initialize with identity transform
    this.pushTransform();
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
      case "extrude":
        return this.convertExtrude(node);
      case "loft":
        return this.convertLoft(node);
      case "lathe":
        return this.convertLathe(node);
      case "fill":
        return this.convertFill(node);
      case "hull":
        return this.convertHull(node);
      case "group":
        return this.convertBlock(node);
      case "detail":
        this.handleDetail(node);
        return null; // Detail doesn't create geometry
      case "color":
        this.handleColorCommand(node);
        return null;
      case "rotate":
        this.handleRotateCommand(node);
        return null;
      case "translate":
        this.handleTranslateCommand(node);
        return null;
      case "scale":
        this.handleScaleCommand(node);
        return null;
      case "customShape":
        return this.convertCustomShape(node);
      default:
        console.warn(`Unknown node type: ${(node as any).type}`);
        return null;
    }
  }

  private convertBlock(node: { children: SceneNode[] }): THREE.Group {
    const group = new THREE.Group();

    // Create new scope for block
    this.symbols.pushScope();
    this.pushTransform();

    for (const child of node.children) {
      const object = this.convertNode(child);
      if (object) {
        group.add(object);
      }
    }

    // Pop scope
    this.popTransform();
    this.symbols.popScope();

    return group;
  }

  private convertShape(node: ShapeNode): THREE.Mesh {
    const geometry = this.createGeometry(node);
    const material = this.createMaterial(node);
    const mesh = new THREE.Mesh(geometry, material);

    // Apply current transform state first
    this.applyCurrentTransform(mesh);

    // Then apply any property-specific transforms (these override the current state)
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
        return new THREE.SphereGeometry(
          size[0],
          this.detailLevel,
          this.detailLevel,
        );

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
        return new THREE.CylinderGeometry(
          radiusTop,
          radiusBottom,
          height,
          this.detailLevel,
        );
      }

      case "cone": {
        const radius = size[0];
        const height = node.properties.height
          ? this.evaluateNumber(node.properties.height)
          : size[1];
        return new THREE.ConeGeometry(radius, height, this.detailLevel);
      }

      case "torus": {
        const outerRadius = node.properties.outerRadius
          ? this.evaluateNumber(node.properties.outerRadius)
          : size[0];
        const innerRadius = node.properties.innerRadius
          ? this.evaluateNumber(node.properties.innerRadius)
          : 0.4;
        return new THREE.TorusGeometry(
          outerRadius,
          innerRadius,
          Math.max(3, Math.floor(this.detailLevel / 2)),
          this.detailLevel,
        );
      }

      case "circle": {
        const radius = size[0] || 1;
        return new THREE.CircleGeometry(radius, this.detailLevel);
      }

      case "square": {
        const sideLength = size[0] || 1;
        return new THREE.PlaneGeometry(sideLength, sideLength);
      }

      case "polygon": {
        // TODO: Support variable sides via properties
        const radius = size[0] || 1;
        const sides = 6; // Default hexagon
        return new THREE.CircleGeometry(radius, sides);
      }

      default:
        console.warn(`Unknown primitive: ${node.primitive}`);
        return new THREE.BoxGeometry(1, 1, 1);
    }
  }

  private createMaterial(node: ShapeNode | ExtrudeNode): THREE.Material {
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
    this.pushTransform();

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
    this.popTransform();
    this.symbols.popScope();

    return group;
  }

  private convertIf(node: IfNode): THREE.Group {
    const group = new THREE.Group();

    // Evaluate condition
    const condition = this.evaluator.evaluateToBoolean(node.condition);

    // Create new scope
    this.symbols.pushScope();
    this.pushTransform();

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
    this.popTransform();
    this.symbols.popScope();

    return group;
  }

  private convertSwitch(node: SwitchNode): THREE.Group {
    const group = new THREE.Group();

    // Evaluate switch value
    const switchValue = this.evaluator.evaluate(node.value);

    // Create new scope
    this.symbols.pushScope();
    this.pushTransform();

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
    this.popTransform();
    this.symbols.popScope();

    return group;
  }

  private handleDefine(node: DefineNode): void {
    // Check if this is a variable definition or a custom shape definition
    if (node.value !== undefined) {
      // Variable definition: define x 5
      const value = this.evaluator.evaluate(node.value);
      this.symbols.set(node.name, value);
    } else if (node.body !== undefined || node.options !== undefined) {
      // Custom shape definition: define shape { ... }
      // Store the entire node for later instantiation
      this.symbols.set(node.name, node);
    }
  }

  private convertCustomShape(node: CustomShapeNode): THREE.Object3D | null {
    // Look up the custom shape definition
    const definition = this.symbols.get(node.name);

    if (!definition || typeof definition !== "object" || !("type" in definition)) {
      console.warn(`Custom shape '${node.name}' not found`);
      return null;
    }

    const defineNode = definition as DefineNode;

    if (!defineNode.body) {
      console.warn(`Custom shape '${node.name}' has no body`);
      return null;
    }

    // Create new scope for custom shape instantiation
    this.symbols.pushScope();
    this.pushTransform();

    // Set default values from options
    if (defineNode.options) {
      for (const option of defineNode.options) {
        const defaultValue = this.evaluator.evaluate(option.defaultValue);
        this.symbols.set(option.name, defaultValue);
      }
    }

    // Override with provided properties
    for (const [key, value] of Object.entries(node.properties)) {
      const evaluatedValue = this.evaluator.evaluate(value as any);
      this.symbols.set(key, evaluatedValue);
    }

    // Convert the body
    const group = new THREE.Group();
    for (const child of defineNode.body) {
      const object = this.convertNode(child);
      if (object) {
        group.add(object);
      }
    }

    // Pop scope
    this.popTransform();
    this.symbols.popScope();

    return group;
  }

  private pushTransform(): void {
    const current = this.currentTransform();
    this.transformStack.push({
      position: current.position.clone(),
      rotation: current.rotation.clone(),
      scale: current.scale.clone(),
      color: current.color?.clone(),
    });
  }

  private popTransform(): void {
    if (this.transformStack.length > 1) {
      this.transformStack.pop();
    }
  }

  private currentTransform() {
    if (this.transformStack.length === 0) {
      // Initialize default transform
      return {
        position: new THREE.Vector3(0, 0, 0),
        rotation: new THREE.Euler(0, 0, 0),
        scale: new THREE.Vector3(1, 1, 1),
        color: undefined,
      };
    }
    return this.transformStack[this.transformStack.length - 1];
  }

  private applyCurrentTransform(object: THREE.Object3D): void {
    const transform = this.currentTransform();
    object.position.copy(transform.position);
    object.rotation.copy(transform.rotation);
    object.scale.copy(transform.scale);
  }

  private handleDetail(node: DetailNode): void {
    this.detailLevel = this.evaluateNumber(node.value);
    // Also add 'detail' as a variable so it can be referenced in expressions
    this.symbols.set("detail", this.detailLevel);
  }

  private handleColorCommand(node: ColorNode): void {
    const colorValue = this.evaluateVector3OrColor(node.value);
    this.currentTransform().color = new THREE.Color(
      colorValue[0],
      colorValue[1],
      colorValue[2],
    );
  }

  private handleRotateCommand(node: RotateNode): void {
    const rotation = this.evaluateVector3(node.value);
    const transform = this.currentTransform();
    // In ShapeScript, rotations are in half-turns (0.5 = 180 degrees)
    // Apply rotation relative to current rotation
    transform.rotation.x += rotation[0] * Math.PI * 2;
    transform.rotation.y += rotation[1] * Math.PI * 2;
    transform.rotation.z += rotation[2] * Math.PI * 2;
  }

  private handleTranslateCommand(node: TranslateNode): void {
    const translation = this.evaluateVector3(node.value);
    const transform = this.currentTransform();
    // Apply translation relative to current position
    transform.position.x += translation[0];
    transform.position.y += translation[1];
    transform.position.z += translation[2];
  }

  private handleScaleCommand(node: ScaleNode): void {
    const scale = this.evaluateVector3(node.value);
    const transform = this.currentTransform();
    // Apply scale relative to current scale
    transform.scale.x *= scale[0];
    transform.scale.y *= scale[1];
    transform.scale.z *= scale[2];
  }

  private convertExtrude(node: ExtrudeNode): THREE.Mesh {
    // Build the 2D shape from the path
    const shape = node.path
      ? this.buildPath(node.path)
      : new THREE.Shape([new THREE.Vector2(0, 0)]);

    // Get extrusion depth from size property
    const size = node.properties.size
      ? this.evaluateVector3(node.properties.size)
      : [1, 1, 1];
    const depth = size[2] || 1;

    // Create extruded geometry
    const geometry = new THREE.ExtrudeGeometry(shape, {
      depth,
      bevelEnabled: false,
      curveSegments: Math.max(1, Math.floor(this.detailLevel / 4)),
    });

    // Create material
    const material = this.createMaterial(node);

    const mesh = new THREE.Mesh(geometry, material);

    // Apply transforms
    if (node.properties.position) {
      const pos = this.evaluateVector3(node.properties.position);
      mesh.position.set(...pos);
    }

    if (node.properties.rotation) {
      const rot = this.evaluateVector3(node.properties.rotation);
      mesh.rotation.set(...rot);
    }

    return mesh;
  }

  private buildPath(pathNode: PathNode): THREE.Shape {
    const shape = new THREE.Shape();
    let currentX = 0;
    let currentY = 0;
    let currentAngle = 0; // In radians

    const processCommand = (command: PathCommand) => {
      switch (command.type) {
        case "point": {
          const x = this.evaluateNumber(command.x);
          const y = this.evaluateNumber(command.y);

          // Apply current rotation
          const cos = Math.cos(currentAngle);
          const sin = Math.sin(currentAngle);
          const rotatedX = x * cos - y * sin;
          const rotatedY = x * sin + y * cos;

          currentX += rotatedX;
          currentY += rotatedY;

          if (shape.curves.length === 0) {
            shape.moveTo(currentX, currentY);
          } else {
            shape.lineTo(currentX, currentY);
          }
          break;
        }

        case "curve": {
          const x = this.evaluateNumber(command.x);
          const y = this.evaluateNumber(command.y);

          // Apply current rotation
          const cos = Math.cos(currentAngle);
          const sin = Math.sin(currentAngle);
          const rotatedX = x * cos - y * sin;
          const rotatedY = x * sin + y * cos;

          currentX += rotatedX;
          currentY += rotatedY;

          if (
            command.controlX !== undefined &&
            command.controlY !== undefined
          ) {
            const cx = this.evaluateNumber(command.controlX);
            const cy = this.evaluateNumber(command.controlY);
            const rotatedCX = cx * cos - cy * sin;
            const rotatedCY = cx * sin + cy * cos;
            shape.quadraticCurveTo(
              currentX + rotatedCX,
              currentY + rotatedCY,
              currentX,
              currentY,
            );
          } else {
            shape.lineTo(currentX, currentY);
          }
          break;
        }

        case "rotate": {
          // In ShapeScript, 1 = 360 degrees = 2π radians
          const angle = this.evaluateNumber(command.angle);
          currentAngle += angle * Math.PI * 2;
          break;
        }

        case "translate": {
          const x = this.evaluateNumber(command.x);
          const y = this.evaluateNumber(command.y);
          currentX += x;
          currentY += y;
          break;
        }

        case "for": {
          // Expand for loop
          this.symbols.pushScope();

          const from = this.evaluateNumber(command.from);
          const to = this.evaluateNumber(command.to);
          const step = command.step ? this.evaluateNumber(command.step) : 1;

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

          for (const i of iterations) {
            this.symbols.set(command.variable, i);
            for (const bodyCmd of command.commands) {
              processCommand(bodyCmd);
            }
          }

          this.symbols.popScope();
          break;
        }
      }
    };

    for (const command of pathNode.commands) {
      processCommand(command);
    }

    return shape;
  }

  private convertLathe(node: LatheNode): THREE.Object3D {
    // Lathe rotates a 2D profile around an axis to create a 3D shape
    // In ShapeScript, the path defines the profile

    // Create new scope
    this.symbols.pushScope();
    this.pushTransform();

    // Find path node in children
    let pathNode: PathNode | null = null;
    for (const child of node.children) {
      if (child.type === "path") {
        pathNode = child as PathNode;
        break;
      }
    }

    if (!pathNode) {
      // No path found, return empty group
      console.warn("Lathe requires a path child");
      this.popTransform();
      this.symbols.popScope();
      return new THREE.Group();
    }

    // Build path and extract points for lathe
    const shape = this.buildPath(pathNode);
    const points: THREE.Vector2[] = [];

    // Extract points from the shape
    shape.getPoints(this.detailLevel).forEach((point) => {
      points.push(new THREE.Vector2(point.x, point.y));
    });

    if (points.length < 2) {
      console.warn("Lathe path must have at least 2 points");
      this.popTransform();
      this.symbols.popScope();
      return new THREE.Group();
    }

    // Create lathe geometry
    const geometry = new THREE.LatheGeometry(
      points,
      this.detailLevel, // Number of segments around the axis
    );

    // Create material
    const material = this.createMaterial(node);
    const mesh = new THREE.Mesh(geometry, material);

    // Apply transforms
    if (node.properties.position) {
      const pos = this.evaluateVector3(node.properties.position);
      mesh.position.set(...pos);
    }

    if (node.properties.rotation) {
      const rot = this.evaluateVector3(node.properties.rotation);
      mesh.rotation.set(...rot);
    }

    this.popTransform();
    this.symbols.popScope();

    return mesh;
  }

  private convertLoft(node: LoftNode): THREE.Object3D {
    // Loft creates a 3D shape by interpolating between multiple 2D cross-sections
    // For now, implement as a simple group that renders all children
    // A proper implementation would use spline interpolation between shapes

    this.symbols.pushScope();
    this.pushTransform();

    const group = new THREE.Group();

    // Convert all children
    for (const child of node.children) {
      const object = this.convertNode(child);
      if (object) {
        group.add(object);
      }
    }

    // Apply transforms
    if (node.properties.position) {
      const pos = this.evaluateVector3(node.properties.position);
      group.position.set(...pos);
    }

    if (node.properties.rotation) {
      const rot = this.evaluateVector3(node.properties.rotation);
      group.rotation.set(...rot);
    }

    this.popTransform();
    this.symbols.popScope();

    return group;
  }

  private convertFill(node: FillNode): THREE.Object3D {
    // Fill creates a solid 2D shape from a path
    // Similar to extrude but with zero depth

    this.symbols.pushScope();
    this.pushTransform();

    // Find path node in children
    let pathNode: PathNode | null = null;
    for (const child of node.children) {
      if (child.type === "path") {
        pathNode = child as PathNode;
        break;
      }
    }

    if (!pathNode) {
      // No path found, return empty group
      console.warn("Fill requires a path child");
      this.popTransform();
      this.symbols.popScope();
      return new THREE.Group();
    }

    // Build the 2D shape
    const shape = this.buildPath(pathNode);

    // Create a ShapeGeometry (flat 2D shape)
    const geometry = new THREE.ShapeGeometry(shape);

    // Create material
    const material = this.createMaterial(node);
    const mesh = new THREE.Mesh(geometry, material);

    // Apply transforms
    if (node.properties.position) {
      const pos = this.evaluateVector3(node.properties.position);
      mesh.position.set(...pos);
    }

    if (node.properties.rotation) {
      const rot = this.evaluateVector3(node.properties.rotation);
      mesh.rotation.set(...rot);
    }

    this.popTransform();
    this.symbols.popScope();

    return mesh;
  }

  private convertHull(node: HullNode): THREE.Object3D {
    // Hull creates a convex hull around child shapes
    // Proper implementation requires computing convex hull from point cloud
    // For now, just render children as a group

    this.symbols.pushScope();
    this.pushTransform();

    const group = new THREE.Group();

    // Convert all children
    for (const child of node.children) {
      const object = this.convertNode(child);
      if (object) {
        group.add(object);
      }
    }

    // Apply transforms
    if (node.properties.position) {
      const pos = this.evaluateVector3(node.properties.position);
      group.position.set(...pos);
    }

    if (node.properties.rotation) {
      const rot = this.evaluateVector3(node.properties.rotation);
      group.rotation.set(...rot);
    }

    this.popTransform();
    this.symbols.popScope();

    return group;
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

  private evaluateVector3OrColor(value: Expression): Vector3 {
    // This helper is used for color commands which can accept a single number or a tuple
    const result = this.evaluator.evaluate(value);

    if (typeof result === "number") {
      // Single value - use as grayscale
      return [result, result, result];
    } else if (Array.isArray(result)) {
      // Tuple - ensure it's a 3-element vector
      if (result.length === 1) {
        return [result[0], result[0], result[0]];
      } else if (result.length === 2) {
        return [result[0], result[1], 0];
      } else if (result.length >= 3) {
        return [result[0], result[1], result[2]];
      }
    }

    return [0.8, 0.8, 0.8]; // Default gray
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
