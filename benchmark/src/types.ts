/**
 * LLM Spreadsheet Benchmark Types
 *
 * Core type definitions for the benchmark system
 */

import type {
  SpreadsheetSheet,
  SpreadsheetToolData,
} from "../../src/tools/models/spreadsheet";

// ============================================================================
// Test Case Definitions
// ============================================================================

export interface RequiredElement {
  type: "label" | "value";
  value: string | number;
  caseSensitive?: boolean;
}

export interface RequiredValue {
  label: string;
  value: number;
  tolerance?: number;
}

export interface Assertion {
  name: string;
  description?: string;
  extractor: string; // e.g., "findByLabel('Total')"
  expected: number | string;
  tolerance?: number;
}

export interface FormulaRequirement {
  description: string;
  check: string; // e.g., "cellWithLabel('Total').hasFormula()"
  optional?: boolean;
}

export interface FormattingRequirement {
  type: "currency" | "percentage" | "number" | "date" | "text";
  appliesTo: string[]; // Labels of cells that should have this format (e.g., ["Rent", "Food", "Total"])
  description?: string;
  required?: boolean; // default true
}

export interface TestCase {
  id: string;
  title: string;
  prompt: string;
  systemPrompt?: string;
  level: 1 | 2 | 3 | 4;
  category:
    | "basic"
    | "statistical"
    | "financial"
    | "logical"
    | "lookup"
    | "text"
    | "date"
    | "mathematical"
    | "complex";
  requiredElements?: RequiredElement[];
  requiredValues?: RequiredValue[];
  assertions: Assertion[];
  formulaRequirements?: FormulaRequirement[];
  formattingRequirements?: FormattingRequirement[];
  expectedFunctions?: string[];
  metadata?: {
    author?: string;
    created?: string;
    updated?: string;
    notes?: string;
  };
}

// ============================================================================
// Verification Results
// ============================================================================

export interface DataPresenceResult {
  score: number;
  maxScore: number;
  foundElements: string[];
  missingElements: string[];
  foundValues: Array<{ label: string; value: number }>;
  missingValues: string[];
}

export interface AssertionResult {
  name: string;
  passed: boolean;
  expected: number | string;
  actual: number | string | null;
  error?: string;
}

export interface ResultCorrectnessResult {
  score: number;
  maxScore: number;
  assertions: AssertionResult[];
  passedCount: number;
  totalCount: number;
}

export interface FormulaInfo {
  cell: string; // e.g., "B4"
  formula: string;
  functions: string[];
}

export interface FormulaUsageResult {
  score: number;
  maxScore: number;
  formulaCount: number;
  hardCodedCount: number;
  formulasFound: FormulaInfo[];
  functionsUsed: string[];
  expectedFunctions: string[];
  missingFunctions: string[];
  requirementResults: Array<{
    description: string;
    passed: boolean;
    optional: boolean;
  }>;
}

export interface FormattingResult {
  score: number;
  maxScore: number;
  requirementResults: Array<{
    type: string;
    appliesTo: string[];
    required: boolean;
    passed: boolean;
    details: string;
  }>;
  // Legacy fields for backward compatibility
  hasCurrency: boolean;
  hasPercentage: boolean;
  hasNumberFormatting: boolean;
  formatCount: number;
}

export interface VerificationResult {
  testCaseId: string;
  passed: boolean;
  score: number;
  maxScore: number;
  dataPresence: DataPresenceResult;
  resultCorrectness: ResultCorrectnessResult;
  formulaUsage: FormulaUsageResult;
  formatting: FormattingResult;
  errors: string[];
  warnings: string[];
  executionTime: number;
  generatedOutput?: SpreadsheetToolData;
}

// ============================================================================
// LLM Client
// ============================================================================

export interface LLMConfig {
  provider: "openai" | "anthropic" | "google";
  apiKey: string;
  model: string;
  temperature?: number;
  maxTokens?: number;
  systemPrompt?: string;
}

export interface LLMResponse {
  content: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  latency: number;
  error?: string;
}

export interface LLMClient {
  name: string;
  generateSpreadsheet(
    prompt: string,
    systemPrompt?: string,
  ): Promise<LLMResponse>;
}

// ============================================================================
// Benchmark Execution
// ============================================================================

export interface BenchmarkConfig {
  models: Record<string, LLMConfig>;
  verification: {
    tolerance: number;
    timeoutMs: number;
  };
  execution: {
    parallel: boolean;
    maxConcurrent: number;
    retryCount: number;
    retryDelayMs: number;
  };
}

export interface BenchmarkRun {
  metadata: {
    model: string;
    timestamp: string;
    duration: number;
    config: LLMConfig;
  };
  summary: {
    totalPrompts: number;
    averageScore: number;
    medianScore: number;
    passRate: number;
    perfectRate: number;
  };
  byLevel: Record<
    number,
    {
      count: number;
      avgScore: number;
      passRate: number;
    }
  >;
  byCategory: Record<
    string,
    {
      count: number;
      avgScore: number;
      passRate: number;
    }
  >;
  results: VerificationResult[];
}

// ============================================================================
// Semantic Extraction
// ============================================================================

export interface CellLocation {
  row: number;
  col: number;
  value: any;
  formula?: string;
}

export interface ExtractedValue {
  label: string;
  value: number | string;
  location: CellLocation;
  confidence: number;
}

export interface SemanticExtractionResult {
  values: ExtractedValue[];
  formulas: FormulaInfo[];
  labels: string[];
}
