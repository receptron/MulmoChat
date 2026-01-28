# Beyond Text: Using LLMs as Compilers for Presentation Languages

## Abstract

Large Language Models (LLMs) excel at generating text but cannot directly produce rich, interactive visual interfaces. This article introduces a powerful architectural pattern where LLMs function as **compilers** that translate natural language into domain-specific **presentation languages**—executable code that rendering engines transform into sophisticated visual and interactive experiences. Drawing from real-world implementations, we demonstrate how this pattern enables users to create complex multimedia presentations, interactive spreadsheets, and illustrated documents through simple conversational interfaces.

## The Fundamental Limitation

LLMs are, by their nature, text generators. They produce sequences of tokens—whether that's natural language, code, or structured data. While this capability is impressive, it creates a fundamental gap when users need rich, graphical, or interactive outputs:

- **Static vs. Dynamic**: LLMs generate static text, not live computations
- **Textual vs. Visual**: LLMs describe images, they don't render them
- **Linear vs. Interactive**: LLMs produce sequential content, not interactive experiences

Traditional approaches have attempted to bridge this gap through post-processing (parsing LLM output) or tool calling (invoking external functions). However, these approaches often result in rigid, limited interfaces that don't leverage the LLM's full generative potential.

## The Presentation Language Pattern

The solution lies in treating LLMs not as direct producers of content, but as **compilers** that generate domain-specific presentation languages. This creates a three-layer architecture:

```
Natural Language (User Intent)
         ↓
    LLM Compiler
         ↓
Presentation Language (DSL Code)
         ↓
   Rendering Engine
         ↓
Rich Interactive UI
```

### Key Characteristics

A presentation language in this context is:

1. **Domain-Specific**: Tailored to a specific type of output (documents, spreadsheets, presentations)
2. **Declarative**: Describes *what* to render, not *how* to render it
3. **Executable**: Contains instructions that systems can interpret and execute
4. **Beyond LLM Capabilities**: Enables outputs the LLM cannot directly produce

## Real-World Implementations

Let's examine three production implementations that demonstrate this pattern's versatility.

### Example 1: Markdown with Embedded Image Generation

**The Challenge**: Users want illustrated documents where images are contextually relevant to the content.

**The Presentation Language**:
```markdown
# The Solar System

The Sun is a massive star at the center of our solar system.

![A photorealistic image of the Sun with visible solar flares and
corona, dramatic lighting](__too_be_replaced_image_path__)

Mercury is the smallest planet and closest to the Sun.

![A detailed view of Mercury's cratered surface, showing the gray
rocky terrain](__too_be_replaced_image_path__)
```

**How It Works**:
1. LLM generates markdown with special image placeholders containing detailed prompts
2. Parser extracts all `__too_be_replaced_image_path__` placeholders
3. Image generation system creates images from embedded prompts
4. Final markdown replaces placeholders with actual image URLs
5. Rich document rendered with contextual AI-generated illustrations

**Tool Definition Excerpt**:
```typescript
{
  name: "presentDocument",
  description: "Display a document in markdown format.",
  parameters: {
    markdown: {
      type: "string",
      description: "The markdown content. Describe embedded images in the format: " +
                   "![Detailed image prompt](__too_be_replaced_image_path__)"
    }
  }
}
```

**Key Insight**: The LLM doesn't generate images—it generates *code that instructs an image generator*. The markdown acts as a template language with embedded generation directives.

### Example 2: MulmoScript for Multimedia Presentations

**The Challenge**: Users want to create video presentations or podcasts from conversational requests.

**The Presentation Language**:
```json
{
  "$mulmocast": { "version": "1.1" },
  "title": "The History of Computing",
  "lang": "en",
  "beats": [
    {
      "id": "beat-001",
      "speaker": "Presenter",
      "text": "In 1936, Alan Turing published his groundbreaking paper on computable numbers,
              introducing the concept of a universal machine that could simulate any other
              machine's computation."
    },
    {
      "id": "beat-002",
      "speaker": "Presenter",
      "text": "This theoretical construct, now known as the Turing Machine, laid the foundation
              for modern computer science and our understanding of computation itself."
    }
  ],
  "audioParams": {
    "padding": 0.2,
    "bgmVolume": 0.1
  },
  "speechParams": {
    "speakers": {
      "Presenter": { "voiceId": "shimmer" }
    }
  }
}
```

