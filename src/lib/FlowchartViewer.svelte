<script lang="ts">
  import { onMount } from "svelte";
  import * as d3 from "d3";
  import { toPng, toJpeg, toSvg } from "html-to-image";
  import { jsPDF } from "jspdf";
  import { Download, FileImage, FileType, FileCode, Palette } from "lucide-svelte";
  import type { FlowNode, FlowTheme } from "./types";

  export let flowchartNodes: FlowNode[] = [];
  export let themeId: string = "default";

  let svg: SVGSVGElement;
  let container: HTMLDivElement;
  let showExportMenu = false;

  const THEMES: Record<string, FlowTheme> = {
    default: {
      id: "default",
      name: "Clásico",
      start: { fill: "#f0fdf4", stroke: "#22c55e", text: "#166534" },
      end: { fill: "#fef2f2", stroke: "#ef4444", text: "#991b1b" },
      decision: { fill: "#fffbeb", stroke: "#f59e0b", text: "#92400e" },
      process: { fill: "#f8fafc", stroke: "#64748b", text: "#334155" },
      line: "#94a3b8"
    },
    ocean: {
      id: "ocean",
      name: "Océano",
      start: { fill: "#e0f2fe", stroke: "#0ea5e9", text: "#0369a1" },
      end: { fill: "#ffedd5", stroke: "#f97316", text: "#c2410c" },
      decision: { fill: "#fae8ff", stroke: "#d946ef", text: "#a21caf" },
      process: { fill: "#f0f9ff", stroke: "#3b82f6", text: "#1d4ed8" },
      line: "#7dd3fc"
    },
    modern: {
      id: "modern",
      name: "Moderno",
      start: { fill: "#10b981", stroke: "#059669", text: "#ffffff" },
      end: { fill: "#f43f5e", stroke: "#e11d48", text: "#ffffff" },
      decision: { fill: "#8b5cf6", stroke: "#7c3aed", text: "#ffffff" },
      process: { fill: "#3b82f6", stroke: "#2563eb", text: "#ffffff" },
      line: "#6366f1"
    },
    minimal: {
      id: "minimal",
      name: "Minimalista",
      start: { fill: "#ffffff", stroke: "#000000", text: "#000000" },
      end: { fill: "#ffffff", stroke: "#000000", text: "#000000" },
      decision: { fill: "#ffffff", stroke: "#000000", text: "#000000" },
      process: { fill: "#ffffff", stroke: "#000000", text: "#000000" },
      line: "#000000"
    }
  };

  function updateFlowchart() {
    if (!svg || !flowchartNodes || flowchartNodes.length === 0) return;

    const currentTheme = THEMES[themeId] || THEMES.default;
    const svgElement = d3.select(svg);
    svgElement.selectAll("*").remove();

    const nodes = JSON.parse(JSON.stringify(flowchartNodes)) as FlowNode[];
    const nodeMap = new Map<string, FlowNode>(nodes.map((n) => [n.id, n]));

    const node_width = 160;
    const vertical_spacing = 100;
    const horizontal_spacing = 80;

    function getNodeHeight(text: string) {
      const lines = text.split("\n").length;
      return Math.max(60, lines * 20 + 24);
    }

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

    const layers = new Map<number, FlowNode[]>();
    nodes.forEach((n) => {
      const d = depths.get(n.id) ?? 0;
      if (!layers.has(d)) layers.set(d, []);
      layers.get(d)?.push(n);
    });

    let currentSvgWidth = 0;
    for (let d = 0; d <= maxDepth; d++) {
      const nodesInLayer = layers.get(d) || [];
      const totalW = nodesInLayer.length * node_width + (nodesInLayer.length - 1) * horizontal_spacing;
      currentSvgWidth = Math.max(currentSvgWidth, totalW);
    }

    const containerWidth = container?.clientWidth || 1000;
    const finalWidth = Math.max(containerWidth, currentSvgWidth + 100);
    const finalHeight = (maxDepth + 1) * vertical_spacing + 150;

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

      const totalW = nodesInLayer.length * node_width + (nodesInLayer.length - 1) * horizontal_spacing;
      let startX = (finalWidth - totalW) / 2;
      nodesInLayer.forEach((n, i) => {
        n.x = startX + i * (node_width + horizontal_spacing);
        n.y = d * vertical_spacing + 60;
      });
    }

    svgElement
      .attr("width", "100%")
      .attr("height", finalHeight)
      .attr("viewBox", `0 0 ${finalWidth} ${finalHeight}`)
      .attr("preserveAspectRatio", "xMidYMin meet");

    const defs = svgElement.append("defs");
    
    defs.append("marker")
      .attr("id", "arrowhead")
      .attr("viewBox", "0 -5 10 10")
      .attr("refX", 9)
      .attr("refY", 0)
      .attr("orient", "auto")
      .attr("markerWidth", 8)
      .attr("markerHeight", 8)
      .append("path")
      .attr("d", "M 0,-5 L 10,0 L 0,5 Z")
      .attr("fill", currentTheme.line);

    const links: any[] = [];
    nodes.forEach(node => {
      node.targets.forEach(targetId => {
        const target = nodeMap.get(targetId);
        if (target) links.push({ source: node, target });
      });
    });

    const getLinkPath = (d: any) => {
      const srcH = getNodeHeight(d.source.text);
      const tgtH = getNodeHeight(d.target.text);
      const sx = d.source.x + node_width / 2;
      const sy = d.source.y + srcH;
      const tx = d.target.x + node_width / 2;
      const ty = d.target.y;
      
      if (ty < sy) {
        const loopOffset = 50;
        const turnY = sy + 25;
        const midX = Math.max(d.source.x, d.target.x) + node_width + loopOffset;
        return `M ${sx} ${sy} L ${sx} ${turnY} L ${midX} ${turnY} L ${midX} ${d.target.y + tgtH/2} L ${d.target.x + node_width} ${d.target.y + tgtH/2}`;
      }
      
      const midY = (sy + ty) / 2;
      return `M ${sx} ${sy} C ${sx} ${midY}, ${tx} ${midY}, ${tx} ${ty}`;
    };

    const linkPaths = svgElement.append("g")
      .selectAll("path")
      .data(links)
      .join("path")
      .attr("d", getLinkPath)
      .attr("fill", "none")
      .attr("stroke", currentTheme.line)
      .attr("stroke-width", 2)
      .attr("marker-end", "url(#arrowhead)")
      .attr("stroke-dasharray", d => d.target.y < d.source.y ? "5,5" : "none");

    const drag = d3.drag()
      .on("start", function(event, d: any) {
        d3.select(this).raise().classed("dragging", true);
      })
      .on("drag", function(event, d: any) {
        d.x = event.x;
        d.y = event.y;
        d3.select(this).attr("transform", `translate(${d.x}, ${d.y})`);
        linkPaths.attr("d", getLinkPath);
      })
      .on("end", function(event, d: any) {
        d3.select(this).classed("dragging", false);
      });

    const nodeGroup = svgElement.append("g")
      .selectAll("g")
      .data(nodes)
      .join("g")
      .attr("transform", (d) => `translate(${d.x}, ${d.y})`)
      .attr("class", "node-group")
      .call(drag as any);

    nodeGroup.each(function (d: FlowNode) {
      const g = d3.select(this);
      const w = node_width;
      const h = getNodeHeight(d.text);
      
      let style = currentTheme.process;
      if (d.type === "start") style = currentTheme.start;
      else if (d.type === "end") style = currentTheme.end;
      else if (d.type === "decision") style = currentTheme.decision;

      if (d.type === "start" || d.type === "end") {
        g.append("rect").attr("rx", h / 2).attr("ry", h / 2).attr("width", w).attr("height", h).attr("fill", style.fill).attr("stroke", style.stroke).attr("stroke-width", 2);
      } else if (d.type === "decision") {
        g.append("path").attr("d", `M ${w / 2} 0 L ${w} ${h / 2} L ${w / 2} ${h} L 0 ${h / 2} Z`).attr("fill", style.fill).attr("stroke", style.stroke).attr("stroke-width", 2);
      } else {
        g.append("rect").attr("rx", 8).attr("ry", 8).attr("width", w).attr("height", h).attr("fill", style.fill).attr("stroke", style.stroke).attr("stroke-width", 2);
      }

      const textEl = g.append("text")
        .attr("x", w / 2)
        .attr("y", 0)
        .attr("text-anchor", "middle")
        .style("font-size", "13px")
        .style("font-weight", "500")
        .style("font-family", "Inter, system-ui, sans-serif")
        .style("fill", style.text)
        .style("pointer-events", "none");

      const lines = d.text.split("\n");
      const lineHeight = 18;
      const startY = (h - lines.length * lineHeight) / 2 + 14;
      
      lines.forEach((line, i) => {
        textEl.append("tspan")
          .attr("x", w / 2)
          .attr("y", startY + i * lineHeight)
          .text(line);
      });
    });
  }

  async function exportFlowchart(format: "png" | "jpg" | "svg" | "pdf") {
    if (!svg) return;
    showExportMenu = false;
    try {
      const options = { 
        backgroundColor: "#ffffff",
        style: { transform: 'scale(1)' }
      };
      
      if (format === "png") {
        const dataUrl = await toPng(svg as any, options);
        download(dataUrl, "flowchart.png");
      } else if (format === "jpg") {
        const dataUrl = await toJpeg(svg as any, { ...options, quality: 0.95 });
        download(dataUrl, "flowchart.jpg");
      } else if (format === "svg") {
        const dataUrl = await toSvg(svg as any, options);
        download(dataUrl, "flowchart.svg");
      } else if (format === "pdf") {
        const dataUrl = await toPng(svg as any, options);
        const pdf = new jsPDF({
          orientation: svg.clientWidth > svg.clientHeight ? "l" : "p", 
          unit: "px", 
          format: [svg.clientWidth, svg.clientHeight] 
        });
        pdf.addImage(dataUrl, "PNG", 0, 0, svg.clientWidth, svg.clientHeight);
        pdf.save("flowchart.pdf");
      }
    } catch (error) {
      console.error("Error exporting flowchart:", error);
    }
  }

  function download(dataUrl: string, filename: string) {
    const link = document.createElement("a");
    link.download = filename;
    link.href = dataUrl;
    link.click();
  }

  $: if (svg && flowchartNodes && container || themeId) {
    updateFlowchart();
  }

  onMount(() => {
    const resizeObserver = new ResizeObserver(() => {
      updateFlowchart();
    });
    if (container) resizeObserver.observe(container);
    return () => resizeObserver.disconnect();
  });
