# PLAN18: Full ShapeScript Specification Support

## Overview

This plan outlines the work needed to upgrade the `present3D` plugin from its current severely limited ShapeScript subset to support the full ShapeScript language specification as documented at https://shapescript.info.

## Current State

The current implementation (`src/tools/models/present3D.ts`) only supports:
- **Literal numbers only** - no expressions, operators, or variables
- **Basic primitives**: cube, sphere, cylinder, cone, torus
- **Basic transforms**: position, rotation, size
- **Basic materials**: color, opacity
- **CSG operations**: union, difference, intersection, xor
- **Limited loops**: `for i to N` creates circular patterns with identical objects only

**Critical Limitation**: The current system explicitly forbids:
- Math operators: `+`, `-`, `*`, `/`, `%`
- Parentheses for expressions
- Variables in property values
- Loop index variables
- Functions

## Target State: Full ShapeScript Specification

### 1. Expressions & Operators

**Arithmetic Operators** (BODMAS precedence):
- Addition: `+`
- Subtraction: `-`
- Multiplication: `*`
- Division: `/`
- Modulo: `%`
- Unary: `+`, `-`
- Parentheses for precedence: `(5 + 3) * 4`

**Comparison Operators** (return boolean):
- Equal: `=`
- Not equal: `<>`
- Less than: `<`, `<=`
- Greater than: `>`, `>=`

**Boolean Logic**:
- `and` - both conditions true
- `or` - either condition true
- `not` - negates condition

**Vector Operations**:
- Element-wise: `(1 2 3) * 2` → `2 4 6`
- Tuple multiplication: `(1 2 3) * (1 -2 3)` → `1 -4 9`

**Important**: Spacing matters! `5 -1` creates a vector, `5 - 1` performs subtraction.

### 2. Variables & Symbols

**Define constants**:
```shapescript
define sides 5
define red 1 0 0
define radius (sides * 0.5)
```

**Scoping**:
- Symbols defined in `{ }` blocks are locally scoped
- Symbols can be shadowed in inner scopes
- Only constants supported (no reassignment)

**Naming rules**:
- Start with letter
- Letters, numbers, underscores only
- Case-sensitive
- Convention: camelCase

### 3. Control Flow

**For Loops** (inclusive ranges):
```shapescript
// Basic loop with index
for i in 1 to 5 {
    cube { position i 0 0 }
}

// Step increment
for i in 1 to 10 step 2 {
    sphere { position 0 i 0 }
}

// Reverse iteration
for i in 5 to 1 step -1 {
    cone { position 0 0 i }
}

// Loop over values
define values "Mambo" "No." 5
for i in values {
    print i
}
```

**If-Else Conditionals**:
```shapescript
if showCube {
    cube
} else {
    sphere
}

// Chained conditions
if x < 0 {
    // negative
} else if x = 0 {
    // zero
} else {
    // positive
}
```

**Switch-Case**:
```shapescript
switch value {
case 1
    cube
case 2
    sphere
case 3 4  // Multiple cases
    cylinder
else
    cone  // Default
}
```

### 4. Functions

**Built-in Arithmetic**:
- `round`, `floor`, `ceil`
- `abs`, `sign`, `sqrt`, `pow`
- `min`, `max`

**Trigonometric** (uses radians, not half-turns):
- `sin`, `cos`, `tan`
- `asin`, `acos`, `atan`, `atan2`

**Vector/Linear Algebra**:
- `dot` - dot product
- `cross` - cross product
- `length` - magnitude
- `normalize` - unit vector
- `sum` - sum components

**String Functions**:
- `join` - concatenate with separator
- `split` - break at delimiter
- `trim` - remove whitespace

**Custom Functions**:
```shapescript
define myFunction(param1 param2) {
    // function body
    param1 + param2
}
```

### 5. Ranges

```shapescript
1 to 5           // Range: 1, 2, 3, 4, 5
1 to 5 step 2    // Range: 1, 3, 5
5 to 1 step -1   // Reverse
from 5           // Open-ended (no upper bound)
2.5 in (1 to 5)  // Membership test (true)
```

### 6. Member Access & Subscripting

```shapescript
vector.y              // Named access
vector["y"]           // Named via string
vector[0]             // Zero-indexed ordinal
vector.first          // First element
vector[-1]            // Last element (negative index)
foo[0 to 2]          // Range slicing
foo[from 2]          // Slice from index 2
```

### 7. Advanced Geometry: Builders

**Fill** - 2D filled polygon from path:
```shapescript
fill {
    circle
}
```

