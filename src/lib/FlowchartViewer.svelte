<script lang="ts">
  import { onMount } from "svelte";
  import * as d3 from "d3";
  import { toPng, toJpeg, toSvg } from "html-to-image";
  import { jsPDF } from "jspdf";
  import {
    Download,
    FileImage,
    FileType,
    FileCode,
    Move,
    Hand,
  } from "lucide-svelte";
  import type { FlowNode, FlowTheme } from "./types";

  export let flowchartNodes: FlowNode[] = [];
  export let themeId: string = "default";

  let svg: SVGSVGElement;
  let container: HTMLDivElement;
  let canvasContainer: HTMLDivElement;
  let showExportMenu = false;

  let isPanning = false;
  let startX = 0;
  let startY = 0;
  let translateX = 0;
  let translateY = 0;

  let panMode = true;

  let nodePositions = new Map<string, { x: number; y: number }>();
  let linkPoints = new Map<string, { x: number; y: number }[]>();
  let linkSmooth = new Map<string, boolean>();
  let isFirstRender = true;

  const THEMES: Record<string, FlowTheme> = {
    default: {
      id: "default",
      name: "Clásico",
      start: { fill: "#f0fdf4", stroke: "#22c55e", text: "#166534" },
      end: { fill: "#fef2f2", stroke: "#ef4444", text: "#991b1b" },
      decision: { fill: "#fffbeb", stroke: "#f59e0b", text: "#92400e" },
      process: { fill: "#f8fafc", stroke: "#64748b", text: "#334155" },
      line: "#94a3b8",
    },
    ocean: {
      id: "ocean",
      name: "Océano",
      start: { fill: "#e0f2fe", stroke: "#0ea5e9", text: "#0369a1" },
      end: { fill: "#ffedd5", stroke: "#f97316", text: "#c2410c" },
      decision: { fill: "#fae8ff", stroke: "#d946ef", text: "#a21caf" },
      process: { fill: "#f0f9ff", stroke: "#3b82f6", text: "#1d4ed8" },
      line: "#7dd3fc",
    },
    modern: {
      id: "modern",
      name: "Moderno",
      start: { fill: "#10b981", stroke: "#059669", text: "#ffffff" },
      end: { fill: "#f43f5e", stroke: "#e11d48", text: "#ffffff" },
      decision: { fill: "#8b5cf6", stroke: "#7c3aed", text: "#ffffff" },
      process: { fill: "#3b82f6", stroke: "#2563eb", text: "#ffffff" },
      line: "#6366f1",
    },
    minimal: {
      id: "minimal",
      name: "Minimalista",
      start: { fill: "#ffffff", stroke: "#000000", text: "#000000" },
      end: { fill: "#ffffff", stroke: "#000000", text: "#000000" },
      decision: { fill: "#ffffff", stroke: "#000000", text: "#000000" },
      process: { fill: "#ffffff", stroke: "#000000", text: "#000000" },
      line: "#000000",
    },
  };

  const node_width = 160;
  const vertical_spacing = 100;
  const horizontal_spacing = 80;

  function getNodeHeight(text: string) {
    const lines = (text || "").split("\n").length;
    return Math.max(60, lines * 20 + 24);
  }

  function handlePanStart(e: MouseEvent) {
    if (!panMode) return;
    if (e.button !== 0) return;

    const target = e.target as HTMLElement;
    if (target.closest(".node-group")) return;

    e.preventDefault(); // Prevenir selección de texto
    isPanning = true;
    startX = e.clientX - translateX;
    startY = e.clientY - translateY;
    if (canvasContainer) {
      canvasContainer.style.cursor = "grabbing";
    }
    document.body.style.userSelect = "none"; // Deshabilitar selección global
  }

  function handlePanMove(e: MouseEvent) {
    if (!isPanning) return;
    translateX = e.clientX - startX;
    translateY = e.clientY - startY;

    if (svg) {
      svg.style.transform = `translate(${translateX}px, ${translateY}px)`;
    }
  }

  function handlePanEnd() {
    isPanning = false;
    document.body.style.userSelect = ""; // Re-habilitar selección
    if (canvasContainer && panMode) {
      canvasContainer.style.cursor = "grab";
    }
  }

  function updateFlowchart() {
    if (!svg || !flowchartNodes || flowchartNodes.length === 0) return;

    const currentTheme = THEMES[themeId] || THEMES.default;
    const svgElement = d3.select(svg);
    svgElement.selectAll("*").remove();

    const nodes = JSON.parse(JSON.stringify(flowchartNodes)) as FlowNode[];
    const nodeMap = new Map<string, FlowNode>(nodes.map((n) => [n.id, n]));

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
      const totalW =
        nodesInLayer.length * node_width +
        (nodesInLayer.length - 1) * horizontal_spacing;
      currentSvgWidth = Math.max(currentSvgWidth, totalW);
    }

    // Determine the actual required size considering stored positions
    let maxX = currentSvgWidth + 100;
    let maxY = (maxDepth + 1) * vertical_spacing + 150;

    nodePositions.forEach((pos, id) => {
      const n = nodeMap.get(id);
      if (n) {
        const h = getNodeHeight(n.text);
        if (pos.x + node_width + 100 > maxX) maxX = pos.x + node_width + 100;
        if (pos.y + h + 100 > maxY) maxY = pos.y + h + 100;
      }
    });

    const containerWidth = container?.clientWidth || 1000;
    const finalWidth = Math.max(containerWidth, maxX);
    const finalHeight = maxY;

    // Calculate initial positions only if not stored
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
      let startX = (finalWidth - totalW) / 2;

      nodesInLayer.forEach((n, i) => {
        // Use stored position if available, otherwise calculate
        const storedPos = nodePositions.get(n.id);
        if (storedPos) {
          n.x = storedPos.x;
          n.y = storedPos.y;
        } else {
          n.x = startX + i * (node_width + horizontal_spacing);
          n.y = d * vertical_spacing + 60;
          // Store initial position
          nodePositions.set(n.id, { x: n.x, y: n.y });
        }
      });
    }

    svgElement.attr("width", finalWidth).attr("height", finalHeight);

    const defs = svgElement.append("defs");

    defs
      .append("marker")
      .attr("id", "arrowhead")
      .attr("viewBox", "0 -5 10 10")
      .attr("refX", 10) // La punta del triángulo es el punto de anclaje
      .attr("refY", 0)
      .attr("orient", "auto")
      .attr("markerWidth", 8)
      .attr("markerHeight", 8)
      .append("path")
      .attr("d", "M 0,-5 L 10,0 L 0,5 Z")
      .attr("fill", currentTheme.line);

    const links: any[] = [];
    nodes.forEach((node) => {
      node.targets.forEach((targetId) => {
        const target = nodeMap.get(targetId);
        if (target) links.push({ source: node, target });
      });
    });

    const getLinkPath = (d: any) => {
      const linkId = `${d.source.id}-${d.target.id}`;
      const points = linkPoints.get(linkId) || [];
      const isSmooth = linkSmooth.get(linkId) || false;
      const srcH = getNodeHeight(d.source.text);
      const tgtH = getNodeHeight(d.target.text);
      const sx = d.source.x + node_width / 2;
      const sy = d.source.y + srcH;
      const tx = d.target.x + node_width / 2;
      const ty = d.target.y;

      // El path llegará hasta el borde del nodo (ty), 
      // pero usaremos un truco visual o el marker se encargará.
      // Para que la línea no se vea en la punta, acortamos el path 
      // pero mantenemos el destino para el marker.

      if (points.length > 0) {
        const allPoints = [{ x: sx, y: sy }, ...points, { x: tx, y: ty }];
        if (isSmooth) {
          const lineGenerator = d3
            .line()
            .x((p: any) => p.x)
            .y((p: any) => p.y)
            .curve(d3.curveCatmullRom.alpha(0.5));
          return lineGenerator(allPoints as any);
        } else {
          let path = `M ${sx} ${sy}`;
          points.forEach((p) => (path += ` L ${p.x} ${p.y}`));
          path += ` L ${tx} ${ty}`;
          return path;
        }
      }

      if (ty < sy) {
        const loopOffset = 50;
        const turnY = sy + 25;
        const midX = Math.max(d.source.x, d.target.x) + node_width + loopOffset;
        const targetSideX = d.target.x + node_width;
        const targetMidY = d.target.y + tgtH / 2;
        return `M ${sx} ${sy} L ${sx} ${turnY} L ${midX} ${turnY} L ${midX} ${targetMidY} L ${targetSideX} ${targetMidY}`;
      }

      const midY = (sy + ty) / 2;
      return `M ${sx} ${sy} C ${sx} ${midY}, ${tx} ${midY}, ${tx} ${ty}`;
    };

    const linkGroup = svgElement.append("g").attr("class", "links-layer");

    const linkPaths = linkGroup
      .selectAll("g.link-group")
      .data(links)
      .join("g")
      .attr("class", "link-group");

    linkPaths
      .append("path")
      .attr("class", "link-background")
      .attr("d", getLinkPath)
      .attr("fill", "none")
      .attr("stroke", "transparent")
      .attr("stroke-width", 30)
      .style("cursor", "pointer")
      .on("contextmenu", function (event, d: any) {
        if (panMode) return;
        event.preventDefault();
        const linkId = `${d.source.id}-${d.target.id}`;
        linkSmooth.set(linkId, !linkSmooth.get(linkId));
        updateFlowchart();
      })
      .on("click", function (event, d: any) {
        if (panMode) return;
        event.stopPropagation();
        const [mx, my] = d3.pointer(event, svgElement.node());
        const linkId = `${d.source.id}-${d.target.id}`;

        if (!linkPoints.has(linkId)) {
          linkPoints.set(linkId, []);
        }
        const points = linkPoints.get(linkId)!;

        const srcH = getNodeHeight(d.source.text);
        const sx = d.source.x + node_width / 2;
        const sy = d.source.y + srcH;
        const tx = d.target.x + node_width / 2;
        const ty = d.target.y;

        const allPoints = [{ x: sx, y: sy }, ...points, { x: tx, y: ty }];
        let minDist = Infinity;
        let insertIdx = 0;

        for (let i = 0; i < allPoints.length - 1; i++) {
          const p1 = allPoints[i];
          const p2 = allPoints[i + 1];
          const l2 =
            (p2.x - p1.x) * (p2.x - p1.x) + (p2.y - p1.y) * (p2.y - p1.y);
          if (l2 === 0) continue;
          let t =
            ((mx - p1.x) * (p2.x - p1.x) + (my - p1.y) * (p2.y - p1.y)) / l2;
          t = Math.max(0, Math.min(1, t));
          const projX = p1.x + t * (p2.x - p1.x);
          const projY = p1.y + t * (p2.y - p1.y);
          const dist = Math.sqrt(
            (mx - projX) * (mx - projX) + (my - projY) * (my - projY),
          );

          if (dist < minDist) {
            minDist = dist;
            insertIdx = i;
          }
        }

        points.splice(insertIdx, 0, { x: mx, y: my });
        updateFlowchart();
      });

    linkPaths
      .append("path")
      .attr("class", "link-visible")
      .attr("d", getLinkPath)
      .attr("fill", "none")
      .attr("stroke", currentTheme.line)
      .attr("stroke-width", 2.5)
      .attr("marker-end", "url(#arrowhead)")
      .attr("stroke-dasharray", (d) =>
        d.target.y < d.source.y ? "5,5" : "none",
      )
      .style("filter", "drop-shadow(0 1px 2px rgba(0,0,0,0.1))")
      .style("pointer-events", "none");

    linkPaths
      .on("mouseenter", function () {
        d3.select(this)
          .select(".link-visible")
          .transition()
          .duration(200)
          .attr("stroke-width", 4)
          .style("filter", "drop-shadow(0 2px 4px rgba(0,0,0,0.2))");
      })
      .on("mouseleave", function () {
        d3.select(this)
          .select(".link-visible")
          .transition()
          .duration(200)
          .attr("stroke-width", 2.5)
          .style("filter", "drop-shadow(0 1px 2px rgba(0,0,0,0.1))");
      });

    function updateLinks() {
      linkGroup.selectAll("path").attr("d", getLinkPath);
      svgElement.selectAll(".link-point-group").attr("transform", (d: any) => 
        `translate(${d.point.x}, ${d.point.y})`
      );
    }

    const dragPoint = d3
      .drag()
      .on("start", function (event) {
        if (panMode) return;
        event.sourceEvent.stopPropagation();
        d3.select(this).select(".link-point").classed("dragging", true);
      })
      .on("drag", function (event, d: any) {
        if (panMode) return;
        d.point.x = event.x;
        d.point.y = event.y;
        updateLinks();
      })
      .on("end", function () {
        if (panMode) return;
        d3.select(this).select(".link-point").classed("dragging", false);
      });

    if (!panMode) {
      links.forEach((link) => {
        const linkId = `${link.source.id}-${link.target.id}`;
        const points = linkPoints.get(linkId) || [];
        points.forEach((point, index) => {
          const pointGroup = svgElement
            .append("g")
            .datum({ point, linkId, index })
            .attr("class", "link-point-group")
            .attr("transform", `translate(${point.x}, ${point.y})`)
            .style("cursor", "move")
            .call(dragPoint as any)
            .on("contextmenu", function (event) {
              event.preventDefault();
              points.splice(index, 1);
              updateFlowchart();
            });

          // Invisible hit area (larger tolerance)
          pointGroup.append("circle")
            .attr("r", 15)
            .attr("fill", "transparent");

          // Visible point
          pointGroup.append("circle")
            .attr("class", "link-point")
            .attr("r", 6)
            .attr("fill", currentTheme.line)
            .attr("stroke", "white")
            .attr("stroke-width", 2);
        });
      });
    }

    const drag = d3
      .drag()
      .on("start", function (event, d: any) {
        if (panMode) return;
        event.sourceEvent.stopPropagation();
        d3.select(this).raise().classed("dragging", true);
        linkGroup.raise();
      })
      .on("drag", function (event, d: any) {
        if (panMode) return;
        d.x = event.x;
        d.y = event.y;

        nodePositions.set(d.id, { x: d.x, y: d.y });

        d3.select(this).attr("transform", `translate(${d.x}, ${d.y})`);
        updateLinks();

        // Dynamically update SVG size if dragging outside current bounds
        const h = getNodeHeight(d.text);
        const currentW = +svgElement.attr("width");
        const currentH = +svgElement.attr("height");
        if (d.x + node_width + 100 > currentW) svgElement.attr("width", d.x + node_width + 100);
        if (d.y + h + 100 > currentH) svgElement.attr("height", d.y + h + 100);
      })
      .on("end", function (event, d: any) {
        if (panMode) return;
        d3.select(this).classed("dragging", false);
      });

    const nodeGroup = svgElement
      .append("g")
      .selectAll("g")
      .data(nodes)
      .join("g")
      .attr("transform", (d) => `translate(${d.x}, ${d.y})`)
      .attr("class", "node-group")
      .style("cursor", () => (panMode ? "grab" : "move"))
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
        g.append("rect")
          .attr("rx", h / 2)
          .attr("ry", h / 2)
          .attr("width", w)
          .attr("height", h)
          .attr("fill", style.fill)
          .attr("stroke", style.stroke)
          .attr("stroke-width", 2.5)
          .style("filter", "drop-shadow(0 2px 4px rgba(0,0,0,0.08))");
      } else if (d.type === "decision") {
        g.append("path")
          .attr(
            "d",
            `M ${w / 2} 0 L ${w} ${h / 2} L ${w / 2} ${h} L 0 ${h / 2} Z`,
          )
          .attr("fill", style.fill)
          .attr("stroke", style.stroke)
          .attr("stroke-width", 2.5)
          .style("filter", "drop-shadow(0 2px 4px rgba(0,0,0,0.08))");
      } else {
        g.append("rect")
          .attr("rx", 8)
          .attr("ry", 8)
          .attr("width", w)
          .attr("height", h)
          .attr("fill", style.fill)
          .attr("stroke", style.stroke)
          .attr("stroke-width", 2.5)
          .style("filter", "drop-shadow(0 2px 4px rgba(0,0,0,0.08))");
      }

      const textEl = g
        .append("text")
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
        textEl
          .append("tspan")
          .attr("x", w / 2)
          .attr("y", startY + i * lineHeight)
          .text(line);
      });
    });

    isFirstRender = false;
  }

  async function exportFlowchart(format: "png" | "jpg" | "svg" | "pdf") {
    if (!svg) return;
    showExportMenu = false;
    try {
      const originalTransform = svg.style.transform;
      svg.style.transform = "";

      const options = {
        backgroundColor: "#ffffff",
        style: { transform: "scale(1)" },
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
          format: [svg.clientWidth, svg.clientHeight],
        });
        pdf.addImage(dataUrl, "PNG", 0, 0, svg.clientWidth, svg.clientHeight);
        pdf.save("flowchart.pdf");
      }

      svg.style.transform = originalTransform;
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

  function toggleMode() {
    panMode = !panMode;
    if (canvasContainer) {
      canvasContainer.style.cursor = panMode ? "grab" : "default";
    }
    if (svg) {
      d3.selectAll(".node-group").style("cursor", panMode ? "grab" : "move");
    }
  }

  let prevNodesLength = 0;
  $: if (flowchartNodes) {
    if (flowchartNodes.length !== prevNodesLength) {
      nodePositions.clear();
      linkPoints.clear();
      linkSmooth.clear();
      prevNodesLength = flowchartNodes.length;
    }
    if (svg && container) {
      updateFlowchart();
    }
  }

  $: if (themeId && svg) {
    updateFlowchart();
  }

  $: if (canvasContainer) {
    canvasContainer.style.cursor = panMode ? "grab" : "default";
  }

  onMount(() => {
    const resizeObserver = new ResizeObserver(() => {
      updateFlowchart();
    });
    if (container) resizeObserver.observe(container);
    return () => resizeObserver.disconnect();
  });
