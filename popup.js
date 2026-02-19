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

        // Restore saved model or auto-select llama3 if available, or the first one
        const saved = await chrome.storage.local.get(['lastModel']);
        if (saved.lastModel && data.models.find(m => m.name === saved.lastModel)) {
            select.value = saved.lastModel;
        } else {
            const preferred = data.models.find(m => m.name.includes("llama3")) || data.models[0];
            if (preferred) select.value = preferred.name;
        }

    } catch (e) {
        select.innerHTML = '<option>Error connecting to Ollama</option>';
        document.getElementById('status').textContent = "Make sure Ollama is running!";
    }
}

// Restore saved preferences
async function restorePreferences() {
    const saved = await chrome.storage.local.get(['lastStrategy', 'lastExpandGroups']);
    
    if (saved.lastStrategy) {
        document.getElementById('strategySelect').value = saved.lastStrategy;
    }
    
    if (saved.lastExpandGroups !== undefined) {
        document.getElementById('expandGroupsCheckbox').checked = saved.lastExpandGroups;
    }
}

// Save preference when changed
function savePreference(key, value) {
    chrome.storage.local.set({ [key]: value });
}

// Run immediately
fetchModels();
restorePreferences();

// Listen for changes to save preferences
document.getElementById('modelSelect').addEventListener('change', (e) => {
    savePreference('lastModel', e.target.value);
});

document.getElementById('strategySelect').addEventListener('change', (e) => {
    savePreference('lastStrategy', e.target.value);
});

