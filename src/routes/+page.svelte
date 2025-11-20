<script lang="ts">
  import "../app.css";
  import { onMount } from "svelte";
  import { Parser, Language } from "web-tree-sitter";

  const LANGUAGES = [
    {
      id: "javascript",
      name: "JavaScript",
      wasmFile: "tree-sitter-javascript.wasm",
    },
    { id: "python", name: "Python", wasmFile: "tree-sitter-python.wasm" },
    { id: "c", name: "C", wasmFile: "tree-sitter-c.wasm" },
  ];

  const exampleCodes = {
    javascript: `function hello(name) {\n  console.log('Hello, ' + name);\n}`,
    python: `def greet(name):\n    print(f"Hello, {name}")`,
    c: `#include <stdio.h>\n\nint main() {\n    printf("Hello, World!");\n    return 0;\n}`,
  };

  let isLoading = true;
  let loadingMessage = "Cargando motor de Tree-sitter...";
  let errorMessage = "";

  let parser: Parser;
  let loadedLanguages = new Map<string, Language>();

  let selectedLanguageId = "javascript";
  let sourceCode = exampleCodes[selectedLanguageId];
  let astOutput = "";

  onMount(async () => {
    try {
      await Parser.init({
        locateFile: (path) => `/wasm/${path}`,
      });
      parser = new Parser();

      await Promise.all(
        LANGUAGES.map(async (lang) => {
          loadingMessage = `Cargando gramática de ${lang.name}...`;
          const language = await Language.load(`/wasm/${lang.wasmFile}`);
          loadedLanguages.set(lang.id, language);
        }),
      );

      isLoading = false;
      parseCode(); // Primer parseo
    } catch (error) {
      console.error("Error al inicializar Tree-sitter:", error);
      errorMessage =
        "No se pudo cargar el parser. Revisa la consola para más detalles.";
      isLoading = false;
    }
  });

  function parseCode() {
    if (isLoading || !parser) return;

    const currentLanguage = loadedLanguages.get(selectedLanguageId);
    if (!currentLanguage) {
      astOutput = `La gramática para ${selectedLanguageId} no está cargada.`;
      return;
    }

    try {
      parser.setLanguage(currentLanguage);
      const tree = parser.parse(sourceCode);
      astOutput = tree.rootNode.toString();
    } catch (e) {
      astOutput = `Error al parsear el código: ${e}`;
    }
  }

  function handleLanguageChange() {
    sourceCode = exampleCodes[selectedLanguageId];
    parseCode();
  }

  $: if (!isLoading) {
    parseCode();
  }
</script>

<main>
  <h1>Editor Interactivo Multi-Lenguaje con Web Tree-sitter</h1>

  {#if isLoading}
    <p class="loading">{loadingMessage}</p>
  {:else if errorMessage}
    <p class="error">{errorMessage}</p>
  {:else}
    <div class="controls">
      <label for="language-select">Lenguaje:</label>
      <select
        id="language-select"
        bind:value={selectedLanguageId}
        on:change={handleLanguageChange}
      >
        {#each LANGUAGES as lang (lang.id)}
          <option value={lang.id}>{lang.name}</option>
        {/each}
      </select>
    </div>

    <div class="container">
      <div class="panel">
        <h2>
          Código Fuente ({LANGUAGES.find((l) => l.id === selectedLanguageId)
            ?.name})
        </h2>
        <textarea bind:value={sourceCode}></textarea>
      </div>
      <div class="panel">
        <h2>Árbol de Sintaxis (AST)</h2>
        <pre><code>{astOutput}</code></pre>
      </div>
    </div>
  {/if}
</main>