**Lathe** - Revolve 2D path around Y axis:
```shapescript
lathe {
    square { size 0.5 }
}
```

**Extrude** - Extend path along Z axis:
```shapescript
extrude {
    circle { size 0.5 }
}

// Extrude along path
extrude {
    circle { size 0.2 }
    along {
        arc  // Curved extrusion
    }
}

// With twist
extrude {
    square { size 0.5 }
    twist 0.5  // Half-turn twist
}
```

**Loft** - Join multiple cross-sections:
```shapescript
loft {
    circle { size 1 }
    square { size 0.5 }
    circle { size 0.2 }
}
```

**Hull** - Convex hull around shapes:
```shapescript
hull {
    sphere { position -1 0 0 }
    sphere { position 1 0 0 }
}
```

**Minkowski** - Blend shapes:
```shapescript
minkowski {
    square { size 2 }
    circle { size 0.5 }  // Creates rounded rectangle
}
```

### 8. Paths

**Points and Curves**:
```shapescript
path {
    point -1 -1
    curve 0 1      // Quadratic Bézier
    point 1 -1
}
```

**Built-in Path Types**:
- `arc` - circular arc with angle/size
- `circle` - complete circle
- `square` - rectangle
- `roundrect` - rounded rectangle
- `polygon { sides 6 }` - regular polygon
- `svgpath "M 0 0 L 1 1"` - SVG path syntax

**Path Features**:
- Closed vs open paths
- Nested sub-paths
- Gradient colors (different colors at points)
- Detail control for smoothness

### 9. Materials (Beyond Basic Color)

**Texture**:
```shapescript
texture "image.png"
```

**Normal Maps** (simulates surface detail):
```shapescript
normals "normalmap.png"
```

**Opacity** (0-1 range, hierarchical):
```shapescript
opacity 0.5
```

**Glow** (self-luminous):
```shapescript
glow 1 0 0  // Red glow
```

**PBR Properties**:
```shapescript
metallic 1      // Fully metallic (0-1)
roughness 0.2   // Smooth (0-1)
```

**Material Presets**:
```shapescript
define goldMaterial {
    color 1 0.84 0
    metallic 1
    roughness 0.3
}

sphere {
    material goldMaterial
}
```

### 10. CSG Additions

**Stencil** - Apply pattern/logo to surface:
```shapescript
stencil {
    sphere { color 1 0 0 }           // Base shape
    cube { size 0.5 color 0 0 1 }    // Pattern (blue)
}
```

### 11. Blocks & Custom Definitions

**Options** (parameters for custom blocks):
```shapescript
define myShape {
    option radius 1       // Default value
    option count 8        // Default value

    for i in 1 to count {
        sphere { size radius }
    }
}

// Call with custom options
myShape { radius 2 count 12 }
```

**Children Property** (accept child shapes):
```shapescript
define wrapper {
    union {
        children  // Insert passed child objects
    }
}

wrapper {
    cube
    sphere { position 2 0 0 }
}
```

### 12. Transform Enhancements

**Relative Transforms** (modify coordinate system):
```shapescript
translate 1 0 0   // Move origin
rotate 0.25       // Rotate coordinate system
scale 2           // Scale all subsequent geometry
```

**Orientation** (absolute rotation):
```shapescript
orientation 0.5 0 0  // Roll, yaw, pitch (half-turns)
```

Note: Transform commands use **half-turns** (0-2 range), but trig functions use **radians**.

### 13. Comments

```shapescript
// Single line comment

/*
   Multi-line
   block comment
*/

/* Nested /* comments */ supported */
```

### 14. Other Features

**Detail Control** (polygon resolution):
```shapescript
detail 32  // Global detail level for curves
```

**Print** (debugging):
```shapescript
print "Debug value:" value
```

## Implementation Strategy

### Phase 1: Expression System & Parser Upgrade
**Goal**: Support full expression syntax

1. **Replace ShapeScript Viewer/Parser**:
   - Current implementation likely uses a very basic parser
   - Need full expression evaluator supporting:
     - Arithmetic operators with BODMAS precedence
     - Comparison and boolean operators
     - Parentheses
     - Function calls

2. **Variable/Symbol System**:
   - Implement `define` keyword
   - Symbol table with scoping rules
   - Shadow variable support
   - Type inference

3. **Update Tool Definition**:
   - Remove restrictive "CRITICAL SYNTAX RULES" from description
   - Update examples to show full capabilities
   - Provide comprehensive syntax guide

