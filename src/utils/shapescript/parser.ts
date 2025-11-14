import {
  Token,
  TokenType,
  SceneNode,
  ShapeNode,
  CSGNode,
  BlockNode,
  ForLoopNode,
  TransformNode,
  Vector3,
  Color,
  ParseError,
} from "./types";

// Lexer/Tokenizer
class Lexer {
  private input: string;
  private pos = 0;
  private line = 1;
  private column = 1;

  constructor(input: string) {
    this.input = input;
  }

  private peek(offset = 0): string {
    return this.input[this.pos + offset] || "";
  }

  private advance(): string {
    const char = this.input[this.pos++];
    if (char === "\n") {
      this.line++;
      this.column = 1;
    } else {
      this.column++;
    }
    return char;
  }

  private skipWhitespace(): void {
    while (this.pos < this.input.length) {
      const char = this.peek();
      if (char === " " || char === "\t" || char === "\r") {
        this.advance();
      } else if (char === "/" && this.peek(1) === "/") {
        // Skip comment
        while (this.peek() && this.peek() !== "\n") {
          this.advance();
        }
      } else {
        break;
      }
    }
  }

  private readNumber(): Token {
    const line = this.line;
    const column = this.column;
    let numStr = "";

    // Handle negative numbers
    if (this.peek() === "-") {
      numStr += this.advance();
    }

    while (this.pos < this.input.length) {
      const char = this.peek();
      if ((char >= "0" && char <= "9") || char === ".") {
        numStr += this.advance();
      } else {
        break;
      }
    }

    return {
      type: TokenType.NUMBER,
      value: parseFloat(numStr),
      line,
      column,
    };
  }

  private readIdentifier(): Token {
    const line = this.line;
    const column = this.column;
    let id = "";

    while (this.pos < this.input.length) {
      const char = this.peek();
      if (
        (char >= "a" && char <= "z") ||
        (char >= "A" && char <= "Z") ||
        (char >= "0" && char <= "9") ||
        char === "_"
      ) {
        id += this.advance();
      } else {
        break;
      }
    }

    // Map keywords to token types
    const keywords: Record<string, TokenType> = {
      cube: TokenType.CUBE,
      sphere: TokenType.SPHERE,
      cylinder: TokenType.CYLINDER,
      cone: TokenType.CONE,
      torus: TokenType.TORUS,
      union: TokenType.UNION,
      difference: TokenType.DIFFERENCE,
      intersection: TokenType.INTERSECTION,
      xor: TokenType.XOR,
      stencil: TokenType.STENCIL,
      for: TokenType.FOR,
      to: TokenType.TO,
      define: TokenType.DEFINE,
      option: TokenType.OPTION,
      position: TokenType.POSITION,
      rotation: TokenType.ROTATION,
      size: TokenType.SIZE,
      color: TokenType.COLOR,
      opacity: TokenType.OPACITY,
      rotate: TokenType.ROTATE,
      translate: TokenType.TRANSLATE,
      scale: TokenType.SCALE,
    };

    const type = keywords[id.toLowerCase()] || TokenType.IDENTIFIER;

    return {
      type,
      value: id,
      line,
      column,
    };
  }

  tokenize(): Token[] {
    const tokens: Token[] = [];

    while (this.pos < this.input.length) {
      this.skipWhitespace();

      if (this.pos >= this.input.length) break;

      const char = this.peek();
      const line = this.line;
      const column = this.column;

      // Numbers
      if (
        (char >= "0" && char <= "9") ||
        (char === "-" && this.peek(1) >= "0" && this.peek(1) <= "9")
      ) {
        tokens.push(this.readNumber());
      }
      // Identifiers and keywords
      else if ((char >= "a" && char <= "z") || (char >= "A" && char <= "Z")) {
        tokens.push(this.readIdentifier());
      }
      // Symbols
      else if (char === "{") {
        this.advance();
        tokens.push({ type: TokenType.LBRACE, value: "{", line, column });
      } else if (char === "}") {
        this.advance();
        tokens.push({ type: TokenType.RBRACE, value: "}", line, column });
      } else if (char === ",") {
        this.advance();
        tokens.push({ type: TokenType.COMMA, value: ",", line, column });
      } else if (char === "/") {
        this.advance();
        tokens.push({ type: TokenType.SLASH, value: "/", line, column });
      } else if (char === "\n") {
        this.advance();
        tokens.push({ type: TokenType.NEWLINE, value: "\n", line, column });
      } else {
        throw new ParseError(`Unexpected character: '${char}'`, line, column);
      }
    }

    tokens.push({
      type: TokenType.EOF,
      value: "",
      line: this.line,
      column: this.column,
    });

    return tokens;
  }
}

// Parser
export class Parser {
  private tokens: Token[];
  private pos = 0;

  constructor(tokens: Token[]) {
    this.tokens = tokens;
  }

  private current(): Token {
    return this.tokens[this.pos];
  }

  private peek(offset = 1): Token {
    return (
      this.tokens[this.pos + offset] || this.tokens[this.tokens.length - 1]
    );
  }

  private advance(): Token {
    return this.tokens[this.pos++];
  }

  private expect(type: TokenType): Token {
    const token = this.current();
    if (token.type !== type) {
      throw new ParseError(
        `Expected ${type} but got ${token.type}`,
        token.line,
        token.column,
      );
    }
    return this.advance();
  }

