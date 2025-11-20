<script lang="ts">
  import { onMount } from "svelte";
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

  let svg: SVGSVGElement;

  onMount(() => {
    const nodes: FlowNode[] = [
      createFlowNode("start", "Start", "start", ["input1"]),
      createFlowNode("input1", "Get Data", "input", ["process1"]),
      createFlowNode("process1", "Process Data", "process", ["decision"]),
      createFlowNode("decision", "Is Valid", "decision", [
        "process2a",
        "process2b",
      ]),
      createFlowNode("process2a", "Process A", "process", ["output1"]),
      createFlowNode("process2b", "Process B", "process", ["output1"]),
      createFlowNode("output1", "Save Data", "input", ["end"]),
      createFlowNode("end", "End", "end", []),
    ];

    const altura = 70;

    //metodo 1
    //var current = 0;
    //var next: string[] = [];
    //var same = 0;
    //for (var node of nodes) {
    //  const arr_n = node.targets.length;
    //  if (arr_n != 1) {
    //    next = node.targets;
    //  }
    //  current += altura;
    //  node.x += current;
    //  if (next.includes(node.id)) {
    //    if (same == 0) {
    //      same = node.x;
    //    }
    //    node.x = same;
    //    current = same;
    //  }
    //}

    //metodo 2

    nodes.forEach((n) => (n.x = 500));
    nodes.forEach((n) => (n.y = 0));
    var profundidad = 0;
    var next: string[] = [];

    for (var node of nodes) {
      if (!next.includes(node.id)) {
        profundidad += 1;
      }
      node.y = altura * profundidad;
      const arr_n = node.targets.length;
      if (arr_n != 1) {
        next = node.targets;
        profundidad += 1;
      }
    }

    var niveles: { [key: number]: typeof nodes } = {};

    nodes.forEach((n) => {
      if (!niveles[n.y]) niveles[n.y] = [];
      niveles[n.y].push(n);
    });

    for (var y in niveles) {
      var nodosEnNivel = niveles[y];
      var division = 1000 / (nodosEnNivel.length + 1);
      nodosEnNivel.forEach((n, index) => {
        n.x = division * (index + 1);
      });
    }

    //metodo 3
    //function asignarPosicionX(id: string, xPropuesto: number) {
    //  const node = nodes.find((n) => n.id === id);
    //  if (!node) return;
    //  if (node.x >= xPropuesto) {
    //    return;
    //  }
    //  node.x = xPropuesto;
    //  node.targets.forEach((targetId) => {
    //    asignarPosicionX(targetId, xPropuesto + altura);
    //  });
    //}
    //asignarPosicionX("start", 0);

    const links = [];
    for (const node of nodes) {
      for (const target of node.targets) {
        links.push({ source: node.id, target: target });
      }
    }

    const node_width = 120;

    const svgElement = d3
      .select(svg)
      .attr("width", 1300)
      .attr("height", profundidad * altura);

    svgElement
      .append("g")
      .selectAll("line")
      .data(links)
      .join("line")
      .attr("x1", (d) => {
        const sourceNode = nodes.find((n) => n.id === d.source)!;
        return sourceNode.x + node_width / 2; // Adjust based on shape
      })
      .attr("y1", (d) => nodes.find((n) => n.id === d.source)!.y + 20)
      .attr(
        "x2",
        (d) => nodes.find((n) => n.id === d.target)!.x + node_width / 2,
      )
      .attr("y2", (d) => nodes.find((n) => n.id === d.target)!.y + 20)
      .attr("stroke", "black")
      .attr("stroke-width", 2);

    // Draw nodes
    const nodeGroup = svgElement
      .append("g")
      .selectAll("g")
      .data(nodes)
      .join("g")
      .attr("transform", (d) => `translate(${d.x}, ${d.y})`);

    nodeGroup.each(function (d: FlowNode) {
      const group = d3.select(this);
      const width = node_width;
      const height = 40;

      switch (d.type) {
        case "start":
        case "end":
          group
            .append("rect")
            .attr("width", width)
            .attr("height", height)
            .attr("rx", height / 2)
            .attr("ry", height / 2)
            .attr("fill", "#f1c40f")
            .attr("stroke", "#f39c12")
            .attr("stroke-width", 2);
          break;
        case "input":
          group
            .append("path")
            .attr(
              "d",
              `M 20 0 L ${width} 0 L ${width - 20} ${height} L 0 ${height} Z`,
            )
            .attr("fill", "#3498db")
            .attr("stroke", "#2980b9")
            .attr("stroke-width", 2);
          break;
        case "decision":
          group
            .append("path")
            .attr(
              "d",
              `M ${width / 2} 0 L ${width} ${height / 2} L ${width / 2} ${height} L 0 ${height / 2} Z`,
            )
            .attr("fill", "#e74c3c")
            .attr("stroke", "#c0392b")
            .attr("stroke-width", 2);
          break;
        default: // process
          group
            .append("rect")
            .attr("width", width)
            .attr("height", height)
            .attr("fill", "#2ecc71")
            .attr("stroke", "#27ae60")
            .attr("stroke-width", 2);
      }
    });

    nodeGroup
      .append("text")
      .attr("x", 60)
      .attr("y", 25)
      .attr("text-anchor", "middle")
      .text((d: any) => d.text);
  });
</script>

<h1>Flowchart Mockup</h1>

<svg bind:this={svg}></svg>
