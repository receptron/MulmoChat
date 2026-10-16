# LLM Spreadsheet Capability Benchmark

A comprehensive benchmarking system to evaluate Large Language Models' ability to generate accurate, formula-based spreadsheets.

## 🎯 Overview

This benchmark tests LLMs on creating structured spreadsheet data with formulas, which are then verified by our spreadsheet engine. The key innovation is **structure-agnostic verification** - we verify *semantic correctness* (what data exists and what results are calculated), NOT structural properties (which cell contains what).

### Key Features

- ✅ **Structure-Agnostic Verification**: Works with any spreadsheet layout (vertical, horizontal, different starting positions)
- ✅ **Comprehensive Scoring**: 4 categories - Data Presence (15%), Result Correctness (50%), Formula Usage (25%), Formatting (10%)
- ✅ **Multi-Provider Support**: OpenAI, Anthropic, and Google Gemini
- ✅ **Secure API Key Handling**: Keys loaded from `.env`, never exposed in results
- ✅ **Context-Aware Formatting**: Checks that the right formatting is used in the right places
- ✅ **Detailed Reporting**: JSON results with complete verification breakdown

## 🚀 Quick Start

### 1. Setup

Ensure you have API keys set in your `.env` file (in the project root):

```bash
# Cloud Providers (at least one required)
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
GEMINI_API_KEY=AIza...
XAI_API_KEY=xai-...

# Local Provider (optional)
# Ollama: No API key needed, runs locally on http://localhost:11434
# Install from https://ollama.ai/ and run: ollama pull gpt-oss:20b
```

### 2. Check Configuration

```bash
# Check which API keys are configured
npm run benchmark:check

# List available models
npm run benchmark:list
```

### 3. Run a Benchmark

```bash
# Run all tests for a model
npm run benchmark:llm -- run --model gpt-4o

# Run specific level (1-4)
npm run benchmark:llm -- run --model claude-3.5-sonnet --level 1

# Run specific category
npm run benchmark:llm -- run --model gemini-pro --category statistical

# Run specific test cases
npm run benchmark:llm -- run --model gpt-4 --ids basic-01,basic-02
```

## 📊 Understanding Results

### Score Breakdown

Each test is scored out of **100 points**:

| Category | Points | What It Measures |
|----------|--------|------------------|
| **Data Presence** | 15 | All required labels and values are present |
| **Result Correctness** | 50 | Calculated results match expected values (most important!) |
| **Formula Usage** | 25 | Uses formulas (not hard-coded), appropriate functions |
| **Formatting** | 10 | Currency, percentage, number formatting in right places |

**Pass Threshold**: 70/100

### Example Output

```
============================================================
🔧 LLM Spreadsheet Benchmark
Model: gpt-4o
Date: 2025-11-26
============================================================

Running 2 test cases...

  Running: basic-01 - Monthly Expenses
  Calling OpenAI gpt-4o...
  Response received (2795ms, 479 tokens)
  ✓ Score: 100/100 (2ms)

  Running: basic-02 - Simple Budget
  Calling OpenAI gpt-4o...
  Response received (4472ms, 698 tokens)
  ✗ Score: 13/100 (2ms)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Summary Statistics
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Overall Score:        56.5 / 100
Pass Rate (≥70):      50%
Perfect Score Rate:   50%

By Level:
  Level 1:  56.5 / 100  (2 tests, 50% pass)

By Category:
  basic       : 56.5 / 100  (2 tests)

Time: 9s
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

💾 Results saved to: benchmark/results/gpt-4o/run-2025-11-26T03-09-41-874Z.json
```

### Results Files

Detailed results are saved to `benchmark/results/<model-name>/run-<timestamp>.json`:

```json
{
  "metadata": {
    "model": "gpt-4o",
    "timestamp": "2025-11-26T03:09:41.874Z",
    "duration": 9,
    "config": {
      "provider": "openai",
      "model": "gpt-4o",
      "temperature": 0
      // NOTE: API keys are NEVER included in results
    }
  },
  "summary": {
    "totalPrompts": 2,
    "averageScore": 56.5,
    "passRate": 0.5,
    "perfectRate": 0.5
  },
  "results": [
    {
      "testCaseId": "basic-01",
      "score": 100,
      "dataPresence": { ... },
      "resultCorrectness": { ... },
      "formulaUsage": { ... },
      "formatting": {
        "score": 10,
        "requirementResults": [
          {
            "type": "currency",
            "appliesTo": ["Rent", "Food", "Transport", "Total"],
            "passed": true,
            "details": "✓ \"Rent\" has currency format; ✓ \"Food\" has currency format; ..."
          }
        ]
      }
    }
  ]
}
```