**How It Works**:
1. LLM generates structured MulmoScript with narrative beats
2. System generates images for each beat based on the text
3. Text-to-speech synthesizes audio for each beat's narration
4. Video compiler combines images, audio, transitions, and effects
5. Final MP4 video presentation rendered and playable

**Key Insight**: The LLM doesn't create videos—it writes a *declarative script* that a multimedia pipeline executes. Each beat is a high-level instruction that triggers complex audio-visual generation.

### Example 3: Interactive Spreadsheets with Live Formulas

**The Challenge**: Users need interactive financial models, calculators, or data analysis tools with live computations.

**The Presentation Language**:
```json
{
  "title": "5-Year Revenue Projection",
  "sheets": [{
    "name": "Projections",
    "data": [
      ["Year", "Revenue", "Growth Rate", "Expenses", "Profit Margin"],
      [2024, 1000000, "—", 750000, {"f": "D2/B2", "z": "0.00%"}],
      [2025, {"f": "B2*1.15", "z": "$#,##0"}, "15%", {"f": "D2*1.08", "z": "$#,##0"}, {"f": "D3/B3", "z": "0.00%"}],
      [2026, {"f": "B3*1.15", "z": "$#,##0"}, "15%", {"f": "D3*1.08", "z": "$#,##0"}, {"f": "D4/B4", "z": "0.00%"}],
      ["", "", "", "Total:", {"f": "SUM(B2:B4)", "z": "$#,##0"}]
    ]
  }]
}
```

**How It Works**:
1. LLM generates spreadsheet structure with Excel-style formulas
2. Each formula uses A1 notation (`B2*1.15`, `SUM(A1:A10)`)
3. Browser-based spreadsheet engine evaluates formulas in real-time
4. User can interact: change inputs and see calculated cells update instantly
5. Full spreadsheet functionality (formatting, functions, cross-references) available

**Tool Definition Excerpt**:
```typescript
{
  name: "presentSpreadsheet",
  description: "Display an Excel-like spreadsheet with formulas and calculations.",
  parameters: {
    sheets: {
      description: "Build LIVE sheets: inputs stay raw numbers, every calculation " +
                   "is a formula object {\"f\": \"...\", \"z\": \"...\"}. Never pre-calculate."
    }
  }
}
```

**System Prompt Guidance**:
```
Use presentSpreadsheet whenever the user needs spreadsheet-style tables, multi-step math,
or dynamic what-if analysis. Build LIVE sheets: inputs stay raw numbers/labels, every
calculation is a formula object {"f": "...", "z": "..."}. Never pre-calculate or format
values yourself; let the spreadsheet compute using cell refs and functions.
```

**Key Insight**: The LLM doesn't calculate results—it writes *executable formulas* that a spreadsheet engine evaluates. This enables interactive "what-if" analysis that would be impossible with static text.

## Architectural Benefits

This pattern provides several significant advantages:

### 1. Separation of Concerns

```
LLM Responsibility:      WHAT to create (intent, structure, logic)
System Responsibility:   HOW to render (execution, optimization, display)
```

The LLM focuses on understanding user intent and generating appropriate structure, while specialized rendering engines handle complex execution details.

### 2. Leveraging Domain Expertise

Each rendering engine can incorporate deep domain knowledge:
- **Image generators**: Artistic principles, composition, style transfer
- **Video compilers**: Timing, transitions, audio mixing, encoding
- **Spreadsheet engines**: Formula evaluation, circular reference detection, recalculation optimization

The LLM doesn't need to understand these complexities—it just needs to generate valid DSL code.

### 3. Interactive and Dynamic Outputs

Because presentation languages generate executable code rather than static content:
- Spreadsheets recalculate when users change inputs
- Presentations can have interactive elements
- Documents can have dynamic, context-aware components

### 4. Composability and Extensibility

