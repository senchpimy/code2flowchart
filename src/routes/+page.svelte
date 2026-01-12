<script lang="ts">
  import "../app.css"; // Asumiendo que tienes estilos globales aquí, si no, elimina esta línea.
  import { onMount } from "svelte";
  import { Parser, Language, type SyntaxNode } from "web-tree-sitter";
  import * as d3 from "d3";
  import { toPng, toJpeg, toSvg } from 'html-to-image';
  import { jsPDF } from "jspdf";
  import CodeEditor from "$lib/CodeEditor.svelte";

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
  let groupSequentialStatements = false;

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

  async function parseCode() {
    if (isLoading || !parser) return;

    const currentLanguage = loadedLanguages.get(selectedLanguageId);
    if (!currentLanguage) return;

    try {
      parser.setLanguage(currentLanguage);
      const tree = parser.parse(sourceCode);
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
        return text.split('\n').map(line => {
          let clean = line.replace(/\s+/g, " ").trim();
          if (clean.length > 30) return clean.substring(0, 27) + "...";
          return clean;
        }).join('\n');
      }
      let clean = text.replace(/\s+/g, " ").trim();
      if (clean.length > 25) return clean.substring(0, 22) + "...";
      return clean;
    }

    function isNodeComplex(n: SyntaxNode): boolean {
       if (
        [
          "program", "module", "translation_unit", "source_file",
          "statement_block", "compound_statement", "block", "statement_list",
          "else_clause", "class_declaration", "class_body",
          "function_definition", "function_declaration", "method_declaration", "function_item"
        ].includes(n.type)
       ) return true;

       if (n.type.includes("if_") || n.type.includes("elif_") || n.type === "if_expression" || n.type === "if_statement") return true;
       if (n.type.includes("while") || n.type.includes("for") || n.type === "loop_expression" || n.type === "for_statement") return true;

       if (n.type === "expression_statement") {
          const child = n.namedChildren[0];
          if (child && (
             child.type.includes("if") || child.type.includes("loop") || 
             child.type.includes("while") || child.type.includes("for") || 
             child.type === "block" || child.type === "compound_statement"
          )) return true;
       }

       return false;
    }

    function isNodeStatement(n: SyntaxNode): boolean {
       if (!n.isNamed) return false;
       return (
        n.type.endsWith("statement") ||
        n.type.endsWith("declaration") ||
        n.type.endsWith("expression") ||
        n.type === "call" ||
        n.type === "call_expression" ||
        n.type === "macro_invocation" ||
        n.type === "assignment_expression" ||
        n.type === "augmented_assignment" ||
        n.type === "inc_dec_expression" ||
        n.type === "return_statement" ||
        n.type === "short_var_declaration" ||
        n.type === "expression_statement"
       );
    }

    function walk(node: SyntaxNode, entryIds: string[]): string[] {
      // 0. Top-level & Blocks
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

      // 1. Functions (Explicit handling to only walk body)
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
        const blockChild = node.namedChildren.find(c => c.type.includes("block") || c.type.includes("statement") || c.type === "compound_statement");
        if (blockChild) return walk(blockChild, entryIds);
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
            child.type === "block" ||
            child.type === "compound_statement"
          ) {
            return walk(child, entryIds);
          }
        }
      }

      // 3. Decisions (If)
      if (
        ["if_statement", "elif_clause", "if_expression"].includes(node.type)
      ) {
        let currentEntryIds = entryIds;
        
        // Go specific: Handle init field in if
        const init = node.childForFieldName("init");
        if (init) {
          const initId = getNewId("process");
          addNode(initId, cleanText(init.text), "process");
          connectNodes(currentEntryIds, initId);
          currentEntryIds = [initId];
        }

        const condition = node.childForFieldName("condition");
        let consequence = node.childForFieldName("consequence");
        if (!consequence) consequence = node.namedChildren.find(c => c.type.includes("block") || c.type.includes("statement") || c.type === "compound_statement");
        
        let alternative = node.childForFieldName("alternative");

        const decisionId = getNewId("decision");
        addNode(decisionId, cleanText(condition?.text ?? "?"), "decision");
        connectNodes(currentEntryIds, decisionId);

        let exitPaths: string[] = [];
        if (consequence) exitPaths.push(...walk(consequence, [decisionId]));
        else exitPaths.push(decisionId);

        if (alternative) {
          exitPaths.push(...walk(alternative, [decisionId]));
        } else {
          exitPaths.push(decisionId);
        }
        return Array.from(new Set(exitPaths));
      }

      // 4. Loops (While/For)
      const isLoop =
        node.type.includes("while") ||
        node.type.includes("for") ||
        node.type === "loop_expression" ||
        node.type === "for_statement" ||
        node.type === "for_clause";
        
      if (isLoop) {
        let currentEntryIds = entryIds;

        const forClause = node.namedChildren.find(
          (c) => c.type === "for_clause" || c.type === "for_range_clause"
        );

        let initializer = node.childForFieldName("initializer") || node.childForFieldName("init");
        if (forClause && !initializer)
          initializer = forClause.childForFieldName("initializer") || forClause.childForFieldName("init");

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
        else if (node.type === "loop_expression") condText = "true";
        else if (node.type === "for_statement" && !condition) {
           if (node.namedChildren.some(c => c.type === "for_range_clause")) {
               condText = "Range Loop"; 
           } else {
               condText = "true";
           }
        }

        const decisionId = getNewId("decision");
        addNode(decisionId, condText, "decision");
        connectNodes(currentEntryIds, decisionId);

        let body =
          node.childForFieldName("body") ||
          node.childForFieldName("consequence");
        
        if (!body) body = node.namedChildren.find(c => c.type.includes("block") || c.type.includes("statement") || c.type === "compound_statement");

        let bodyExitIds: string[] = [];
        if (body) bodyExitIds = walk(body, [decisionId]);
        else bodyExitIds = [decisionId];

        let update = node.childForFieldName("update") || node.childForFieldName("post");
        if (forClause && !update)
          update = forClause.childForFieldName("update") || forClause.childForFieldName("post");

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
        node.type === "call_expression" ||
        node.type === "macro_invocation" ||
        node.type === "assignment_expression" ||
        node.type === "augmented_assignment" ||
        node.type === "inc_dec_expression" ||
        node.type === "return_statement" ||
        node.type === "short_var_declaration";

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
    // Calculate node height based on text lines
    function getNodeHeight(text: string) {
       const lines = text.split('\n').length;
       return Math.max(50, lines * 18 + 20);
    }

    // Since we used fixed node_height before for layout, we might need a fixed grid or dynamic y.
    // For simplicity, let's keep a "slot height" but draw nodes larger if needed.
    // Or we just increase default slot size.
    // Let's make vertical_spacing depend on max node height in layer?
    // For now, let's use a dynamic height per node for drawing, but layout assumes a bit more space.
    
    // Actually, simple grid layout might overlap if nodes are too tall.
    // Let's just increase default height slightly and handle text rendering.
    const vertical_spacing = 100; // Increased from 90
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

    function getLinkPath(d: any) {
      const srcH = getNodeHeight(d.source.text);
      const tgtH = getNodeHeight(d.target.text);

      const sx = d.source.x + node_width / 2;
      const sy = d.source.y + srcH; // Source bottom
      const tx = d.target.x + node_width / 2;
      const ty = d.target.y; // Target top

      const isBackEdge = ty < sy;

      if (isBackEdge) {
        // Calculate a local max X considering only nodes within the vertical span of the loop
        const nodesInSpan = nodes.filter(n => {
           const ny = n.y ?? 0;
           return ny >= d.target.y && ny <= d.source.y;
        });

        const localMaxX = nodesInSpan.length > 0 
           ? Math.max(...nodesInSpan.map(n => (n.x ?? 0) + node_width)) 
           : globalMaxX;

        const loopX = localMaxX + 40;
        const turnY = sy + 20;

        return `M ${sx} ${sy} 
                L ${sx} ${turnY}
                L ${loopX} ${turnY} 
                L ${loopX} ${d.target.y + tgtH / 2} 
                L ${d.target.x + node_width} ${d.target.y + tgtH / 2}`;
      } else {
        return `M ${sx} ${sy} C ${sx} ${sy + 40}, ${tx} ${ty - 40}, ${tx} ${ty}`;
      }
    }

    const linkPaths = svgElement
      .append("g")
      .selectAll("path")
      .data(links)
      .join("path")
      .attr("d", getLinkPath)
      .attr("fill", "none")
      .attr("stroke", "#555")
      .attr("stroke-width", 2)
      .attr("marker-end", "url(#arrowhead)");

    // Drag Behavior
    const drag = d3
      .drag()
      .on("start", function (event, d: any) {
        d3.select(this).raise().style("cursor", "grabbing");
      })
      .on("drag", function (event, d: any) {
        d.x = event.x;
        d.y = event.y;
        d3.select(this).attr("transform", `translate(${d.x},${d.y})`);
        linkPaths.attr("d", getLinkPath);
      })
      .on("end", function (event, d: any) {
        d3.select(this).style("cursor", "grab");
      });

    // 6. Dibujar Nodos
    const nodeGroup = svgElement
      .append("g")
      .selectAll("g")
      .data(nodes)
      .join("g")
      .attr("transform", (d) => `translate(${d.x}, ${d.y})`)
      .style("cursor", "grab")
      .call(drag as any);

    nodeGroup.each(function (d: FlowNode) {
      const g = d3.select(this);
      const w = node_width;
      const h = getNodeHeight(d.text);

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

      const textEl = g.append("text")
        .attr("x", w / 2)
        .attr("y", 0) // Will position tspans
        .attr("text-anchor", "middle")
        .style("font-size", "12px")
        .style("font-family", "sans-serif")
        .style("pointer-events", "none");
        
      const lines = d.text.split('\n');
      const lineHeight = 14;
      const startY = (h - (lines.length * lineHeight)) / 2 + 10;
      
      lines.forEach((line, i) => {
          textEl.append("tspan")
             .attr("x", w / 2)
             .attr("y", startY + i * lineHeight)
             .text(line);
      });
    });
  }

  function handleLanguageChange() {
    sourceCode = exampleCodes[selectedLanguageId];
    parseCode();
  }

  async function exportFlowchart(format: 'png' | 'jpg' | 'svg' | 'pdf') {
    if (!svg) return;

    try {
      const filter = (node: HTMLElement) => {
        return node.tagName !== 'i'; // Ejemplo de filtro si fuera necesario
      };

      const options = { backgroundColor: '#ffffff', filter };

      if (format === 'png') {
        const dataUrl = await toPng(svg, options);
        download(dataUrl, 'flowchart.png');
      } else if (format === 'jpg') {
        const dataUrl = await toJpeg(svg, { ...options, quality: 0.95 });
        download(dataUrl, 'flowchart.jpg');
      } else if (format === 'svg') {
        const dataUrl = await toSvg(svg, options);
        download(dataUrl, 'flowchart.svg');
      } else if (format === 'pdf') {
        const dataUrl = await toPng(svg, options);
        const pdf = new jsPDF({
          orientation: svg.clientWidth > svg.clientHeight ? 'l' : 'p',
          unit: 'px',
          format: [svg.clientWidth, svg.clientHeight]
        });
        pdf.addImage(dataUrl, 'PNG', 0, 0, svg.clientWidth, svg.clientHeight);
        pdf.save('flowchart.pdf');
      }
    } catch (error) {
      console.error('Error exporting flowchart:', error);
    }
  }

  function download(dataUrl: string, filename: string) {
    const link = document.createElement('a');
    link.download = filename;
    link.href = dataUrl;
    link.click();
  }

  $: if (!isLoading && sourceCode) {
    parseCode();
  }
  
  // Watch for toggle changes
  $: if (groupSequentialStatements !== undefined) {
    parseCode();
  }

  $: if (svg && flowchartNodes) {
    updateFlowchart();
  }