**Deliverables**:
- ✅ Expressions work: `position (i * 1.5 - 2.25) 0 0`
- ✅ Variables work: `define r 2; sphere { size r }`
- ✅ Math in properties: `size (radius * 2)`

### Phase 2: Control Flow
**Goal**: Support loops, conditionals, switch

1. **Enhanced For Loops**:
   - Index variables: `for i in 1 to 5`
   - Step support: `step 2`, `step -1`
   - Value iteration: `for i in values`
   - Ranges: `1 to 5`, `from 5`

2. **Conditionals**:
   - If/else/else-if implementation
   - Boolean evaluation
   - Block scoping for conditionals

3. **Switch Statements**:
   - Case matching (any type)
   - Multiple cases: `case 1 2 3`
   - Default case: `else`

**Deliverables**:
- ✅ Linear arrangements with loops: `for i in 1 to 4 { cube { position (i * 2) 0 0 } }`
- ✅ Conditionals: `if x > 0 { sphere } else { cube }`
- ✅ Switch: `switch type { case "sphere" sphere case "cube" cube }`

### Phase 3: Functions
**Goal**: Built-in and custom functions

1. **Built-in Functions**:
   - Arithmetic: round, floor, ceil, abs, sign, sqrt, pow, min, max
   - Trig: sin, cos, tan, asin, acos, atan, atan2
   - Vector: dot, cross, length, normalize, sum
   - String: join, split, trim

2. **Custom Functions**:
   - Function definition syntax
   - Parameter passing
   - Return values
   - Type checking

3. **Member Access**:
   - Dot notation: `vector.x`, `vector.y`, `vector.z`
   - Subscripting: `vector[0]`, `vector[-1]`
   - Range slicing: `vector[1 to 3]`

**Deliverables**:
- ✅ Math functions: `position (sin(i * 0.5)) (cos(i * 0.5)) 0`
- ✅ Custom functions: `define dist(x y) { sqrt(x * x + y * y) }`
- ✅ Vector operations: `define v (1 2 3); sphere { size v.x }`

### Phase 4: Advanced Geometry
**Goal**: Builders and paths

1. **Builders**:
   - fill: 2D filled polygons
   - lathe: Revolve around Y axis
   - extrude: Extend along Z, with `along` and `twist` options
   - loft: Join cross-sections
   - hull: Convex hull
   - minkowski: Shape blending

2. **Paths**:
   - point, curve (Bézier)
   - Built-ins: arc, circle, square, roundrect, polygon
   - svgpath support
   - Nested paths
   - Color gradients on paths

3. **CSG Addition**:
   - stencil operation

**Deliverables**:
- ✅ Extruded shapes: `extrude { circle { size 0.5 } }`
- ✅ Lathed objects: `lathe { square { size 0.5 } }`
- ✅ Complex paths: Custom path definitions with curves
- ✅ Stencil: Pattern/logo application

### Phase 5: Materials & Rendering
**Goal**: Advanced material properties

1. **Texture System**:
   - Image texture loading
   - Normal maps
   - Opacity textures

2. **PBR Materials**:
   - metallic property
   - roughness property
   - glow property

3. **Material Definitions**:
   - `material` command
   - Reusable material presets

**Deliverables**:
- ✅ Textures: `texture "image.png"`
- ✅ PBR: `metallic 1 roughness 0.3`
- ✅ Materials: Reusable material definitions

### Phase 6: Blocks & Advanced Features
**Goal**: Custom blocks with options

1. **Options System**:
   - option keyword
   - Default values
   - Override at call time

2. **Children Property**:
   - Accept child shapes
   - Insert with `children` keyword
   - Type validation

3. **Relative Transforms**:
   - translate, rotate, scale commands
   - Coordinate system manipulation

**Deliverables**:
- ✅ Custom blocks: Reusable shape definitions
- ✅ Options: Parameterized blocks
- ✅ Children: Compositional shapes

## Technical Considerations

### 1. Parser/Interpreter Choice

**Options**:
- **ShapeScript CLI** (if available as library): Direct execution
- **Custom Parser**: Build JS/TS parser for ShapeScript
- **Existing JS Parser Library**: Adapt parser generator (e.g., PEG.js, nearley)

**Recommendation**: Investigate if ShapeScript has a JavaScript/WASM runtime. Otherwise, build custom parser using PEG.js or similar.

### 2. Rendering Engine

Current implementation uses a 3D viewer component. Need to verify:
- Can it handle textures, normal maps?
- Does it support PBR materials (metallic/roughness)?
- Can it render complex CSG operations efficiently?

May need to upgrade to more capable 3D renderer (Three.js with PBR materials?).

