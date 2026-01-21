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

  let prevNodesLength = 0;

  const btnToolClass =
    "flex items-center gap-2 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg px-3 py-2 shadow-sm text-sm font-medium hover:bg-neutral-50 dark:hover:bg-neutral-700 transition-colors";
  const btnToolActiveClass =
    "bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300";
  const menuItemClass =
    "px-4 py-2 text-left text-sm hover:bg-neutral-50 dark:hover:bg-neutral-700 flex items-center gap-2 w-full text-neutral-700 dark:text-neutral-200";

  const THEMES: Record<string, FlowTheme> = {
    default: {
      id: "default",
      name: "Clásico",
      start: { fill: "#dcfce7", stroke: "#22c55e", text: "#14532d" },
      end: { fill: "#fee2e2", stroke: "#ef4444", text: "#7f1d1d" },
      decision: { fill: "#fef3c7", stroke: "#f59e0b", text: "#78350f" },
      process: { fill: "#e2e8f0", stroke: "#64748b", text: "#1e293b" },
      line: "#475569",
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

  // --- GEOMETRÍA: Intersecciones Exactas ---
  function getNodeIntersection(
    node: FlowNode,
    targetPoint: { x: number; y: number },
  ) {
    const w = node_width;
    const h = getNodeHeight(node.text);
    const cx = node.x! + w / 2;
    const cy = node.y! + h / 2;

    const dx = targetPoint.x - cx;
    const dy = targetPoint.y - cy;

    if (node.type === "decision") {
      if (dx === 0 && dy === 0) return { x: cx, y: cy };
      const a = w / 2;
      const b = h / 2;
      const tanTheta = Math.abs(dy / dx);
      const signX = dx >= 0 ? 1 : -1;
      const signY = dy >= 0 ? 1 : -1;

      let ix = (a * b) / (b + a * tanTheta);
      let iy = ix * tanTheta;

      return { x: cx + signX * ix, y: cy + signY * iy };
    } else {
      const wHalf = w / 2;
      const hHalf = h / 2;
      if (dx === 0) return { x: cx, y: cy + (dy > 0 ? hHalf : -hHalf) };
      const slope = dy / dx;

      if (Math.abs(dx) >= Math.abs(dy * (w / h))) {
        const xOffset = dx > 0 ? wHalf : -wHalf;
        return { x: cx + xOffset, y: cy + xOffset * slope };
      } else {
        const yOffset = dy > 0 ? hHalf : -hHalf;
        return { x: cx + yOffset / slope, y: cy + yOffset };
      }
    }
  }

  function handlePanStart(e: MouseEvent) {
    if (!panMode) return;
    if (e.button !== 0) return;
    const target = e.target as HTMLElement;
    if (target.closest(".node-group") || target.closest(".link-point-group"))
      return;

    e.preventDefault();
    isPanning = true;
    startX = e.clientX - translateX;
    startY = e.clientY - translateY;
    if (canvasContainer) canvasContainer.style.cursor = "grabbing";
    document.body.style.userSelect = "none";
  }

  function handlePanMove(e: MouseEvent) {
    if (!isPanning) return;
    translateX = e.clientX - startX;
    translateY = e.clientY - startY;
    if (svg)
      svg.style.transform = `translate(${translateX}px, ${translateY}px)`;
  }

  function handlePanEnd() {
    isPanning = false;
    document.body.style.userSelect = "";
    if (canvasContainer && panMode) canvasContainer.style.cursor = "grab";
  }

  function updateFlowchart() {
    if (!svg || !flowchartNodes || flowchartNodes.length === 0) return;

    const currentTheme = THEMES[themeId] || THEMES.default;
    const svgElement = d3.select(svg);
    svgElement.selectAll("*").remove();

    const nodes = JSON.parse(JSON.stringify(flowchartNodes)) as FlowNode[];
    const nodeMap = new Map<string, FlowNode>(nodes.map((n) => [n.id, n]));

    // --- Layout Automático Básico (Solo 1ra vez o si no hay posiciones) ---
    const depths = new Map<string, number>();
    const parentsMap = new Map<string, string[]>();
    nodes.forEach((n) => {
      if (!parentsMap.has(n.id)) parentsMap.set(n.id, []);
      n.targets.forEach((t) => {
        if (!parentsMap.has(t)) parentsMap.set(t, []);
        parentsMap.get(t)?.push(n.id);
      });
    });

    const roots = nodes.filter(
      (n) => n.type === "start" || parentsMap.get(n.id)?.length === 0,
    );
    const queue: { id: string; depth: number }[] = roots.map((r) => ({
      id: r.id,
      depth: 0,
    }));
    roots.forEach((r) => depths.set(r.id, 0));

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
      const d = depths.get(n.id) ?? maxDepth + 1;
      if (!layers.has(d)) layers.set(d, []);
      layers.get(d)?.push(n);
    });

    let currentSvgWidth = 0;
    for (let d = 0; d <= maxDepth + 1; d++) {
      const nodesInLayer = layers.get(d) || [];
      const totalW =
        nodesInLayer.length * node_width +
        Math.max(0, nodesInLayer.length - 1) * horizontal_spacing;
      currentSvgWidth = Math.max(currentSvgWidth, totalW);
    }

    let maxX = currentSvgWidth + 200;
    let maxY = (maxDepth + 2) * vertical_spacing + 200;

    for (let d = 0; d <= maxDepth + 1; d++) {
      const nodesInLayer = layers.get(d) || [];
      if (d > 0) {
        nodesInLayer.forEach((node: any) => {
          const parents = parentsMap.get(node.id) || [];
          let avgX = 0,
            count = 0;
          parents.forEach((pid) => {
            const p = nodePositions.get(pid);
            if (p) {
              avgX += p.x;
              count++;
            }
          });
          node._sortX = count > 0 ? avgX / count : 0;
        });
        nodesInLayer.sort((a: any, b: any) => a._sortX - b._sortX);
      }

      const totalW =
        nodesInLayer.length * node_width +
        Math.max(0, nodesInLayer.length - 1) * horizontal_spacing;
      let startXLayer = (maxX - totalW) / 2;

      nodesInLayer.forEach((n, i) => {
        const stored = nodePositions.get(n.id);
        if (stored) {
          n.x = stored.x;
          n.y = stored.y;
        } else {
          n.x = startXLayer + i * (node_width + horizontal_spacing);
          n.y = d * vertical_spacing + 60;
          nodePositions.set(n.id, { x: n.x, y: n.y });
        }
        maxX = Math.max(maxX, n.x + node_width + 100);
        maxY = Math.max(maxY, n.y + getNodeHeight(n.text) + 100);
      });
    }

    svgElement.attr("width", maxX).attr("height", maxY);

    // --- Defs ---
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
      .attr("d", "M0,-5L10,0L0,5")
      .attr("fill", currentTheme.line);

    // --- Links ---
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

      const srcW = node_width;
      const srcH = getNodeHeight(d.source.text);
      const tgtW = node_width;
      const tgtH = getNodeHeight(d.target.text);
      const srcCenter = { x: d.source.x + srcW / 2, y: d.source.y + srcH / 2 };
      const tgtCenter = { x: d.target.x + tgtW / 2, y: d.target.y + tgtH / 2 };

      // Rutas con Puntos Manuales
      if (points.length > 0) {
        const start = getNodeIntersection(d.source, points[0]);
        const end = getNodeIntersection(d.target, points[points.length - 1]);
        const allPoints = [start, ...points, end];

        if (isSmooth) {
          return d3
            .line()
            .x((p: any) => p.x)
            .y((p: any) => p.y)
            .curve(d3.curveCatmullRom.alpha(0.5))(allPoints as any);
        } else {
          return d3
            .line()
            .x((p: any) => p.x)
            .y((p: any) => p.y)
            .curve(d3.curveLinear)(allPoints as any);
        }
      }

      // Rutas Automáticas
      if (tgtCenter.y < srcCenter.y - srcH) {
        // BACK LOOP (Retorno hacia arriba)
        const start = { x: d.source.x + srcW, y: srcCenter.y };
        const end = { x: d.target.x + tgtW, y: tgtCenter.y };

        const realStart = getNodeIntersection(d.source, {
          x: d.source.x + srcW + 100,
          y: srcCenter.y,
        });
        const realEnd = getNodeIntersection(d.target, {
          x: d.target.x + tgtW + 100,
          y: tgtCenter.y,
        });

        const midX = Math.max(d.source.x, d.target.x) + srcW + 40;

        return `M ${realStart.x} ${realStart.y} 
                L ${midX} ${realStart.y} 
                L ${midX} ${realEnd.y} 
                L ${realEnd.x} ${realEnd.y}`;
      } else {
        // STANDARD (Hacia abajo/lados)
        let intendedStart = { x: srcCenter.x, y: d.source.y + srcH + 10 };
        let intendedEnd = { x: tgtCenter.x, y: d.target.y - 10 };

        if (
          d.source.type === "decision" &&
          Math.abs(tgtCenter.x - srcCenter.x) > srcW * 0.8
        ) {
          intendedStart = {
            x:
              tgtCenter.x > srcCenter.x
                ? d.source.x + srcW + 10
                : d.source.x - 10,
            y: srcCenter.y,
          };
        }

        const realStart = getNodeIntersection(d.source, intendedEnd);
        const realEnd = getNodeIntersection(d.target, realStart);

        const midY = (realStart.y + realEnd.y) / 2;

        if (Math.abs(realStart.x - realEnd.x) < 2) {
          return `M ${realStart.x} ${realStart.y} L ${realEnd.x} ${realEnd.y}`;
        }

        return `M ${realStart.x} ${realStart.y} 
                C ${realStart.x} ${midY}, 
                  ${realEnd.x} ${midY}, 
                  ${realEnd.x} ${realEnd.y}`;
      }
    };

    const linkGroup = svgElement.append("g").attr("class", "links-layer");
    const linkPaths = linkGroup
      .selectAll("g.link-group")
      .data(links)
      .join("g")
      .attr("class", "link-group");

    // Área de clic invisible
    linkPaths
      .append("path")
      .attr("class", "link-hit-area")
      .attr("d", getLinkPath)
      .attr("fill", "none")
      .attr("stroke", "transparent")
      .attr("stroke-width", 20)
      .style("cursor", "pointer")
      .on("contextmenu", (e, d: any) => {
        if (panMode) return;
        e.preventDefault();
        const linkId = `${d.source.id}-${d.target.id}`;
        linkSmooth.set(linkId, !linkSmooth.get(linkId));
        updateFlowchart();
      })
      .on("click", (event, d: any) => {
        if (panMode) return;
        event.stopPropagation();
        const [mx, my] = d3.pointer(event, svgElement.node());
        const linkId = `${d.source.id}-${d.target.id}`;
        if (!linkPoints.has(linkId)) linkPoints.set(linkId, []);
        const points = linkPoints.get(linkId)!;
        points.push({ x: mx, y: my });
        updateFlowchart();
      });

    // Línea visible
    linkPaths
      .append("path")
      .attr("class", "link-visible")
      .attr("d", getLinkPath)
      .attr("fill", "none")
      .attr("stroke", currentTheme.line)
      .attr("stroke-width", 2)
      .attr("stroke-linecap", "round")
      .attr("stroke-linejoin", "round")
      .attr("marker-end", "url(#arrowhead)")
      .attr("stroke-dasharray", (d) => {
        const srcH = getNodeHeight(d.source.text);
        if (d.target.y < d.source.y - srcH) return "5,5";
        return "none";
      });

    // Puntos de control
    if (!panMode) {
      links.forEach((link) => {
        const linkId = `${link.source.id}-${link.target.id}`;
        const points = linkPoints.get(linkId) || [];

        points.forEach((point, idx) => {
          const pointG = svgElement
            .append("g")
            .datum({ point, linkId, idx })
            .attr("class", "link-point-group")
            .attr("transform", `translate(${point.x}, ${point.y})`)
            .call(
              d3
                .drag()
                .on("start", function (e) {
                  e.sourceEvent.stopPropagation();
                  d3.select(this)
                    .select("circle")
                    .attr("r", 8)
                    .classed("dragging", true);
                })
                .on("drag", function (e, d: any) {
                  d.point.x = e.x;
                  d.point.y = e.y;
                  d3.select(this).attr("transform", `translate(${e.x},${e.y})`);
                  linkGroup.selectAll(".link-visible").attr("d", getLinkPath);
                  linkGroup.selectAll(".link-hit-area").attr("d", getLinkPath);
                })
                .on("end", function () {
                  d3.select(this)
                    .select("circle")
                    .attr("r", 5)
                    .classed("dragging", false);
                }) as any,
            )
            .on("contextmenu", (e) => {
              e.preventDefault();
              points.splice(idx, 1);
              updateFlowchart();
            });

          pointG
            .append("circle")
            .attr("r", 5)
            .attr("fill", "#fff")
            .attr("stroke", currentTheme.line)
            .attr("stroke-width", 2)
            .style("cursor", "move");
        });
      });
    }

    // --- Nodos ---
    const dragNode = d3
      .drag()
      .on("start", function (e) {
        if (panMode) return;
        d3.select(this).raise().classed("dragging", true);
      })
      .on("drag", function (e, d: any) {
        if (panMode) return;
        d.x = e.x;
        d.y = e.y;
        nodePositions.set(d.id, { x: d.x, y: d.y });
        d3.select(this).attr("transform", `translate(${d.x}, ${d.y})`);
        linkGroup.selectAll(".link-visible").attr("d", getLinkPath);
        linkGroup.selectAll(".link-hit-area").attr("d", getLinkPath);
      })
      .on("end", function () {
        if (panMode) return;
        d3.select(this).classed("dragging", false);
        updateFlowchart();
      });

    const nodeGroup = svgElement
      .append("g")
      .selectAll("g.node-group")
      .data(nodes)
      .join("g")
      .attr("class", "node-group")
      .attr("transform", (d) => `translate(${d.x}, ${d.y})`)
      .style("cursor", () => (panMode ? "grab" : "move"))
      .call(dragNode as any);

    nodeGroup.each(function (d: FlowNode) {
      const g = d3.select(this);
      const w = node_width;
      const h = getNodeHeight(d.text);

      let style = currentTheme.process;
      if (d.type === "start") style = currentTheme.start;
      else if (d.type === "end") style = currentTheme.end;
      else if (d.type === "decision") style = currentTheme.decision;

      const shadowFilter =
        "drop-shadow(0 4px 6px -1px rgba(0, 0, 0, 0.1)) drop-shadow(0 2px 4px -1px rgba(0, 0, 0, 0.06))";

      if (d.type === "decision") {
        g.append("path")
          .attr(
            "d",
            `M ${w / 2} 0 L ${w} ${h / 2} L ${w / 2} ${h} L 0 ${h / 2} Z`,
          )
          .attr("fill", style.fill)
          .attr("stroke", style.stroke)
          .attr("stroke-width", 2)
          .style("filter", shadowFilter);
      } else {
        const r = d.type === "start" || d.type === "end" ? h / 2 : 8;
        g.append("rect")
          .attr("rx", r)
          .attr("ry", r)
          .attr("width", w)
          .attr("height", h)
          .attr("fill", style.fill)
          .attr("stroke", style.stroke)
          .attr("stroke-width", 2)
          .style("filter", shadowFilter);
      }

      const textEl = g
        .append("text")
        .attr("x", w / 2)
        .attr("y", 0)
        .attr("text-anchor", "middle")
        .style("font-size", "14px")
        .style("font-family", "ui-sans-serif, system-ui, sans-serif")
        .style("fill", style.text)
        .style("pointer-events", "none");

      const lines = d.text.split("\n");
      const startY = (h - lines.length * 18) / 2 + 14;
      lines.forEach((line, i) => {
        textEl
          .append("tspan")
          .attr("x", w / 2)
          .attr("y", startY + i * 18)
          .text(line);
      });
    });
  }

  // --- EXPORTAR ---
  async function exportFlowchart(format: "png" | "jpg" | "svg" | "pdf") {
    if (!svg) return;
    showExportMenu = false;
    const originalTransform = svg.style.transform;
    svg.style.transform = "";
    const options = {
      backgroundColor: "#ffffff",
      style: { transform: "scale(1)" },
    };
    try {
      if (format === "png")
        download(await toPng(svg as any, options), "flow.png");
      else if (format === "jpg")
        download(await toJpeg(svg as any, options), "flow.jpg");
      else if (format === "svg")
        download(await toSvg(svg as any, options), "flow.svg");
      else if (format === "pdf") {
        const dataUrl = await toPng(svg as any, options);
        const pdf = new jsPDF({
          orientation: "l",
          unit: "px",
          format: [svg.clientWidth, svg.clientHeight],
        });
        pdf.addImage(dataUrl, "PNG", 0, 0, svg.clientWidth, svg.clientHeight);
        pdf.save("flow.pdf");
      }
    } catch (e) {
      console.error(e);
    }
    svg.style.transform = originalTransform;
  }

  function download(url: string, name: string) {
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
  }

  function toggleMode() {
    panMode = !panMode;
    if (svg)
      d3.selectAll(".node-group").style("cursor", panMode ? "grab" : "move");
  }

  $: if (
    flowchartNodes &&
    (flowchartNodes.length !== prevNodesLength || themeId)
  ) {
    prevNodesLength = flowchartNodes.length;
    setTimeout(updateFlowchart, 0);
  }

  onMount(() => {
    const ro = new ResizeObserver(() => updateFlowchart());
    if (container) ro.observe(container);
    return () => ro.disconnect();
  });
