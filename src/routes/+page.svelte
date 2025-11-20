<script lang="ts">
  import "../app.css";
  import { onMount } from "svelte";
  import { Parser, Language, type SyntaxNode } from "web-tree-sitter";
  import * as d3 from "d3";

  interface FlowNode {
    id: string;
    text: string;
    x?: number;
    y?: number;
    type: "start" | "end" | "process" | "decision" | "input";
    targets: string[];
  }

  function createFlowNode(
    id: string,
    text: string,
    type: FlowNode["type"],
    targets: string[],
  ): FlowNode {
    return { id, text, type, targets };
  }

  const LANGUAGES = [
    {
      id: "javascript",
      name: "JavaScript",
      wasmFile: "tree-sitter-javascript.wasm",
    },
    { id: "python", name: "Python", wasmFile: "tree-sitter-python.wasm" },
    { id: "c", name: "C", wasmFile: "tree-sitter-c.wasm" },
    { id: "go", name: "Go", wasmFile: "tree-sitter-go.wasm" },
    { id: "rust", name: "Rust", wasmFile: "tree-sitter-rust.wasm" },
    { id: "java", name: "Java", wasmFile: "tree-sitter-java.wasm" },
    { id: "cpp", name: "C++", wasmFile: "tree-sitter-cpp.wasm" },
  ];

  const exampleCodes = {
    javascript: `let x = 10;
if (x > 5) {
  console.log("x is greater than 5");
} else {
  console.log("x is not greater than 5");
}
console.log("Done.");`,
    python: `x = 10
if x > 20:
    print("GT 20")
elif x > 5:
    print("GT 5 but not 20")
else:
    print("Not GT 5")
print("Done")`,
    c: `#include <stdio.h>

int main() {
    int x = 10;
    if (x > 5) {
        printf("x > 5");
    } else {
        printf("x <= 5");
    }
    return 0;
}`,
    go: `package main
import "fmt"

func main() {
    x := 10
    if x > 5 {
        fmt.Println("x is big")
    } else {
        fmt.Println("x is small")
    }
}`,
    rust: `fn main() {
    let x = 10;
    if x > 5 {
        println!("x is big");
    } else {
        println!("x is small");
    }
}`,
    java: `public class Main {
    public static void main(String[] args) {
        int x = 10;
        if (x > 5) {
            System.out.println("x is big");
        } else {
            System.out.println("x is small");
        }
    }
}`,
    cpp: `#include <iostream>

int main() {
    int x = 10;
    if (x > 5) {
        std::cout << "x is big" << std::endl;
    } else {
        std::cout << "x is small" << std::endl;
    }
    return 0;
}`,
  };

  let isLoading = true;
  let loadingMessage = "Cargando motor de Tree-sitter...";
  let errorMessage = "";

  let parser: Parser;
  let loadedLanguages = new Map<string, Language>();

  let selectedLanguageId = "javascript";
  let sourceCode = exampleCodes[selectedLanguageId];
  let astOutput = "";

  let flowchartNodes: FlowNode[] = [];
  let svg: SVGSVGElement;

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
      await parseCode();
    } catch (error) {
      console.error("Error al inicializar Tree-sitter:", error);
      errorMessage =
        "No se pudo cargar el parser. Asegúrate de que los archivos .wasm estén en la carpeta public/wasm/.";
      isLoading = false;
    }
  });

  async function parseCode() {
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

      flowchartNodes = astToFlowNodes(tree.rootNode);
    } catch (e) {
      astOutput = `Error al parsear el código: ${e}`;
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

    function cleanText(text: string): string {
      let clean = text.replace(/\s+/g, " ").trim();
      if (clean.length > 20) return clean.substring(0, 17) + "...";
      return clean;
    }

    function walk(node: SyntaxNode, entryIds: string[]): string[] {
      if (
        [
          "program", // JS
          "module", // Python
          "translation_unit", // C
          "source_file", //Rust
          "statement_block", // JS Block
          "compound_statement", // C/JS Block
          "block", // Python Block
          "statement_list", // go block
          "else_clause", // Python else wrapper
          "class_declaration", // Java
          "class_body",
        ].includes(node.type)
      ) {
        let currentEntryIds = entryIds;
        for (const child of node.namedChildren) {
          currentEntryIds = walk(child, currentEntryIds);
        }
        return currentEntryIds;
      }

      // 2. DEFINICIONES DE FUNCIÓN
      if (
        [
          "function_definition", // Python, C
          "function_declaration",
          "function_item",
          "method_declaration", // Java
        ].includes(node.type)
      ) {
        const body = node.childForFieldName("body");
        if (body) {
          return walk(body, entryIds);
        }
        return entryIds;
      }
      if (node.type === "expression_statement") {
        const child = node.namedChildren[0];
        if (child && child.type === "if_expression") {
          return walk(child, entryIds);
        }
      }
      // 3. DECISIONES (IF / ELIF)
      if (
        node.type === "if_statement" ||
        node.type === "elif_clause" ||
        node.type === "if_expression" // Rust
      ) {
        const condition = node.childForFieldName("condition");
        const consequence = node.childForFieldName("consequence");
        const alternative = node.childForFieldName("alternative");

        const decisionId = getNewId("decision");
        addNode(decisionId, cleanText(condition?.text ?? "?"), "decision");

        connectNodes(entryIds, decisionId);

        let exitPaths: string[] = [];

        if (consequence) {
          exitPaths.push(...walk(consequence, [decisionId]));
        }

        if (alternative) {
          exitPaths.push(...walk(alternative, [decisionId]));
        } else {
          exitPaths.push(decisionId);
        }

        return exitPaths;
      }

      // 4. DECLARACIONES SIMPLES (PROCESS)
      if (!node.isNamed) return entryIds;

      if (
        node.type.endsWith("statement") ||
        node.type.endsWith("declaration") || // Catch-all para declaraciones
        node.type.endsWith("expression") ||
        node.type === "call" ||
        node.type === "macro_invocation" || // Rust: println!
        node.type === "let_declaration" || // Rust variable
        node.type === "short_var_declaration" || // Go variable
        node.type === "local_variable_declaration"
      ) {
        const processId = getNewId("process");
        addNode(processId, cleanText(node.text), "process");
        connectNodes(entryIds, processId);
        return [processId];
      }

      return entryIds;
    }

    const startId = getNewId("start");
    addNode(startId, "Start", "start");

    const exitIds = walk(rootNode, [startId]);

    const endId = getNewId("end");
    addNode(endId, "End", "end");

    connectNodes(exitIds, endId);

    return nodes;
  }

  function updateFlowchart() {
    if (!svg || !flowchartNodes || flowchartNodes.length === 0) return;

    // Limpiar SVG previo
    const svgElement = d3.select(svg);
    svgElement.selectAll("*").remove();

    const nodes = JSON.parse(JSON.stringify(flowchartNodes));
    const nodeMap = new Map<string, FlowNode>(nodes.map((n) => [n.id, n]));

    const node_width = 140;
    const node_height = 50;
    const vertical_spacing = 80;
    const horizontal_spacing = 60;

    // --- Layout Simple (Layered BFS) ---
    const depths = new Map<string, number>();
    const queue: { id: string; depth: number }[] = [];

    const startNode = nodes.find((n) => n.type === "start");
    if (startNode) {
      depths.set(startNode.id, 0);
      queue.push({ id: startNode.id, depth: 0 });
    }

    let maxDepth = 0;

    while (queue.length > 0) {
      const { id, depth } = queue.shift()!;
      maxDepth = Math.max(maxDepth, depth);
      const currentNode = nodeMap.get(id);

      if (currentNode) {
        currentNode.targets.forEach((targetId) => {
          if (nodeMap.has(targetId)) {
            const currentTargetDepth = depths.get(targetId) ?? -1;
            if (depth + 1 > currentTargetDepth) {
              depths.set(targetId, depth + 1);
              queue.push({ id: targetId, depth: depth + 1 });
            }
          }
        });
      }
    }

    const layers = new Map<number, FlowNode[]>();
    nodes.forEach((n) => {
      const d = depths.get(n.id) ?? 0;
      n.y = d * vertical_spacing + 40;
      if (!layers.has(d)) layers.set(d, []);
      layers.get(d)?.push(n);
    });

    // Asignar X
    let currentSvgWidth = 0;
    layers.forEach((nodesInLayer) => {
      nodesInLayer.sort((a, b) => a.id.localeCompare(b.id)); // Estabilidad
      const totalW =
        nodesInLayer.length * node_width +
        (nodesInLayer.length - 1) * horizontal_spacing;
      currentSvgWidth = Math.max(currentSvgWidth, totalW);
      let startX = (1000 - totalW) / 2; // Centrado base 1000px

      nodesInLayer.forEach((n, i) => {
        n.x = startX + i * (node_width + horizontal_spacing);
      });
    });

    svgElement
      .attr("width", Math.max(1000, currentSvgWidth + 100))
      .attr("height", (maxDepth + 1) * vertical_spacing + 150);

    // Flechas (Defs)
    const defs = svgElement.append("defs");
    defs
      .append("marker")
      .attr("id", "arrowhead")
      .attr("viewBox", "0 -5 10 10")
      .attr("refX", 9) // Ajustado para chocar con el borde
      .attr("refY", 0)
      .attr("orient", "auto")
      .attr("markerWidth", 6)
      .attr("markerHeight", 6)
      .append("path")
      .attr("d", "M 0,-5 L 10,0 L 0,5 Z")
      .attr("fill", "#333");

    // Links
    const links = [];
    for (const node of nodes) {
      for (const target of node.targets) {
        links.push({ source: node, target: nodeMap.get(target) });
      }
    }

    svgElement
      .append("g")
      .selectAll("path")
      .data(links)
      .join("path")
      .attr("d", (d: any) => {
        // Curva Bezier simple
        const sx = d.source.x + node_width / 2;
        const sy = d.source.y + node_height;
        const tx = d.target.x + node_width / 2;
        const ty = d.target.y;
        return `M ${sx} ${sy} C ${sx} ${sy + 30}, ${tx} ${ty - 30}, ${tx} ${ty}`;
      })
      .attr("fill", "none")
      .attr("stroke", "#555")
      .attr("stroke-width", 2)
      .attr("marker-end", "url(#arrowhead)");

    // Nodos
    const nodeGroup = svgElement
      .append("g")
      .selectAll("g")
      .data(nodes)
      .join("g")
      .attr("transform", (d) => `translate(${d.x}, ${d.y})`);

    nodeGroup.each(function (d: FlowNode) {
      const g = d3.select(this);
      const w = node_width;
      const h = node_height;

      if (d.type === "start" || d.type === "end") {
        g.append("rect")
          .attr("rx", h / 2)
          .attr("ry", h / 2)
          .attr("width", w)
          .attr("height", h)
          .attr("fill", d.type === "start" ? "#d4edda" : "#f8d7da")
          .attr("stroke", d.type === "start" ? "#155724" : "#721c24")
          .attr("stroke-width", 2);
      } else if (d.type === "decision") {
        // Rombo
        g.append("path")
          .attr(
            "d",
            `M ${w / 2} 0 L ${w} ${h / 2} L ${w / 2} ${h} L 0 ${h / 2} Z`,
          )
          .attr("fill", "#fff3cd")
          .attr("stroke", "#856404")
          .attr("stroke-width", 2);
      } else {
        // Proceso
        g.append("rect")
          .attr("width", w)
          .attr("height", h)
          .attr("rx", 5)
          .attr("fill", "white")
          .attr("stroke", "#333")
          .attr("stroke-width", 2);
      }

      g.append("text")
        .attr("x", w / 2)
        .attr("y", h / 2 + 4)
        .attr("text-anchor", "middle")
        .style("font-size", "12px")
        .style("font-family", "sans-serif")
        .style("pointer-events", "none")
        .text(d.text);
    });
  }

  function handleLanguageChange() {
    sourceCode = exampleCodes[selectedLanguageId];
    parseCode();
  }

  $: if (!isLoading && sourceCode) {
    parseCode();
  }

  $: if (svg && flowchartNodes) {
    updateFlowchart();
  }
</script>

<main>
  <h1>Editor Interactivo Multi-Lenguaje (Fix)</h1>

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
        <h2>Código Fuente</h2>
        <textarea bind:value={sourceCode} rows="10"></textarea>
      </div>
      <div class="panel">
        <h2>Árbol de Sintaxis (AST)</h2>
        <pre class="ast-view"><code>{astOutput}</code></pre>
      </div>
    </div>

    <div class="flowchart-container">
      <h2>Flowchart</h2>
      <div class="svg-wrapper">
        <svg bind:this={svg}></svg>
      </div>
    </div>
  {/if}
</main>