### 3. Security Considerations

Full language support introduces risks:
- **Infinite loops**: `for i in 1 to 999999`
- **Memory exhaustion**: Complex CSG operations
- **External resources**: Texture/file loading

**Mitigations**:
- Execution timeout
- Complexity limits
- Sandboxed file access
- Resource size limits

### 4. Backwards Compatibility

Current severely limited syntax is technically a subset. Options:
1. **Break compatibility**: Update to full syntax (recommended)
2. **Dual mode**: Detect and support both (complex)
3. **Auto-migration**: Convert old scripts (unnecessary)

**Recommendation**: Breaking change is acceptable since current system is so limited.

## Testing Strategy

### Unit Tests
- Expression evaluator: All operators, precedence
- Variable/symbol system: Define, scoping, shadowing
- Control flow: Loops (all variants), conditionals, switch
- Functions: All built-ins, custom functions
- Geometry: All primitives, builders, paths, CSG
- Materials: All properties, textures

### Integration Tests
- Complex scenes combining multiple features
- Performance tests (execution time limits)
- Memory tests (complexity limits)

### Example Scripts
Create comprehensive example library:
- Basic shapes
- Mathematical visualizations
- Molecular structures
- Architectural models
- Game boards
- Data visualizations

## Documentation Updates

### Tool Description
Update `src/tools/models/present3D.ts`:
- Remove "CRITICAL SYNTAX RULES" restrictions
- Add comprehensive syntax guide
- Include rich examples showcasing capabilities
- Document all primitives, builders, operations

### System Prompt
Update to guide LLM to use full language features:
- Encourage use of variables for readability
- Suggest functions for complex calculations
- Show how to use loops properly with variables
- Demonstrate builders and paths for advanced geometry

### User Documentation
Create examples showing:
- Simple to complex progressions
- Common patterns (grids, circles, spirals)
- Material usage
- Custom function libraries
- Reusable block definitions

## Success Criteria

The implementation is complete when:

1. ✅ **Expressions**: All arithmetic, comparison, boolean operators work
2. ✅ **Variables**: Define, scope, shadow work correctly
3. ✅ **Control Flow**: For loops (with variables), if/else, switch all functional
4. ✅ **Functions**: All built-ins implemented, custom functions work
5. ✅ **Geometry**: All primitives, all builders, all CSG operations
6. ✅ **Paths**: All path types, curves, gradients
7. ✅ **Materials**: Color, texture, normals, PBR properties
8. ✅ **Advanced**: Options, children, relative transforms
9. ✅ **Performance**: Complex scenes render in <5 seconds
10. ✅ **Security**: Limits prevent abuse
11. ✅ **Examples**: 20+ example scripts demonstrating all features
12. ✅ **Documentation**: Comprehensive guide for users and LLM

## Timeline Estimate

- **Phase 1** (Expressions & Parser): 2-3 weeks
- **Phase 2** (Control Flow): 1-2 weeks
- **Phase 3** (Functions): 1-2 weeks
- **Phase 4** (Advanced Geometry): 2-3 weeks
- **Phase 5** (Materials): 1-2 weeks
- **Phase 6** (Blocks & Advanced): 1-2 weeks

**Total**: 8-14 weeks for full implementation

## Priority Ordering

If implementing incrementally, prioritize:

1. **High Priority** (Minimum Viable Enhancement):
   - Phase 1: Expressions & variables
   - Phase 2: Control flow (especially loops with variables)
   - Phase 3: Basic functions (trig, math)

2. **Medium Priority** (Significantly Enhanced):
   - Phase 4: Builders (extrude, lathe most useful)
   - Phase 3: Member access & custom functions

3. **Lower Priority** (Complete Implementation):
   - Phase 5: Advanced materials
   - Phase 6: Options & children system
   - Phase 4: Hull, minkowski, complex paths

## Risk Assessment

**High Risk**:
- Parser implementation complexity
- Security/safety constraints
- Performance with complex CSG

**Medium Risk**:
- Rendering engine capabilities
- Texture/resource loading
- Breaking changes to existing usage

**Low Risk**:
- Documentation updates
- Example creation
- Testing

## Conclusion

Upgrading from the current severely limited subset to full ShapeScript specification will transform `present3D` from a basic shape demonstrator into a powerful 3D modeling tool capable of creating sophisticated visualizations. The phased approach allows incremental delivery of value while managing complexity.

The most impactful early win is **Phase 1 + 2**: enabling expressions, variables, and proper loops with indices. This alone removes the current painful restrictions that require manually writing out each object with literal numbers.
