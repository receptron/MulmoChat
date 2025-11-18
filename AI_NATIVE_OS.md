# The Dawn of the AI-Native Operating System

Satoshi Nakajima

It has been nearly three years since OpenAI released ChatGPT.
Since then, we’ve seen the emergence of Function Calling, MCP, the Code Interpreter, Artifacts, multi-modal LLMs, and Agents.
Yet, despite these advances, ChatGPT’s core interface remains a **text-based chat**.

Among software engineers, the growing use of chat-based programming environments such as Claude Code shows that the **Natural Language User Interface (NLUI)** between humans and LLMs holds far greater potential.

By contrast, efforts like Microsoft Copilot—which retrofit natural-language interfaces onto legacy applications such as Excel—have been less successful.
The reason is simple: those applications were designed **before the era of LLMs**.

For the same reason, approaches that let LLMs “operate” browsers or existing apps also face hard limits.
A truly AI-native approach exposes application functions as APIs and lets the LLM translate the user’s **intent** into a sequence of API calls.
In this paradigm, the LLM serves as an interpreter between the user and the application.

In short, an **AI-Native computing experience** must fuse the **NLUI (Natural Language UI)** between user and LLM with the **GUI** between user and application.
This fusion demands an application architecture fundamentally different from anything that came before.

This paper introduces **[MulmoChat (Multi-modal Chat)](https://github.com/receptron/MulmoChat)**—an open-source prototype designed to explore the future of AI-native computing from the perspective of **user experience and system architecture**.

---

### The Fusion of NLUI and GUI

Function Calls and MCP—collectively referred to here as **Tools** or **Tool Calls**—were created to let LLMs access external functionality.
They use a simple text-based interface: parameters and results in JSON.

While a Tool Call can open a custom application window or a browser page, such results remain disconnected from the chat itself.
They do not represent a true **fusion of NLUI and GUI**.

MulmoChat extends the Tool Call mechanism to achieve that integration.
Specifically, it allows a Tool Call to return not only the LLM’s reply but also **Tool-specific data** to be displayed to the user.
Each Tool has a dedicated **viewer** responsible for rendering that data on screen.

This architecture enables applications to dynamically generate and manipulate their own interactive GUIs—**within the same conversational flow**.

Example: imagine a spreadsheet application running on this architecture.

1. The “Spreadsheet” Tool registers itself and its dedicated viewer with the system.
2. The user says: *“Show me the present value of a $1000 monthly income over a year, and make it easy to change the discount rate.”*
3. The LLM interprets the intent and constructs JSON data for a Spreadsheet Tool Call.
4. The Tool notifies the LLM that it’s generating spreadsheet data and returns that data to the system.
5. The system recognizes the data type and launches the corresponding viewer.
6. The viewer displays the generated spreadsheet.
7. The user can now interact directly with the GUI, and those interactions feed back into the chat context (NLUI).

In MulmoChat, the **LLM, GUI, and user** operate seamlessly within a single conversational context.
This is the genuine convergence of NLUI and GUI—the foundation of user experience in an AI-native computing environment.

![](https://mag2.thelifeisbeautiful.com/Nov2025/discount2.png)

---

### Beyond the Sea of App Icons

The difference from today’s systems becomes clear when viewed through the lens of user experience.

Most iPhone users have dozens—sometimes hundreds—of apps.
Each time they need to do something, they must search through **a sea of icons** to find the right one.

In an AI-native system, the LLM chooses which Tool to use.
The user is completely freed from the act of selecting or launching apps.

Spreadsheets, presentations, and word processors merely exist as Tools registered in the system—available to the LLM.
The concept of a separate “application” disappears.

Since LLMs can automatically generate initial drafts—whether spreadsheets or slides—the **learning curve** drops dramatically.

For example, when a user tells MulmoChat, *“Make a travel guide for Tokyo with pictures of three famous landmarks,”*
a Word-like Tool is invoked, and within seconds, a fully formatted document appears.

![](https://mag2.thelifeisbeautiful.com/Nov2025/tokyo_guide.png)

The user can then add details or issue new instructions to refine the document, turning the entire **chat into the creative process itself**.

This mechanism resembles Claude’s Artifact or ChatGPT’s Canvas, but MulmoChat differs in two key ways:

1. **Extensibility** – Artifacts and Canvas support only limited data types, whereas MulmoChat allows third parties to freely add new data types and viewers.
2. **Communication-First Design** – While Artifacts and Canvas focus on generating output, MulmoChat centers on the *conversation* itself.
   Documents or software are simply by-products of that dialogue.

Because of this design, an LLM can function not just as a content generator but as an **interactive service agent**—for example, a travel agency that chats with the customer and produces personalized itineraries.

The same mechanism also works in the opposite direction: to **collect information** from the user.
In the example below, MulmoChat acts as a “hospital receptionist” within MulmoCast, dynamically generating forms in natural dialogue to gather patient information.

![](https://mag2.thelifeisbeautiful.com/Nov2025/Receptionist.png)

In short, MulmoChat enables both information generation and collection through a single, seamless natural-language interface.
This is what we mean by **a unified NLUI-GUI experience** in an AI-native environment.

---

### Domain-Specific Presentation Language — The Bridge Between Intent and Interface

A crucial component of this architecture is the **Domain-Specific Language (DSL)** generated by the LLM when presenting information (including input forms) to the user.
More precisely, since this language focuses on presentation, we call it a **Domain-Specific Presentation Language (DSPL)**.

Each Tool—spreadsheet, document, form—has its own data schema, which it defines and exposes to the LLM.
When the user makes a request, the LLM generates data conforming to that schema and invokes the appropriate Tool.

Typically, the Tool passes that data directly to the system as Tool-specific output, and a dedicated viewer renders it on screen for user interaction.

This process involves two key transformations:

1. The LLM converts **user intent** → **DSL**.
2. The viewer converts **DSL** → **GUI**.

Together, DSLs and viewers enable LLMs—masters of text generation—to produce **interactive graphical experiences**.

Common open formats such as Markdown, HTML, SVG, and TeX can serve as DSLs, or each Tool may define its own.
Generic formats benefit from LLM familiarity and accuracy, but they can be verbose and token-heavy.
MulmoChat therefore supports both general-purpose and custom DSLs, chosen flexibly according to purpose.

The current direction of LLM development—enhancing Tool Calling and code generation—aligns perfectly with the DSL approach.
MulmoChat’s experiments show that even mid-sized open models such as **gpt-oss:20b** or **qwen3:30b** can perform effectively in this framework, not just frontier models like GPT-5 or Sonnet 4.5.

---

### The Road Ahead — Toward an AI-Native Computing Paradigm

MulmoChat is more than an extended chat interface.
It is an attempt to **redefine the very concept of the operating system**.

Traditional computers assumed that **humans operate applications**.
In the AI-native world, the LLM understands human intent, orchestrates Tools, and presents results.
Users no longer need to search for apps or memorize complex procedures.

This shift is as profound as the transition from **CUI (MS-DOS)** to **GUI (Mac and Windows)**.
Just as keyboard commands gave way to the mouse, now **natural language and DSLs** will make *thought itself* the new input for the OS.

MulmoChat serves as an “OS-level laboratory” for that future.
Its DSPL and Tool architecture may well become the foundation of AI-native computing.

Ultimately, the goal is a world where **humans and AI share the same canvas of thought**.
In environments where NLUI and GUI merge seamlessly, creation, learning, research, and everyday life all unfold naturally through dialogue.