New presentation languages can be added without modifying the LLM:
1. Define a new DSL schema
2. Implement a rendering engine
3. Add tool definition to LLM's function registry
4. Users can immediately access new capabilities

### 5. Cost and Latency Optimization

Complex rendering happens outside the LLM:
- LLM generates compact DSL code (low token cost)
- Heavy computation offloaded to specialized systems
- Rendering can be cached, optimized, or parallelized
- Re-rendering doesn't require re-invoking the LLM

## Beyond Applications: The Capability Plugin Paradigm

The presentation language pattern, combined with a plugin architecture, represents a fundamental reimagining of how users interact with software capabilities. Traditional applications are being replaced by seamlessly integrated capability plugins.

### The Traditional Application Model

For decades, software has been organized into discrete, monolithic applications:

```
User needs spreadsheet → Launches Excel → Learns formulas, ribbons, shortcuts
User needs presentation → Launches PowerPoint → Learns slide layouts, transitions
User needs image editing → Launches Photoshop → Learns layers, tools, filters
```

This model has inherent friction:

- **Explicit Invocation**: Users must know which application to launch for each task
- **Context Switching**: Moving between applications breaks workflow and mental context
- **Steep Learning Curves**: Each application has unique UI patterns, shortcuts, and concepts to master
- **Discovery Problem**: Users may not know which application can solve their problem
- **Integration Overhead**: Sharing data between applications requires manual export/import

### The Capability Plugin Model

The presentation language architecture inverts this model. Instead of applications that users invoke, we have **capabilities that blend into a conversational interface**:

```
User: "Show me a 5-year revenue projection with sensitivity analysis"
System: [Automatically routes to spreadsheet plugin]
         [Generates live interactive financial model]

User: "Create a presentation explaining quantum computing"
System: [Automatically routes to MulmoScript plugin]
         [Generates illustrated video presentation]

User: "Make a document about the solar system with images"
System: [Automatically routes to markdown plugin]
         [Generates illustrated document with AI-generated images]
```

### Key Paradigm Shifts

**1. From Explicit to Implicit**

Traditional:
- User decides: "I need a spreadsheet"
- User launches Excel
- User figures out how to build the model

Plugin-based:
- User expresses intent: "Show me the financial projection"
- LLM routes to appropriate capability automatically
- System generates the artifact

**2. From Learning to Asking**

Traditional:
- User invests hours learning Excel formulas, PowerPoint layouts, Photoshop tools
- Knowledge becomes outdated as UIs change
- Productivity limited by expertise with specific applications

Plugin-based:
- User expresses what they want in natural language
- No application-specific knowledge required
- Same conversational interface for all capabilities

**3. From Apps to Capabilities**

Traditional:
- Software organized as discrete "applications" with boundaries
- User mentally maps tasks to applications
- "For this task, I need to open that program"

Plugin-based:
- Software organized as composable capabilities
- User thinks about goals, not tools
- "I need this outcome" (system figures out how)

**4. Seamless Integration and Composition**

Because all capabilities share the conversational interface and common context:

```markdown
# Q4 Business Review

Here's our financial performance:
[Spreadsheet plugin generates interactive quarterly results]

Key insights from the data:
[LLM analyzes spreadsheet results, generates insights]

Here's a presentation for stakeholders:
[MulmoScript plugin generates video from insights]
```

Capabilities can reference and build upon each other without manual data transfer.

### Third-Party Extensibility

The plugin architecture is fully extensible. Adding new capabilities is straightforward:

**To add a new presentation language:**
1. Define the DSL schema (what structure the LLM should generate)
2. Implement the rendering engine (how to execute the DSL)
3. Register the tool definition with the LLM
4. Users can immediately access it through natural language

**No changes to core system required.** The new capability blends seamlessly into the existing conversational interface.

This enables:
- **Third-party ecosystems**: Developers can publish presentation language plugins
- **Domain-specific tools**: Specialized capabilities for niche use cases (chemical formulas, music notation, circuit diagrams)
- **Enterprise extensions**: Organizations can add proprietary capabilities without forking
- **Rapid innovation**: New capabilities can be deployed without waiting for "application updates"