</script>

<svelte:window on:mousemove={handlePanMove} on:mouseup={handlePanEnd} />

<div class="w-full h-full flex flex-col relative group" bind:this={container}>
  <div
    class="absolute top-4 left-4 z-20 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
  >
    <div class="relative">
      <button
        on:click={() => (showExportMenu = !showExportMenu)}
        class="flex items-center gap-2 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg px-3 py-2 shadow-sm hover:bg-neutral-50 dark:hover:bg-neutral-700 transition-colors text-sm font-medium"
      >
        <Download class="w-4 h-4" />
        <span>Guardar como</span>
      </button>

      {#if showExportMenu}
        <div
          class="absolute top-full mt-2 left-0 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl shadow-xl py-2 w-48 z-30 animate-in fade-in zoom-in-95 duration-200"
        >
          <button
            on:click={() => exportFlowchart("png")}
            class="w-full px-4 py-2 text-left text-sm hover:bg-neutral-50 dark:hover:bg-neutral-700 flex items-center gap-3"
          >
            <FileImage class="w-4 h-4 text-blue-500" /> PNG Imagen
          </button>
          <button
            on:click={() => exportFlowchart("jpg")}
            class="w-full px-4 py-2 text-left text-sm hover:bg-neutral-50 dark:hover:bg-neutral-700 flex items-center gap-3"
          >
            <FileImage class="w-4 h-4 text-orange-500" /> JPG Imagen
          </button>
          <button
            on:click={() => exportFlowchart("svg")}
            class="w-full px-4 py-2 text-left text-sm hover:bg-neutral-50 dark:hover:bg-neutral-700 flex items-center gap-3"
          >
            <FileType class="w-4 h-4 text-purple-500" /> SVG Vector
          </button>
          <div class="h-px bg-neutral-100 dark:bg-neutral-700 my-1"></div>
          <button
            on:click={() => exportFlowchart("pdf")}
            class="w-full px-4 py-2 text-left text-sm hover:bg-neutral-50 dark:hover:bg-neutral-700 flex items-center gap-3"
          >
            <FileCode class="w-4 h-4 text-red-500" /> PDF Documento
          </button>
        </div>
      {/if}
    </div>

    <button
      on:click={toggleMode}
      class="flex items-center gap-2 border rounded-lg px-3 py-2 shadow-sm transition-all text-sm font-medium"
      class:bg-orange-500={!panMode}
      class:text-white={!panMode}
      class:border-orange-500={!panMode}
      class:bg-white={panMode}
      class:dark:bg-neutral-800={panMode}
      class:border-neutral-200={panMode}
      class:dark:border-neutral-700={panMode}
      class:hover:bg-neutral-50={panMode}
      class:dark:hover:bg-neutral-700={panMode}
    >
      {#if panMode}
        <Move class="w-4 h-4" />
        <span>Modo Navegación</span>
      {:else}
        <Hand class="w-4 h-4" />
        <span>Modo Edición</span>
      {/if}
    </button>
  </div>

  <div
    class="flex-1 overflow-hidden bg-white dark:bg-neutral-800/50 select-none"
    class:cursor-grab={panMode}
    class:active:cursor-grabbing={panMode}
    bind:this={canvasContainer}
    on:mousedown={handlePanStart}
  >
    <svg bind:this={svg} style="transition: transform 0.05s ease-out; overflow: visible;"></svg>
  </div>
</div>

<style>
  :global(.node-group) {
    transition: filter 0.2s;
  }
  :global(.node-group:hover) {
    filter: drop-shadow(0 6px 12px rgba(0, 0, 0, 0.15));
  }
  :global(.node-group.dragging) {
    cursor: grabbing !important;
    filter: drop-shadow(0 8px 16px rgba(0, 0, 0, 0.2));
  }
  :global(.link-group) {
    transition: all 0.2s ease;
  }
  :global(.link-point) {
    transition:
      r 0.2s,
      fill 0.2s;
  }
  :global(.link-point:hover) {
    r: 8;
  }
  :global(.link-point.dragging) {
    fill: #3b82f6;
  }
</style>
