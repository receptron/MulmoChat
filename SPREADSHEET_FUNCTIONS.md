# Spreadsheet Functions Reference

This document lists all available functions in the MulmoChat spreadsheet tool.

## Summary

**Total Functions**: 51 functions across 4 categories
- **Statistical**: 13 functions
- **Mathematical**: 17 functions
- **Logical**: 9 functions
- **Text**: 17 functions

---

## Statistical Functions (13)

### Basic Aggregation
- **SUM(range)** - Returns the sum of all numbers in a range
  - Example: `SUM(A1:A10)`

- **AVERAGE(range)** - Returns the average (arithmetic mean) of numbers in a range
  - Example: `AVERAGE(B2:B20)`

- **MAX(range)** - Returns the largest value in a range
  - Example: `MAX(C1:C10)`

- **MIN(range)** - Returns the smallest value in a range
  - Example: `MIN(D1:D10)`

- **COUNT(range)** - Counts the number of cells in a range
  - Example: `COUNT(A1:A10)`

- **COUNTA(range)** - Counts the number of non-empty cells in a range
  - Example: `COUNTA(A1:A10)`

### Advanced Statistics
- **MEDIAN(range)** - Returns the median (middle) value in a range
  - Example: `MEDIAN(A1:A10)`

- **MODE(range)** - Returns the most frequently occurring value in a range
  - Example: `MODE(B1:B20)`

- **STDEV(range)** - Returns the standard deviation of numbers in a range
  - Example: `STDEV(C1:C10)`

- **VAR(range)** - Returns the variance of numbers in a range
  - Example: `VAR(D1:D10)`

### Conditional Statistics
- **COUNTIF(range, criteria)** - Counts cells in a range that match a criteria
  - Example: `COUNTIF(A1:A10, ">5")`
  - Example: `COUNTIF(B1:B10, "Yes")`

- **SUMIF(range, criteria, [sum_range])** - Sums cells in a range that match a criteria
  - Example: `SUMIF(A1:A10, ">5")`
  - Example: `SUMIF(A1:A10, ">5", B1:B10)`

- **AVERAGEIF(range, criteria, [average_range])** - Averages cells in a range that match a criteria
  - Example: `AVERAGEIF(A1:A10, ">5")`
  - Example: `AVERAGEIF(A1:A10, ">5", B1:B10)`

---

## Mathematical Functions (17)

### Rounding Functions
- **ROUND(number, digits)** - Rounds a number to a specified number of digits
  - Example: `ROUND(3.14159, 2)` → 3.14

- **ROUNDUP(number, digits)** - Rounds a number up, away from zero
  - Example: `ROUNDUP(3.14159, 2)` → 3.15

- **ROUNDDOWN(number, digits)** - Rounds a number down, toward zero
  - Example: `ROUNDDOWN(3.14159, 2)` → 3.14

- **FLOOR(number, significance)** - Rounds a number down to the nearest multiple of significance
  - Example: `FLOOR(24, 5)` → 20

- **CEILING(number, significance)** - Rounds a number up to the nearest multiple of significance
  - Example: `CEILING(24, 5)` → 25

- **INT(number)** - Rounds a number down to the nearest integer
  - Example: `INT(3.7)` → 3

- **TRUNC(number, [digits])** - Truncates a number to a specified number of decimal places
  - Example: `TRUNC(3.14159, 2)` → 3.14

### Basic Math
- **ABS(number)** - Returns the absolute value of a number
  - Example: `ABS(-5)` → 5

- **POWER(base, exponent)** - Returns the result of a number raised to a power
  - Example: `POWER(2, 3)` → 8

- **SQRT(number)** - Returns the square root of a number
  - Example: `SQRT(16)` → 4

- **MOD(number, divisor)** - Returns the remainder after division
  - Example: `MOD(10, 3)` → 1

- **SIGN(number)** - Returns the sign of a number (1, 0, or -1)
  - Example: `SIGN(-5)` → -1

