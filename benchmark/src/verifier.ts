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
    const dataPresence = verifyDataPresence(calculated, testCase);

    // 4. Verify result correctness
    const resultCorrectness = verifyResultCorrectness(calculated, testCase);

    // 5. Verify formula usage
    const formulaUsage = verifyFormulaUsage(sheet, calculated, testCase);

    // 6. Check formatting
    const formatting = checkFormatting(sheet);

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
  sheet: SpreadsheetSheet,
  testCase: TestCase,
): DataPresenceResult {
  const maxScore = 15;
  let score = 0;

  const foundElements: string[] = [];
  const missingElements: string[] = [];
  const foundValues: Array<{ label: string; value: number }> = [];
  const missingValues: string[] = [];

  // Extract all labels from the sheet
  const labels = extractLabels(sheet);

  // Check required elements
  if (testCase.requiredElements) {
    const elementScore = maxScore * 0.47; // 7 points
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
  }

  // Check required values
  if (testCase.requiredValues) {
    const valueScore = maxScore * 0.53; // 8 points
    let foundCount = 0;

    for (const reqValue of testCase.requiredValues) {
      const extracted = findByLabel(
        sheet,
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
  sheet: SpreadsheetSheet,
  testCase: TestCase,
): ResultCorrectnessResult {
  const maxScore = 50;
  const assertions: AssertionResult[] = [];
  let passedCount = 0;

  for (const assertion of testCase.assertions) {
    try {
      // Simple label-based extraction (can be extended with more complex extractors)
      const extracted = findByLabel(sheet, assertion.extractor, false);

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
    const extracted = findByLabel(calculatedSheet, assertion.extractor, false);
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
 * Check for appropriate formatting
 */
function checkFormatting(sheet: SpreadsheetSheet): FormattingResult {
  const maxScore = 10;
  let score = 0;

  let hasCurrency = false;
  let hasPercentage = false;
  let hasNumberFormatting = false;
  let formatCount = 0;

  // Check all cells for formatting
  for (const row of sheet.data) {
    for (const cell of row) {
      if (typeof cell === "object" && cell !== null && "f" in cell) {
        const format = cell.f;
        if (format) {
          formatCount++;

          if (format.includes("$") || format.includes("€") || format.includes("£")) {
            hasCurrency = true;
          }
          if (format.includes("%")) {
            hasPercentage = true;
          }
          if (
            format.includes("#,##0") ||
            format.includes("0.00") ||
            format.includes("0.0")
          ) {
            hasNumberFormatting = true;
          }
        }
      }
    }
  }

  // Score formatting
  if (hasCurrency) score += 3;
  if (hasPercentage) score += 3;
  if (hasNumberFormatting) score += 4;

  return {
    score,
    maxScore,
    hasCurrency,
    hasPercentage,
    hasNumberFormatting,
    formatCount,
  };
}
