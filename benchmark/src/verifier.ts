/**
 * Verification Engine
 *
 * Verifies LLM-generated spreadsheets against test cases using
 * structure-agnostic semantic extraction.
 */

import { SpreadsheetEngine } from "../../src/tools/models/spreadsheet-engine";
import type {
  SpreadsheetToolData,
  SpreadsheetSheet,
} from "../../src/tools/models/spreadsheet";
import type {
  TestCase,
  VerificationResult,
  DataPresenceResult,
  ResultCorrectnessResult,
  FormulaUsageResult,
  FormattingResult,
  AssertionResult,
} from "./types";
import {
  findByLabel,
  extractSemanticData,
  extractFormulas,
  extractLabels,
  findValue,
  cellHasFormula,
} from "./semantic-extractor";

// Import all spreadsheet functions
import "../../src/tools/models/spreadsheet-engine/functions";

/**
 * Main verification function
 */
export async function verifySpreadsheet(
  llmOutputJson: string,
  testCase: TestCase,
): Promise<VerificationResult> {
  const startTime = Date.now();
  const errors: string[] = [];
  const warnings: string[] = [];

  try {
    // 1. Parse LLM output
    const generatedOutput: SpreadsheetToolData = JSON.parse(llmOutputJson);

    if (!generatedOutput.sheets || generatedOutput.sheets.length === 0) {
      throw new Error("No sheets found in generated output");
    }

    // 2. Calculate formulas using spreadsheet engine
    const engine = new SpreadsheetEngine();
    const sheet = generatedOutput.sheets[0];
    const calculated = engine.calculate(sheet);

    // 3. Verify data presence
    const dataPresence = verifyDataPresence(sheet, calculated, testCase);

    // 4. Verify result correctness
    const resultCorrectness = verifyResultCorrectness(sheet, calculated, testCase);

    // 5. Verify formula usage
    const formulaUsage = verifyFormulaUsage(sheet, calculated, testCase);

    // 6. Check formatting
    const formatting = checkFormatting(sheet, calculated, testCase);

    // 7. Calculate total score
    const totalScore =
      dataPresence.score +
      resultCorrectness.score +
      formulaUsage.score +
      formatting.score;

    const maxScore =
      dataPresence.maxScore +
      resultCorrectness.maxScore +
      formulaUsage.maxScore +
      formatting.maxScore;

    const passed = totalScore >= maxScore * 0.7; // 70% threshold

    const executionTime = Date.now() - startTime;

    return {
      testCaseId: testCase.id,
      passed,
      score: Math.round(totalScore),
      maxScore,
      dataPresence,
      resultCorrectness,
      formulaUsage,
      formatting,
      errors,
      warnings,
      executionTime,
      generatedOutput,
    };
  } catch (error) {
    const executionTime = Date.now() - startTime;
    const errorMessage =
      error instanceof Error ? error.message : String(error);
    errors.push(errorMessage);

    return {
      testCaseId: testCase.id,
      passed: false,
      score: 0,
      maxScore: 100,
      dataPresence: {
        score: 0,
        maxScore: 15,
        foundElements: [],
        missingElements: [],
        foundValues: [],
        missingValues: [],
      },
      resultCorrectness: {
        score: 0,
        maxScore: 50,
        assertions: [],
        passedCount: 0,
        totalCount: testCase.assertions.length,
      },
      formulaUsage: {
        score: 0,
        maxScore: 25,
        formulaCount: 0,
        hardCodedCount: 0,
        formulasFound: [],
        functionsUsed: [],
        expectedFunctions: testCase.expectedFunctions || [],
        missingFunctions: testCase.expectedFunctions || [],
        requirementResults: [],
      },
      formatting: {
        score: 0,
        maxScore: 10,
        hasCurrency: false,
        hasPercentage: false,
        hasNumberFormatting: false,
        formatCount: 0,
      },
      errors,
      warnings,
      executionTime,
    };
  }
}

/**
 * Verify presence of required data elements and values
 */
