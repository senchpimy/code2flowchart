<script lang="ts">
  import {
    Code2,
    Zap,
    Globe,
    Lock,
    Cpu,
    ArrowRight,
    CheckCircle2
  } from "lucide-svelte";
</script>

<svelte:head>
  <title>Code2Flowchart - Convierte Código en Diagramas de Flujo Gratis</title>
  <meta name="description" content="Visualiza tu lógica de programación al instante. Convierte JavaScript, Python, C, Go y más en diagramas de flujo claros y profesionales. Ideal para desarrolladores y estudiantes." />
  <meta name="keywords" content="código a diagrama de flujo, visualizador de código, flowchart generator, programación visual, javascript to flowchart, python to flowchart" />
</svelte:head>

<div class="min-h-screen bg-neutral-50 dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 font-sans">
  <!-- Header -->
  <header class="max-w-7xl mx-auto px-6 py-8 flex justify-between items-center">
    <div class="flex items-center gap-3">
      <div class="bg-orange-500 p-2 rounded-lg shadow-lg shadow-orange-500/20">
        <Code2 class="text-white w-6 h-6" />
      </div>
      <span class="text-2xl font-black tracking-tighter">Code2Flowchart</span>
    </div>
    <div class="hidden md:flex items-center gap-8 font-medium text-neutral-600 dark:text-neutral-400">
      <a href="#features" class="hover:text-orange-500 transition-colors">Características</a>
      <a href="#about" class="hover:text-orange-500 transition-colors">¿Por qué usarlo?</a>
      <a href="/tool" class="bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 px-5 py-2.5 rounded-full hover:scale-105 transition-all">Empezar ahora</a>
    </div>
  </header>

  <main>
    <!-- Hero Section -->
    <section class="max-w-7xl mx-auto px-6 py-20 md:py-32 text-center">
      <div class="inline-flex items-center gap-2 bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 px-4 py-1.5 rounded-full text-sm font-bold mb-8 animate-bounce">
        <Zap class="w-4 h-4" />
        <span>Nuevo: Soporte para Rust y Go</span>
      </div>
      <h1 class="text-5xl md:text-7xl font-black mb-6 tracking-tight leading-[1.1]">
        Visualiza tu <span class="text-orange-500">lógica</span><br />en segundos.
      </h1>
      <p class="text-xl text-neutral-600 dark:text-neutral-400 max-w-2xl mx-auto mb-12 leading-relaxed">
        La herramienta definitiva para desarrolladores que quieren convertir código complejo en diagramas de flujo claros, profesionales y visuales. Todo en tu navegador.
      </p>
      <div class="flex flex-col md:flex-row gap-4 justify-center items-center">
        <a href="/tool" class="group bg-orange-500 text-white px-8 py-4 rounded-2xl font-bold text-lg shadow-xl shadow-orange-500/25 hover:bg-orange-600 hover:-translate-y-1 transition-all flex items-center gap-2">
          Probar el editor gratis
          <ArrowRight class="w-5 h-5 group-hover:translate-x-1 transition-transform" />
        </a>
        <span class="text-sm font-medium text-neutral-400">Sin registros • 100% Privado • Open Source</span>
      </div>

      <!-- Preview Mockup -->
      <div class="mt-20 relative max-w-5xl mx-auto">
        <div class="absolute -inset-1 bg-gradient-to-r from-orange-500 to-purple-600 rounded-3xl blur opacity-20 dark:opacity-40"></div>
        <div class="relative bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-2xl shadow-2xl overflow-hidden aspect-[16/9] flex items-center justify-center">
           <div class="text-center p-8">
             <div class="flex justify-center gap-4 mb-6">
                <div class="w-12 h-12 bg-neutral-100 dark:bg-neutral-700 rounded-lg animate-pulse"></div>
                <div class="w-12 h-12 bg-neutral-100 dark:bg-neutral-700 rounded-lg animate-pulse delay-75"></div>
                <div class="w-12 h-12 bg-neutral-100 dark:bg-neutral-700 rounded-lg animate-pulse delay-150"></div>
             </div>
             <p class="font-bold text-neutral-400">Generando visualización profesional...</p>
             <a href="/tool" class="mt-4 inline-block text-orange-500 font-bold hover:underline">Ver ejemplo real &rarr;</a>
           </div>
        </div>
      </div>
    </section>

    <!-- Features Section -->
    <section id="features" class="bg-white dark:bg-neutral-800/50 py-24 border-y border-neutral-200 dark:border-neutral-700">
      <div class="max-w-7xl mx-auto px-6">
        <div class="text-center mb-16">
          <h2 class="text-3xl md:text-4xl font-bold mb-4">¿Por qué Code2Flowchart?</h2>
          <p class="text-neutral-600 dark:text-neutral-400">Diseñado para simplificar el flujo de trabajo de ingeniería.</p>
        </div>

        <div class="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
          <div class="p-8 bg-neutral-50 dark:bg-neutral-900 rounded-3xl border border-neutral-200 dark:border-neutral-700 hover:border-orange-500/50 transition-colors group">
            <div class="bg-orange-100 dark:bg-orange-900/30 p-4 rounded-2xl w-fit mb-6 group-hover:scale-110 transition-transform">
              <Zap class="w-6 h-6 text-orange-600 dark:text-orange-400" />
            </div>
            <h3 class="font-bold text-xl mb-3">Instantáneo</h3>
            <p class="text-neutral-600 dark:text-neutral-400 text-sm leading-relaxed">
              Escribe código y mira cómo el diagrama se dibuja en tiempo real. Sin esperas.
            </p>
          </div>

          <div class="p-8 bg-neutral-50 dark:bg-neutral-900 rounded-3xl border border-neutral-200 dark:border-neutral-700 hover:border-blue-500/50 transition-colors group">
            <div class="bg-blue-100 dark:bg-blue-900/30 p-4 rounded-2xl w-fit mb-6 group-hover:scale-110 transition-transform">
              <Globe class="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
            <h3 class="font-bold text-xl mb-3">Multilenguaje</h3>
            <p class="text-neutral-600 dark:text-neutral-400 text-sm leading-relaxed">
              Soporte para JavaScript, Python, C, Go, Rust, Java y C++.
            </p>
          </div>

          <div class="p-8 bg-neutral-50 dark:bg-neutral-900 rounded-3xl border border-neutral-200 dark:border-neutral-700 hover:border-green-500/50 transition-colors group">
            <div class="bg-green-100 dark:bg-green-900/30 p-4 rounded-2xl w-fit mb-6 group-hover:scale-110 transition-transform">
              <Lock class="w-6 h-6 text-green-600 dark:text-green-400" />
            </div>
            <h3 class="font-bold text-xl mb-3">Privado</h3>
            <p class="text-neutral-600 dark:text-neutral-400 text-sm leading-relaxed">
              Tu código nunca sale de tu navegador. Procesamiento local mediante WebAssembly.
            </p>
          </div>

          <div class="p-8 bg-neutral-50 dark:bg-neutral-900 rounded-3xl border border-neutral-200 dark:border-neutral-700 hover:border-purple-500/50 transition-colors group">
            <div class="bg-purple-100 dark:bg-purple-900/30 p-4 rounded-2xl w-fit mb-6 group-hover:scale-110 transition-transform">
              <Cpu class="w-6 h-6 text-purple-600 dark:text-purple-400" />
            </div>
            <h3 class="font-bold text-xl mb-3">Preciso</h3>
            <p class="text-neutral-600 dark:text-neutral-400 text-sm leading-relaxed">
              Basado en Tree-sitter (AST) para garantizar una representación lógica perfecta.
            </p>
          </div>
        </div>
      </div>
    </section>

    <!-- Content Section -->
    <section id="about" class="max-w-4xl mx-auto px-6 py-24">
      <h2 class="text-4xl font-black mb-12 text-center">Optimiza tu proceso de desarrollo</h2>
      
      <div class="space-y-16">
        <div class="grid md:grid-cols-2 gap-12 items-center">
          <div>
            <h3 class="text-2xl font-bold mb-4">¿Por qué usar diagramas de flujo?</h3>
            <p class="text-neutral-600 dark:text-neutral-400 leading-relaxed mb-6">
              Leer código línea por línea es agotador. Una representación visual te permite entender estructuras de control, bucles y condiciones de un vistazo.
            </p>
            <ul class="space-y-3">
              {#each ["Documenta algoritmos rápidamente", "Ideal para enseñar programación", "Detecta errores lógicos visualmente", "Mejora la comunicación en el equipo"] as item}
                <li class="flex items-center gap-3 text-sm font-medium">
                  <CheckCircle2 class="w-5 h-5 text-orange-500" />
                  {item}
                </li>
              {/each}
            </ul>
          </div>
          <div class="bg-neutral-200 dark:bg-neutral-800 rounded-3xl p-8 aspect-square flex items-center justify-center">
             <Code2 class="w-32 h-32 text-neutral-400 dark:text-neutral-600" />
          </div>
        </div>
      </div>
    </section>

    <!-- CTA Final -->
    <section class="max-w-7xl mx-auto px-6 py-24">
      <div class="bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 rounded-[3rem] p-12 md:p-24 text-center relative overflow-hidden">
        <div class="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_top_right,rgba(249,115,22,0.15),transparent)]"></div>
        <h2 class="text-4xl md:text-6xl font-black mb-8 relative z-10">¿Listo para visualizar?</h2>
        <p class="text-xl text-neutral-400 dark:text-neutral-500 mb-12 max-w-xl mx-auto relative z-10">
          Empieza a convertir tu código hoy mismo. Es gratis, rápido y no requiere cuenta.
        </p>
        <a href="/tool" class="inline-block bg-orange-500 text-white px-12 py-5 rounded-2xl font-bold text-xl hover:scale-105 transition-all relative z-10">
          Abrir Code2Flowchart
        </a>
      </div>
    </section>
  </main>

  <footer class="max-w-7xl mx-auto px-6 py-12 border-t border-neutral-200 dark:border-neutral-700 flex flex-col md:flex-row justify-between items-center gap-6">
    <div class="flex items-center gap-3 opacity-50">
      <Code2 class="w-5 h-5" />
      <span class="font-bold tracking-tighter">Code2Flowchart</span>
    </div>
    <p class="text-neutral-500 text-sm italic">© 2026 Code2Flowchart - Hecho para desarrolladores</p>
    <div class="flex gap-6 text-sm font-medium text-neutral-500">
      <a href="https://github.com" class="hover:text-orange-500 transition-colors">GitHub</a>
      <a href="#" class="hover:text-orange-500 transition-colors">Privacidad</a>
    </div>
  </footer>
</div>