## 📝 Creating Test Cases

Test cases are JSON files in `benchmark/prompts/<category>/`.

### Test Case Structure

```json
{
  "id": "basic-01",
  "title": "Monthly Expenses",
  "prompt": "Create a spreadsheet showing monthly expenses...",
  "level": 1,
  "category": "basic",

  "requiredElements": [
    {"type": "label", "value": "Rent", "caseSensitive": false},
    {"type": "label", "value": "Total", "caseSensitive": false}
  ],

  "requiredValues": [
    {"label": "Rent", "value": 1200, "tolerance": 0}
  ],

  "assertions": [
    {
      "name": "Total is correct",
      "extractor": "Total",
      "expected": 1800,
      "tolerance": 0.01
    }
  ],

  "formulaRequirements": [
    {
      "description": "Total uses a formula, not hard-coded value",
      "check": "cellWithLabel('Total').hasFormula()"
    }
  ],

  "formattingRequirements": [
    {
      "type": "currency",
      "appliesTo": ["Rent", "Food", "Transport", "Total"],
      "description": "All expense amounts should have currency formatting"
    }
  ],

  "expectedFunctions": ["SUM"],

  "metadata": {
    "author": "Benchmark System",
    "created": "2025-11-25",
    "notes": "Basic level test to verify simple formula usage"
  }
}
```

### Field Descriptions

| Field | Description |
|-------|-------------|
| **id** | Unique identifier (e.g., "basic-01", "financial-03") |
| **title** | Human-readable test name |
| **prompt** | Instructions given to the LLM |
| **level** | Difficulty: 1 (Basic), 2 (Intermediate), 3 (Advanced), 4 (Expert) |
| **category** | One of: basic, statistical, financial, logical, lookup, text, date, mathematical, complex |
| **requiredElements** | Labels that must appear in the spreadsheet |
| **requiredValues** | Specific values that must be present near labels |
| **assertions** | Expected calculated results (the most important checks!) |
| **formulaRequirements** | Requirements about formula usage |
| **formattingRequirements** | Required formatting for specific cells |
| **expectedFunctions** | Spreadsheet functions that should be used (SUM, AVERAGE, IF, etc.) |

### Formatting Requirements

The `formattingRequirements` array specifies which cells should have which formatting:

```json
{
  "type": "currency",           // currency, percentage, number, date, text
  "appliesTo": ["Total", "Sum"], // Labels of cells that should have this format
  "description": "Dollar amounts should use currency formatting",
  "required": true               // Optional, defaults to true
}
```

**Supported Types:**
- **currency**: `$`, `€`, `£`, `¥` symbols
- **percentage**: `%` symbol
- **number**: Decimal places, thousand separators (`#,##0`, `0.00`)
- **date**: Date format codes (`MM`, `DD`, `YYYY`)
- **text**: Text format (`@`)

### Difficulty Levels

**Level 1: Basic (10 prompts target)**
- Simple arithmetic formulas
- Single sheet, 3-5 rows
- Functions: SUM, basic arithmetic

**Level 2: Intermediate (15 prompts target)**
- Multiple functions
- Cell ranges, 5-10 rows
- Functions: AVERAGE, COUNT, MAX, MIN, IF

**Level 3: Advanced (15 prompts target)**
- Nested functions
- Cross-references within sheet
- 10-20 rows
- Functions: VLOOKUP, nested IF, ROUND(SUM(...))

**Level 4: Expert (10 prompts target)**
- Multi-sheet references
- Complex nested formulas
- 20+ rows
- All categories combined

### Categories

- **basic**: Simple expenses, budgets, arithmetic
- **statistical**: SUM, AVERAGE, COUNT, MAX, MIN, MEDIAN
- **financial**: PMT, PV, FV, NPV, IRR
- **logical**: IF, AND, OR, NOT, nested conditions
- **lookup**: VLOOKUP, HLOOKUP, INDEX, MATCH
- **text**: CONCAT, LOWER, UPPER, TRIM, SUBSTITUTE
- **date**: DATE, TODAY, DATEDIF, date arithmetic
- **mathematical**: ROUND, ABS, SQRT, POWER, MOD
- **complex**: Multi-sheet, advanced combinations

## 🏗️ Architecture