function verifyDataPresence(
  originalSheet: SpreadsheetSheet,
  calculatedSheet: SpreadsheetSheet,
  testCase: TestCase,
): DataPresenceResult {
  const maxScore = 15;
  let score = 0;

  const foundElements: string[] = [];
  const missingElements: string[] = [];
  const foundValues: Array<{ label: string; value: number }> = [];
  const missingValues: string[] = [];

  // Extract all labels from the calculated sheet
  const labels = extractLabels(calculatedSheet);

  // Check required elements
  const elementScore = maxScore * 0.47; // 7 points
  if (testCase.requiredElements && testCase.requiredElements.length > 0) {
    let foundCount = 0;

    for (const element of testCase.requiredElements) {
      const elementStr = String(element.value);
      const found = labels.some((label) =>
        label.toLowerCase().includes(elementStr.toLowerCase()),
      );

      if (found) {
        foundElements.push(elementStr);
        foundCount++;
      } else {
        missingElements.push(elementStr);
      }
    }

    score +=
      (foundCount / testCase.requiredElements.length) * elementScore;
  } else {
    // No element requirements - award full credit for this section
    score += elementScore;
  }

  // Check required values
  const valueScore = maxScore * 0.53; // 8 points
  if (testCase.requiredValues && testCase.requiredValues.length > 0) {
    let foundCount = 0;

    for (const reqValue of testCase.requiredValues) {
      const extracted = findByLabelWithFormulas(
        originalSheet,
        calculatedSheet,
        reqValue.label,
        false,
      );

      if (
        extracted &&
        typeof extracted.value === "number" &&
        Math.abs(extracted.value - reqValue.value) <=
          (reqValue.tolerance || 0)
      ) {
        foundValues.push({
          label: reqValue.label,
          value: extracted.value,
        });
        foundCount++;
      } else {
        missingValues.push(reqValue.label);
      }
    }

    score += (foundCount / testCase.requiredValues.length) * valueScore;
  } else {
    // No value requirements - award full credit for this section
    score += valueScore;
  }

  // Deduct for missing elements
  const missingCount = missingElements.length + missingValues.length;
  score = Math.max(0, score - missingCount * 3);

  return {
    score: Math.min(maxScore, score),
    maxScore,
    foundElements,
    missingElements,
    foundValues,
    missingValues,
  };
}

/**
 * Verify calculated results match expected assertions
 */