### The Conversational Interface as Universal OS

In this architecture, the conversational interface becomes the **universal operating system** for human-computer interaction:

- **Single interface**: One conversational UI for all capabilities
- **Intent-based routing**: LLM determines which capabilities to invoke
- **Contextual awareness**: Shared context across all tools
- **Progressive disclosure**: Capabilities appear as needed, not in overwhelming menus
- **Natural language as API**: No need to learn application-specific interfaces

The user's relationship with software shifts from:
- "What applications do I know how to use?"

To:
- "What do I want to accomplish?"

The system handles capability discovery, routing, composition, and execution automatically.

### Replacing Applications with Conversations

This represents a fundamental transition in computing paradigms:

| Traditional Applications | Capability Plugins |
|-------------------------|-------------------|
| Monolithic software packages | Composable presentation languages |
| Explicit launch and invocation | Automatic routing via LLM |
| Application-specific UIs to learn | Natural language for everything |
| Manual context switching | Shared conversational context |
| Static feature sets | Extensible plugin ecosystem |
| "Open Word to write a document" | "Create a document about X" |

Users no longer need to know *how* software works—they only need to express *what* they want. The presentation language pattern, combined with LLM-based routing and capability plugins, makes this vision practical and scalable.

## Scaling with Roles: Managing Plugin Complexity

As the plugin ecosystem grows, a new challenge emerges: **how do we manage dozens or hundreds of available capabilities without overwhelming the system?** The solution lies in introducing **roles**—curated contexts that bundle relevant tools with specialized behavior.

### The Scaling Challenge

While plugin extensibility is powerful, unrestricted growth creates problems:

**Token Inefficiency**:
- Each tool definition consumes context tokens
- 50+ plugins could consume thousands of tokens before user conversation even begins
- Larger context = higher cost and latency

**Cognitive Overload**:
- LLM must evaluate all available tools for every request
- Too many options can degrade routing quality
- Unrelated tools create noise in decision-making

**Lack of Specialization**:
- Generic system prompt must serve all use cases
- Behavior cannot be optimized for specific contexts
- Tools lack coherent grouping

### Introducing Roles

A **role** is a curated operational context that packages:

1. **Selected Tool Subset**: Only plugins relevant to that role
2. **Specialized System Prompt**: Behavior guidance tailored to the role's purpose
3. **Coherent Capabilities**: Tools that naturally work together

**Role Definition Structure**:
```typescript
interface Role {
  id: string;
  name: string;
  description: string;  // Helps LLM/user understand when this role applies
  systemPrompt: string; // Behavioral guidance for this context
  enabledPlugins: string[]; // Which presentation languages are available
}
```

### Example Roles

**Tutor Role**:
```typescript
{
  id: "tutor",
  name: "Tutor",
  description: "Educational contexts: teaching concepts, testing understanding, " +
               "providing practice exercises and interactive learning materials",
  systemPrompt: `You are a patient, encouraging tutor. Your goal is to help the student
    understand concepts deeply through clear explanations and interactive practice.

    - Use the quiz tool to test understanding after explaining new concepts
    - Create illustrated documents with presentDocument for lesson materials
    - Use spreadsheets for mathematical practice problems with instant feedback
    - Break complex topics into manageable steps`,
  enabledPlugins: [
    "quiz",              // Interactive quizzes
    "presentDocument",   // Illustrated lesson materials
    "presentSpreadsheet", // Practice problems with formulas
    "canvas"             // Diagrams and visual explanations
  ]
}
```

**Business Analyst Role**:
```typescript
{
  id: "analyst",
  name: "Business Analyst",
  description: "Data analysis, financial modeling, business intelligence, " +
               "reporting and strategic insights from data",
  systemPrompt: `You are a data-driven business analyst. Approach problems analytically
    and support conclusions with quantitative evidence.

    - Always use spreadsheets for multi-step calculations and financial models
    - Build interactive models that allow what-if analysis
    - Create presentations to communicate insights to stakeholders
    - Use search tools to gather market research and competitive intelligence
    - Focus on actionable insights, not just data description`,
  enabledPlugins: [
    "presentSpreadsheet", // Financial models, data analysis
    "showPresentation",   // Stakeholder presentations
    "exa",               // Market research
    "browse",            // Competitive intelligence
    "presentDocument"    // Written reports
  ]
}
```