```
benchmark/
├── prompts/              # Test case definitions
│   ├── basic/
│   ├── statistical/
│   ├── financial/
│   └── ...
├── expected/             # Sample valid outputs (for testing)
├── results/              # LLM outputs (auto-generated)
│   ├── gpt-4o/
│   ├── claude-3.5-sonnet/
│   └── ...
└── src/
    ├── cli.ts           # Command-line interface
    ├── runner.ts        # Batch benchmark execution
    ├── llm-client.ts    # LLM API abstraction
    ├── verifier.ts      # Spreadsheet verification logic
    ├── semantic-extractor.ts  # Structure-agnostic value extraction
    ├── test-runner.ts   # Single test execution
    ├── config.ts        # Configuration and API key management
    └── types.ts         # TypeScript type definitions
```

## 🔬 How Verification Works

### Structure-Agnostic Verification

The benchmark uses **semantic extraction** instead of position-based checking:

**❌ Traditional Approach (Fragile):**
```typescript
// Expects Total in cell B5
assert(sheet.data[4][1].value === 1800);
```

**✅ Our Approach (Robust):**
```typescript
// Finds "Total" label anywhere, then checks adjacent value
const total = findByLabel(sheet, "Total");
assert(total.value === 1800);
```

This means all these layouts are equally valid:

**Vertical:**
```
| Rent      | $1200 |
| Food      | $400  |
| Transport | $200  |
| Total     | =SUM  |  ✓ Works!
```

**Horizontal:**
```
| Expense | Rent | Food | Transport | Total |
| Amount  | 1200 | 400  | 200       | =SUM  |  ✓ Works!
```

**Different Starting Position:**
```
(starts at B2 instead of A1)
                  ✓ Works!
```

### Verification Steps

1. **Parse LLM Output**: Extract JSON spreadsheet data
2. **Calculate Formulas**: Run through spreadsheet engine to evaluate all formulas
3. **Data Presence**: Check all required labels and values exist
4. **Result Correctness**: Verify calculated results match assertions
5. **Formula Usage**: Ensure formulas (not hard-coded values) are used
6. **Formatting Check**: Verify currency/percentage/number formatting in right places

## 🧪 Testing Locally

Test a single case without calling an LLM:

```bash
# Test with a sample output file
npm run benchmark:test -- basic-01 benchmark/expected/basic-01-correct.json

# Test different layouts
npm run benchmark:test -- basic-01 benchmark/expected/basic-01-horizontal.json

# Test detection of hard-coded values (should fail)
npm run benchmark:test -- basic-01 benchmark/expected/basic-01-hardcoded.json
```

## 🔑 Security

- ✅ API keys are loaded from `.env` (never committed to git)
- ✅ API keys are **never written** to result files
- ✅ Results use `sanitizeConfig()` to strip sensitive data
- ✅ All configuration objects are sanitized before serialization

## 📦 Available Models

### OpenAI Models (8 models)
| Model | Description | API Key Required |
|-------|-------------|-----------------|
| `gpt-5.1` | GPT-5.1 (Latest) | `OPENAI_API_KEY` |
| `gpt-5` | GPT-5 | `OPENAI_API_KEY` |
| `gpt-5-mini` | GPT-5 Mini (Budget) | `OPENAI_API_KEY` |
| `gpt-4.1` | GPT-4.1 | `OPENAI_API_KEY` |
| `gpt-4o` | GPT-4o | `OPENAI_API_KEY` |
| `gpt-4o-mini` | GPT-4o Mini (Budget) | `OPENAI_API_KEY` |
| `gpt-4.1-mini` | GPT-4.1 Mini (Budget) | `OPENAI_API_KEY` |
| `gpt-4` | GPT-4 Turbo Preview | `OPENAI_API_KEY` |

### Anthropic Models (6 models)
| Model | Description | API Key Required |
|-------|-------------|-----------------|
| `claude-sonnet-4-5` | Claude Sonnet 4.5 (Latest) | `ANTHROPIC_API_KEY` |
| `claude-opus-4-1` | Claude Opus 4.1 | `ANTHROPIC_API_KEY` |
| `claude-haiku-4-5` | Claude Haiku 4.5 (Fast) | `ANTHROPIC_API_KEY` |
| `claude-3.5-sonnet` | Alias → claude-sonnet-4-5 | `ANTHROPIC_API_KEY` |
| `claude-3.5-haiku` | Claude 3.5 Haiku Latest (Fast) | `ANTHROPIC_API_KEY` |
| `claude-3-opus` | Alias → claude-opus-4-1 | `ANTHROPIC_API_KEY` |

> **Note**: Anthropic changed their model naming convention. Old version-dated names (e.g., `claude-3-5-sonnet-20241022`) no longer work. The aliases above map to the current model names for backward compatibility.

