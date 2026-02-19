# Tab Grouper

Groups open browser tabs using local AI via Ollama. All processing happens locally.

## What it does

- Analyzes your open tabs using a local Ollama model
- Identifies tabs that share clear topical relationships
- Creates browser tab groups only when there's genuine clustering
- Leaves unrelated tabs ungrouped (not everything needs a group!)

## Philosophy

This extension focuses on **meaningful grouping** over forced organization:
- Only creates groups when tabs genuinely relate to each other
- Prefers topical clustering over lazy website-based grouping
- Leaves tabs ungrouped if they don't fit anywhere
- Requires at least 2 tabs to form a group (no single-tab groups)

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
4. (Optional) Check "Expand existing groups" to add tabs to current groups
5. Click "Group Tabs"

Your preferences (model, strategy, expand setting) are automatically saved.

## Grouping strategies

**Simple**: Fast, basic topical clustering using titles and URLs. Good for quick organization.

**Medium**: Analyzes titles and URLs to infer intent. Splits tabs from the same site by actual topic (e.g., YouTube videos about cooking vs tech tutorials).

**Full**: Uses page descriptions for deep context. Identifies workflows and projects. Slower but best for complex research sessions.

**All strategies:**
- Only group tabs with clear topical relationships
- Require at least 2 tabs per group
- Leave unrelated tabs ungrouped
- Prefer topic-based over site-based grouping

## Features

- **Smart clustering**: Only groups when there's genuine topical similarity
- **Saved preferences**: Remembers your last model and strategy choice
- **Expand existing groups**: Add new tabs to your current groups
- **Local processing**: All AI processing happens on your machine
- **Index-based matching**: Handles duplicate tab titles correctly

## How it works

1. Collects open tabs with index, title, URL, and optionally page content
2. Sends data to local Ollama model with smart prompts
3. AI returns groups of tab indices (only tabs with clear relationships)
4. Creates browser tab groups with descriptive names
5. Tabs without clear grouping remain ungrouped

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

**Not all tabs were grouped**
- This is intentional! The extension only groups tabs with clear topical relationships
- Ungrouped tabs didn't have enough related content to form meaningful groups
- Try the Full strategy for more nuanced grouping, or manually organize remaining tabs

**Grouping isn't working well**
- Try a different model (larger models like `llama3` often perform better)
- Try a different strategy (Full is most accurate but slower)
- Check the browser console (F12) for errors