**Content Creator Role**:
```typescript
{
  id: "creator",
  name: "Content Creator",
  description: "Creating multimedia content: videos, presentations, articles, " +
               "visual stories, and engaging educational or entertainment materials",
  systemPrompt: `You are a creative storyteller who produces engaging multimedia content.

    - Use showPresentation to create video presentations with narration and visuals
    - Generate rich illustrated documents for articles and long-form content
    - Create complementary music/audio when appropriate for mood and engagement
    - Focus on narrative flow, emotional engagement, and visual appeal
    - Optimize pacing and structure for audience attention`,
  enabledPlugins: [
    "showPresentation",  // Video presentations
    "generateImage",     // Custom visuals
    "editImage",         // Image refinement
    "presentDocument",   // Articles with embedded images
    "music"              // Background music and audio
  ]
}
```

**Researcher Role**:
```typescript
{
  id: "researcher",
  name: "Researcher",
  description: "Academic research, literature review, information synthesis, " +
               "fact-finding and deep investigation of topics",
  systemPrompt: `You are a thorough researcher who finds, evaluates, and synthesizes
    information from multiple sources.

    - Use search tools to find authoritative sources
    - Browse websites to extract detailed information
    - Synthesize findings into well-structured documents with citations
    - Evaluate source credibility and cross-reference claims
    - Present comprehensive, balanced analysis of complex topics`,
  enabledPlugins: [
    "exa",               // AI-powered search
    "browse",            // Web content extraction
    "presentDocument",   // Research reports with citations
    "presentSpreadsheet" // Data compilation and analysis
  ]
}
```

### Dynamic Role Switching

The system can switch roles dynamically based on user intent:

**Explicit Switching**:
```
User: "Switch to tutor mode"
System: [Activates Tutor role]
        [Loads quiz, document, spreadsheet, canvas tools]
        [Applies educational system prompt]

User: "Help me understand calculus derivatives"
System: [Uses tutor behavior and tools to teach concept]
```

**Automatic Switching**:
```
User: "Teach me about photosynthesis"
System: [Detects educational intent]
        [Automatically switches to Tutor role]
        [Creates illustrated lesson with quiz]

User: "Now analyze our Q4 sales performance"
System: [Detects analytical intent]
        [Automatically switches to Business Analyst role]
        [Creates interactive financial analysis spreadsheet]
```

**Implementation of Auto-Switching**:
```typescript
// LLM evaluates user intent and requests role switch via function call
{
  type: "function",
  name: "switchRole",
  description: "Switch to a different role when user intent changes context",
  parameters: {
    roleId: {
      type: "string",
      enum: ["tutor", "analyst", "creator", "researcher"],
      description: "The role that best matches the user's current intent"
    },
    reason: {
      type: "string",
      description: "Brief explanation of why this role is appropriate"
    }
  }
}

// Example call:
switchRole({
  roleId: "tutor",
  reason: "User is asking to learn a new concept and needs educational support"
})
```

### Benefits of Role-Based Architecture

**1. Token Efficiency**

Instead of loading 50+ tool definitions:
```
Without roles: ~5000 tokens for all tool definitions
With roles: ~500 tokens for 5-10 relevant tools
Savings: 90% reduction in tool definition overhead
```

**2. Improved Routing Quality**

The LLM chooses from a focused, coherent set:
- Tutor mode: 4 educational tools vs. 50 mixed tools
- Higher accuracy in tool selection
- Faster decision-making with less noise

**3. Specialized Behavior**

Each role's system prompt optimizes behavior:
- **Tutor**: Encourages explanations, quizzes, step-by-step breakdowns
- **Analyst**: Emphasizes data, calculations, evidence-based insights
- **Creator**: Focuses on narrative, engagement, visual appeal
- **Researcher**: Prioritizes sources, citations, comprehensive coverage

**4. Coherent Tool Ecosystems**

