<script lang="ts">
  import { onMount } from "svelte";
  import { Parser, Language, type Node as SyntaxNode } from "web-tree-sitter";
  import CodeEditor from "$lib/CodeEditor.svelte";
  import FlowchartViewer from "$lib/FlowchartViewer.svelte";
  import type { FlowNode } from "$lib/types";
  import {
    Code2,
    Share2,
    ChevronRight,
    AlertCircle,
    Loader2,
    Bug,
    LayoutGrid,
    Type,
    Palette
  } from "lucide-svelte";

  function createFlowNode(
    id: string,
    text: string,
    type: FlowNode["type"],
    targets: string[],
  ): FlowNode {
    return { id, text, type, targets };
  }

  const LANGUAGES = [
    { id: "javascript", name: "JavaScript", wasmFile: "tree-sitter-javascript.wasm" },
    { id: "python", name: "Python", wasmFile: "tree-sitter-python.wasm" },
    { id: "c", name: "C", wasmFile: "tree-sitter-c.wasm" },
    { id: "go", name: "Go", wasmFile: "tree-sitter-go.wasm" },
    { id: "rust", name: "Rust", wasmFile: "tree-sitter-rust.wasm" },
    { id: "java", name: "Java", wasmFile: "tree-sitter-java.wasm" },
    { id: "cpp", name: "C++", wasmFile: "tree-sitter-cpp.wasm" },
  ];

  const THEMES = [
    { id: "default", name: "Clásico" },
    { id: "ocean", name: "Océano" },
    { id: "modern", name: "Moderno" },
    { id: "minimal", name: "Minimalista" }
  ];

  const exampleCodes: Record<string, string> = {
    c: `#include <stdio.h>\n\nint main() {\n    int i;\n    int sum = 0;\n    int count = 5;\n    \n    for (i = 0; i < count; i++) {\n        sum += i;\n        printf(\"%d\", i);\n    }\n    \n    printf(\"Total: %d\", sum);\n    printf(\"Done\");\n    return 0;\n}`,
    javascript: `let count = 0;\nwhile (count < 3) {\n  console.log(\"Looping...\");\n  count++;\n}\nconsole.log(\"Done.\");`,
    python: `x = 0\nwhile x < 5:\n    print(x)\n    x += 1\nprint(\"Done\")`,
    go: `package main\nimport \"fmt\"\n\nfunc main() {\n    sum := 0\n    count := 0\n    total := 10\n    \n    for i := 0; i < 5; i++ {\n        sum += i\n        count++\n        fmt.Println(i)\n    }\n    \n    fmt.Println(sum)\n    fmt.Println(count)\n    fmt.Println(\"Done\")\n}`,
    rust: `fn main() {\n    let mut n = 0;\n    while n < 5 {\n        println!(\"{}\", n);\n        n += 1;\n    }\n}`,
    java: `public class Main {\n    public static void main(String[] args) {\n        for (int i = 0; i < 5; i++) {\n            System.out.println(i);\n        }\n    }\n}`,
    cpp: `#include <iostream>\nint main() {\n    int x = 0;\n    while (x < 5) {\n        std::cout << x;\n        x++;\n    }\n    return 0;\n}`,
  };

  let isLoading = true;
  let loadingMessage = "Cargando motor de Tree-sitter...";
  let errorMessage = "";

  let parser: Parser;
  let loadedLanguages = new Map<string, Language>();

  let selectedLanguageId = "c";
  let selectedThemeId = "default";
  let sourceCode = exampleCodes[selectedLanguageId];
  let groupSequentialStatements = true;
  let showDebug = false;

  let flowchartNodes: FlowNode[] = [];
  let debugInfo: string[] = [];

  onMount(async () => {
    try {
      await Parser.init({
        locateFile: (path: string) => `/wasm/${path}`,
      });
      parser = new Parser();

      for (const lang of LANGUAGES) {
        loadingMessage = `Cargando gramática de ${lang.name}...`;
        const language = await Language.load(`/wasm/${lang.wasmFile}`);
        loadedLanguages.set(lang.id, language);
      }

      isLoading = false;
      await parseCode();
    } catch (error) {
      console.error("Error al inicializar Tree-sitter:", error);
      errorMessage = "No se pudo cargar el parser. Verifique la carpeta public/wasm/.";
      isLoading = false;
    }
  });

  async function parseCode() {
    if (isLoading || !parser) return;

    const currentLanguage = loadedLanguages.get(selectedLanguageId);
    if (!currentLanguage) return;

    try {
      parser.setLanguage(currentLanguage);
      const tree = parser.parse(sourceCode);
      if (!tree) return;
      debugInfo = [];
      flowchartNodes = astToFlowNodes(tree.rootNode);
    } catch (e) {
      console.error(e);
    }
  }

  function astToFlowNodes(rootNode: SyntaxNode): FlowNode[] {
    const nodes: FlowNode[] = [];
    let nodeCounter = 0;

    function getNewId(type: string): string {
      return `${type}-${nodeCounter++}`;
    }

    function addNode(
      id: string,
      text: string,
      type: FlowNode["type"],
      targets: string[] = [],
    ): FlowNode {
      const node = createFlowNode(id, text, type, targets);
      nodes.push(node);
      return node;
    }

    function connectNodes(sourceIds: string[], targetId: string) {
      for (const sourceId of sourceIds) {
        const sourceNode = nodes.find((n) => n.id === sourceId);
        if (sourceNode && !sourceNode.targets.includes(targetId)) {
          sourceNode.targets.push(targetId);
        }
      }
    }

    function cleanText(text: string, isGrouped: boolean = false): string {
      if (isGrouped) {
        return text
          .split("\n")
          .map((line) => {
            let clean = line.replace(/\s+/g, " ").trim();
            if (clean.length > 30) return clean.substring(0, 27) + "...";
            return clean;
          })
          .join("\n");
      }
      let clean = text.replace(/\s+/g, " ").trim();
      if (clean.length > 25) return clean.substring(0, 22) + "...";
      return clean;
    }

    function isNodeComplex(n: SyntaxNode): boolean {
      if (["program", "module", "translation_unit", "source_file", "statement_block", "compound_statement", "block", "statement_list", "else_clause", "class_declaration", "class_body"].includes(n.type)) return true;
      if (["function_definition", "function_declaration", "method_declaration", "function_item"].includes(n.type)) return true;
      if (n.type.includes("if_") || n.type.includes("elif_") || n.type === "if_expression" || n.type === "if_statement") return true;
      if (n.type.includes("while") || n.type.includes("for") || n.type === "loop_expression" || n.type === "for_statement") return true;
      if (n.type === "expression_statement") {
        const child = n.namedChildren[0];
        if (child && (child.type.includes("if") || child.type.includes("loop") || child.type.includes("while") || child.type.includes("for") || child.type === "block" || child.type === "compound_statement")) return true;
      }
      return false;
    }

    function isNodeStatement(n: SyntaxNode): boolean {
      if (!n.isNamed) return false;
      if (n.type === "expression_statement") {
        const child = n.namedChildren[0];
        if (child && (child.type.includes("if") || child.type.includes("loop") || child.type.includes("while") || child.type.includes("for"))) return false;
        return true;
      }
      if (n.type === "declaration" || n.type === "local_variable_declaration" || n.type === "var_declaration" || n.type === "const_declaration") return true;
      if (n.type.endsWith("statement") || n.type.endsWith("declaration") || n.type === "call" || n.type === "call_expression" || n.type === "macro_invocation" || n.type === "assignment_expression" || n.type === "augmented_assignment" || n.type === "inc_dec_expression" || n.type === "short_var_declaration") return true;
      if (n.type.endsWith("expression")) {
        if (n.type === "if_expression" || n.type === "loop_expression") return false;
        return true;
      }
      return false;
    }

    function walk(node: SyntaxNode, entryIds: string[]): string[] {
      if (["program", "module", "translation_unit", "source_file", "statement_block", "compound_statement", "block", "statement_list", "else_clause", "class_declaration", "class_body"].includes(node.type)) {
        let currentEntryIds = entryIds;
        if (groupSequentialStatements) {
          let buffer: string[] = [];
          for (const child of node.namedChildren) {
            const isComplex = isNodeComplex(child);
            const isStmt = isNodeStatement(child);
            if (!isComplex && isStmt) {
              buffer.push(cleanText(child.text, true));
            } else {
              if (buffer.length > 0) {
                const processId = getNewId("process");
                addNode(processId, buffer.join("\n"), "process");
                connectNodes(currentEntryIds, processId);
                currentEntryIds = [processId];
                buffer = [];
              }
              currentEntryIds = walk(child, currentEntryIds);
            }
          }
          if (buffer.length > 0) {
            const processId = getNewId("process");
            addNode(processId, buffer.join("\n"), "process");
            connectNodes(currentEntryIds, processId);
            currentEntryIds = [processId];
          }
          return currentEntryIds;
        } else {
          for (const child of node.namedChildren) {
            currentEntryIds = walk(child, currentEntryIds);
          }
          return currentEntryIds;
        }
      }

      if (["function_definition", "function_declaration", "method_declaration", "function_item"].includes(node.type)) {
        const body = node.childForFieldName("body");
        if (body) return walk(body, entryIds);
        const blockChild = node.namedChildren.find((c: SyntaxNode) => c.type.includes("block") || c.type.includes("statement") || c.type === "compound_statement");
        if (blockChild) return walk(blockChild, entryIds);
        return entryIds;
      }

      if (node.type === "expression_statement") {
        const child = node.namedChildren[0];
        if (child && (child.type.includes("if") || child.type.includes("loop") || child.type.includes("while") || child.type.includes("for") || child.type === "block" || child.type === "compound_statement")) return walk(child, entryIds);
      }

      if (["if_statement", "elif_clause", "if_expression"].includes(node.type)) {
        let currentEntryIds = entryIds;
        const init = node.childForFieldName("init");
        if (init) {
          const initId = getNewId("process");
          addNode(initId, cleanText(init.text), "process");
          connectNodes(currentEntryIds, initId);
          currentEntryIds = [initId];
        }
        const condition = node.childForFieldName("condition");
        let consequence = node.childForFieldName("consequence");
        if (!consequence) consequence = node.namedChildren.find((c: SyntaxNode) => c.type.includes("block") || c.type.includes("statement") || c.type === "compound_statement");
        let alternative = node.childForFieldName("alternative");
        const decisionId = getNewId("decision");
        addNode(decisionId, cleanText(condition?.text ?? "?"), "decision");
        connectNodes(currentEntryIds, decisionId);
        let exitPaths: string[] = [];
        if (consequence) exitPaths.push(...walk(consequence, [decisionId]));
        else exitPaths.push(decisionId);
        if (alternative) exitPaths.push(...walk(alternative, [decisionId]));
        else exitPaths.push(decisionId);
        return Array.from(new Set(exitPaths));
      }

      const isLoop = node.type.includes("while") || node.type.includes("for") || node.type === "loop_expression" || node.type === "for_statement" || node.type === "for_clause";
      if (isLoop) {
        let currentEntryIds = entryIds;
        const forClause = node.namedChildren.find((c: SyntaxNode) => c.type === "for_clause" || c.type === "for_range_clause");
        let initializer = node.childForFieldName("initializer") || node.childForFieldName("init");
        if (forClause && !initializer) initializer = forClause.childForFieldName("initializer") || forClause.childForFieldName("init");
        if (initializer) {
          const initId = getNewId("process");
          addNode(initId, cleanText(initializer.text), "process");
          connectNodes(currentEntryIds, initId);
          currentEntryIds = [initId];
        }
        let condText = "Loop";
        let condition = node.childForFieldName("condition");
        if (forClause && !condition) condition = forClause.childForFieldName("condition");
        const right = node.childForFieldName("right");
        if (condition) condText = cleanText(condition.text);
        else if (right) condText = "in " + cleanText(right.text);
        else if (node.type === "loop_expression") condText = "true";
        else if (node.type === "for_statement" && !condition) {
          if (node.namedChildren.some((c: SyntaxNode) => c.type === "for_range_clause")) condText = "Range Loop";
          else condText = "true";
        }
        const decisionId = getNewId("decision");
        addNode(decisionId, condText, "decision");
        connectNodes(currentEntryIds, decisionId);
        let body = node.childForFieldName("body") || node.childForFieldName("consequence");
        if (!body) body = node.namedChildren.find((c: SyntaxNode) => c.type.includes("block") || c.type.includes("statement") || c.type === "compound_statement");
        let bodyExitIds: string[] = [];
        if (body) bodyExitIds = walk(body, [decisionId]);
        else bodyExitIds = [decisionId];
        let update = node.childForFieldName("update") || node.childForFieldName("post");
        if (forClause && !update) update = forClause.childForFieldName("update") || forClause.childForFieldName("post");
        if (update) {
          const updateId = getNewId("process");
          addNode(updateId, cleanText(update.text), "process");
          connectNodes(bodyExitIds, updateId);
          connectNodes([updateId], decisionId);
        } else {
          connectNodes(bodyExitIds, decisionId);
        }
        return [decisionId];
      }

      if (!node.isNamed) return entryIds;
      const isStatement = isNodeStatement(node) && !isNodeComplex(node);
      if (isStatement) {
        const processId = getNewId("process");
        addNode(processId, cleanText(node.text), "process");
        connectNodes(entryIds, processId);
        return [processId];
      }

      let currentEntryIds = entryIds;
      for (const child of node.namedChildren) {
        currentEntryIds = walk(child, currentEntryIds);
      }
      return currentEntryIds;
    }

    const startId = getNewId("start");
    addNode(startId, "Start", "start");
    const exitIds = walk(rootNode, [startId]);
    const endId = getNewId("end");
    addNode(endId, "End", "end");
    connectNodes(exitIds, endId);
    return nodes;
  }

  function handleLanguageChange() {
    sourceCode = exampleCodes[selectedLanguageId];
    parseCode();
  }

  $: if (!isLoading && sourceCode) {
    parseCode();
  }

  $: if (groupSequentialStatements !== undefined) {
    parseCode();
  }