</script>

<div class="w-full h-full flex flex-col relative group" bind:this={container}>
  <!-- Floating Toolbar -->
  <div class="absolute top-4 left-4 z-20 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
    <div class="relative">
      <button 
        on:click={() => showExportMenu = !showExportMenu}
        class="flex items-center gap-2 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg px-3 py-2 shadow-sm hover:bg-neutral-50 dark:hover:bg-neutral-700 transition-colors text-sm font-medium"
      >
        <Download class="w-4 h-4" />
        <span>Guardar como</span>
      </button>

      {#if showExportMenu}
        <div class="absolute top-full mt-2 left-0 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl shadow-xl py-2 w-48 z-30 animate-in fade-in zoom-in-95 duration-200">
          <button on:click={() => exportFlowchart("png")} class="w-full px-4 py-2 text-left text-sm hover:bg-neutral-50 dark:hover:bg-neutral-700 flex items-center gap-3">
            <FileImage class="w-4 h-4 text-blue-500" /> PNG Imagen
          </button>
          <button on:click={() => exportFlowchart("jpg")} class="w-full px-4 py-2 text-left text-sm hover:bg-neutral-50 dark:hover:bg-neutral-700 flex items-center gap-3">
            <FileImage class="w-4 h-4 text-orange-500" /> JPG Imagen
          </button>
          <button on:click={() => exportFlowchart("svg")} class="w-full px-4 py-2 text-left text-sm hover:bg-neutral-50 dark:hover:bg-neutral-700 flex items-center gap-3">
            <FileType class="w-4 h-4 text-purple-500" /> SVG Vector
          </button>
          <div class="h-px bg-neutral-100 dark:bg-neutral-700 my-1"></div>
          <button on:click={() => exportFlowchart("pdf")} class="w-full px-4 py-2 text-left text-sm hover:bg-neutral-50 dark:hover:bg-neutral-700 flex items-center gap-3">
            <FileCode class="w-4 h-4 text-red-500" /> PDF Documento
          </button>
        </div>
      {/if}
    </div>
  </div>

  <!-- SVG Canvas -->
  <div class="flex-1 overflow-auto bg-white dark:bg-neutral-800/50 cursor-move">
    <svg bind:this={svg} class="mx-auto"></svg>
  </div>
</div>

<style>
  :global(.node-group) {
    transition: filter 0.2s;
  }
  :global(.node-group:hover) {
    filter: drop-shadow(0 4px 6px rgb(0 0 0 / 0.1));
  }
  :global(.node-group.dragging) {
    cursor: grabbing !important;
  }
</style>