Tools within a role complement each other:
```
Tutor role workflow:
1. Explain concept (presentDocument with illustrations)
2. Provide practice (presentSpreadsheet with interactive formulas)
3. Test understanding (quiz)
4. Visualize relationships (canvas)

All tools work together toward educational goals.
```

**5. Scalability Without Complexity**

The system can support hundreds of plugins:
- 100 total plugins across all roles
- Each role exposes only 5-10 relevant tools
- Users get specialized experience without overwhelming options
- New plugins added to appropriate roles without affecting others

**6. Personalization and Customization**

Users or organizations can:
- Define custom roles for their specific workflows
- Mix and match tools for niche use cases
- Share role definitions as reusable configurations
- Have role presets that adapt to their work patterns

### Multi-Role and Cross-Role Capabilities

Some capabilities may be available across multiple roles:

**Core Tools** (available in all roles):
- `presentDocument` - Universal document creation
- Basic image generation

**Role-Specific Tools** (only in certain contexts):
- `quiz` - Only in Tutor role
- Financial analysis plugins - Only in Analyst role
- Music composition - Only in Creator role

**Hybrid Approach**:
```typescript
interface Role {
  // ... other properties
  enabledPlugins: string[];
  inheritsCore: boolean; // Include universal tools?
}
```

### Role as Context, Not Constraint

Roles should be:
- **Fluid**: Easy to switch when context changes
- **Suggestive**: Guide behavior but don't rigidly restrict
- **Transparent**: User can see current role and available tools
- **Overridable**: User can explicitly request tools outside current role if needed

This maintains flexibility while providing the benefits of specialization.

### The Future: Hierarchical and Composite Roles

As the pattern matures, more sophisticated role structures emerge:

**Hierarchical Roles**:
```typescript
{
  id: "math-tutor",
  name: "Mathematics Tutor",
  inheritsFrom: "tutor",  // Gets base tutor tools and behavior
  additionalPlugins: ["graphing", "geometry", "symbolic-math"],
  systemPrompt: "Tutor system prompt + specialized math guidance"
}
```

**Composite Roles** (multiple active simultaneously):
```typescript
{
  activeRoles: ["researcher", "creator"],
  // User gets research tools + content creation tools
  // Behavior: "Research thoroughly, then present engagingly"
}
```

**Context-Aware Role Suggestions**:
```
System: "I notice you're working on a business plan. Would you like to switch
         to Business Analyst mode for financial projections, or Creator mode
         for presentation materials?"
```

The role pattern transforms the capability plugin architecture from a flat namespace of tools into a structured, context-aware system that scales gracefully while maintaining coherent, specialized user experiences.

## Implementation Guidelines

### Designing Effective Tool Definitions

The tool definition serves as the "compiler specification" that teaches the LLM your DSL syntax:

**1. Be Explicit About Format**
```typescript
description: "Formula expression using Excel A1 notation (columns: A,B,C...;
             rows: 1,2,3...). Examples: 'B2*1.05', 'SUM(A1:A10)', 'C3/C2-1'"
```

**2. Provide Clear Examples**
```typescript
description: "Example row: ['Year', 'Revenue', 'Growth %'],
             [2024, 1500000, {\"f\": \"B2/B1-1\", \"z\": \"0.00%\"}]"
```

**3. Specify What NOT to Do**
```typescript
description: "Never pre-calculate or format values yourself; let the spreadsheet
             compute using cell refs and functions."
```

**4. Use Type Constraints**
```typescript
items: {
  oneOf: [
    { type: "string", description: "Text labels only (NOT for formulas)" },
    { type: "number", description: "Raw numeric values (inputs only)" },
    { type: "object", properties: { f: "...", z: "..." }, required: ["f", "z"] }
  ]
}
```

### System Prompts as Compiler Directives

System prompts guide the LLM on *when* and *how* to use each presentation language:

```
Use presentSpreadsheet whenever the user needs:
- Spreadsheet-style tables
- Multi-step math
- Dynamic what-if analysis

Build LIVE sheets: inputs stay raw numbers/labels, every calculation is a
formula object. Never pre-calculate values yourself.
```

This acts as a "compilation strategy" that ensures the LLM generates executable code rather than static text.