function verifyResultCorrectness(
  originalSheet: SpreadsheetSheet,
  calculatedSheet: SpreadsheetSheet,
  testCase: TestCase,
): ResultCorrectnessResult {
  const maxScore = 50;
  const assertions: AssertionResult[] = [];
  let passedCount = 0;

  for (const assertion of testCase.assertions) {
    try {
      // Simple label-based extraction (can be extended with more complex extractors)
      const extracted = findByLabelWithFormulas(
        originalSheet,
        calculatedSheet,
        assertion.extractor,
        false,
      );

      if (extracted === null) {
        assertions.push({
          name: assertion.name,
          passed: false,
          expected: assertion.expected,
          actual: null,
          error: `Could not find value for: ${assertion.extractor}`,
        });
        continue;
      }

      const actual = extracted.value;
      let passed = false;

      if (typeof assertion.expected === "number" && typeof actual === "number") {
        const tolerance = assertion.tolerance || 0.01;
        passed = Math.abs(actual - assertion.expected) <= tolerance;
      } else {
        passed = String(actual) === String(assertion.expected);
      }

      if (passed) passedCount++;

      assertions.push({
        name: assertion.name,
        passed,
        expected: assertion.expected,
        actual,
      });
    } catch (error) {
      assertions.push({
        name: assertion.name,
        passed: false,
        expected: assertion.expected,
        actual: null,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const score =
    testCase.assertions.length > 0
      ? (passedCount / testCase.assertions.length) * maxScore
      : maxScore;

  return {
    score,
    maxScore,
    assertions,
    passedCount,
    totalCount: testCase.assertions.length,
  };
}

/**
 * Find value associated with a label, using original sheet to detect formulas
 * This version checks the original sheet for formulas and returns calculated values
 * Supports pipe-separated synonyms (e.g., "Total|Sum" will match either "Total" or "Sum")
 */
export function findByLabelWithFormulas(
  originalSheet: SpreadsheetSheet,
  calculatedSheet: SpreadsheetSheet,
  label: string,
  caseSensitive: boolean,
): { label: string; value: any; location: any; confidence: number } | null {
  // Support pipe-separated synonyms
  const labelAlternatives = label.split('|').map(l => l.trim());

  // Try each alternative and return the best match
  for (const labelAlt of labelAlternatives) {
    const result = findByLabelWithFormulasInternal(
      originalSheet,
      calculatedSheet,
      labelAlt,
      caseSensitive
    );
    if (result !== null) {
      return result;
    }
  }

  return null;
}

/**
 * Internal implementation of label finding
 */
function findByLabelWithFormulasInternal(
  originalSheet: SpreadsheetSheet,
  calculatedSheet: SpreadsheetSheet,
  label: string,
  caseSensitive: boolean,
): { label: string; value: any; location: any; confidence: number } | null {
  const originalData = originalSheet.data;
  const calculatedData = calculatedSheet.data;

  // Collect all potential matches with scoring
  const potentialMatches: Array<{
    row: number;
    col: number;
    cellStr: string;
    numericCells: Array<{ col: number; value: number; hasFormula: boolean }>;
    score: number;
  }> = [];

  for (let row = 0; row < originalData.length; row++) {
    for (let col = 0; col < originalData[row].length; col++) {
      const cell = originalData[row][col];
      const cellValue = typeof cell === "object" && cell !== null && "v" in cell ? cell.v : cell;
      const cellStr = String(cellValue);

      // Calculate match score
      let matchScore = 0;
      const searchLower = label.toLowerCase();
      const cellLower = cellStr.toLowerCase();

      if (caseSensitive ? cellStr === label : cellLower === searchLower) {
        matchScore = 1000; // Exact match - highest priority
      } else if (caseSensitive ? cellStr.startsWith(label) : cellLower.startsWith(searchLower)) {
        matchScore = 100; // Starts with - high priority
      } else if (caseSensitive ? cellStr.includes(label) : cellLower.includes(searchLower)) {
        matchScore = 10; // Contains - lower priority
      }

      // Apply length penalty - prefer shorter, more specific labels
      if (matchScore > 0) {
        matchScore -= cellStr.length * 0.1;
      }

      if (matchScore > 0) {
        // Found a matching label, collect numeric cells in the same row
        const numericCells: Array<{
          col: number;
          value: number | string;
          hasFormula: boolean;
        }> = [];

        for (let c = col + 1; c < originalData[row].length; c++) {
          // Check if original cell has formula
          const originalCell = originalData[row][c];
          const originalValue =
            typeof originalCell === "object" && originalCell !== null && "v" in originalCell
              ? originalCell.v
              : originalCell;
          const hasFormula =
            typeof originalValue === "string" && originalValue.startsWith("=");

          // Get calculated value (numeric or string)
          const calculatedCell = calculatedData[row][c];
          const calculatedValue =
            typeof calculatedCell === "object" && calculatedCell !== null && "v" in calculatedCell
              ? calculatedCell.v
              : calculatedCell;

          // Extract value from calculated cell (numeric or string)
          let value: number | string | null = null;
          if (typeof calculatedValue === "number") {
            value = calculatedValue;
          } else if (typeof calculatedValue === "string") {
            // Try to parse as number first
            const cleaned = calculatedValue.replace(/[$,€£¥%]/g, "").trim();
            const parsed = parseFloat(cleaned);
            // If it's a valid number, use it; otherwise keep the string
            value = isNaN(parsed) ? calculatedValue : parsed;
          }

          if (value !== null && value !== "") {
            numericCells.push({
              col: c,
              value: value,
              hasFormula,
            });
          }
        }

        // Only add to potential matches if we found value cells
        if (numericCells.length > 0) {
          potentialMatches.push({
            row,
            col,
            cellStr,
            numericCells,
            score: matchScore,
          });
        }
      }
    }
  }

  // Sort matches by score (highest first)
  potentialMatches.sort((a, b) => b.score - a.score);

  // Return the best match
  if (potentialMatches.length > 0) {
    const bestMatch = potentialMatches[0];
    const numericCells = bestMatch.numericCells;

    // Prioritize cells with formulas over static values
    const formulaCells = numericCells.filter((c) => c.hasFormula);
    const numericFormulaCells = formulaCells.filter(
      (c) => typeof c.value === "number",
    );
    if (numericFormulaCells.length > 0) {
      // Prefer formula-driven numeric results (e.g., averages) over string formulas
      const bestCell = numericFormulaCells[numericFormulaCells.length - 1];
      return {
        label,
        value: bestCell.value,
        location: {
          row: bestMatch.row,
          col: bestCell.col,
          value: calculatedData[bestMatch.row][bestCell.col],
        },
        confidence: 1.0,
      };
    }

    if (formulaCells.length > 0) {
      // Fall back to any formula cell (may be string results like letter grades)
      const bestCell = formulaCells[formulaCells.length - 1];
      return {
        label,
        value: bestCell.value,
        location: {
          row: bestMatch.row,
          col: bestCell.col,
          value: calculatedData[bestMatch.row][bestCell.col],
        },
        confidence: 1.0,
      };
    }

    const numericValueCells = numericCells.filter(
      (c) => typeof c.value === "number",
    );
    if (numericValueCells.length > 0) {
      const bestCell = numericValueCells[numericValueCells.length - 1];
      return {
        label,
        value: bestCell.value,
        location: {
          row: bestMatch.row,
          col: bestCell.col,
          value: calculatedData[bestMatch.row][bestCell.col],
        },
        confidence: 0.9,
      };
    }

    // If only string cells remain, fall back to the rightmost entry (string data)
    const bestCell = numericCells[numericCells.length - 1];
    return {
      label,
      value: bestCell.value,
      location: {
        row: bestMatch.row,
        col: bestCell.col,
        value: calculatedData[bestMatch.row][bestCell.col],
      },
      confidence: 0.9,
    };
  }

  return null;
}

/**
 * Verify appropriate use of formulas and functions
 */
function verifyFormulaUsage(
  originalSheet: SpreadsheetSheet,
  calculatedSheet: SpreadsheetSheet,
  testCase: TestCase,
): FormulaUsageResult {
  const maxScore = 25;
  let score = 0;

  // Extract formula information
  const formulas = extractFormulas(originalSheet);
  const formulaCount = formulas.length;
  const functionsUsed = new Set<string>();

  formulas.forEach((f) => {
    f.functions.forEach((fn) => functionsUsed.add(fn));
  });

  // Count hard-coded values (calculated cells without formulas)
  let hardCodedCount = 0;

  for (const assertion of testCase.assertions) {
    const extracted = findByLabelWithFormulas(
      originalSheet,
      calculatedSheet,
      assertion.extractor,
      false,
    );
    if (extracted && !cellHasFormula(originalSheet, extracted.location.row, extracted.location.col)) {
      // This should be a formula but it's hard-coded
      if (typeof extracted.value === "number") {
        hardCodedCount++;
      }
    }
  }

  // Score for using formulas (15 points)
  if (formulaCount > 0 && hardCodedCount === 0) {
    score += 15;
  } else if (formulaCount > 0) {
    score += Math.max(0, 15 - hardCodedCount * 5);
  }

  // Score for using appropriate functions (7 points)
  const expectedFunctions = testCase.expectedFunctions || [];
  const missingFunctions: string[] = [];

  if (expectedFunctions.length > 0) {
    let foundCount = 0;
    for (const expectedFn of expectedFunctions) {
      if (functionsUsed.has(expectedFn.toUpperCase())) {
        foundCount++;
      } else {
        missingFunctions.push(expectedFn);
      }
    }
    score += (foundCount / expectedFunctions.length) * 7;
  } else {
    score += 7; // No specific functions required
  }

  // Score for best practices (3 points)
  // Give points if formulas are used appropriately
  if (formulaCount > 0 && hardCodedCount === 0) {
    score += 3;
  } else if (formulaCount > hardCodedCount) {
    score += 1.5;
  }

  // Check formula requirements
  const requirementResults = (testCase.formulaRequirements || []).map(
    (req) => {
      // Simple heuristic check (can be enhanced)
      let passed = formulaCount > 0;

      return {
        description: req.description,
        passed,
        optional: req.optional || false,
      };
    },
  );

  return {
    score: Math.min(maxScore, score),
    maxScore,
    formulaCount,
    hardCodedCount,
    formulasFound: formulas,
    functionsUsed: Array.from(functionsUsed),
    expectedFunctions,
    missingFunctions,
    requirementResults,
  };
}

/**
 * Check if a cell has a specific type of formatting
 */
function hasFormatType(
  formatString: string | undefined,
  type: "currency" | "percentage" | "number" | "date" | "text",
): boolean {
  if (!formatString) return false;

  switch (type) {
    case "currency":
      return (
        formatString.includes("$") ||
        formatString.includes("€") ||
        formatString.includes("£") ||
        formatString.includes("¥")
      );
    case "percentage":
      return formatString.includes("%");
    case "number":
      return (
        formatString.includes("#,##0") ||
        formatString.includes("0.00") ||
        formatString.includes("0.0") ||
        /\d/.test(formatString)
      );
    case "date":
      return (
        formatString.includes("MM") ||
        formatString.includes("DD") ||
        formatString.includes("YYYY") ||
        formatString.includes("m/d/y")
      );
    case "text":
      return formatString.includes("@");
    default:
      return false;
  }
}

/**
 * Check for appropriate formatting based on test case requirements
 */
function checkFormatting(
  originalSheet: SpreadsheetSheet,
  calculatedSheet: SpreadsheetSheet,
  testCase: TestCase,
): FormattingResult {
  const maxScore = 10;
  let score = 0;

  // Legacy fields for backward compatibility
  let hasCurrency = false;
  let hasPercentage = false;
  let hasNumberFormatting = false;
  let formatCount = 0;

  // Count all formatting in the sheet (for legacy fields)
  for (const row of originalSheet.data) {
    for (const cell of row) {
      if (typeof cell === "object" && cell !== null && "f" in cell) {
        const format = cell.f;
        if (format) {
          formatCount++;
          if (hasFormatType(format, "currency")) hasCurrency = true;
          if (hasFormatType(format, "percentage")) hasPercentage = true;
          if (hasFormatType(format, "number")) hasNumberFormatting = true;
        }
      }
    }
  }

  const requirementResults: FormattingResult["requirementResults"] = [];

  // If no formatting requirements specified, use legacy scoring
  if (
    !testCase.formattingRequirements ||
    testCase.formattingRequirements.length === 0
  ) {
    // Legacy behavior: give full score if any appropriate formatting is present
    // This prevents penalizing old test cases
    if (hasCurrency || hasPercentage || hasNumberFormatting) {
      score = maxScore;
    } else {
      score = 0;
    }

    return {
      score,
      maxScore,
      requirementResults: [],
      hasCurrency,
      hasPercentage,
      hasNumberFormatting,
      formatCount,
    };
  }

  // New context-aware scoring based on formatting requirements
  const pointsPerRequirement = maxScore / testCase.formattingRequirements.length;

  for (const requirement of testCase.formattingRequirements) {
    const required = requirement.required !== false; // default true
    let passed = true;
    const details: string[] = [];
    let formattedCount = 0;
    let totalCount = 0;

    // Check each label that should have this formatting
    for (const label of requirement.appliesTo) {
      totalCount++;
      const extracted = findByLabelWithFormulas(
        originalSheet,
        calculatedSheet,
        label,
        false,
      );

      if (!extracted) {
        details.push(`❌ "${label}" not found`);
        passed = false;
        continue;
      }

      // Get the format string from the original cell
      const cellValue = originalSheet.data[extracted.location.row]?.[extracted.location.col];
      const formatString =
        typeof cellValue === "object" && cellValue !== null && "f" in cellValue
          ? cellValue.f
          : undefined;

      if (hasFormatType(formatString, requirement.type)) {
        details.push(`✓ "${label}" has ${requirement.type} format`);
        formattedCount++;
      } else {
        details.push(`❌ "${label}" missing ${requirement.type} format`);
        passed = false;
      }
    }

    // Calculate partial credit based on how many cells have correct formatting
    const partialScore =
      totalCount > 0
        ? (formattedCount / totalCount) * pointsPerRequirement
        : 0;

    if (passed) {
      score += pointsPerRequirement;
    } else if (!required) {
      // Optional requirements don't affect score negatively
      score += partialScore;
    } else {
      // Required but not fully met - give partial credit
      score += partialScore;
    }

    requirementResults.push({
      type: requirement.type,
      appliesTo: requirement.appliesTo,
      required,
      passed,
      details: details.join("; "),
    });
  }

  return {
    score: Math.min(maxScore, Math.round(score * 10) / 10),
    maxScore,
    requirementResults,
    hasCurrency,
    hasPercentage,
    hasNumberFormatting,
    formatCount,
  };
}