</script>

<svelte:window on:mousemove={handlePanMove} on:mouseup={handlePanEnd} />

<div
  class="w-full h-full flex flex-col relative group bg-neutral-50 dark:bg-neutral-900"
  bind:this={container}
>
  <div
    class="absolute top-4 left-4 z-20 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
  >
    <div class="relative">
      <button
        on:click={() => (showExportMenu = !showExportMenu)}
        class={btnToolClass}
      >
        <Download class="w-4 h-4" /> <span>Exportar</span>
      </button>
      {#if showExportMenu}
        <div
          class="absolute top-full mt-2 left-0 bg-white dark:bg-neutral-800 border dark:border-neutral-700 rounded-lg shadow-xl py-1 w-40 flex flex-col"
        >
          <button on:click={() => exportFlowchart("png")} class={menuItemClass}
            ><FileImage class="w-4 h-4 text-blue-500" /> PNG</button
          >
          <button on:click={() => exportFlowchart("svg")} class={menuItemClass}
            ><FileType class="w-4 h-4 text-orange-500" /> SVG</button
          >
          <button on:click={() => exportFlowchart("pdf")} class={menuItemClass}
            ><FileCode class="w-4 h-4 text-red-500" /> PDF</button
          >
        </div>
      {/if}
    </div>

    <button
      on:click={toggleMode}
      class={`${btnToolClass} ${!panMode ? btnToolActiveClass : ""}`}
    >
      {#if panMode}
        <Move class="w-4 h-4" /> <span>Navegar</span>
      {:else}
        <Hand class="w-4 h-4" /> <span>Editar</span>
      {/if}
    </button>
  </div>

  <div
    class="flex-1 overflow-hidden select-none"
    bind:this={canvasContainer}
    on:mousedown={handlePanStart}
  >
    <svg bind:this={svg} style="overflow: visible; width: 100%; height: 100%;"
    ></svg>
  </div>
</div>

<style>
  /* Aquí solo dejamos CSS nativo, sin dependencias de Tailwind */
  :global(.node-group) {
    transition: filter 0.2s;
  }
  :global(.node-group:hover) {
    filter: drop-shadow(0 6px 12px rgba(0, 0, 0, 0.15)) !important;
  }
  :global(.node-group.dragging) {
    cursor: grabbing !important;
    filter: drop-shadow(0 10px 20px rgba(0, 0, 0, 0.2)) !important;
  }

  :global(.link-visible) {
    transition: stroke-width 0.2s;
  }
  :global(.link-group:hover .link-visible) {
    stroke-width: 3px;
    stroke: #3b82f6;
  }
</style>