document.getElementById('expandGroupsCheckbox').addEventListener('change', (e) => {
    savePreference('lastExpandGroups', e.target.checked);
});

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
        // Map index to tab ID for grouping
        const indexToIdMap = [];

        // Fetch existing groups if expansion is enabled
        let existingGroups = [];
        if (shouldExpandGroups) {
            statusEl.textContent = "Checking existing groups...";
            existingGroups = await getExistingGroups();
        }

        // 3. Loop tabs and grab context
        let tabIndex = 0;
        const processingPromises = tabs.map(async (t) => {
            // Skip chrome:// URLs or empty ones
            if (t.url.startsWith("chrome://") || !t.title) return;

            const cleanTitle = t.title.trim();
            const cleanUrl = t.url || "";
            const currentIndex = tabIndex++;
            
            // Add to AI list with index
            if (isFull) {
                const description = await getPageDescription(t.id);
                tabsForAi.push({
                    index: currentIndex,
                    title: cleanTitle,
                    url: cleanUrl,
                    description: description || ""
                });
            } else {
                tabsForAi.push({
                    index: currentIndex,
                    title: cleanTitle,
                    url: cleanUrl
                });
            }

            // Store tab ID by index
            indexToIdMap[currentIndex] = t.id;
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
                    ? `\n\nEXISTING GROUPS (already organized - for reference only):\n${JSON.stringify(existingGroups, null, 2)}\n\nYou are organizing the tabs in TAB DATA. You may create new groups or match existing group titles if appropriate.`
                    : "";
                
                if (strategyKey === "simple") {
                        prompt = `
                        You are a professional Information Architect.
                        Group tabs that share clear topical relationships based on title and URL.

                        TAB DATA (JSON):
                        ${JSON.stringify(tabsForAi)}
                        ${groupsContext}

                        INSTRUCTIONS:
                        1. Only group tabs when they share a clear topic. It's better to leave tabs ungrouped than force unrelated tabs together.
                        2. Each group needs at least 2 tabs. Don't create single-tab groups.
                        3. Keep group names short (1-3 words) and topic-focused.
                        4. Return raw JSON only - do NOT wrap in markdown code blocks. Format: {"Group Name": [index1, index2]}
                        5. Omit tabs that don't fit any group.

                        Example Input:
                        [
                            {"index": 0, "title": "BBC News - Politics", "url": "https://www.bbc.com/news/politics"},
                            {"index": 1, "title": "GitHub - My Project", "url": "https://github.com/user/project"},
                            {"index": 2, "title": "The Guardian - Politics", "url": "https://www.theguardian.com/politics"},
                            {"index": 3, "title": "Random Article", "url": "https://example.com/random"}
                        ]

                        Example Output:
                        {"Politics News": [0, 2]}
                        `;
                } else if (strategyKey === "medium") {
                        prompt = `
                        You are a professional Information Architect.
                        Identify tabs with shared topics or intent using title and URL analysis.

                        TAB DATA (JSON):
                        ${JSON.stringify(tabsForAi)}
                        ${groupsContext}

                        INSTRUCTIONS:
                        1. ONLY group tabs when they share a clear topical or intentional relationship.
                        2. It's BETTER to leave tabs ungrouped than to force unrelated tabs together.
                        3. Each group should contain at least 2 tabs (preferably 3+). Don't create single-tab groups.
                        4. Prefer grouping by topic/content over website name. Use title clues to understand what each tab is actually about.
                        5. If many tabs from one site cover different topics (e.g., YouTube videos about cooking vs tech), split them by topic.
                        6. Website-based grouping is OK for small groups (2-3 tabs) when no better topical grouping exists.
                        7. For groups larger than 8 tabs, split into more specific sub-topics if possible.
                        8. Keep group names short (1-3 words), topic-focused, and use emojis when appropriate (e.g., "🛠️ Dev Tools").
                        9. Return raw JSON only - do NOT wrap in markdown code blocks or backticks.
                        10. Output format: map group names to arrays of tab indices (numbers).
                        11. Tabs that don't fit any group should simply be omitted from the output.

                        Example Input:
                        [
                            {"index": 0, "title": "React Hooks Documentation", "url": "https://react.dev"},
                            {"index": 1, "title": "useEffect Best Practices", "url": "https://react.dev"},
                            {"index": 2, "title": "How to Make Pasta Carbonara", "url": "https://youtube.com/watch?v=123"},
                            {"index": 3, "title": "Italian Cooking Basics", "url": "https://cooking.com/italian"},
                            {"index": 4, "title": "Dog Training Tips", "url": "https://youtube.com/watch?v=456"},
                            {"index": 5, "title": "Random News Article", "url": "https://news.com/article"}
                        ]

                        Example Output:
                        {
                            "📚 React": [0, 1],
                            "🍳 Italian Cooking": [2, 3]
                        }
                        Note: Tabs 4 and 5 are left ungrouped - not enough related content to form meaningful groups.
                        `;
                } else {
                        prompt = `
                        You are a professional Information Architect.
                        Use deep context from title, URL, and description to identify tabs that belong to the same project, workflow, or research topic.

                        TAB DATA (JSON):
                        ${JSON.stringify(tabsForAi)}
                        ${groupsContext}

                        INSTRUCTIONS:
                        1. ONLY group tabs when they share a clear project, workflow, or deep topical relationship.
                        2. It's BETTER to leave tabs ungrouped than to force unrelated tabs together.
                        3. Each group should contain at least 2 tabs (preferably 3+). Don't create single-tab groups.
                        4. Prefer grouping by project/topic/intent over website name. Use descriptions to understand the real purpose.
                        5. If many tabs from one site serve different projects or purposes, split them by project/intent.
                        6. Website-based grouping is OK for small groups (2-3 tabs) when no better project/workflow grouping exists.
                        7. Look for workflow patterns: tabs that serve the same research goal, project phase, or task.
                        8. For groups larger than 8 tabs, consider if they represent distinct sub-projects or phases.
                        9. Keep group names short (1-3 words), project/intent-focused, and use emojis appropriately (e.g., "🛠️ Dev Setup").
                        10. Return raw JSON only - do NOT wrap in markdown code blocks or backticks.
                        11. Output format: map group names to arrays of tab indices (numbers).
                        12. Tabs that don't fit any group should simply be omitted from the output.

                        Example Input:
                        [
                            {"index": 0, "title": "Q1 Architecture Notes", "url": "https://docs.company.com", "description": "System design decisions for the new microservices platform"},
                            {"index": 1, "title": "Microservices Book", "url": "https://amazon.com/microservices", "description": "Book about building microservices architecture"},
                            {"index": 2, "title": "Competitor Analysis", "url": "https://sheets.google.com", "description": "Spreadsheet comparing pricing models of top 5 competitors"},
                            {"index": 3, "title": "User Survey Q1", "url": "https://typeform.com/results", "description": "Customer feedback and market research findings"},
                            {"index": 4, "title": "Vacation Photos", "url": "https://photos.google.com", "description": "Personal vacation photos from last summer"},
                            {"index": 5, "title": "Random Recipe", "url": "https://cooking.com", "description": "Quick dinner recipe for tonight"}
                        ]

                        Example Output:
                        {
                            "🏗️ Microservices": [0, 1],
                            "📊 Market Research": [2, 3]
                        }
                        Note: Tabs 4 and 5 are left ungrouped - they don't relate to any work project or shared topic.
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
        for (const [groupName, indices] of Object.entries(groupings)) {
            const idsToGroup = [];
            
            // Ensure indices is an array
            if (Array.isArray(indices)) {
                indices.forEach(index => {
                    if (indexToIdMap[index] !== undefined) {
                        idsToGroup.push(indexToIdMap[index]);
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