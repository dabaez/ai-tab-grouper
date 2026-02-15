// 1. Fetch available models from Ollama when popup opens
async function fetchModels() {
    const select = document.getElementById('modelSelect');
    try {
        const response = await fetch('http://localhost:11434/api/tags');
        const data = await response.json();
        
        select.innerHTML = ''; // Clear "Loading..."
        
        data.models.forEach(model => {
            const option = document.createElement('option');
            option.value = model.name;
            option.textContent = model.name;
            select.appendChild(option);
        });

        // Optional: auto-select llama3 if available, or the first one
        const preferred = data.models.find(m => m.name.includes("llama3")) || data.models[0];
        if (preferred) select.value = preferred.name;

    } catch (e) {
        select.innerHTML = '<option>Error connecting to Ollama</option>';
        document.getElementById('status').textContent = "Make sure Ollama is running!";
    }
}

// Run immediately
fetchModels();

// Fetch existing tab groups
async function getExistingGroups() {
    try {
        const groups = await chrome.tabGroups.query({ windowId: chrome.windows.WINDOW_ID_CURRENT });
        const groupsWithTabs = [];
        
        for (const group of groups) {
            const tabs = await chrome.tabs.query({ groupId: group.id });
            const tabTitles = tabs.map(t => t.title).filter(Boolean);
            groupsWithTabs.push({
                id: group.id,
                title: group.title || "Unnamed Group",
                color: group.color,
                collapsed: group.collapsed,
                tabs: tabTitles
            });
        }
        
        return groupsWithTabs;
    } catch (e) {
        console.error("Error fetching groups:", e);
        return [];
    }
}

async function getPageDescription(tabId) {
    try {
        const results = await chrome.scripting.executeScript({
            target: { tabId },
            func: () => {
                const meta = document.querySelector('meta[name="description"], meta[property="og:description"]');
                const metaText = meta && meta.content ? meta.content.trim() : "";
                const keywords = document.querySelector('meta[name="keywords"]');
                const keywordText = keywords && keywords.content ? keywords.content.trim() : "";
                const h1 = document.querySelector('h1');
                const h1Text = h1 && h1.innerText ? h1.innerText.trim() : "";
                const p = document.querySelector('main p, article p, p');
                const pText = p && p.innerText ? p.innerText.trim() : "";
                const combined = [metaText, h1Text, pText, keywordText].filter(Boolean).join(" | ");
                const maxLen = 320;
                if (combined.length <= maxLen) return combined;
                return combined.slice(0, maxLen).trim() + "...";
            }
        });

        return (results && results[0] && results[0].result) ? results[0].result : "";
    } catch (e) {
        return "";
    }
}

