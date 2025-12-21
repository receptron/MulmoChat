# Plan: Fix ShapeScript Parser Pre-existing Bugs

## Overview
Fix 4 pre-existing bugs in the ShapeScript parser that prevent example files from parsing correctly. These bugs affect: Train.shape, Cog.shape, Spirals.shape, and Icosahedron.shape.

## Current Test Results
- **6/10 examples passing** (Ball, Chessboard, Earth, Spring, cube, panda)
- **4 examples failing** due to parser bugs
- **All transform tests passing** (3/3)

## Critical Files
- `/Users/satoshi/git/ai/chat/src/utils/shapescript/parser.ts` - Main parser implementation
- `/Users/satoshi/git/ai/chat/src/utils/shapescript/types.ts` - AST type definitions
- `/Users/satoshi/git/ai/chat/test-shapescript.ts` - Test suite

---

## Bug #1: Group Block Double-Brace Bug (Train.shape)

### Error
```
Parse error at line 35, column 9: Expected LBRACE but got TRANSLATE
```

### Root Cause
In `parseGroup()` (line 1232-1240), the method:
1. Consumes the opening `{` with `this.expect(TokenType.LBRACE)`
2. Calls `parseBlock()` which expects to consume **another** `{`
3. This causes parseBlock to fail when it sees the first child node instead

### Example That Fails
```shapescript
group {
    translate 0 0 1  // Parser expects another '{' here
}
```

### Fix
Create a helper method `parseBlockContents()` that parses block contents without expecting to consume the opening brace:

1. Extract the content-parsing logic from `parseBlock()` into `parseBlockContents()`
2. Have `parseBlock()` call `parseBlockContents()` after consuming `{`
3. Update `parseGroup()` to call `parseBlockContents()` instead of `parseBlock()`

**File**: `src/utils/shapescript/parser.ts`
- Lines 851-870: Refactor `parseBlock()`
- Lines 1232-1240: Fix `parseGroup()` to use `parseBlockContents()`

---

## Bug #2: Custom Shapes in Extrude Blocks (Cog.shape)

### Error
```
Parse error at line 22, column 13: Unexpected token: LBRACE
```

### Root Cause
In `parseBuilder()` (lines 1243-1373), when parsing children inside extrude blocks:
- Line 22 of Cog.shape: `cog { teeth 8 }` (custom shape invocation)
- The parser calls `parseNode()` for children (line 1346)
- `parseNode()` handles custom shapes via IDENTIFIER token (line 1782)
- However, the IDENTIFIER case expects shapes to have braces, but the parser is already inside the extrude block

### Investigation Needed
This might be a token ordering issue or the parseNode needs to better handle custom shape invocations inside builder blocks. Need to trace through exact token sequence to identify the issue.

### Fix Approach
1. Debug by adding console.log to see exact token sequence at failure point
2. Ensure custom shape invocation (IDENTIFIER + LBRACE) is properly recognized inside extrude blocks
3. May need to adjust parseNode logic for custom shapes when inside builder context

**File**: `src/utils/shapescript/parser.ts`
- Lines 1243-1373: `parseBuilder()` method
- Lines 1782-1829: Custom shape handling in `parseNode()`

---

## Bug #3: Path For-Loop Expression Parsing (Spirals.shape)

### Error
```
Parse error at line 13, column 46: Unexpected token in path for loop: NUMBER
```

### Root Cause
Line 13 in Spirals.shape:
```shapescript
curve 0 radius * (1 - i / steps) 0
```

The issue is with parsing the third argument `0` after the complex expression `radius * (1 - i / steps)`.

The `parsePathValue()` method (lines 1348-1382) should handle expressions, but it may be consuming too much or not properly detecting the end of an expression when followed by another simple value.

### Fix
1. Review `parsePathValue()` logic to ensure it properly handles:
   - Complex parenthesized expressions: `(1 - i / steps)`
   - Binary operations: `radius * (...)`
   - Multiple space-separated values in sequence
