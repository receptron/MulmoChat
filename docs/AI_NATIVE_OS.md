# The Dawn of the AI-Native Operating System

**Satoshi Nakajima**

It has been nearly three years since OpenAI released ChatGPT.
Since then, we’ve seen the emergence of Function Calling, MCP, the Code Interpreter, Artifacts, multimodal LLMs, and Agents.
Yet despite these breakthroughs, ChatGPT’s core interface remains a **text-based chat**.

**Thesis:** This paper argues that the future of computing lies beyond today’s app-centric model. In an **AI-native operating system**, natural language and graphical interfaces converge—allowing users to think, converse, and create seamlessly with AI.

## The Fusion of NLUI and GUI

Among software engineers, the growing use of chat-based programming environments such as Claude Code demonstrates that the **Natural Language User Interface (NLUI)** holds immense potential.
By contrast, efforts like Microsoft Copilot—which retrofit natural-language features onto legacy apps such as Excel—have been less successful, because those systems were designed **before the LLM era**.

For the same reason, approaches that let LLMs “operate” browsers or existing apps face hard limits.
A truly AI-native approach exposes application functions as APIs and lets the LLM translate the user’s **intent** into sequences of API calls.
In this paradigm, the LLM acts as an interpreter between human thought and system function.

An **AI-native computing experience** thus fuses the **NLUI** between user and LLM with the **GUI** between user and application—requiring an architecture fundamentally different from anything that came before.

This paper introduces **[MulmoChat (Multi-modal Chat)](https://github.com/receptron/MulmoChat)**—an open-source prototype exploring this fusion from both the **user-experience** and **system-architecture** perspectives.

---

## How MulmoChat Unifies Conversation and Interface

Function Calls and MCP—collectively referred to as **Tools**—allow LLMs to access external capabilities via JSON.
However, in current systems, Tool results are disconnected from the chat. They open a browser or render a window, but do not merge naturally with the conversation.

**MulmoChat extends Tool Calls to bridge this gap.**
Each Tool can return not only text but also **Tool-specific data** for visualization.
Dedicated **viewers** render that data on screen—so every Tool can generate and control its own interactive GUI **within the same conversational flow**.

### Example: A Spreadsheet by Conversation

1. The “Spreadsheet” Tool registers itself and its viewer.
2. The user says: *“Show me the present value of a $1000 monthly income over a year, and make it easy to change the discount rate.”*
3. The LLM interprets intent and generates JSON for a Spreadsheet Tool Call.
4. The Tool creates spreadsheet data and returns it.
5. The system launches the viewer associated with that data type.
6. The spreadsheet appears—ready for direct interaction.
7. Any user edits or comments feed back into the same NLUI context.

In MulmoChat, **LLM, GUI, and user** collaborate inside a single conversational space.
This is the genuine convergence of NLUI and GUI—the foundation of user experience in an AI-native computing environment.

![](https://mag2.thelifeisbeautiful.com/Nov2025/discount2.png)

---

## Beyond the Sea of App Icons

Consider today’s user experience: dozens of icons on a smartphone screen.
Each time we want to do something, we must search through **a sea of apps**.

In an AI-native system, the LLM handles that choice.
The user no longer “launches” apps—the LLM simply selects and orchestrates the right Tools.
The concept of a separate “application” dissolves.

Spreadsheets, slides, and text editors exist merely as **registered Tools** accessible to the LLM.
And because LLMs can generate drafts instantly, the **learning curve** for any creative task drops sharply.

For example, when the user says:
*“Make a travel guide for Tokyo with pictures of three famous landmarks,”*
MulmoChat calls a document Tool and produces a fully formatted guide within seconds.

![](https://mag2.thelifeisbeautiful.com/Nov2025/tokyo_guide.png)

The user can then refine it conversationally—turning **dialogue itself into the creative process**.

MulmoChat resembles Claude’s Artifact or ChatGPT’s Canvas, but differs in two key ways:

1. **Extensibility** – Anyone can add new data types and viewers; it’s open by design.
2. **Conversation-First Design** – Whereas others focus on output, MulmoChat centers on dialogue.
   Documents and applications emerge naturally *as a result of* that conversation.

Because of this, LLMs can act as **interactive service agents**—for instance, a travel planner that chats with the customer and produces itineraries in real time.

The same mechanism also collects information conversationally.
Below, MulmoChat serves as a **hospital receptionist**, dynamically generating input forms through natural dialogue.

![](https://mag2.thelifeisbeautiful.com/Nov2025/Receptionist.png)

In short, MulmoChat enables both information generation and collection through one unified conversational interface—the essence of an **AI-native user experience**.

---

## Domain-Specific Presentation Language — The Bridge Between Intent and Interface

At the core of this architecture lies the **Domain-Specific Presentation Language (DSPL)**—a structured format generated by the LLM to describe how information or input forms should appear.

Each Tool defines and exposes its data schema to the LLM.
When the user makes a request, the LLM generates data conforming to that schema and invokes the appropriate Tool.
The Tool returns the data; the viewer renders it.

This involves two transformations:

1. **User intent → DSL (via LLM)**
2. **DSL → GUI (via viewer)**

Through these steps, LLMs—masters of text—can create **interactive graphical experiences**.

Common formats such as Markdown, HTML, SVG, or TeX can serve as DSLs, but MulmoChat also supports custom DSPLs to reduce verbosity and token cost.
Developers can choose the format best suited to their Tool’s purpose.

This design aligns perfectly with current LLM evolution—especially the trend toward Tool Calling and structured code generation.
MulmoChat experiments show that even mid-sized open models like **gpt-oss:20b** or **qwen3:30b** perform effectively in this DSPL framework—not just frontier models such as GPT-5 or Sonnet 4.5.

---

## The Road Ahead — Toward an AI-Native Computing Paradigm

MulmoChat is not merely an extended chat interface.
It is an **operating-system experiment**—a prototype of how humans and AI will collaborate in the coming decade.

Traditional computers assumed that **humans operate applications**.
In the AI-native era, the LLM understands intent, orchestrates Tools, and presents results.
Users no longer search for apps or memorize procedures.

This transformation is as profound as the shift from **CUI (MS-DOS)** to **GUI (Mac and Windows)**.
Just as the mouse replaced typed commands, now **natural language and DSPLs** will make *thought itself* the next input device.

MulmoChat serves as an “OS-level laboratory” for this future.
Its DSPL and Tool architecture may form the foundation of tomorrow’s AI-native computing stack.

Ultimately, the goal is a world where **humans and AI share the same canvas of thought**—
where creation, learning, research, and everyday work unfold naturally through conversation.

**We invite developers, designers, and researchers to join this exploration—
to help shape the architecture of the AI-native era.**