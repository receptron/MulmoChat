# Beyond the Sea of App Icons: The LLM-Orchestrated Operating System

**A New Paradigm for Human-Computer Interaction**

*Author: Satoshi Nakajima*
*Date: October 2025*

---

## Abstract

This paper presents a technical architecture that reframes human-computer interaction as a **human-AI partnership**, proposing a shift from traditional **Man-Machine Interfaces** to **Man-Machine-AI Interfaces**. Rather than simply replacing static app icons with a conversational layer, we make **natural language conversation** and **intent expression** the primary interface. A Large Language Model (LLM) orchestrates a plugin ecosystem, understanding user intent and invoking appropriate tools through function calling. The key innovation is extending the traditional function calling mechanism (and contemporary MCP-style protocols) to support **multi-modal interaction**: plugins return not only data to the LLM, but also graphical interface components that provide rich visual feedback to users. This dual-channel approach combines the natural interaction of conversation with the power of visual interfaces, allowing users to collaborate with AI systems that surface the right GUI affordances on demand instead of forcing them to operate discrete applications. In this triadic architecture, the AI serves as an intelligent intermediary—the "driver"—between human intent and machine execution.

**Table of Contents**
- [1. Introduction](#1-introduction)
- [2. Architectural Overview](#2-architectural-overview)
- [3. Eliminating the App Icon Paradigm](#3-eliminating-the-app-icon-paradigm)
- [4. Implementation: MulmoChat Case Study](#4-implementation-mulmochat-case-study)
- [5. Benefits and Implications](#5-benefits-and-implications)
- [6. Technical Innovations](#6-technical-innovations)
- [7. Challenges and Solutions](#7-challenges-and-solutions)
- [8. Future Directions](#8-future-directions)
- [9. Comparison with Existing Paradigms](#9-comparison-with-existing-paradigms)
- [10. Philosophical Implications](#10-philosophical-implications)
- [11. Conclusion](#11-conclusion)
- [References](#references)
- [Appendix A: Plugin Interface Specification](#appendix-a-plugin-interface-specification)
- [Appendix B: Example Plugin Implementation](#appendix-b-example-plugin-implementation)

## 1. Introduction

### 1.1 The App Icon Problem

Modern operating systems present users with an overwhelming array of application icons. Consider the typical smartphone home screen with 50-100 apps, or a desktop computer with hundreds of installed applications. This paradigm suffers from several fundamental issues:

1. **Discovery Problem**: Users must know which app performs which function
2. **Context Switching**: Each app has unique UI patterns, requiring constant mental model changes
3. **Learning Curve**: Every new app requires time investment to learn its interface
4. **Decision Fatigue**: Choosing the right app for a task imposes cognitive overhead
5. **Fragmentation**: Related tasks often require multiple apps, breaking workflow continuity

### 1.2 From Man-Machine to Man-Machine-AI Interfaces

When we discuss UI/UX design, we traditionally use terms like **MMI (Man-Machine Interface)** or **HCI (Human-Computer Interaction)**—because historically, interaction meant something happening between a human and a machine.

But in the age of AI-native systems, that definition feels incomplete.

Consider modern software development: when coding in an IDE like Cursor alongside Claude Code—an AI pair programmer—the dynamic has fundamentally shifted. The developer gives instructions, the AI writes code, and the human reviews or edits. It's no longer just a person and their computer. It's a **three-way collaboration**: human, AI, and machine.

This is analogous to riding in a taxi: you're not driving the car yourself, but giving instructions to the driver, who then operates the vehicle. (Of course, it would be quite surprising—and probably a safety concern—if the passenger suddenly grabbed the steering wheel!) The driver represents the AI—understanding natural language, translating intent into machine actions.

**We propose this as a new paradigm**: an AI-native operating system where users express **intent** rather than selecting **applications**. The LLM acts as the intelligent intermediary—the "driver"—translating natural language commands into orchestrated sequences of function calls, presenting results through dynamic, context-appropriate visual interfaces.

Crucially, this architecture positions the LLM as the mediator between humans and computational capabilities. The AI interprets context, negotiates task boundaries, and manifests GUI elements only when they provide clear value—transforming the interface problem from "which app should I open?" into a dialog about goals, constraints, and outcomes.

This represents an evolution in our vocabulary: from **Man-Machine Interface** to **Man-Machine-AI Interface**—because in this new era, AI is not just a tool; it's the driver between intent and execution.

## 2. Architectural Overview

### 2.1 LLM-MVC Pattern

Our architecture implements a Model-View-Controller pattern with two critical innovations: **the LLM serves as the Controller**, and **the function-calling layer natively supports multi-modal, GUI-capable responses**.

```
User (Natural Language)
    ↓
LLM Controller (GPT-4 Realtime API)
    ↓
Plugin Ecosystem (Models + Views)
    ↓
Dynamic Visual Interface
```

#### Components:

**Controller (LLM)**
- Receives natural language input via voice or text
- Understands user intent through contextual reasoning
- Selects appropriate plugins via function calling
- Orchestrates multi-step workflows
- Generates conversational feedback

**Model (Plugin Execution Layer)**
- Self-contained business logic units
- Standardized `ToolPlugin` interface
- Executes domain-specific operations
- Returns structured `ToolResult` objects

**View (Dynamic Component Rendering)**
- Plugin-specific Vue components
- Main canvas view for multi-modal presentation
- Direct interaction via GUI
- Indirect voice interaction through the LLM

### 2.2 Core Interfaces

The following interfaces represent one possible implementation in TypeScript and Vue, which our first prototype (MulmoChat) uses to demonstrate the architecture:

```typescript
interface ToolPlugin {
  toolDefinition: {
    name: string;
    description: string;
    parameters: object;
  };
  execute: (context: ToolContext, args: object) => Promise<ToolResult>;
  viewComponent: VueComponent;      // Visual representation
  previewComponent: VueComponent;   // Thumbnail preview
  generatingMessage: string;
  isEnabled: (config?) => boolean;
}

interface ToolResult {
  message: string;        // Status for LLM
  jsonData?: any;         // Structured data for LLM
  instructions?: string;  // Follow-up prompts
  data?: object;          // Plug-in specific data
  viewState?: object;     // UI state
  updating?: boolean;     // In-place update flag
}
```

This dual-channel return type enables both **conversational feedback** (message, jsonData) and **visual feedback** (data, viewState, viewComponent).

### 2.3 Extending Function Calling Beyond MCP

Existing function-calling APIs—including the Model Context Protocol (MCP) and OpenAI's canonical schema—were designed around pure data exchange. They excel at transactional interactions ("fetch data", "transform text"), but they stop short of specifying how results should be rendered or how a user can continue the interaction through a GUI.

MulmoChat introduces an extended contract where every tool (1) returns conversational updates for the LLM, (2) exposes structured data for downstream reasoning, and (3) carries **view descriptors** that the client renders in real time. This approach effectively couples intent interpretation with GUI synthesis: the LLM remains in control of the workflow while the human enjoys contextual UI components that can adapt, update, and even accept direct input, all without abandoning the conversational loop.

## 3. Eliminating the App Icon Paradigm

### 3.1 From App-Centric to Intent-Centric

**Traditional OS:**
```
User thinks: "I need to check Tesla stock price"
↓
User remembers: "I need a browser or finance app"
↓
User searches: Opens app drawer, finds Chrome
↓
User navigates: Types "yahoo finance tesla" in search
↓
User interacts: Clicks links, navigates UI
```

**LLM-OS:**
```
User speaks: "What's Tesla's stock price?"
↓
LLM understands: Stock price query
↓
LLM executes: browse("https://finance.yahoo.com/quote/TSLA/")
↓
LLM presents: Visual chart + spoken summary
```

The app abstraction layer completely disappears from the user's mental model.

### 3.2 Zero Learning Curve

Each traditional app requires users to learn:
- Where to find it (app store, home screen organization)
- How to launch it (icon, search, voice assistant)
- How its UI works (navigation patterns, gestures, menu structures)
- What features it offers (often discovered through trial and error)

In the LLM-OS model, users need only:
- Express what they want in natural language
- Observe the result

The system handles all translation from intent to implementation.

### 3.3 Automatic Workflow Composition

The LLM controller can orchestrate multi-step workflows that traditionally would require multiple apps:

**Example: "Plan a trip to Paris"**

Traditional approach:
1. Open web browser → search for flights
2. Open calendar app → check dates
3. Open maps app → explore neighborhoods
4. Open notes app → save information
5. Open weather app → check climate
6. Switch between all apps multiple times

LLM-OS approach:
```javascript
User: "Plan a trip to Paris next month"
↓
LLM executes:
  1. browse("flight comparison site")
  2. generateImage("Paris neighborhoods map")
  3. browse("Paris weather in November")
  4. pushMarkdown("Trip itinerary")
↓
Presents: Integrated visual dashboard with all information
```

All operations flow naturally from a single conversational thread.

## 4. Implementation: MulmoChat Case Study

### 4.1 System Architecture

MulmoChat implements this vision through:

**WebRTC Realtime Communication**
- Bidirectional audio streams (voice input/output)
- Data channel for function calling
- Sub-second latency for natural conversation

**Plugin Ecosystem** (11+ plugins):
- `generateImage`: AI image generation via Google Gemini
- `editImage`: Image manipulation
- `browse`: Web content extraction
- `exa`: AI-powered search
- `map`: Google Maps integration
- `mulmocast`: Multimedia presentations
- `music`: Audio playback control
- `othello`: Interactive game with AI
- `quiz`: Educational quizzes
- `markdown`: Document rendering
- `canvas`: Drawing tools

**Dynamic View Rendering**
```vue
<component
  v-if="selectedResult && getToolPlugin(selectedResult.toolName)?.viewComponent"
  :is="getToolPlugin(selectedResult.toolName).viewComponent"
  :selected-result="selectedResult"
  :send-text-message="sendTextMessage"
  @update-result="handleUpdateResult"
/>
```

The main canvas dynamically renders whatever component the current plugin provides—no hardcoded UI for specific tools.

### 4.2 Execution Flow

1. **User Input**: Voice or text via sidebar
2. **LLM Processing**: GPT-4 Realtime analyzes intent
3. **Function Selection**: Based on tool definitions
4. **Plugin Execution**:
   ```typescript
   const result = await toolExecute(context, toolName, args);
   ```
5. **Dual Feedback**:
   - **To LLM**: JSON status enables follow-up reasoning
   - **To User**: Visual component renders on canvas
6. **Conversation Continues**: LLM can chain multiple tools

### 4.3 Plugin Example: Image Generation

**Scenario**: A user asks, "How does a jet engine work?"

The LLM begins explaining the concept verbally, but autonomously decides to generate a visual aid to enhance understanding:

```
User: "How does a jet engine work?"
LLM: "A jet engine works by compressing air, mixing it with fuel,
      igniting it, and expelling the hot gases to create thrust..."
      [Calls generateImage("cross-section diagram of jet engine showing compressor, combustion chamber, and turbine")]
[Visual diagram appears on canvas]
LLM: "As you can see in the diagram, air enters through the intake..."
```

The user never explicitly requested an image—the LLM understood that complex mechanical concepts benefit from visual representation and proactively invoked the appropriate tool. This demonstrates the intelligence of the orchestration layer.

**Tool Definition** (sent to LLM):
```typescript
{
  name: "generateImage",
  description: "Generate an image from a text prompt using AI",
  parameters: {
    type: "object",
    properties: {
      prompt: { type: "string", description: "Image description" }
    },
    required: ["prompt"]
  }
}
```

**Execution** (in plugin):
```typescript
async execute(context, args) {
  const imageUrl = await generateWithGemini(args.prompt);
  return {
    message: "Image generated successfully",
    data: { imageUrl, prompt: args.prompt },
    viewState: { zoom: 1.0 }
  };
}
```

**View Component** (displays result):
```vue
<template>
  <img :src="selectedResult.data.imageUrl" />
  <p>{{ selectedResult.data.prompt }}</p>
</template>
```

The user never needs to know an "image generation app" exists—they ask about jet engines, and the LLM autonomously generates visual aids to enhance understanding.

## 5. Benefits and Implications

### 5.1 Cognitive Load Reduction

**Traditional OS**: O(n) cognitive load, where n = number of installed apps
- Must remember app names, icons, locations
- Must recall which app does what
- Must learn n different UI paradigms

**LLM-OS**: O(1) cognitive load
- Single interaction paradigm: natural language
- No app discovery required
- No UI learning curve per function

### 5.2 Accessibility Revolution

Voice-first interaction with visual feedback creates universal accessibility:
- **Visual impairments**: Full voice control with audio feedback
- **Motor impairments**: No precise clicking/tapping required
- **Cognitive impairments**: No complex menu navigation
- **Age barriers**: Intuitive for children and elderly
- **Technical literacy**: No prerequisite knowledge needed

### 5.3 Workflow Continuity

Traditional app switching breaks concentration and disrupts flow state. LLM-OS maintains continuous conversational context:

```
User: "Show me Tesla's stock price"
[LLM displays chart]

User: "How does that compare to Ford?"
[LLM updates chart with comparison]

User: "Create a presentation about EV market trends"
[LLM generates slides using previous context]
```

All within one conversational thread—no app switching.

## 6. Technical Innovations

### 6.1 Multi-Modal Function Calling

Traditional function calling returns JSON for the LLM to process. We extend this with plugin specific data, which allows the plugin to interact with the user via its graphical view:

```typescript
// Traditional: LLM receives only JSON
{ status: "success", data: {...} }

// Our approach: LLM receives JSON + User sees interactive UI
{
  message: "Map loaded",           // For LLM
  jsonData: { location: "..." },   // For LLM
  data: { markers: [...] },        // For view
  viewComponent: GoogleMapView     // For view
}
```

This enables the LLM to reason about visual outputs and chain operations effectively.

### 6.2 Context-Aware Execution

The `ToolContext` interface allows plugins to access current state:

```typescript
interface ToolContext {
  currentResult: ToolResult | null;
}
```

This enables contextual operations:
```
User: "Zoom in on that map"
→ map plugin receives currentResult with existing map state
→ updates in place rather than creating new map
```

The `updating: true` flag in `ToolResult` enables in-place updates, maintaining visual continuity.

### 6.3 Follow-Up Instructions

Plugins can guide the LLM's next actions:

```typescript
return {
  message: "Image generated",
  instructions: "Tell the user their image is ready and ask if they'd like any modifications"
}
```

This creates natural multi-turn interactions without hardcoding conversation flows.

## 7. Challenges and Solutions

### 7.1 Plugin Discovery

**Challenge**: How does the LLM know which plugin to use?

**Solution**: Descriptive `toolDefinition` with clear descriptions:
```typescript
{
  name: "browse",
  description: "Fetch and extract content from any web URL. Use this when the user asks about current events, specific websites, or real-time information."
}
```

The LLM's language understanding selects appropriate tools based on intent.

### 7.2 Error Handling

**Challenge**: Plugin failures shouldn't break conversation flow.

**Solution**: Standardized error responses sent back to LLM:
```typescript
catch (error) {
  return {
    message: `Failed to load webpage: ${error.message}`,
    instructions: "Apologize to the user and suggest alternatives"
  };
}
```

The LLM gracefully handles errors conversationally.

### 7.3 Latency

**Challenge**: Multi-step workflows could feel slow.

**Solution**:
- WebRTC for real-time communication
- Streaming responses (audio and text)
- Optimistic UI updates
- `waitingMessage` for immediate feedback:
```typescript
waitingMessage: "I'm generating your image now. This will take a moment."
```
- Deferred processing: The presentation plugin (mulmocast) returns results (text and images) quickly and performs slow operations (generating video) after the view is presented to the user, caching the result for future use

## 8. Future Directions

### 8.1 Persistent Context

Extending context beyond single sessions:
- Long-term memory of user preferences
- Resumable multi-session projects
- Personalized plugin recommendations

### 8.2 Third-Party Plugin Ecosystem

Opening the platform to external developers:
- Plugin marketplace with semantic search
- Automated tool discovery based on conversation
- Community-driven capability expansion

### 8.3 Multi-User Collaboration

Extending single-user model to teams:
- Shared conversational workspaces
- Collaborative plugin interactions
- Unified context across team members

### 8.4 Agentic Workflows

Evolving from reactive to proactive:
- Background task execution
- Scheduled autonomous operations
- Proactive suggestions based on context

### 8.5 Cross-Platform Unification

Extending beyond web to native platforms:
- Mobile OS integration
- Desktop OS integration
- IoT device control
- Unified experience across all devices

## 9. Comparison with Existing Paradigms

### 9.1 Traditional Desktop OS
- **App Icons**: Explicit, user-managed
- **Interaction**: Click/keyboard navigation
- **Learning Curve**: Per-application
- **Workflow**: Sequential app switching
- **Cognitive Model**: "Which app do I need?"

### 9.2 Voice Assistants (Siri, Alexa)
- **Capabilities**: Limited, predefined commands
- **Visual Feedback**: Minimal or none
- **Extensibility**: Closed ecosystem or rigid "skills" model
- **Conversation**: Shallow, stateless
- **Complexity Limit**: Simple single-step tasks

### 9.3 LLM-OS (Our Approach)
- **Interface**: Natural language (voice + text)
- **Capabilities**: Extensible plugin ecosystem
- **Visual Feedback**: Rich, interactive components
- **Conversation**: Deep, multi-turn, contextual
- **Complexity**: Multi-step workflows
- **Cognitive Model**: "What do I want to accomplish?"

### 9.4 Key Differentiator

Unlike voice assistants that map utterances to predefined functions, our LLM controller **reasons** about intent and **composes** solutions:

**Voice Assistant:**
```
User: "Find restaurants near me"
System: [Hardcoded restaurant search function]
```

**LLM-OS:**
```
User: "I'm hungry and near Times Square"
LLM reasons:
  1. User needs restaurant recommendations
  2. Location: Times Square
  3. Should show map + options
LLM executes:
  - map("Times Square restaurants")
  - browse("restaurant reviews Times Square")
  - Synthesizes visual + conversational response
```

The LLM bridges intent to implementation through understanding, not keyword matching.

## 10. Philosophical Implications

### 10.1 The Triadic Interface: Man-Machine-AI

Designing AI-native systems requires a fundamentally different mindset than traditional interface design. We can no longer rely on the Man-Machine Interface (MMI) paradigm that has dominated computing for decades. We must design the entire system architecture and experience with the AI as an **active participant**, not a background feature.

Consider the evolution of interface terminology:
- **1960s-2010s: MMI/HCI** - Human ↔ Machine (direct manipulation)
- **2010s-2020s: Voice Assistants** - Human → Voice Layer → Machine (simple command mapping)
- **2025+: Man-Machine-AI Interface** - Human ↔ AI ↔ Machine (intelligent mediation)

In MulmoChat, this triadic relationship manifests concretely:

**Traditional MMI:**
```
User clicks → Application responds → User sees result
```

**Man-Machine-AI Interface:**
```
User speaks: "Show me Tesla stock"
    ↓
AI reasons: User wants financial data + visualization
    ↓
AI invokes: browse() plugin
    ↓
Machine executes: Web scraping, data extraction
    ↓
AI synthesizes: Conversational summary + chart selection
    ↓
User experiences: Voice explanation + visual chart
    ↓
User continues: "Compare to Ford" (AI has context)
```

The AI serves as an **intelligent intermediary** that:
1. **Interprets** human intent from natural language
2. **Translates** intent into machine operations
3. **Orchestrates** multi-step workflows across plugins
4. **Synthesizes** results into multi-modal presentations
5. **Maintains** conversational context for continuity

This is fundamentally different from voice assistants (which map utterances to fixed functions) or traditional GUIs (which require direct manipulation). The AI doesn't just execute commands—it **reasons** about goals, **composes** solutions, and **adapts** the interface to the task.

Just as a passenger shouldn't grab the steering wheel from a taxi driver, users shouldn't need to manually orchestrate low-level operations. They express destination (intent), the AI drives (orchestrates), and the machine moves (executes).

### 10.2 From Tool Mastery to Intent Expression

Traditional computing requires users to become "tool masters"—experts in wielding specific applications. The LLM-OS model shifts the burden from user to system:

**Old paradigm**: "Learn the tool, then accomplish the task"
**New paradigm**: "Express the task, system handles the tools"

This mirrors the evolution from command-line interfaces to GUIs—but goes further by eliminating the need to learn visual interfaces entirely.

### 10.3 The Computer as Colleague

Rather than a collection of passive tools, the LLM-OS presents the computer as an intelligent colleague:
- Understands natural language requests
- Asks clarifying questions when needed
- Suggests relevant next steps
- Maintains conversational context
- Adapts to user preferences over time

This transforms human-computer interaction from command-response to collaboration.

### 10.4 Democratization of Computing

By eliminating app-specific knowledge requirements, the LLM-OS makes computing truly universal:
- Children can use advanced capabilities without reading menus
- Elderly users avoid complex UI navigation
- Non-technical users access powerful tools
- Global users interact in natural language regardless of UI localization

Computing becomes as accessible as conversation.

## 11. Conclusion

The "sea of app icons" represents a fundamental mismatch between how humans think (intent-based, task-oriented) and how computers present functionality (app-based, tool-oriented). By placing an LLM as the controller in an MVC architecture—and by extending the function-calling substrate to produce rich GUI experiences—we recast the OS as a human-AI interface rather than a collection of isolated applications.

Users express **what they want**, not **how to get it**. The system translates intent into orchestrated plugin executions, presenting results through dynamic visual interfaces. This eliminates:

- App discovery problems
- UI learning curves
- Context switching overhead
- Workflow fragmentation
- Decision fatigue

The result is a computing experience that feels less like operating a machine and more like collaborating with an intelligent assistant.

As LLMs continue to improve in reasoning capability, context retention, and multi-modal understanding, the LLM-OS paradigm will become increasingly powerful. We believe this represents the future of human-computer interaction: **intent-centric, conversational, and fundamentally more human**.

---

## References

1. Karpathy, A. (2023). "LLM OS" - https://x.com/karpathy/status/1723140519554105733
2. OpenAI. (2024). "GPT-4 Realtime API Documentation"
3. Nielsen, J. (1994). "Usability Engineering" - discussing cognitive load in UI design
4. Shneiderman, B. (2016). "The New ABCs of Research: Achieving Breakthrough Collaborations" - on human-computer collaboration
5. Norman, D. (2013). "The Design of Everyday Things" - principles of intuitive design
6. MulmoChat GitHub Repository: [https://github.com/receptron/MulmoChat]

## Appendix A: Plugin Interface Specification

```typescript
// Core plugin interface
export interface ToolPlugin {
  toolDefinition: {
    type: "function";
    name: string;
    description: string;
    parameters?: {
      type: "object";
      properties: {
        [key: string]: any;
      };
      required: string[];
    };
  };
  execute: (
    context: ToolContext,
    args: Record<string, any>,
  ) => Promise<ToolResult>;
  generatingMessage: string;
  waitingMessage?: string;
  isEnabled: (startResponse?: StartApiResponse) => boolean;
  delayAfterExecution?: number;
  viewComponent?: any;
  previewComponent?: any;
}

// Tool execution context
export interface ToolContext {
  currentResult: ToolResult | null;
}

// Tool execution result
export interface ToolResult {
  toolName?: string;
  uuid?: string;
  message: string;           // Status message to LLM
  title?: string;
  jsonData?: any;            // Structured data to LLM
  instructions?: string;     // Follow-up prompts for LLM
  updating?: boolean;        // Update existing result vs. create new
  data?: Record<string, any>;      // Plugin-specific view data
  viewState?: Record<string, any>; // Plugin-specific UI state
}
```

## Appendix B: Example Plugin Implementation

```typescript
// src/tools/models/generateImage.ts
export const plugin: ToolPlugin = {
  toolDefinition: {
    type: "function",
    name: "generateImage",
    description: "Generate an image from a text prompt using AI. Use this when the user asks for visual content or to illustrate concepts.",
    parameters: {
      type: "object",
      properties: {
        prompt: {
          type: "string",
          description: "Detailed description of the image to generate"
        }
      },
      required: ["prompt"]
    }
  },

  execute: async (context: ToolContext, args: any): Promise<ToolResult> => {
    const imageUrl = await callGeminiAPI(args.prompt);

    return {
      message: `Successfully generated image: ${args.prompt}`,
      data: {
        imageUrl,
        prompt: args.prompt,
        timestamp: Date.now()
      },
      instructions: "Tell the user their image is ready. Ask if they'd like any modifications or a different variation."
    };
  },

  generatingMessage: "Generating image...",
  waitingMessage: "I'm creating that image for you now.",
  isEnabled: () => true,
  viewComponent: ImageView,
  previewComponent: ImagePreview
};
```

---

*This whitepaper describes the architecture implemented in MulmoChat, an open-source project exploring the future of human-computer interaction through LLM-orchestrated interfaces.*