2. The issue is likely that after parsing `radius * (1 - i / steps)`, it continues trying to parse `0` as part of the expression instead of recognizing it as the next argument
3. May need to check for whitespace or token boundaries to determine expression end

**File**: `src/utils/shapescript/parser.ts`
- Lines 1348-1382: `parsePathValue()` method
- Lines 1594-1657: Path command parsing for CURVE in for loops

### Additional Issue in Spirals.shape
**Note**: After fixing the path parsing bug, Spirals.shape will reveal a second issue:
- Line 33 uses `along` keyword: `along spiral { coils 5 }`
- The `along` keyword is NOT implemented in the parser
- This would require adding ALONG token type and handling in extrude parsing
- Consider as a future enhancement

---

## Bug #4: Function-Style Define Statements (Icosahedron.shape)

### Error
```
Parse error at line 22, column 24: Unexpected token: LBRACE
```

### Root Cause
Line 22 in Icosahedron.shape:
```shapescript
define triangle(a b c) {
    polygon {
        point a
        point b
        point c
    }
}
```

This is a **function-style define** with parameters `(a b c)`, which is NOT currently supported by the parser.

Current `DefineNode` type (lines 161-167 in types.ts):
```typescript
export interface DefineNode {
  type: "define";
  name: string;
  value?: Expression;        // For variables
  options?: OptionNode[];    // For custom shapes with options
  body?: SceneNode[];        // For custom shapes
}
```

Function parameters are not represented in the AST.

### Fix
This is a **major feature addition** that requires:

1. **Type Definition Changes** (`types.ts`):
   - Add `parameters?: string[]` to `DefineNode`

2. **Parser Changes** (`parser.ts`):
   - In `parseDefine()` (lines 1112-1169), after parsing the name:
     - Check if next token is `LPAREN`
     - If yes, parse parameter list: `(a b c)` → `["a", "b", "c"]`
     - Store parameters in DefineNode

3. **Evaluator Changes** (need to check evaluator.ts):
   - When invoking a custom shape with parameters, bind arguments to parameters in scope
   - Example: `triangle points.first points.second points.third` should bind:
     - `a = points.first`
     - `b = points.second`
     - `c = points.third`

4. **Invocation Changes**:
   - Custom shape invocation may need to support both:
     - Property syntax: `cog { teeth 8 }`
     - Argument syntax: `triangle points.first points.second points.third`

**Files**:
- `src/utils/shapescript/types.ts`: Add parameters field
- `src/utils/shapescript/parser.ts`: Parse parameter lists in defines
- `src/utils/shapescript/evaluator.ts`: Handle parameter binding (need to review)
- `src/utils/shapescript/toThreeJS.ts`: Handle parameterized shapes (need to review)

**Complexity**: HIGH - This is a significant language feature addition

---

## Implementation Order

### Priority 1: Quick Wins (Bugs #1, #3)
1. **Bug #1 (Group)**: Simple refactoring, low risk
2. **Bug #3 (Path)**: Medium complexity, focused on one method

### Priority 2: Investigation (Bug #2)
3. **Bug #2 (Cog)**: Needs debugging to identify exact issue

### Priority 3: Major Feature (Bug #4)
4. **Bug #4 (Functions)**: Complex feature, requires changes across multiple files

---

## Testing Strategy

After each fix:
1. Run `npx tsx test-shapescript.ts` to verify:
   - The specific failing test now passes
   - No regressions in previously passing tests
   - Transform regression tests still pass (3/3)

Target: **10/10 examples passing**

---

## Notes

- Bug #1 is the most straightforward fix
- Bug #3 requires careful expression boundary detection
- Bug #2 needs investigation to understand exact failure
- Bug #4 is a major feature that may be out of scope for initial fixes

## Recommendation

Start with Bugs #1 and #3 to get quick wins (8/10 passing), then investigate Bug #2. Consider Bug #4 as a future enhancement given its complexity.
