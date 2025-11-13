// ShapeScript AST Type Definitions

export type Vector3 = [number, number, number];
export type Color = [number, number, number];

export type SceneNode = ShapeNode | CSGNode | BlockNode | ForLoopNode;

export interface ShapeNode {
  type: "shape";
  primitive: "cube" | "sphere" | "cylinder" | "cone" | "torus";
  properties: ShapeProperties;
  children?: SceneNode[];
}

export interface ShapeProperties {
  position?: Vector3;
  rotation?: Vector3;
  size?: Vector3;
  color?: Color;
  opacity?: number;
  // For cylinder/cone specific properties
  radiusTop?: number;
  radiusBottom?: number;
  height?: number;
  // For torus
  innerRadius?: number;
  outerRadius?: number;
}

export interface CSGNode {
  type: "csg";
  operation: "union" | "difference" | "intersection" | "xor" | "stencil";
  children: SceneNode[];
}

export interface BlockNode {
  type: "block";
  children: SceneNode[];
}

export interface ForLoopNode {
  type: "for";
  variable: string;
  from: number;
  to: number;
  step?: number;
  body: SceneNode[];
  transforms?: TransformNode[];
}

export interface TransformNode {
  type: "rotate" | "translate" | "scale";
  values: Vector3;
}

export interface DefineNode {
  type: "define";
  name: string;
  options: Record<string, any>;
  body: SceneNode[];
}

// Token types for the lexer
export enum TokenType {
  // Primitives
  CUBE = "CUBE",
  SPHERE = "SPHERE",
  CYLINDER = "CYLINDER",
  CONE = "CONE",
  TORUS = "TORUS",

  // CSG Operations
  UNION = "UNION",
  DIFFERENCE = "DIFFERENCE",
  INTERSECTION = "INTERSECTION",
  XOR = "XOR",
  STENCIL = "STENCIL",

  // Control Flow
  FOR = "FOR",
  TO = "TO",
  DEFINE = "DEFINE",
  OPTION = "OPTION",

  // Properties
  POSITION = "POSITION",
  ROTATION = "ROTATION",
  SIZE = "SIZE",
  COLOR = "COLOR",
  OPACITY = "OPACITY",
  ROTATE = "ROTATE",
  TRANSLATE = "TRANSLATE",
  SCALE = "SCALE",

  // Literals
  NUMBER = "NUMBER",
  IDENTIFIER = "IDENTIFIER",
  STRING = "STRING",

  // Symbols
  LBRACE = "LBRACE",
  RBRACE = "RBRACE",
  COMMA = "COMMA",
  SLASH = "SLASH",

  // Special
  NEWLINE = "NEWLINE",
  EOF = "EOF",
  COMMENT = "COMMENT",
}

export interface Token {
  type: TokenType;
  value: string | number;
  line: number;
  column: number;
}

export class ParseError extends Error {
  constructor(
    message: string,
    public line?: number,
    public column?: number,
  ) {
    super(
      line !== undefined && column !== undefined
        ? `Parse error at line ${line}, column ${column}: ${message}`
        : `Parse error: ${message}`,
    );
    this.name = "ParseError";
  }
}
