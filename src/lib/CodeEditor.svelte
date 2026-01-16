<script lang="ts">
  import CodeMirror from "svelte-codemirror-editor";
  import { javascript } from "@codemirror/lang-javascript";
  import { python } from "@codemirror/lang-python";
  import { cpp } from "@codemirror/lang-cpp";
  import { java } from "@codemirror/lang-java";
  import { rust } from "@codemirror/lang-rust";
  import { go } from "@codemirror/lang-go";
  import { oneDark } from "@codemirror/theme-one-dark";

  export let code: string;
  export let languageId: string;

  function getLangExtension(langId: string) {
    switch (langId) {
      case "javascript": return javascript();
      case "python": return python();
      case "c": return cpp();
      case "cpp": return cpp();
      case "java": return java();
      case "rust": return rust();
      case "go": return go();
      default: return null;
    }
  }

  $: currentLangExtension = getLangExtension(languageId);
</script>

<div class="h-full w-full overflow-hidden text-sm border-t border-neutral-200 dark:border-neutral-700">
  <CodeMirror
    bind:value={code}
    lang={currentLangExtension}
    theme={oneDark}
    styles={{ 
      "&": { height: "100%", backgroundColor: "transparent" },
      ".cm-scroller": { overflow: "auto" }
    }}
  />
</div>