</script>

<main style="padding: 1rem; height: 100vh; display: flex; flex-direction: column; box-sizing: border-box; margin: 0; max-width: none;">
  <h1 style="margin-top: 0; margin-bottom: 1rem;">Code2Flowchart</h1>

  {#if isLoading}
    <p>{loadingMessage}</p>
  {:else if errorMessage}
    <p style="color:red">{errorMessage}</p>
  {:else}
    <div style="display: flex; gap: 1rem; flex: 1; overflow: hidden;">
      <!-- Left Column: Code Editor -->
      <div style="flex: 1; display: flex; flex-direction: column; gap: 0.5rem; min-width: 300px;">
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
                    <label style="margin-left: 1rem;">
                      <input
                        type="checkbox"
                        bind:checked={groupSequentialStatements}
                        on:change={() => parseCode()}
                      />
                      Agrupar instrucciones secuenciales
                    </label>            </div>        
        <div style="flex: 1; border: 1px solid #ddd; overflow: hidden;">
           <CodeEditor bind:code={sourceCode} languageId={selectedLanguageId} />
        </div>
      </div>

      <!-- Right Column: Flowchart & Controls -->
      <div style="flex: 2; display: flex; flex-direction: column; gap: 0.5rem; overflow: hidden;">
        <div style="display: flex; gap: 0.5rem;">
          <button on:click={() => exportFlowchart('png')}>Guardar PNG</button>
          <button on:click={() => exportFlowchart('jpg')}>Guardar JPG</button>
          <button on:click={() => exportFlowchart('svg')}>Guardar SVG</button>
          <button on:click={() => exportFlowchart('pdf')}>Guardar PDF</button>
        </div>

        <div
          style="flex: 1; border:1px solid #ccc; padding:1rem; overflow:auto; background:#f9f9f9;"
        >
          <svg bind:this={svg}></svg>
        </div>
      </div>
    </div>
  {/if}
</main>
