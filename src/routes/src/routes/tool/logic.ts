import { Parser, Language, type Node as SyntaxNode } from "web-tree-sitter";
import type { FlowNode } from "$lib/types";

export const LANGUAGES = [
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

export const THEMES = [
  { id: "default", name: "Clásico" },
  { id: "ocean", name: "Océano" },
  { id: "modern", name: "Moderno" },
  { id: "minimal", name: "Minimalista" },
];

export const exampleCodes: Record<string, string> = {
  c: `#include <stdio.h>\n\nint main() {\n    int i;\n    int sum = 0;\n    int count = 5;\n    \n    for (i = 0; i < count; i++) {\n        sum += i;\n        printf(\"%d\", i);\n    }\n    \n    printf(\"Total: %d\", sum);\n    printf(\"Done\");\n    return 0;\n}`,
  javascript: `let count = 0;\nwhile (count < 3) {\n  console.log(\"Looping...\");\n  count++;\n}\nconsole.log(\"Done.\");`,
  python: `x = 0\nwhile x < 5:\n    print(x)\n    x += 1\nprint(\"Done\")`,
  go: `package main\nimport \"fmt\"\n\nfunc main() {\n    sum := 0\n    count := 0\n    total := 10\n    \n    for i := 0; i < 5; i++ {\n        sum += i\n        count++\n        fmt.Println(i)\n    }\n    \n    fmt.Println(sum)\n    fmt.Println(count)\n    fmt.Println(\"Done\")\n}`,
  rust: `fn main() {\n    let mut n = 0;\n    while n < 5 {\n        println!(\"{}\", n);\n        n += 1;\n    }\n}`,
  java: `public class Main {\n    public static void main(String[] args) {\n        for (int i = 0; i < 5; i++) {\n            System.out.println(i);\n        }\n    }\n}`,
  cpp: `#include <iostream>\nint main() {\n    int x = 0;\n    while (x < 5) {\n        std::cout << x;\n        x++;\n    }\n    return 0;\n}`,
};

export function createFlowNode(
  id: string,
  text: string,
  type: FlowNode["type"],
  targets: string[],
): FlowNode {
  return { id, text, type, targets };
}

export function astToFlowNodes(
  rootNode: SyntaxNode,
  groupSequentialStatements: boolean,
): FlowNode[] {
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
      return text
        .split("\n")
        .map((line) => {
          let clean = line.replace(/\s+/g, " ").trim();
          if (clean.length > 30) return clean.substring(0, 27) + "...";
          return clean;
        })
        .join("\n");
    }
    let clean = text.replace(/\s+/g, " ").trim();
    if (clean.length > 25) return clean.substring(0, 22) + "...";
    return clean;
  }

  function isNodeComplex(n: SyntaxNode): boolean {
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
      ].includes(n.type)
    )
      return true;
    if (
      [
        "function_definition",
        "function_declaration",
        "method_declaration",
        "function_item",
      ].includes(n.type)
    )
      return true;
    if (
      n.type.includes("if_") ||
      n.type.includes("elif_") ||
      n.type === "if_expression" ||
      n.type === "if_statement"
    )
      return true;
    if (
      n.type.includes("while") ||
      n.type.includes("for") ||
      n.type === "loop_expression" ||
      n.type === "for_statement"
    )
      return true;
    if (n.type === "expression_statement") {
      const child = n.namedChildren[0];
      if (
        child &&
        (
          child.type.includes("if") ||
          child.type.includes("loop") ||
          child.type.includes("while") ||
          child.type.includes("for") ||
          child.type === "block" ||
          child.type === "compound_statement"
        )
      )
        return true;
    }
    return false;
  }

  function isNodeStatement(n: SyntaxNode): boolean {
    if (!n.isNamed) return false;
    if (n.type === "expression_statement") {
      const child = n.namedChildren[0];
      if (
        child &&
        (
          child.type.includes("if") ||
          child.type.includes("loop") ||
          child.type.includes("while") ||
          child.type.includes("for")
        )
      )
        return false;
      return true;
    }
    if (
      n.type === "declaration" ||
      n.type === "local_variable_declaration" ||
      n.type === "var_declaration" ||
      n.type === "const_declaration"
    )
      return true;
    if (
      n.type.endsWith("statement") ||
      n.type.endsWith("declaration") ||
      n.type === "call" ||
      n.type === "call_expression" ||
      n.type === "macro_invocation" ||
      n.type === "assignment_expression" ||
      n.type === "augmented_assignment" ||
      n.type === "inc_dec_expression" ||
      n.type === "short_var_declaration"
    )
      return true;
    if (n.type.endsWith("expression")) {
      if (n.type === "if_expression" || n.type === "loop_expression")
        return false;
      return true;
    }
    return false;
  }

  function walk(node: SyntaxNode, entryIds: string[]): string[] {
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
      const blockChild = node.namedChildren.find(
        (c: SyntaxNode) =>
          c.type.includes("block") ||
          c.type.includes("statement") ||
          c.type === "compound_statement",
      );
      if (blockChild) return walk(blockChild, entryIds);
      return entryIds;
    }

    if (node.type === "expression_statement") {
      const child = node.namedChildren[0];
      if (
        child &&
        (
          child.type.includes("if") ||
          child.type.includes("loop") ||
          child.type.includes("while") ||
          child.type.includes("for") ||
          child.type === "block" ||
          child.type === "compound_statement"
        )
      )
        return walk(child, entryIds);
    }

    if (
      ["if_statement", "elif_clause", "if_expression"].includes(node.type)
    ) {
      let currentEntryIds = entryIds;
      const init = node.childForFieldName("init");
      if (init) {
        const initId = getNewId("process");
        addNode(initId, cleanText(init.text), "process");
        connectNodes(currentEntryIds, initId);
        currentEntryIds = [initId];
      }
      let condition = node.childForFieldName("condition");
      let consequence = node.childForFieldName("consequence");
      if (!consequence)
        consequence = node.namedChildren.find(
          (c: SyntaxNode) =>
            c.type.includes("block") ||
            c.type.includes("statement") ||
            c.type === "compound_statement",
        );
      let alternative = node.childForFieldName("alternative");
      const decisionId = getNewId("decision");
      addNode(decisionId, cleanText(condition?.text ?? "?"), "decision");
      connectNodes(currentEntryIds, decisionId);
      let exitPaths: string[] = [];
      if (consequence) exitPaths.push(...walk(consequence, [decisionId]));
      else exitPaths.push(decisionId);
      if (alternative) exitPaths.push(...walk(alternative, [decisionId]));
      else exitPaths.push(decisionId);
      return Array.from(new Set(exitPaths));
    }

    const isLoop =
      node.type.includes("while") ||
      node.type.includes("for") ||
      node.type === "loop_expression" ||
      node.type === "for_statement" ||
      node.type === "for_clause";
    if (isLoop) {
      let currentEntryIds = entryIds;
      const forClause = node.namedChildren.find(
        (c: SyntaxNode) =>
          c.type === "for_clause" || c.type === "for_range_clause",
      );
      let initializer =
        node.childForFieldName("initializer") ||
        node.childForFieldName("init");
      if (forClause && !initializer)
        initializer =
          forClause.childForFieldName("initializer") ||
          forClause.childForFieldName("init");
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
        if (
          node.namedChildren.some(
            (c: SyntaxNode) => c.type === "for_range_clause",
          )
        )
          condText = "Range Loop";
        else condText = "true";
      }
      const decisionId = getNewId("decision");
      addNode(decisionId, condText, "decision");
      connectNodes(currentEntryIds, decisionId);
      let body =
        node.childForFieldName("body") ||
        node.childForFieldName("consequence");
      if (!body)
        body = node.namedChildren.find(
          (c: SyntaxNode) =>
            c.type.includes("block") ||
            c.type.includes("statement") ||
            c.type === "compound_statement",
          );
      let bodyExitIds: string[] = [];
      if (body) bodyExitIds = walk(body, [decisionId]);
      else bodyExitIds = [decisionId];
      let update =
        node.childForFieldName("update") || node.childForFieldName("post");
      if (forClause && !update)
        update =
          forClause.childForFieldName("update") ||
          forClause.childForFieldName("post");
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

    if (!node.isNamed) return entryIds;
    const isStatement = isNodeStatement(node) && !isNodeComplex(node);
    if (isStatement) {
      const processId = getNewId("process");
      addNode(processId, cleanText(node.text), "process");
      connectNodes(entryIds, processId);
      return [processId];
    }

    let currentEntryIds = entryIds;
    for (const child of node.namedChildren) {
      currentEntryIds = walk(child, currentEntryIds);
    }
    return currentEntryIds;
  }

  const startId = getNewId("start");
  addNode(startId, "Start", "start");
  const exitIds = walk(rootNode, [startId]);
  const endId = getNewId("end");
  addNode(endId, "End", "end");
  connectNodes(exitIds, endId);
  return nodes;
}