### Logarithmic & Exponential
- **EXP(number)** - Returns e raised to the power of a number
  - Example: `EXP(1)` → 2.718...

- **LN(number)** - Returns the natural logarithm of a number
  - Example: `LN(10)` → 2.302...

- **LOG(number, [base])** - Returns the logarithm of a number to a specified base (default 10)
  - Example: `LOG(100)` → 2
  - Example: `LOG(8, 2)` → 3

- **LOG10(number)** - Returns the base-10 logarithm of a number
  - Example: `LOG10(100)` → 2

### Constants
- **PI()** - Returns the value of pi (3.14159...)
  - Example: `PI()*2` → 6.283...

---

## Logical Functions (9)

### Conditionals
- **IF(condition, trueValue, falseValue)** - Returns one value if a condition is true and another if false
  - Example: `IF(A1>10, "High", "Low")`
  - Example: `IF(B2>=5, SUM(C1:C10), 0)`

- **IFS(condition1, value1, condition2, value2, ...)** - Checks multiple conditions and returns the first true result
  - Example: `IFS(A1>90, "A", A1>80, "B", A1>70, "C")`

### Boolean Operations
- **AND(condition1, condition2, ...)** - Returns TRUE if all arguments are true
  - Example: `AND(A1>5, B1<10)`

- **OR(condition1, condition2, ...)** - Returns TRUE if any argument is true
  - Example: `OR(A1>5, B1<10)`

- **NOT(condition)** - Reverses the logical value of its argument
  - Example: `NOT(A1>5)`

- **TRUE()** - Returns the logical value TRUE
  - Example: `TRUE()`

- **FALSE()** - Returns the logical value FALSE
  - Example: `FALSE()`

### Error Handling
- **IFERROR(value, value_if_error)** - Returns a value if expression is an error, otherwise returns the expression
  - Example: `IFERROR(A1/B1, 0)`

- **IFNA(value, value_if_na)** - Returns a value if expression is #N/A, otherwise returns the expression
  - Example: `IFNA(A1, "N/A")`

---

## Text Functions (17)

### Concatenation
- **CONCATENATE(text1, text2, ...)** - Joins several text strings into one string
  - Example: `CONCATENATE("Hello", " ", "World")`

- **CONCAT(text1, text2, ...)** - Same as CONCATENATE
  - Example: `CONCAT(A1, B1)`

### Extraction
- **LEFT(text, [num_chars])** - Returns the leftmost characters from a text string
  - Example: `LEFT("Hello", 2)` → "He"

- **RIGHT(text, [num_chars])** - Returns the rightmost characters from a text string
  - Example: `RIGHT("Hello", 2)` → "lo"

- **MID(text, start, num_chars)** - Returns characters from the middle of a text string
  - Example: `MID("Hello", 2, 3)` → "ell"

### Case Conversion
- **UPPER(text)** - Converts text to uppercase
  - Example: `UPPER("hello")` → "HELLO"

- **LOWER(text)** - Converts text to lowercase
  - Example: `LOWER("HELLO")` → "hello"

- **PROPER(text)** - Capitalizes the first letter of each word
  - Example: `PROPER("hello world")` → "Hello World"

### Search & Replace
- **FIND(find_text, within_text, [start])** - Finds one text string within another (case-sensitive)
  - Example: `FIND("o", "Hello")` → 5

- **SEARCH(find_text, within_text, [start])** - Finds one text string within another (case-insensitive)
  - Example: `SEARCH("O", "Hello")` → 5

- **SUBSTITUTE(text, old_text, new_text, [instance])** - Replaces old text with new text in a string
  - Example: `SUBSTITUTE("Hello World", "World", "Earth")` → "Hello Earth"

- **REPLACE(old_text, start_pos, num_chars, new_text)** - Replaces part of a text string with a different text string
  - Example: `REPLACE("Hello World", 7, 5, "Earth")` → "Hello Earth"