document.getElementById('groupBtn').addEventListener('click', async () => {
    const statusEl = document.getElementById('status');
    const modelName = document.getElementById('modelSelect').value;
    const strategyKey = document.getElementById('strategySelect').value || "medium";
    const shouldExpandGroups = document.getElementById('expandGroupsCheckbox').checked;
    const btn = document.getElementById('groupBtn');

    if (!modelName) {
        statusEl.textContent = "Please select a model first.";
        return;
    }

    try {
        btn.disabled = true;
        statusEl.textContent = "Scraping page context...";

        const tabs = await chrome.tabs.query({ currentWindow: true });
        const isFull = strategyKey === "full";
        
        // Data structure for the AI
        const tabsForAi = [];
        // Map to find tab ID later
        const titleToIdMap = {};

        // Fetch existing groups if expansion is enabled
        let existingGroups = [];
        if (shouldExpandGroups) {
            statusEl.textContent = "Checking existing groups...";
            existingGroups = await getExistingGroups();
        }

        // 3. Loop tabs and grab context
        const processingPromises = tabs.map(async (t) => {
            // Skip chrome:// URLs or empty ones
            if (t.url.startsWith("chrome://") || !t.title) return;

            const cleanTitle = t.title.trim();
            const cleanUrl = t.url || "";
            
            // Add to AI list
            if (isFull) {
                const description = await getPageDescription(t.id);
                tabsForAi.push({
                    title: cleanTitle,
                    url: cleanUrl,
                    description: description || ""
                });
            } else {
                tabsForAi.push({
                    title: cleanTitle,
                    url: cleanUrl
                });
            }

            // Add to Map
            if (!titleToIdMap[cleanTitle]) {
                titleToIdMap[cleanTitle] = [];
            }
            titleToIdMap[cleanTitle].push(t.id);
        });

        await Promise.all(processingPromises);

        if (tabsForAi.length === 0) {
            statusEl.textContent = "No valid tabs to group.";
            btn.disabled = false;
            return;
        }

        statusEl.textContent = "Thinking...";

                let prompt = "";
                const groupsContext = shouldExpandGroups && existingGroups.length > 0 
                    ? `\n\nEXISTING GROUPS:\n${JSON.stringify(existingGroups, null, 2)}\n\nYou may add tabs to existing groups by using their exact title, or create new groups.`
                    : "";
                
                if (strategyKey === "simple") {
                        prompt = `
                        You are a professional Information Architect.
                        Group tabs into a few simple, broad buckets based only on title and URL.

                        TAB DATA (JSON):
                        ${JSON.stringify(tabsForAi)}
                        ${groupsContext}

                        INSTRUCTIONS:
                        1. Create logical groups with good distribution (aim for 2-5 tabs, but allow 1-2 for focused categories or larger if many tabs naturally belong together).
                        2. Ensure every tab is assigned to a group.
                        3. Favor obvious site or high-level category groupings.
                        4. Keep group names short (1-3 words).
                        5. Return ONLY a valid JSON object mapping group name to tab titles.

                        Example Input:
                        [
                            {"title": "BBC News - Home", "url": "https://www.bbc.com/news"},
                            {"title": "GitHub - Repository", "url": "https://github.com/user/project"},
                            {"title": "The Guardian", "url": "https://www.theguardian.com"}
                        ]

                        Example Output:
                        {
                            "News": ["BBC News - Home", "The Guardian"],
                            "Work": ["GitHub - Repository"]
                        }
                        `;
                } else if (strategyKey === "medium") {
                        prompt = `
                        You are a professional Information Architect.
                        Group tabs by topics and intent based only on title and URL.

                        TAB DATA (JSON):
                        ${JSON.stringify(tabsForAi)}
                        ${groupsContext}

                        INSTRUCTIONS:
                        1. Create logical groups with good distribution (aim for 2-5 tabs, but allow 1-2 for focused categories or larger if many tabs naturally belong together).
                        2. Ensure every tab is assigned to a group.
                        3. Do NOT group purely by site; use title clues to infer topic.
                        4. Split mixed-topic sites into different groups when intent differs.
                        5. Keep group names short (1-3 words) and use emojis when appropriate (e.g., "🛠️ Dev Tools").
                        6. Return ONLY a valid JSON object mapping group name to tab titles.

                        Example Input:
                        [
                            {"title": "React Hooks Documentation", "url": "https://react.dev"},
                            {"title": "useEffect Best Practices", "url": "https://react.dev/reference/react/useEffect"},
                            {"title": "Pasta Carbonara Recipe", "url": "https://cooking.com/recipes/carbonara"},
                            {"title": "JavaScript Async/Await", "url": "https://developer.mozilla.org/async"}
                        ]

                        Example Output:
                        {
                            "📚 React": ["React Hooks Documentation", "useEffect Best Practices"],
                            "🍳 Cooking": ["Pasta Carbonara Recipe"],
                            "💻 JavaScript": ["JavaScript Async/Await"]
                        }
                        `;
                } else {
                        prompt = `
                        You are a professional Information Architect.
                        Group tabs using deep context from title, URL, and description.

                        TAB DATA (JSON):
                        ${JSON.stringify(tabsForAi)}
                        ${groupsContext}

                        INSTRUCTIONS:
                        1. Create logical groups with good distribution (aim for 2-5 tabs, but allow 1-2 for focused categories or larger if many tabs naturally belong together).
                        2. Ensure every tab is assigned to a group.
                        3. Use descriptions to infer tasks, projects, and workflows.
                        4. Create precise, non-overlapping groups.
                        5. If intent differs, separate even if the site is the same.
                        6. Keep group names short (1-3 words) and use emojis when appropriate (e.g., "🛠️ Dev Tools").
                        7. Return ONLY a valid JSON object mapping group name to tab titles.

                        Example Input:
                        [
                            {"title": "Q1 Architecture Notes", "url": "https://docs.company.com", "description": "System design decisions for the new microservices platform"},
                            {"title": "Building Better Apps", "url": "https://amazon.com/Building-Better-Apps", "description": "Book about application architecture patterns"},
                            {"title": "Competitor Pricing Analysis", "url": "https://sheets.google.com", "description": "Spreadsheet comparing pricing models of top 5 competitors"},
                            {"title": "User Survey Results Q1", "url": "https://typeform.com/results", "description": "Customer feedback and market research findings"}
                        ]

                        Example Output:
                        {
                            "🏗️ Build Plan": ["Q1 Architecture Notes", "Building Better Apps"],
                            "📊 Market Research": ["Competitor Pricing Analysis", "User Survey Results Q1"]
                        }
                        `;
                }

        console.log("Prompt sent to Ollama:", prompt);

        // 5. Send to Ollama
        const response = await fetch('http://localhost:11434/api/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: modelName,
                prompt: prompt,
                stream: false,
                format: "json",
                options: { temperature: 0.2 }
            })
        });

        if (!response.ok) throw new Error("Ollama connection failed");

        const data = await response.json();
        statusEl.textContent = "Grouping...";

        console.log("Raw response from Ollama:", data);

        // 6. Parse and Group
        let groupings = {};
        try {
            groupings = JSON.parse(data.response);
        } catch (e) {
            // Fallback for models that wrap response in a "response" key
            const temp = JSON.parse(data.response);
            if (temp.response) groupings = temp.response;
            else groupings = temp;
        }

        // Apply groups
        for (const [groupName, titles] of Object.entries(groupings)) {
            const idsToGroup = [];
            
            // Ensure titles is an array
            if (Array.isArray(titles)) {
                titles.forEach(title => {
                    if (titleToIdMap[title] && titleToIdMap[title].length > 0) {
                        idsToGroup.push(titleToIdMap[title].shift());
                    }
                });
            }

            if (idsToGroup.length > 0) {
                // Check if this is an existing group we should expand
                const existingGroup = existingGroups.find(g => g.title === groupName);
                
                if (existingGroup && shouldExpandGroups) {
                    // Add tabs to existing group
                    await chrome.tabs.group({ 
                        tabIds: idsToGroup,
                        groupId: existingGroup.id
                    });
                } else {
                    // Create new group
                    const groupId = await chrome.tabs.group({ tabIds: idsToGroup });
                    await chrome.tabGroups.update(groupId, { 
                        title: groupName,
                        collapsed: false 
                    });
                }
            }
        }

        statusEl.textContent = "Done!";

    } catch (err) {
        console.error(err);
        statusEl.textContent = "Error: " + err.message;
    } finally {
        btn.disabled = false;
    }
});