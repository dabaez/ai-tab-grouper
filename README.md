# 🤖 Local AI Tab Grouper Pro

A Chromium extension that intelligently groups your browser tabs using AI. Powered by **Ollama**, all processing happens locally on your machine.

## ✨ Features

- **Local AI Processing**: Uses Ollama for on-device AI inference (no cloud, no data tracking)
- **Smart Tab Grouping**: Analyzes page content and context to organize tabs logically
- **Multiple Organization Strategies**:
  - **Simple**: Groups by broad topics
  - **Medium**: Groups by topics + user intent (recommended)
  - **Full**: Deep context analysis + workflow detection
- **Model Selection**: Choose from any installed Ollama model
- **Zero Configuration**: Works out of the box after Ollama setup

## 📋 Requirements

- **Chromium-based browser** (Chrome, Edge, Brave, etc.)
- **Ollama** installed and running locally
- At least one LLM model installed in Ollama (e.g., `llama2`, `mistral`, `neural-chat`)

## 🚀 Quick Start

### 1. Install Ollama

Download and install Ollama from [ollama.ai](https://ollama.ai)

### 2. Configure Ollama for CORS

The extension needs to communicate with Ollama across origins. You must set the `OLLAMA_ORIGINS` environment variable before starting Ollama.

#### **On macOS/Linux:**

```bash
# Start Ollama with the required CORS configuration
OLLAMA_ORIGINS="*" ollama serve
```

#### **On Windows (PowerShell):**

```powershell
$env:OLLAMA_ORIGINS="*"
ollama serve
```

#### **On Windows (Command Prompt):**

```cmd
set OLLAMA_ORIGINS=*
ollama serve
```

**Or**, set it as a persistent environment variable in your system settings:
- **macOS**: Add to `~/.zshrc` or `~/.bash_profile`:
  ```bash
  export OLLAMA_ORIGINS="*"
  ```
- **Linux**: Add to `~/.bashrc` or `~/.zshenv`:
  ```bash
  export OLLAMA_ORIGINS="*"
  ```
- **Windows**: Use System Properties → Environment Variables (restart required)

### 3. Pull a Model

```bash
ollama pull llama2
# or choose another model
ollama pull mistral
ollama pull neural-chat
```

### 4. Install the Extension

#### Chrome/Edge/Brave:

1. Open your browser's extension page:
   - Chrome: `chrome://extensions`
   - Edge: `edge://extensions`
   - Brave: `brave://extensions`

2. Enable **Developer mode** (toggle in top-right corner)

3. Click **"Load unpacked"** and select this repository folder

4. The extension icon should appear in your toolbar

### 5. Start Grouping!

1. Make sure Ollama is running with `OLLAMA_ORIGINS="*"` set
2. Click the extension icon in your toolbar
3. Select your preferred model and organization strategy
4. Click **✨ Group Tabs** to organize all open tabs in the current window

## 🎯 How It Works

1. **Tab Analysis**: The extension reads metadata and content from each open tab
2. **Context Extraction**: Pulls titles, descriptions, keywords, and snippets
3. **AI Processing**: Sends contextualized summaries to your local Ollama model
4. **Grouping**: Creates tab groups based on the AI's analysis
5. **Local Privacy**: All data stays on your machine—nothing is sent to external servers

## 🛠️ Usage Tips

- **Organization Strategies**:
  - Use **Simple** for quick organization when you have many tabs
  - Use **Medium** for balanced accuracy and speed (recommended for most users)
  - Use **Full** for complex workflows with deep context requirements

- **Performance**: Grouping speed depends on your hardware and model size. Larger models produce better results but take longer.

## 🔧 Troubleshooting

### "Error connecting to Ollama"

- ✅ Make sure Ollama is running
- ✅ Verify it's started with `OLLAMA_ORIGINS="*"`:
  ```bash
  ps aux | grep ollama
  # Look for OLLAMA_ORIGINS in the process output
  ```
- ✅ Check that Ollama is accessible at `http://localhost:11434`
- ✅ Try `curl http://localhost:11434/api/tags` in a terminal to test the connection

### "No models found"

- ✅ Pull at least one model: `ollama pull llama2`
- ✅ List installed models: `ollama list`

### Extension doesn't appear in toolbar

- ✅ Make sure Developer mode is enabled on the extensions page
- ✅ Try removing and re-adding the extension
- ✅ Restart your browser

### Tabs aren't grouping correctly

- ✅ Try a different model (larger models usually produce better results)
- ✅ Try the **Full** organization strategy for complex tabs
- ✅ Check the browser console (F12) for any error messages

## 📦 Installation for Development

Clone the repository and load it as an unpacked extension:

```bash
git clone https://github.com/yourusername/ai-tab-grouper.git
cd ai-tab-grouper
```

Then follow the "Install the Extension" steps above, selecting this folder.
