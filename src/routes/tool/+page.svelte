<script lang="ts">
  import { onMount } from "svelte";
  import { Parser, Language } from "web-tree-sitter";
  import CodeEditor from "$lib/CodeEditor.svelte";
  import FlowchartViewer from "$lib/FlowchartViewer.svelte";
  import type { FlowNode } from "$lib/types";
  import {
    Code2,
    ChevronRight,
    AlertCircle,
    Loader2,
    Type,
    Palette,
  } from "lucide-svelte";
  import {
    LANGUAGES,
    THEMES,
    exampleCodes,
    astToFlowNodes,
  } from "./logic";

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

  // Resizable Sidebar Logic
  let sidebarWidth = 450;
  let isDragging = false;

  function startDrag() {
    isDragging = true;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none"; // Prevent text selection while dragging
  }

  function stopDrag() {
    isDragging = false;
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
  }

  function onDrag(e: MouseEvent) {
    if (!isDragging) return;
    // Constraints: Min 300px, Max 800px (or window width - 300px)
    const minWidth = 300;
    const maxWidth = Math.min(window.innerWidth - 300, 800);
    sidebarWidth = Math.max(minWidth, Math.min(e.clientX, maxWidth));
  }

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
      errorMessage =
        "No se pudo cargar el parser. Verifique la carpeta public/wasm/.";
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
      flowchartNodes = astToFlowNodes(tree.rootNode, groupSequentialStatements);
    } catch (e) {
      console.error(e);
    }
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

<svelte:window on:mousemove={onDrag} on:mouseup={stopDrag} />

<div
  class="flex flex-col h-screen bg-neutral-50 dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 overflow-hidden"
>
  <!-- Header -->
  <header
    class="flex items-center justify-between px-6 py-3 bg-white dark:bg-neutral-800 border-b border-neutral-200 dark:border-neutral-700 shadow-sm z-10"
  >
    <a
      href="/"
      class="flex items-center gap-3 hover:opacity-80 transition-opacity"
    >
      <div class="bg-orange-500 p-2 rounded-lg">
        <Code2 class="text-white w-6 h-6" />
      </div>
      <div>
        <h1 class="text-xl font-bold tracking-tight">Code2Flowchart</h1>
        <p class="text-xs text-neutral-500 dark:text-neutral-400 font-medium">
          Editor Interactivo
        </p>
      </div>
    </a>
    <div class="flex items-center gap-4">
      <a
        href="/"
        class="text-sm font-medium text-neutral-500 hover:text-orange-500 transition-colors"
        >Volver al inicio</a
      >
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
          <p class="text-sm text-neutral-500">
            Preparando el entorno de visualización...
          </p>
        </div>
      </div>
    {:else if errorMessage}
      <div class="flex-1 flex flex-col items-center justify-center gap-4 p-8">
        <div class="bg-red-100 dark:bg-red-900/30 p-4 rounded-full">
          <AlertCircle class="w-12 h-12 text-red-600 dark:text-red-400" />
        </div>
        <div class="text-center max-w-md">
          <p class="text-xl font-bold text-red-600 dark:text-red-400">
            ¡Ups! Algo salió mal
          </p>
          <p class="mt-2 text-neutral-600 dark:text-neutral-400">
            {errorMessage}
          </p>
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
      <div
        class="border-r border-neutral-200 dark:border-neutral-700 flex flex-col bg-white dark:bg-neutral-800/50"
        style="width: {sidebarWidth}px; min-width: 300px;"
      >
        <!-- Controls Area -->
        <div
          class="p-4 border-b border-neutral-200 dark:border-neutral-700 flex flex-col gap-4"
        >
          <div class="grid grid-cols-2 gap-4">
            <div class="flex flex-col gap-1.5">
              <label
                for="lang-select"
                class="text-xs font-bold text-neutral-500 uppercase tracking-wider"
                >Lenguaje</label
              >
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
                <div
                  class="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none"
                >
                  <ChevronRight class="w-4 h-4 text-neutral-400 rotate-90" />
                </div>
              </div>
            </div>

            <div class="flex flex-col gap-1.5">
              <label
                for="theme-select"
                class="text-xs font-bold text-neutral-500 uppercase tracking-wider"
                >Estilo</label
              >
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
                <div
                  class="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none"
                >
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
                <div
                  class="w-10 h-5 bg-neutral-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-orange-300 dark:peer-focus:ring-orange-800 rounded-full peer dark:bg-neutral-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-gray-600 peer-checked:bg-orange-500"
                ></div>
              </div>
              <span
                class="text-sm font-medium text-neutral-700 dark:text-neutral-300 group-hover:text-orange-500 transition-colors"
              >
                Agrupar instrucciones secuenciales
              </span>
            </label>
          </div>
        </div>

        <!-- Code Editor -->
        <div class="flex-1 overflow-hidden">
          <CodeEditor bind:code={sourceCode} languageId={selectedLanguageId} />
        </div>
      </div>

      <!-- Resizer Slider -->
      <div
        role="separator"
        tabindex="0"
        aria-label="Resize Sidebar"
        class="w-1.5 bg-neutral-200 dark:bg-neutral-800 hover:bg-orange-500 dark:hover:bg-orange-500 cursor-col-resize flex items-center justify-center transition-colors group z-20"
        on:mousedown={startDrag}
      >
        <div
          class="h-8 w-1 bg-neutral-300 dark:bg-neutral-600 group-hover:bg-white rounded-full transition-colors"
        ></div>
      </div>

      <!-- Right Panel: Flowchart -->
      <div
        class="flex-1 flex flex-col bg-neutral-100 dark:bg-neutral-900 overflow-hidden relative"
      >
        <!-- Flowchart Viewer -->
        <div class="flex-1 p-6 overflow-hidden">
          <div
            class="w-full h-full bg-white dark:bg-neutral-800 rounded-2xl shadow-sm border border-neutral-200 dark:border-neutral-700 overflow-hidden"
          >
            <FlowchartViewer {flowchartNodes} themeId={selectedThemeId} />
          </div>
        </div>

        <!-- Debug Info -->
        {#if showDebug && debugInfo.length > 0}
          <div
            class="absolute bottom-6 right-6 left-6 max-h-[250px] bg-neutral-900/95 text-neutral-300 p-4 rounded-xl border border-neutral-700 shadow-2xl backdrop-blur-sm overflow-hidden flex flex-col animate-in slide-in-from-bottom-4 duration-300"
          >
            <div class="flex items-center justify-between mb-2">
              <span
                class="text-xs font-bold uppercase tracking-widest text-neutral-500"
                >Log de Análisis AST</span
              >
              <button
                on:click={() => (showDebug = false)}
                class="text-neutral-500 hover:text-white">&times;</button
              >
            </div>
            <div
              class="flex-1 overflow-y-auto font-monospace text-[11px] space-y-1"
            >
              {#each debugInfo as info}
                <div class="border-l border-neutral-700 pl-2 py-0.5">
                  {info}
                </div>
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