  private skipNewlines(): void {
    while (this.current().type === TokenType.NEWLINE) {
      this.advance();
    }
  }

  private parseNumber(): number {
    const token = this.expect(TokenType.NUMBER);
    return token.value as number;
  }

  private parseVector3(): Vector3 {
    const x = this.parseNumber();
    let y = 0;
    let z = 0;

    if (this.current().type === TokenType.NUMBER) {
      y = this.parseNumber();
      if (this.current().type === TokenType.NUMBER) {
        z = this.parseNumber();
      }
    }

    return [x, y, z];
  }

  private parseColor(): Color {
    const r = this.parseNumber();
    const g = this.parseNumber();
    const b = this.parseNumber();
    return [r, g, b];
  }

  private parseProperties(): Record<string, any> {
    const properties: Record<string, any> = {};

    while (
      this.current().type !== TokenType.RBRACE &&
      this.current().type !== TokenType.EOF
    ) {
      this.skipNewlines();

      const token = this.current();

      switch (token.type) {
        case TokenType.POSITION:
          this.advance();
          properties.position = this.parseVector3();
          break;

        case TokenType.ROTATION:
          this.advance();
          properties.rotation = this.parseVector3();
          break;

        case TokenType.SIZE:
          this.advance();
          properties.size = this.parseVector3();
          break;

        case TokenType.COLOR:
          this.advance();
          properties.color = this.parseColor();
          break;

        case TokenType.OPACITY:
          this.advance();
          properties.opacity = this.parseNumber();
          break;

        case TokenType.RBRACE:
          break;

        default:
          // Skip unknown properties
          this.advance();
          break;
      }

      this.skipNewlines();
    }

    return properties;
  }

  private parseBlock(): SceneNode[] {
    this.expect(TokenType.LBRACE);
    this.skipNewlines();

    const nodes: SceneNode[] = [];

    while (
      this.current().type !== TokenType.RBRACE &&
      this.current().type !== TokenType.EOF
    ) {
      const node = this.parseNode();
      if (node) {
        nodes.push(node);
      }
      this.skipNewlines();
    }

    this.expect(TokenType.RBRACE);
    return nodes;
  }

  private parseShape(
    primitive: "cube" | "sphere" | "cylinder" | "cone" | "torus",
  ): ShapeNode {
    this.advance(); // consume primitive token

    let properties: Record<string, any> = {};

    if (this.current().type === TokenType.LBRACE) {
      this.expect(TokenType.LBRACE);
      properties = this.parseProperties();
      this.expect(TokenType.RBRACE);
    }

    return {
      type: "shape",
      primitive,
      properties,
    };
  }

  private parseCSG(
    operation: "union" | "difference" | "intersection" | "xor" | "stencil",
  ): CSGNode {
    this.advance(); // consume operation token

    const children = this.parseBlock();

    return {
      type: "csg",
      operation,
      children,
    };
  }

  private parseForLoop(): ForLoopNode {
    this.advance(); // consume 'for'

    let variable = "i";
    let from = 1;
    let to = 1;

    // Parse: for <identifier>? <from>? to <to>
    if (this.current().type === TokenType.IDENTIFIER) {
      variable = this.current().value as string;
      this.advance();
    }

    // Optional 'from' value
    if (this.current().type === TokenType.NUMBER) {
      from = this.parseNumber();
    }

    this.expect(TokenType.TO);
    to = this.parseNumber();

    const body = this.parseBlock();

    return {
      type: "for",
      variable,
      from,
      to,
      body,
    };
  }

  private parseNode(): SceneNode | null {
    this.skipNewlines();

    const token = this.current();

    switch (token.type) {
      case TokenType.CUBE:
        return this.parseShape("cube");
      case TokenType.SPHERE:
        return this.parseShape("sphere");
      case TokenType.CYLINDER:
        return this.parseShape("cylinder");
      case TokenType.CONE:
        return this.parseShape("cone");
      case TokenType.TORUS:
        return this.parseShape("torus");

      case TokenType.UNION:
        return this.parseCSG("union");
      case TokenType.DIFFERENCE:
        return this.parseCSG("difference");
      case TokenType.INTERSECTION:
        return this.parseCSG("intersection");
      case TokenType.XOR:
        return this.parseCSG("xor");
      case TokenType.STENCIL:
        return this.parseCSG("stencil");

      case TokenType.FOR:
        return this.parseForLoop();

      case TokenType.RBRACE:
      case TokenType.EOF:
        return null;

      default:
        throw new ParseError(
          `Unexpected token: ${token.type}`,
          token.line,
          token.column,
        );
    }
  }

  parse(): SceneNode[] {
    const nodes: SceneNode[] = [];

    while (this.current().type !== TokenType.EOF) {
      const node = this.parseNode();
      if (node) {
        nodes.push(node);
      }
      this.skipNewlines();
    }

    return nodes;
  }
}

// Main export function
export function parseShapeScript(script: string): SceneNode[] {
  try {
    const lexer = new Lexer(script);
    const tokens = lexer.tokenize();

    // Filter out newline tokens for simpler parsing
    const filteredTokens = tokens.filter((t) => t.type !== TokenType.NEWLINE);

    const parser = new Parser(filteredTokens);
    return parser.parse();
  } catch (error) {
    if (error instanceof ParseError) {
      throw error;
    }
    throw new ParseError(
      error instanceof Error ? error.message : "Unknown parse error",
    );
  }
}