### Text Manipulation
- **TRIM(text)** - Removes extra spaces from text
  - Example: `TRIM("  hello  world  ")` → "hello world"

### Information
- **LEN(text)** - Returns the number of characters in a text string
  - Example: `LEN("Hello")` → 5

- **EXACT(text1, text2)** - Checks if two text strings are exactly the same (case-sensitive)
  - Example: `EXACT("Hello", "hello")` → FALSE

### Conversion
- **TEXT(value, format)** - Formats a number and converts it to text
  - Example: `TEXT(1234.5, "$#,##0.00")` → "$1,234.50"
  - Example: `TEXT(0.5, "0%")` → "50%"

- **VALUE(text)** - Converts a text string to a number
  - Example: `VALUE("123")` → 123
  - Example: `VALUE("$1,234.56")` → 1234.56

---

## Formula Features

### Cell References
- **Simple**: `A1`, `B2`, `C10`
- **Absolute**: `$A$1`, `$B$2` (won't change when copied)
- **Cross-sheet**: `'Sheet1'!A1`, `Sheet2!B5`

### Range References
- **Column range**: `A1:A10` (all cells from A1 to A10)
- **Row range**: `A1:E1` (all cells from A1 to E1)
- **Rectangle**: `A1:E10` (all cells in rectangle)

### Arithmetic Operators
- **Addition**: `A1+B1`
- **Subtraction**: `A1-B1`
- **Multiplication**: `A1*B1`
- **Division**: `A1/B1`
- **Exponentiation**: `A1^2` (A1 squared)

### Nested Functions
Functions can be nested within each other:
- `IF(SUM(A1:A10)>100, "High", "Low")`
- `ROUND(AVERAGE(B1:B10), 2)`
- `CONCATENATE("Total: ", TEXT(SUM(C1:C10), "$#,##0.00"))`

### Number Formatting
Use these format codes in formula objects:
- **Currency**: `$#,##0.00` → $1,234.56
- **Integer with commas**: `#,##0` → 1,235
- **Percentage**: `0.00%` → 12.34%
- **Decimal**: `0.00` → 12.34

---

## Criteria Syntax (for COUNTIF, SUMIF, AVERAGEIF)

- **Greater than**: `">5"`, `">=10"`
- **Less than**: `"<5"`, `"<=10"`
- **Equal to**: `"=5"`, `"Yes"`
- **Not equal**: `"<>5"`, `"!=No"`
- **Text match**: `"Apple"`, `"Yes"`

Examples:
```
COUNTIF(A1:A10, ">5")        // Count cells greater than 5
SUMIF(B1:B10, ">=100", C1:C10)  // Sum C cells where B >= 100
AVERAGEIF(A1:A10, "<>0")     // Average non-zero cells
```

---

## Examples

### Financial Analysis
```
Revenue:     1000000
Expenses:    750000
Profit:      {f: "A1-A2", z: "$#,##0"}
Margin:      {f: "A3/A1", z: "0.00%"}
```

### Grade Calculator
```
Score:       85
Grade:       {f: "IFS(A1>=90, 'A', A1>=80, 'B', A1>=70, 'C', A1>=60, 'D', TRUE(), 'F')"}
```

### Text Processing
```
Name:        "john doe"
Formatted:   {f: "PROPER(A1)"}           // "John Doe"
Length:      {f: "LEN(A1)"}              // 8
Initials:    {f: "CONCATENATE(LEFT(A1,1), MID(A1, FIND(' ', A1)+1, 1))"}  // "jd"
```

### Statistics
```
Data:        [10, 20, 30, 40, 50]
Average:     {f: "AVERAGE(A1:A5)", z: "0.00"}     // 30.00
Median:      {f: "MEDIAN(A1:A5)", z: "0.00"}      // 30.00
StdDev:      {f: "STDEV(A1:A5)", z: "0.00"}       // 15.81
Max:         {f: "MAX(A1:A5)", z: "0"}            // 50
```
