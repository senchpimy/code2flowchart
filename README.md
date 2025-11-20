# code2flowchart

A SvelteKit application designed to convert code into visual flowcharts using the power of Tree-sitter for robust code parsing. This project aims to help developers understand code logic more easily by providing a graphical representation of its flow.

## Features

*   **Code Parsing:** Utilizes Tree-sitter to accurately parse various programming languages.
*   **Flowchart Generation:** Converts parsed code structures into interactive flowcharts.
*   **Intuitive UI:** Built with SvelteKit for a smooth and responsive user experience.

## Technologies Used

*   **Frontend:** SvelteKit, TypeScript
*   **Package Manager:** Bun
*   **Code Parsing:** Tree-sitter (with WASM modules for C, C++, Go, Java, JavaScript, Python, Rust)
*   **Build Tool:** Vite

## Setup

To get this project up and running on your local machine, follow these steps:

### Prerequisites

Make sure you have [Bun](https://bun.sh/) installed.

```bash
# Install Bun (if you haven't already)
curl -fsSL https://bun.sh/install | bash
```

### Installation

1.  **Clone the repository:**

    ```bash
    git clone [YOUR_REPOSITORY_URL]
    cd code2flowchart
    ```

2.  **Install dependencies:**

    ```bash
    bun install
    ```

### Running the Development Server

Once the dependencies are installed, you can start the development server:

```bash
bun dev
```

This will start the SvelteKit development server, usually accessible at `http://localhost:5173`.

### Building the Project

To build the project for production, use:

```bash
bun build
```

The build output will be located in the `build/` directory (or as configured in `svelte.config.js`).

## Usage

(Once the application is running)

1.  Navigate to the application in your web browser.
2.  Input your code into the provided editor.
3.  Select the programming language.
4.  Observe the generated flowchart representing your code's logic.

## Project Structure

*   `src/`: Contains the SvelteKit application source code.
    *   `src/routes/`: SvelteKit pages and layouts.
    *   `src/lib/`: Reusable components and utility functions.
*   `static/wasm/`: WebAssembly modules for Tree-sitter parsers.
*   `svelte.config.js`: SvelteKit configuration.
*   `vite.config.ts`: Vite build tool configuration.
*   `tsconfig.json`: TypeScript configuration.
*   `package.json`: Project metadata and dependencies (managed by Bun).

## License

This project is licensed under the MIT License. See the `LICENSE` file for details.