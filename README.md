# Tab Grouper

Groups open browser tabs using local AI via Ollama. All processing happens locally.

## What it does

- Takes your open tabs and sends them to a local Ollama model
- Groups tabs by topic and intent based on page titles and content
- Creates browser tab groups for you to organize

## Requirements

- Chromium-based browser (Chrome, Edge, Brave, etc.)
- Ollama installed and running locally
- At least one LLM model installed (e.g., `llama2`, `mistral`, `neural-chat`)

## Setup

### 1. Install and configure Ollama

Download Ollama from [ollama.ai](https://ollama.ai) and set the CORS environment variable before running it.

On macOS/Linux:
```bash
OLLAMA_ORIGINS="*" ollama serve
```

On Windows (PowerShell):
```powershell
$env:OLLAMA_ORIGINS="*"
ollama serve
```

To make this permanent, add to your shell config:
- macOS/Linux: Add `export OLLAMA_ORIGINS="*"` to `~/.zshrc` or `~/.bash_profile`
- Windows: Set as an environment variable in System Properties

### 2. Pull a model

```bash
ollama pull llama2
```

Other options: `mistral`, `neural-chat`, etc.

### 3. Install the extension

1. Go to your browser's extensions page:
   - Chrome: `chrome://extensions`
   - Edge: `edge://extensions`
   - Brave: `brave://extensions`

2. Enable Developer mode

3. Click "Load unpacked" and select this folder

### 4. Use it

1. Make sure Ollama is running
2. Click the extension icon
3. Select a model and strategy
4. Click "Group Tabs"

## Grouping strategies

**Simple**: Groups by broad topics based on site name.

**Medium**: Groups by topic and intent using page titles. Better than Simple for mixed-content sites.

**Full**: Uses page descriptions for deeper context. Slower but catches nuance better.

All strategies aim for good distribution (typically 2-5 tabs per group, but will create single-tab groups for distinct categories or larger groups if many tabs naturally belong together).

## How it works

1. Reads open tabs (title, URL, and optionally page content)
2. Sends to local Ollama model
3. Parses AI response into groups
4. Creates browser tab groups

## Troubleshooting

**"Error connecting to Ollama"**
- Make sure Ollama is running with `OLLAMA_ORIGINS="*"`
- Verify with: `curl http://localhost:11434/api/tags`

**"No models found"**
- Run `ollama pull llama2`
- Check installed models with: `ollama list`

**Extension doesn't appear**
- Make sure Developer mode is enabled
- Try removing and re-adding the extension

**Grouping isn't working well**
- Try a different model or strategy
- Check the browser console (F12) for errors
