export interface FlowNode {
  id: string;
  text: string;
  x?: number;
  y?: number;
  type: "start" | "end" | "process" | "decision" | "input";
  targets: string[];
}

export interface NodeStyle {
  fill: string;
  stroke: string;
  text: string;
}

export interface FlowTheme {
  id: string;
  name: string;
  start: NodeStyle;
  end: NodeStyle;
  decision: NodeStyle;
  process: NodeStyle;
  line: string;
}