### Google Models (5 models)
| Model | Description | API Key Required |
|-------|-------------|-----------------|
| `gemini-3-pro` | Gemini 3 Pro Preview (Latest) | `GEMINI_API_KEY` |
| `gemini-2.5-pro` | Gemini 2.5 Pro | `GEMINI_API_KEY` |
| `gemini-2.5-flash` | Gemini 2.5 Flash (Fast) | `GEMINI_API_KEY` |
| `gemini-1.5-pro` | Gemini 1.5 Pro | `GEMINI_API_KEY` |
| `gemini-pro` | Alias for gemini-1.5-pro | `GEMINI_API_KEY` |

### Ollama Models (4 models - Local)
| Model | Description | Requirements |
|-------|-------------|--------------|
| `ollama-gpt-oss-20b` | GPT-OSS 20B (Local) | Ollama running locally |
| `ollama-gpt-oss-120b` | GPT-OSS 120B (Local) | Ollama running locally |
| `ollama-qwen3-30b` | Qwen3 30B (Local) | Ollama running locally |
| `ollama-phi4-mini` | Phi4 Mini (Local, Fast) | Ollama running locally |

> **Note**: Ollama models run locally on your machine. Install [Ollama](https://ollama.ai/) and pull the models first: `ollama pull gpt-oss:20b`

### Grok/xAI Models (4 models)
| Model | Description | API Key Required |
|-------|-------------|-----------------|
| `grok-4-1` | Grok 4.1 (Latest) | `XAI_API_KEY` |
| `grok-4-1-fast` | Grok 4.1 Fast Reasoning | `XAI_API_KEY` |
| `grok-4` | Grok 4 | `XAI_API_KEY` |
| `grok-beta` | Grok Beta | `XAI_API_KEY` |

**Total: 36 models** across 5 providers

## 🎓 Examples

### Example 1: Compare Models

```bash
# Test latest cloud models
npm run benchmark:llm -- run --model gpt-5.1 --level 1
npm run benchmark:llm -- run --model claude-sonnet-4-5 --level 1
npm run benchmark:llm -- run --model gemini-3-pro --level 1
npm run benchmark:llm -- run --model grok-4-1 --level 1

# Test budget models
npm run benchmark:llm -- run --model gpt-4o-mini --level 1
npm run benchmark:llm -- run --model claude-haiku-4-5 --level 1
npm run benchmark:llm -- run --model gemini-2.5-flash --level 1

# Test local models (requires Ollama)
npm run benchmark:llm -- run --model ollama-gpt-oss-20b --level 1
npm run benchmark:llm -- run --model ollama-phi4-mini --level 1

# Compare results in benchmark/results/
```

### Example 2: Test Specific Category

```bash
# Test only financial calculations
npm run benchmark:llm -- run --model gpt-4o --category financial

# Test only statistical functions
npm run benchmark:llm -- run --model claude-3.5-sonnet --category statistical
```

### Example 3: Quick Single Test

```bash
# Test just one prompt
npm run benchmark:llm -- run --model gpt-4o --ids basic-01
```

## 🐛 Troubleshooting

### "Missing required environment variable: OPENAI_API_KEY"

Set your API key in `.env` file:
```bash
OPENAI_API_KEY=sk-...
```

### Ollama connection errors

Make sure Ollama is running:
```bash
# Check if Ollama is running
curl http://localhost:11434/api/tags

# Start Ollama (if needed)
ollama serve

# Pull required model
ollama pull gpt-oss:20b
```

### "Unknown model: xyz"

Check available models:
```bash
npm run benchmark:list
```

### Results show 0 score with parse error

The LLM returned invalid JSON. Check the detailed results file to see the actual response.

### Formatting score is 0 even with formatting

Make sure the formatting is applied to the cells specified in `formattingRequirements.appliesTo`. The system checks that **specific cells** (by label) have the right formatting, not just that formatting exists anywhere.

## 📈 Current Test Coverage

| Category | Tests | Status |
|----------|-------|--------|
| Basic | 2 | ✅ |
| Statistical | 1 | ✅ |
| Mathematical | 1 | ✅ |
| Logical | 1 | ✅ |
| Financial | 1 | ✅ |
| Text | 1 | ✅ |
| Lookup | 0 | ⚠️ Need more |
| Date | 0 | ⚠️ Need more |
| Complex | 0 | ⚠️ Need more |

**Total: 7 prompts** (Target: 50+)

## 🤝 Contributing

To add a new test case:

1. Create a JSON file in the appropriate category folder
2. Follow the test case structure above
3. Specify clear assertions for what should be calculated
4. Add formatting requirements for proper cell formatting
5. Test locally before committing:
   ```bash
   npm run benchmark:test -- your-test-id path/to/sample-output.json
   ```

## 📄 License

MIT

---

**Made with ❤️ for objective LLM evaluation**
