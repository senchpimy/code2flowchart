<script lang="ts">
  import "../app.css"; // Asumiendo que tienes estilos globales aquí, si no, elimina esta línea.
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
    c: `#include <stdio.h>

int main() {
    int i;
    for (i = 0; i < 5; i++) {
        printf("%d", i);
    }
    return 0;
}`,
    javascript: `let count = 0;
while (count < 3) {
  console.log("Looping...");
  count++;
}
console.log("Done.");`,
    python: `x = 0
while x < 5:
    print(x)
    x += 1
print("Done")`,
    go: `package main
import "fmt"
func main() {
    sum := 0
    for i := 0; i < 5; i++ {
        sum += i
    }
}`,
    rust: `fn main() {
    let mut n = 0;
    while n < 5 {
        println!("{}", n);
        n += 1;
    }
}`,
    java: `public class Main {
    public static void main(String[] args) {
        for (int i = 0; i < 5; i++) {
            System.out.println(i);
        }
    }
}`,
    cpp: `#include <iostream>
int main() {
    int x = 0;
    while (x < 5) {
        std::cout << x;
        x++;
    }
    return 0;
}`,
  };

  let isLoading = true;
  let loadingMessage = "Cargando motor de Tree-sitter...";
  let errorMessage = "";

  let parser: Parser;
  let loadedLanguages = new Map<string, Language>();

  let selectedLanguageId = "c";
  let sourceCode = exampleCodes[selectedLanguageId];

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
        "No se pudo cargar el parser. Verifique la carpeta public/wasm/.";
      isLoading = false;
    }
  });
  var ast_Output = "";
  async function parseCode() {
    if (isLoading || !parser) return;

    const currentLanguage = loadedLanguages.get(selectedLanguageId);
    if (!currentLanguage) return;

    try {
      parser.setLanguage(currentLanguage);
      const tree = parser.parse(sourceCode);
      flowchartNodes = astToFlowNodes(tree.rootNode);
      ast_Output = tree?.rootNode.toString();
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

    function cleanText(text: string): string {
      let clean = text.replace(/\s+/g, " ").trim();
      if (clean.length > 20) return clean.substring(0, 18) + "...";
      return clean;
    }

    function walk(node: SyntaxNode, entryIds: string[]): string[] {
      // 1. Blocks
      if (
        [
          "program",
          "module",
          "translation_unit",
          "source_file",
          "statement_block",
          "compound_statement",
          "block",
          "statement_list",
          "else_clause",
          "class_declaration",
          "class_body",
        ].includes(node.type)
      ) {
        let currentEntryIds = entryIds;
        for (const child of node.namedChildren) {
          currentEntryIds = walk(child, currentEntryIds);
        }
        return currentEntryIds;
      }

      // 2. Functions
      if (
        [
          "function_definition",
          "function_declaration",
          "method_declaration",
          "function_item",
        ].includes(node.type)
      ) {
        const body = node.childForFieldName("body");
        if (body) return walk(body, entryIds);
        return entryIds;
      }

      if (node.type === "expression_statement") {
        const child = node.namedChildren[0];
        if (child) {
          if (
            child.type.includes("if") ||
            child.type.includes("loop") ||
            child.type.includes("while") ||
            child.type.includes("for") ||
            child.type === "block"
          ) {
            return walk(child, entryIds);
          }
        }
      }

      // 3. Decisions (If)
      if (
        ["if_statement", "elif_clause", "if_expression"].includes(node.type)
      ) {
        const condition = node.childForFieldName("condition");
        const consequence = node.childForFieldName("consequence");
        const alternative = node.childForFieldName("alternative");

        const decisionId = getNewId("decision");
        addNode(decisionId, cleanText(condition?.text ?? "?"), "decision");
        connectNodes(entryIds, decisionId);

        let exitPaths: string[] = [];
        if (consequence) exitPaths.push(...walk(consequence, [decisionId]));
        if (alternative) {
          exitPaths.push(...walk(alternative, [decisionId]));
        } else {
          exitPaths.push(decisionId);
        }
        return exitPaths;
      }

      // 4. Loops (While/For)
      const isLoop =
        node.type.includes("while") ||
        node.type.includes("for") ||
        node.type === "loop_expression";
      if (isLoop) {
        let currentEntryIds = entryIds;

        // FIX GO: Go agrupa init/cond/update dentro de un nodo hijo 'for_clause'
        const forClause = node.namedChildren.find(
          (c) => c.type === "for_clause",
        );

        let initializer = node.childForFieldName("initializer");
        if (forClause && !initializer)
          initializer = forClause.childForFieldName("initializer");

        if (initializer) {
          const initId = getNewId("process");
          addNode(initId, cleanText(initializer.text), "process");
          connectNodes(currentEntryIds, initId);
          currentEntryIds = [initId];
        }

        let condText = "Loop";
        let condition = node.childForFieldName("condition");
        if (forClause && !condition)
          condition = forClause.childForFieldName("condition");

        const right = node.childForFieldName("right");

        if (condition) condText = cleanText(condition.text);
        else if (right) condText = "in " + cleanText(right.text);
        else if (node.type === "loop_expression") condText = "true"; // Rust loop infinito

        const decisionId = getNewId("decision");
        addNode(decisionId, condText, "decision");
        connectNodes(currentEntryIds, decisionId);

        // C. Body
        const body =
          node.childForFieldName("body") ||
          node.childForFieldName("consequence");

        let bodyExitIds: string[] = [];
        if (body) bodyExitIds = walk(body, [decisionId]);
        else bodyExitIds = [decisionId];

        // D. Update
        let update = node.childForFieldName("update");
        if (forClause && !update)
          update = forClause.childForFieldName("update");

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

      // 5. Statements
      if (!node.isNamed) return entryIds;
      const isStatement =
        node.type.endsWith("statement") ||
        node.type.endsWith("declaration") ||
        node.type.endsWith("expression") ||
        node.type === "call" ||
        node.type === "macro_invocation" ||
        node.type === "assignment_expression" ||
        node.type === "augmented_assignment" ||
        node.type === "inc_dec_expression";

      if (isStatement) {
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

    const svgElement = d3.select(svg);
    svgElement.selectAll("*").remove();

    const nodes = JSON.parse(JSON.stringify(flowchartNodes)) as FlowNode[];
    const nodeMap = new Map<string, FlowNode>(nodes.map((n) => [n.id, n]));

    nodes.forEach((node) => {
      const connectsToDecision = node.targets.some(
        (t) => nodeMap.get(t)?.type === "decision",
      );
      if (connectsToDecision) {
        node.targets = node.targets.filter(
          (t) => nodeMap.get(t)?.type !== "end",
        );
      }
    });

    const node_width = 140;
    const node_height = 50;
    const vertical_spacing = 90;
    const horizontal_spacing = 60;

    // 1. Calcular Profundidad
    const depths = new Map<string, number>();
    const parentsMap = new Map<string, string[]>();

    nodes.forEach((n) => {
      n.targets.forEach((t) => {
        if (!parentsMap.has(t)) parentsMap.set(t, []);
        parentsMap.get(t)?.push(n.id);
      });
    });

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
          if (!depths.has(targetId)) {
            depths.set(targetId, depth + 1);
            queue.push({ id: targetId, depth: depth + 1 });
          }
        });
      }
    }

    // 2. Agrupar por capas
    const layers = new Map<number, FlowNode[]>();
    nodes.forEach((n) => {
      const d = depths.get(n.id) ?? 0;
      n.y = d * vertical_spacing + 50;
      if (!layers.has(d)) layers.set(d, []);
      layers.get(d)?.push(n);
    });

    // 3. Asignar X
    let currentSvgWidth = 0;

    for (let d = 0; d <= maxDepth; d++) {
      const nodesInLayer = layers.get(d) || [];

      if (d > 0) {
        nodesInLayer.forEach((node: any) => {
          const parents = parentsMap.get(node.id) || [];
          let avgParentX = 0;
          let parentCount = 0;

          parents.forEach((pid) => {
            const pNode = nodeMap.get(pid);
            if (pNode && (depths.get(pid) ?? -1) < d && pNode.x !== undefined) {
              avgParentX += pNode.x;
              parentCount++;
            }
          });
          node._sortX = parentCount > 0 ? avgParentX / parentCount : 9999;
        });
        nodesInLayer.sort((a: any, b: any) => a._sortX - b._sortX);
      }

      const totalW =
        nodesInLayer.length * node_width +
        (nodesInLayer.length - 1) * horizontal_spacing;
      currentSvgWidth = Math.max(currentSvgWidth, totalW);
      let startX = (1000 - totalW) / 2;

      nodesInLayer.forEach((n, i) => {
        n.x = startX + i * (node_width + horizontal_spacing);
      });
    }

    svgElement
      .attr("width", Math.max(1000, currentSvgWidth + 300))
      .attr("height", (maxDepth + 1) * vertical_spacing + 150);

    // 4. Defs
    const defs = svgElement.append("defs");
    defs
      .append("marker")
      .attr("id", "arrowhead")
      .attr("viewBox", "0 -5 10 10")
      .attr("refX", 9)
      .attr("refY", 0)
      .attr("orient", "auto")
      .attr("markerWidth", 6)
      .attr("markerHeight", 6)
      .append("path")
      .attr("d", "M 0,-5 L 10,0 L 0,5 Z")
      .attr("fill", "#333");

    // 5. Dibujar Conexiones
    const links = [];
    for (const node of nodes) {
      for (const target of node.targets) {
        links.push({ source: node, target: nodeMap.get(target) });
      }
    }

    const globalMaxX = Math.max(...nodes.map((n) => n.x! + node_width));

    svgElement
      .append("g")
      .selectAll("path")
      .data(links)
      .join("path")
      .attr("d", (d: any) => {
        const sx = d.source.x + node_width / 2;
        const sy = d.source.y + node_height;
        const tx = d.target.x + node_width / 2;
        const ty = d.target.y;

        const isBackEdge = ty < sy;

        if (isBackEdge) {
          // --- CORRECCIÓN VISUAL DE LOOP ---
          // En lugar de salir por la derecha (donde choca con End),
          // salimos por ABAJO, bajamos un poco más para esquivar la fila actual,
          // y luego rodeamos.
          const loopX = globalMaxX + 40;
          const turnY = sy + 20; // Bajamos 20px extra por debajo del nodo origen

          return `M ${sx} ${sy} 
                  L ${sx} ${turnY}
                  L ${loopX} ${turnY} 
                  L ${loopX} ${d.target.y + node_height / 2} 
                  L ${d.target.x + node_width} ${d.target.y + node_height / 2}`;
        } else {
          return `M ${sx} ${sy} C ${sx} ${sy + 40}, ${tx} ${ty - 40}, ${tx} ${ty}`;
        }
      })
      .attr("fill", "none")
      .attr("stroke", "#555")
      .attr("stroke-width", 2)
      .attr("marker-end", "url(#arrowhead)");

    // 6. Dibujar Nodos
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
        g.append("path")
          .attr(
            "d",
            `M ${w / 2} 0 L ${w} ${h / 2} L ${w / 2} ${h} L 0 ${h / 2} Z`,
          )
          .attr("fill", "#fff3cd")
          .attr("stroke", "#856404")
          .attr("stroke-width", 2);
      } else {
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
  <h1>Editor Flowchart (Layout Fix)</h1>

  {#if isLoading}
    <p>{loadingMessage}</p>
  {:else if errorMessage}
    <p style="color:red">{errorMessage}</p>
  {:else}
    <div>
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

    <div style="margin: 1rem 0;">
      <textarea
        bind:value={sourceCode}
        rows="8"
        style="width:100%; font-family:monospace; padding:10px;"
      ></textarea>
    </div>

    <div
      style="border:1px solid #ccc; padding:1rem; overflow:auto; background:#f9f9f9;"
    >
      <svg bind:this={svg}></svg>
    </div>

    <div style="margin: 1rem 0;">
      <textarea
        bind:value={ast_Output}
        rows="8"
        style="width:100%; font-family:monospace; padding:10px;"
      ></textarea>
    </div>
  {/if}
</main>