## Comparison with Alternative Approaches

### vs. Direct Tool Calling

**Traditional Tool Calling**:
```typescript
LLM: calls generateImage("a sunset")
System: returns base64 image data
LLM: displays single image
```

**Presentation Language**:
```typescript
LLM: generates markdown with 5 embedded image prompts
System: generates all 5 images in parallel, composes document
LLM: displays rich illustrated document
```

The presentation language approach enables more complex, compositional outputs.

### vs. Post-Processing LLM Text

**Text Post-Processing**:
```typescript
LLM: "The revenue is $1.5M and expenses are $1.2M, so profit is $300K"
System: parses text, extracts numbers (fragile, error-prone)
```

**Presentation Language**:
```typescript
LLM: [["Revenue", 1500000], ["Expenses", 1200000], ["Profit", {"f": "A1-A2"}]]
System: renders live spreadsheet with formula
```

The DSL approach provides structure and executability without fragile parsing.

### vs. Code Execution

**Direct Code Execution**:
```typescript
LLM: generates Python script
System: executes in sandbox (security concerns, limited interactivity)
```

**Presentation Language**:
```typescript
LLM: generates declarative spreadsheet DSL
System: evaluates safely in browser (sandboxed, interactive)
```

Presentation languages are safer (declarative, not Turing-complete) and more interactive.

## Future Directions

### Multi-Modal Presentation Languages

Extending beyond visual outputs to other modalities:
- **Audio DSLs**: Music composition languages (notes, chords, arrangements)
- **3D/VR DSLs**: Scene description languages for immersive experiences
- **Animation DSLs**: Timeline-based animation scripts

### Composable Presentation Languages

Allowing presentation languages to reference each other:
```markdown
# Financial Report

Here's our revenue projection:
[embed:spreadsheet:revenue-model]

And here's a presentation explaining the strategy:
[embed:mulmocast:strategy-presentation]
```

### User-Customizable Presentation Languages

Enabling users to define their own DSLs:
```typescript
definePresentation({
  name: "chemicalFormula",
  schema: { /* custom schema */ },
  renderer: { /* custom rendering logic */ }
})
```

### LLM-Generated Interpreters

Using LLMs to not only generate DSL code but also generate the interpreters:
```
User: "Create a Gantt chart showing project timeline"
LLM: Generates both:
  1. GanttDSL code (data structure)
  2. Rendering instructions (how to visualize)
```

## Conclusion

The presentation language pattern represents a paradigm shift in how we think about LLM capabilities. Rather than treating LLMs as direct producers of content, we leverage them as sophisticated compilers that translate natural language into domain-specific executable code.

This approach:
- **Transcends text**: Enables rich visual and interactive experiences
- **Separates concerns**: LLMs handle intent, systems handle execution
- **Scales gracefully**: New capabilities added through new DSLs
- **Empowers users**: Complex outputs through simple conversations

As LLMs become more capable at understanding and generating structured code, and as rendering engines become more sophisticated, this architectural pattern will enable increasingly powerful and creative human-computer interactions.

The next generation of AI interfaces won't just chat—they'll **compile conversations into experiences**.

## References

### Implementation Examples

The implementations discussed in this article are production code from MulmoChat, an open-source multi-modal chat application:

- **Markdown Plugin**: `/src/tools/models/markdown.ts`
- **MulmoScript Plugin**: `/src/tools/models/mulmocast.ts`
- **Spreadsheet Plugin**: `/src/tools/models/spreadsheet.ts`
- **Plugin Architecture**: `/src/tools/types.ts`

### Related Concepts

- **Domain-Specific Languages (DSLs)**: Languages tailored to specific problem domains
- **Declarative Programming**: Specifying *what* rather than *how*
- **Compiler Design**: Translating high-level languages to executable forms
- **Template Languages**: Embedding logic within markup (e.g., JSX, Jinja)
- **Function Calling in LLMs**: Structured outputs and tool integration

---

*This article describes patterns implemented in MulmoChat, a Vue 3 application providing multi-modal voice chat with OpenAI's GPT-4 Realtime API.*