</script>

<div class="flex flex-col h-screen bg-neutral-50 dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 overflow-hidden">
  <!-- Header -->
  <header class="flex items-center justify-between px-6 py-3 bg-white dark:bg-neutral-800 border-b border-neutral-200 dark:border-neutral-700 shadow-sm z-10">
    <div class="flex items-center gap-3">
      <div class="bg-orange-500 p-2 rounded-lg">
        <Code2 class="text-white w-6 h-6" />
      </div>
      <div>
        <h1 class="text-xl font-bold tracking-tight">Code2Flowchart</h1>
        <p class="text-xs text-neutral-500 dark:text-neutral-400 font-medium">Visualiza tu código instantáneamente</p>
      </div>
    </div>

    <div class="flex items-center gap-4">
      <div class="flex items-center bg-neutral-100 dark:bg-neutral-700 p-1 rounded-md">
        <button
          class="px-3 py-1.5 text-sm font-medium rounded transition-all bg-white dark:bg-neutral-600 shadow-sm"
        >
          Editor
        </button>
      </div>
      <button class="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-lg font-medium transition-colors shadow-sm">
        <Share2 class="w-4 h-4" />
        <span>Exportar</span>
      </button>
    </div>
  </header>

  <main class="flex-1 flex overflow-hidden">
    {#if isLoading}
      <div class="flex-1 flex flex-col items-center justify-center gap-4">
        <div class="relative">
          <Loader2 class="w-12 h-12 text-orange-500 animate-spin" />
        </div>
        <div class="text-center">
          <p class="text-lg font-semibold">{loadingMessage}</p>
          <p class="text-sm text-neutral-500">Preparando el entorno de visualización...</p>
        </div>
      </div>
    {:else if errorMessage}
      <div class="flex-1 flex flex-col items-center justify-center gap-4 p-8">
        <div class="bg-red-100 dark:bg-red-900/30 p-4 rounded-full">
          <AlertCircle class="w-12 h-12 text-red-600 dark:text-red-400" />
        </div>
        <div class="text-center max-w-md">
          <p class="text-xl font-bold text-red-600 dark:text-red-400">¡Ups! Algo salió mal</p>
          <p class="mt-2 text-neutral-600 dark:text-neutral-400">{errorMessage}</p>
          <button
            on:click={() => window.location.reload()}
            class="mt-6 px-6 py-2 bg-neutral-800 dark:bg-neutral-100 text-white dark:text-neutral-900 rounded-lg font-medium"
          >
            Reintentar
          </button>
        </div>
      </div>
    {:else}
      <!-- Sidebar / Left Panel -->
      <div class="w-[450px] border-r border-neutral-200 dark:border-neutral-700 flex flex-col bg-white dark:bg-neutral-800/50">
        <!-- Controls Area -->
        <div class="p-4 border-b border-neutral-200 dark:border-neutral-700 flex flex-col gap-4">
          <div class="grid grid-cols-2 gap-4">
            <div class="flex flex-col gap-1.5">
              <label for="lang-select" class="text-xs font-bold text-neutral-500 uppercase tracking-wider">Lenguaje</label>
              <div class="relative">
                <select
                  id="lang-select"
                  bind:value={selectedLanguageId}
                  on:change={handleLanguageChange}
                  class="w-full bg-neutral-100 dark:bg-neutral-700 border-none rounded-lg px-4 py-2.5 text-sm font-medium focus:ring-2 focus:ring-orange-500 appearance-none cursor-pointer"
                >
                  {#each LANGUAGES as lang}
                    <option value={lang.id}>{lang.name}</option>
                  {/each}
                </select>
                <div class="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                  <ChevronRight class="w-4 h-4 text-neutral-400 rotate-90" />
                </div>
              </div>
            </div>

            <div class="flex flex-col gap-1.5">
              <label for="theme-select" class="text-xs font-bold text-neutral-500 uppercase tracking-wider">Estilo</label>
              <div class="relative">
                <select
                  id="theme-select"
                  bind:value={selectedThemeId}
                  class="w-full bg-neutral-100 dark:bg-neutral-700 border-none rounded-lg px-4 py-2.5 text-sm font-medium focus:ring-2 focus:ring-orange-500 appearance-none cursor-pointer"
                >
                  {#each THEMES as theme}
                    <option value={theme.id}>{theme.name}</option>
                  {/each}
                </select>
                <div class="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                  <Palette class="w-4 h-4 text-neutral-400" />
                </div>
              </div>
            </div>
          </div>

          <div class="flex flex-col gap-3">
            <label class="flex items-center gap-3 cursor-pointer group">
              <div class="relative inline-flex items-center">
                <input
                  type="checkbox"
                  bind:checked={groupSequentialStatements}
                  class="sr-only peer"
                />
                <div class="w-10 h-5 bg-neutral-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-orange-300 dark:peer-focus:ring-orange-800 rounded-full peer dark:bg-neutral-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-gray-600 peer-checked:bg-orange-500"></div>
              </div>
              <span class="text-sm font-medium text-neutral-700 dark:text-neutral-300 group-hover:text-orange-500 transition-colors">
                Agrupar instrucciones secuenciales
              </span>
            </label>
          </div>
        </div>

        <!-- Editor Title -->
        <div class="px-4 py-2 bg-neutral-50 dark:bg-neutral-800/80 border-b border-neutral-200 dark:border-neutral-700 flex justify-between items-center">
          <div class="flex items-center gap-2">
            <Type class="w-4 h-4 text-neutral-400" />
            <span class="text-xs font-bold text-neutral-500 uppercase">Editor de Código</span>
          </div>
        </div>

        <!-- Code Editor -->
        <div class="flex-1 overflow-hidden">
          <CodeEditor bind:code={sourceCode} languageId={selectedLanguageId} />
        </div>
      </div>

      <!-- Right Panel: Flowchart -->
      <div class="flex-1 flex flex-col bg-neutral-100 dark:bg-neutral-900 overflow-hidden relative">
        <!-- Canvas Toolbar -->
        <div class="absolute top-4 right-4 z-10 flex flex-col gap-2">
          <button
            on:click={() => showDebug = !showDebug}
            class="p-2 bg-white dark:bg-neutral-800 rounded-full shadow-lg border border-neutral-200 dark:border-neutral-700 hover:text-orange-500 transition-colors"
            title="Toggle Debug"
          >
            <Bug class="w-5 h-5 {showDebug ? 'text-orange-500' : ''}" />
          </button>
        </div>

        <!-- Flowchart Title -->
        <div class="px-6 py-4 flex items-center justify-between">
          <div class="flex items-center gap-3">
            <LayoutGrid class="w-5 h-5 text-orange-500" />
            <h2 class="font-bold text-lg">Diagrama de Flujo</h2>
          </div>
          <div class="flex items-center gap-2 bg-white dark:bg-neutral-800 px-3 py-1.5 rounded-full border border-neutral-200 dark:border-neutral-700 shadow-sm text-xs font-medium">
            <span class="w-2 h-2 rounded-full bg-green-500"></span>
            {flowchartNodes.length} Nodos
          </div>
        </div>

        <!-- Flowchart Viewer -->
        <div class="flex-1 p-6 overflow-hidden">
          <div class="w-full h-full bg-white dark:bg-neutral-800 rounded-2xl shadow-sm border border-neutral-200 dark:border-neutral-700 overflow-hidden">
            <FlowchartViewer {flowchartNodes} themeId={selectedThemeId} />
          </div>
        </div>

        <!-- Debug Info -->
        {#if showDebug && debugInfo.length > 0}
          <div class="absolute bottom-6 right-6 left-6 max-h-[250px] bg-neutral-900/95 text-neutral-300 p-4 rounded-xl border border-neutral-700 shadow-2xl backdrop-blur-sm overflow-hidden flex flex-col animate-in slide-in-from-bottom-4 duration-300">
            <div class="flex items-center justify-between mb-2">
              <span class="text-xs font-bold uppercase tracking-widest text-neutral-500">Log de Análisis AST</span>
              <button on:click={() => showDebug = false} class="text-neutral-500 hover:text-white">&times;</button>
            </div>
            <div class="flex-1 overflow-y-auto font-monospace text-[11px] space-y-1">
              {#each debugInfo as info}
                <div class="border-l border-neutral-700 pl-2 py-0.5">{info}</div>
              {/each}
            </div>
          </div>
        {/if}
      </div>
    {/if}
  </main>
</div>

<style>
  :global(.monaco-editor) {
    padding-top: 8px;
  }
  
  /* Estilos personalizados para el scrollbar */
  ::-webkit-scrollbar {
    width: 6px;
    height: 6px;
  }
  ::-webkit-scrollbar-track {
    background: transparent;
  }
  ::-webkit-scrollbar-thumb {
    background: #d1d5db;
    border-radius: 10px;
  }
  .dark ::-webkit-scrollbar-thumb {
    background: #4b5563;
  }
  ::-webkit-scrollbar-thumb:hover {
    background: #9ca3af;
  }
</style>
