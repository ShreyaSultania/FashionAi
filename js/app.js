// DOM Elements
const chatForm = document.getElementById('chat-form');
const userInput = document.getElementById('user-input');
const chatMessages = document.getElementById('chat-messages');
const lookbookCarousel = document.getElementById('lookbook-carousel');
const carouselControls = document.getElementById('carousel-controls');
const carouselIndicators = document.getElementById('carousel-indicators');
const prevBtn = document.getElementById('prev-btn');
const nextBtn = document.getElementById('next-btn');
const themeToggle = document.getElementById('theme-toggle');
const filterBtns = document.querySelectorAll('.filter-btn');

// State
let outfits = [];
let currentOutfitIndex = 0;
let userPreferences = {
    style: '',
    colorPalette: '',
    season: '',
    occasion: '',
    gender: ''
};
let isLoading = false;
let chatHistory = [];

// Constants
const API_URL = "https://generativelanguage.googleapis.com/v1/models/gemini-2.0-flash:generateContent";
// API key is now set
const API_KEY = "AIzaSyCSRgwsQP4tyLUWa_WQiqwTd_Nznxl_3Ow";

// Event Listeners
document.addEventListener('DOMContentLoaded', initializeApp);
chatForm.addEventListener('submit', handleChatSubmit);
prevBtn.addEventListener('click', showPreviousOutfit);
nextBtn.addEventListener('click', showNextOutfit);
themeToggle.addEventListener('click', toggleTheme);
filterBtns.forEach(btn => btn.addEventListener('click', handleFilterClick));

// Functions
function initializeApp() {
    // Check for saved theme preference
    if (localStorage.getItem('theme') === 'dark') {
        document.body.classList.add('dark-theme');
    }
}

function toggleTheme() {
    document.body.classList.toggle('dark-theme');
    // Save preference
    if (document.body.classList.contains('dark-theme')) {
        localStorage.setItem('theme', 'dark');
    } else {
        localStorage.setItem('theme', 'light');
    }
}

function handleChatSubmit(e) {
    e.preventDefault();
    
    if (userInput.value.trim() === '' || isLoading) return;
    
    const userMessage = userInput.value;
    userInput.value = '';
    
    // Add user message to chat
    addMessageToChat('user', userMessage);
    chatHistory.push({ role: "user", content: userMessage });
    
    // Process the message and get a response
    processUserMessage(userMessage);
}

function addMessageToChat(role, content) {
    const messageDiv = document.createElement('div');
    messageDiv.classList.add('message', role);
    
    const contentDiv = document.createElement('div');
    contentDiv.classList.add('message-content');
    contentDiv.innerHTML = formatMessage(content);
    
    messageDiv.appendChild(contentDiv);
    chatMessages.appendChild(messageDiv);
    
    // Scroll to bottom
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function formatMessage(message) {
    // Simple formatting for links and new lines
    return message
        .replace(/\n/g, '<br>')
        .replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank">$1</a>');
}

function showTypingIndicator() {
    const typingDiv = document.createElement('div');
    typingDiv.classList.add('message', 'assistant', 'typing-message');
    
    const contentDiv = document.createElement('div');
    contentDiv.classList.add('message-content');
    
    const indicatorDiv = document.createElement('div');
    indicatorDiv.classList.add('typing-indicator');
    
    for (let i = 0; i < 3; i++) {
        const dot = document.createElement('div');
        dot.classList.add('typing-dot');
        indicatorDiv.appendChild(dot);
    }
    
    contentDiv.appendChild(indicatorDiv);
    typingDiv.appendChild(contentDiv);
    chatMessages.appendChild(typingDiv);
    
    // Scroll to bottom
    chatMessages.scrollTop = chatMessages.scrollHeight;
    
    return typingDiv;
}

function removeTypingIndicator() {
    const typingMessage = document.querySelector('.typing-message');
    if (typingMessage) {
        typingMessage.remove();
    }
}

async function processUserMessage(message) {
    isLoading = true;
    
    // Show typing indicator
    showTypingIndicator();
    
    try {
        // Update preferences based on input
        updateUserPreferences(message);
        
        // Prepare API call to Gemini for chat response
        const response = await callGeminiAPI(message, "chat");
        removeTypingIndicator();
        
        // Add AI response to chat
        addMessageToChat('assistant', response);
        chatHistory.push({ role: "assistant", content: response });
        
        // If we have enough preferences, generate outfit suggestions
        if (hasEnoughPreferences()) {
            showLookbookLoading();
            
            // Generate outfits using the API
            try {
                const outfitResults = await callGeminiAPI(message, "outfits");
                outfits = parseOutfitResults(outfitResults);
                renderOutfits();
            } catch (error) {
                console.error("Error generating outfits:", error);
                // Fallback to local generation
                generateOutfits();
                renderOutfits();
            }
        }
    } catch (error) {
        console.error("Error processing message:", error);
        removeTypingIndicator();
        addMessageToChat('assistant', "I'm having trouble connecting right now. Please try again later.");
    } finally {
        isLoading = false;
    }
}

async function callGeminiAPI(message, requestType) {
    const prompt = createPrompt(message, requestType);
    
    const response = await fetch(`${API_URL}?key=${API_KEY}`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            contents: [
                {
                    role: "user",
                    parts: [{ text: prompt }]
                }
            ],
            generationConfig: {
                temperature: 0.7,
                maxOutputTokens: 800,
            }
        })
    });
    
    if (!response.ok) {
        throw new Error(`API request failed with status ${response.status}`);
    }
    
    const data = await response.json();
    
    if (data.candidates && data.candidates.length > 0 && 
        data.candidates[0].content && 
        data.candidates[0].content.parts && 
        data.candidates[0].content.parts.length > 0) {
        return data.candidates[0].content.parts[0].text;
    } else {
        throw new Error("Unexpected API response format");
    }
}

function createPrompt(message, requestType) {
    if (requestType === "chat") {
        return `You are a virtual fashion stylist helping users create personalized fashion lookbooks.
        
User Preferences so far:
Style: ${userPreferences.style || "Not specified"}
Color Palette: ${userPreferences.colorPalette || "Not specified"}
Season: ${userPreferences.season || "Not specified"}
Occasion: ${userPreferences.occasion || "Not specified"}
Gender Identity: ${userPreferences.gender || "Not specified"}

Chat History:
${chatHistory.map(msg => `${msg.role.toUpperCase()}: ${msg.content}`).join('\n')}

USER: ${message}

Respond as a helpful fashion stylist, giving style advice and asking for any missing preferences. Keep your response concise and friendly. If you have enough preferences (style + either season or occasion), mention that you'll create outfit suggestions.`;
    } else if (requestType === "outfits") {
        return `Generate exactly 3 outfit suggestions based on these preferences:
        
Style: ${userPreferences.style || "Casual"}
Color Palette: ${userPreferences.colorPalette || "Neutral"}
Season: ${userPreferences.season || "Summer"}
Occasion: ${userPreferences.occasion || "Everyday"}
Gender Identity: ${userPreferences.gender || "Neutral"}

Format each outfit in a valid JSON structure with the following fields for each:
{
  "outfits": [
    {
      "title": "Outfit name",
      "description": "Brief description",
      "tops": ["item 1", "item 2"],
      "bottoms": ["item 1", "item 2"],
      "shoes": ["item 1", "item 2"],
      "accessories": ["item 1", "item 2", "item 3"],
      "notes": ["styling tip 1", "styling tip 2"]
    },
    // repeat for outfit 2 and 3
  ]
}

Make sure each outfit is creative, trendy, and reflects current fashion. Include specific items (with colors/materials), not generic ones.`;
    }
}

function parseOutfitResults(apiResponse) {
    try {
        // Find the JSON part of the response
        const jsonMatch = apiResponse.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            throw new Error("No valid JSON found in API response");
        }
        
        const jsonStr = jsonMatch[0];
        const data = JSON.parse(jsonStr);
        
        // Validate the format
        if (!data.outfits || !Array.isArray(data.outfits)) {
            throw new Error("Invalid outfit data format");
        }
        
        return data.outfits;
    } catch (error) {
        console.error("Error parsing outfit results:", error);
        console.log("Raw API response:", apiResponse);
        // Return empty array to trigger fallback
        return [];
    }
}

function updateUserPreferences(message) {
    const messageLower = message.toLowerCase();
    
    // Style detection
    if (messageLower.includes('casual') || messageLower.includes('relaxed')) {
        userPreferences.style = 'casual';
    } else if (messageLower.includes('formal') || messageLower.includes('elegant')) {
        userPreferences.style = 'formal';
    } else if (messageLower.includes('streetwear') || messageLower.includes('urban')) {
        userPreferences.style = 'streetwear';
    } else if (messageLower.includes('bohemian') || messageLower.includes('boho')) {
        userPreferences.style = 'bohemian';
    } else if (messageLower.includes('minimalist') || messageLower.includes('simple')) {
        userPreferences.style = 'minimalist';
    }
    
    // Color palette detection
    if (messageLower.includes('neutral') || messageLower.includes('earth tone')) {
        userPreferences.colorPalette = 'neutral';
    } else if (messageLower.includes('bright') || messageLower.includes('colorful')) {
        userPreferences.colorPalette = 'bright';
    } else if (messageLower.includes('pastel') || messageLower.includes('soft color')) {
        userPreferences.colorPalette = 'pastel';
    } else if (messageLower.includes('monochrome') || messageLower.includes('black and white')) {
        userPreferences.colorPalette = 'monochrome';
    }
    
    // Season detection
    if (messageLower.includes('summer') || messageLower.includes('hot weather')) {
        userPreferences.season = 'summer';
    } else if (messageLower.includes('fall') || messageLower.includes('autumn')) {
        userPreferences.season = 'fall';
    } else if (messageLower.includes('winter') || messageLower.includes('cold weather')) {
        userPreferences.season = 'winter';
    } else if (messageLower.includes('spring')) {
        userPreferences.season = 'spring';
    }
    
    // Occasion detection
    if (messageLower.includes('work') || messageLower.includes('office') || messageLower.includes('professional')) {
        userPreferences.occasion = 'work';
    } else if (messageLower.includes('party') || messageLower.includes('night out')) {
        userPreferences.occasion = 'party';
    } else if (messageLower.includes('date') || messageLower.includes('dinner')) {
        userPreferences.occasion = 'date';
    } else if (messageLower.includes('vacation') || messageLower.includes('travel')) {
        userPreferences.occasion = 'vacation';
    } else if (messageLower.includes('everyday') || messageLower.includes('daily')) {
        userPreferences.occasion = 'casual';
    }
    
    // Gender detection (if shared)
    if (messageLower.includes('men') || messageLower.includes('male') || messageLower.includes('man')) {
        userPreferences.gender = 'male';
    } else if (messageLower.includes('women') || messageLower.includes('female') || messageLower.includes('woman')) {
        userPreferences.gender = 'female';
    } else if (messageLower.includes('non-binary') || messageLower.includes('gender neutral') || messageLower.includes('unisex')) {
        userPreferences.gender = 'neutral';
    }
    
    // Update filter buttons to match preferences
    updateFilterButtons();
}

function updateFilterButtons() {
    filterBtns.forEach(btn => {
        const filter = btn.getAttribute('data-filter');
        if (
            filter === userPreferences.style ||
            filter === userPreferences.season ||
            filter === userPreferences.occasion
        ) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });
}

function hasEnoughPreferences() {
    // Need at least style, and either season or occasion to generate outfits
    return userPreferences.style && (userPreferences.season || userPreferences.occasion);
}

function showLookbookLoading() {
    lookbookCarousel.innerHTML = `
        <div class="outfit-card">
            <div class="shimmer shimmer-title"></div>
            <div class="shimmer shimmer-line"></div>
            <div class="shimmer shimmer-line"></div>
            
            <div style="margin-top: 20px;">
                <div class="shimmer shimmer-line" style="width: 30%;"></div>
                <div class="shimmer shimmer-line"></div>
                <div class="shimmer shimmer-line"></div>
            </div>
            
            <div style="margin-top: 20px;">
                <div class="shimmer shimmer-line" style="width: 30%;"></div>
                <div class="shimmer shimmer-line"></div>
                <div class="shimmer shimmer-line"></div>
            </div>
            
            <div style="margin-top: 20px;">
                <div class="shimmer shimmer-line" style="width: 30%;"></div>
                <div class="shimmer shimmer-line"></div>
            </div>
        </div>
    `;
}

function generateOutfits() {
    // This would be replaced with an actual AI call
    // For now, we'll use some static outfit templates based on preferences
    outfits = [];
    
    const style = userPreferences.style || 'casual';
    const season = userPreferences.season || 'summer';
    const occasion = userPreferences.occasion || 'casual';
    const gender = userPreferences.gender || 'neutral';
    
    // Outfit 1
    let outfit1 = createOutfitTemplate(1, style, season, occasion, gender);
    outfits.push(outfit1);
    
    // Outfit 2
    let outfit2 = createOutfitTemplate(2, style, season, occasion, gender);
    outfits.push(outfit2);
    
    // Outfit 3
    let outfit3 = createOutfitTemplate(3, style, season, occasion, gender);
    outfits.push(outfit3);
    
    // Reset the index
    currentOutfitIndex = 0;
}

function createOutfitTemplate(number, style, season, occasion, gender) {
    const templates = {
        casual: {
            summer: {
                neutral: {
                    title: "Relaxed Summer Casual",
                    description: "A comfortable and breezy outfit perfect for warm summer days.",
                    tops: ["Lightweight cotton T-shirt in white or pastel", "Linen button-up with rolled sleeves"],
                    bottoms: ["Relaxed fit chino shorts in beige or navy", "Light wash denim shorts"],
                    shoes: ["Canvas sneakers", "Leather sandals"],
                    accessories: ["Straw hat", "Minimal leather bracelet", "Classic sunglasses"],
                    notes: ["Roll sleeves for a more relaxed look", "Opt for breathable fabrics to stay cool"]
                },
                female: {
                    title: "Effortless Summer Style",
                    description: "Light and feminine outfit that keeps you cool while looking put-together.",
                    tops: ["Loose cotton tank in pastel", "Off-shoulder linen blouse"],
                    bottoms: ["Flowy midi skirt", "High-waisted denim shorts"],
                    shoes: ["Strappy sandals", "Espadrilles"],
                    accessories: ["Delicate layered necklace", "Woven handbag", "Oversized sunglasses"],
                    notes: ["Tuck in your top for a more defined silhouette", "Add a hat for sun protection and style"]
                },
                male: {
                    title: "Cool Summer Casual",
                    description: "Laid-back men's look that's effortlessly stylish for summer days.",
                    tops: ["Cotton henley in light blue", "Patterned short-sleeve button-up"],
                    bottoms: ["Tailored shorts in khaki", "Linen drawstring shorts"],
                    shoes: ["Low-top white sneakers", "Leather boat shoes"],
                    accessories: ["Woven belt", "Minimal watch", "Classic aviator sunglasses"],
                    notes: ["Keep the fit relaxed but not baggy", "Roll shorts once for a more tailored look"]
                }
            },
            winter: {
                // Similar templates for winter...
                neutral: {
                    title: "Cozy Winter Casual",
                    description: "Warm and comfortable outfit for chilly winter days.",
                    tops: ["Chunky knit sweater", "Thermal henley with flannel overshirt"],
                    bottoms: ["Dark wash jeans", "Corduroy pants in earth tone"],
                    shoes: ["Leather boots", "Wool-lined sneakers"],
                    accessories: ["Knit beanie", "Wool scarf", "Leather gloves"],
                    notes: ["Layer for both warmth and style", "Choose thicker fabrics with texture"]
                }
            }
        },
        formal: {
            // Formal outfit templates...
            summer: {
                neutral: {
                    title: "Refined Summer Formal",
                    description: "Elegant yet comfortable formal look for warm weather events.",
                    tops: ["Lightweight cotton blazer in tan", "Crisp linen shirt in white or light blue"],
                    bottoms: ["Tailored chinos in navy or light grey", "Linen-blend trousers"],
                    shoes: ["Suede loafers", "Leather dress shoes without socks"],
                    accessories: ["Silk pocket square", "Minimal leather watch", "Woven leather belt"],
                    notes: ["Consider unstructured blazers for comfort", "Opt for lighter fabrics like linen and cotton blends"]
                }
            }
        }
    };
    
    // Fallback to neutral if specified gender template isn't available
    let genderToUse = templates[style]?.[season]?.[gender] ? gender : 'neutral';
    
    // Fallback to most appropriate season if the specific one isn't available
    let seasonToUse = season;
    if (!templates[style]?.[season]) {
        seasonToUse = style === 'casual' ? 'summer' : 'summer';
    }
    
    // Fallback to casual if style isn't available
    let styleToUse = templates[style] ? style : 'casual';
    
    // Get the template
    const template = templates[styleToUse][seasonToUse][genderToUse];
    
    // Modify for occasion if needed
    if (occasion === 'party' && style !== 'formal') {
        template.title = template.title.replace('Casual', 'Party');
        template.description = "A stylish outfit that's perfect for social gatherings and parties.";
        template.accessories.push("Statement jewelry");
    }
    
    // Ensure each outfit is unique by slightly modifying the title
    template.title = `${template.title} ${number}`;
    
    return template;
}

function renderOutfits() {
    // Empty state when no outfits
    if (outfits.length === 0) {
        lookbookCarousel.innerHTML = `
            <div class="empty-state">
                <h3>No outfits yet</h3>
                <p>Chat with FashionAI to get personalized outfit suggestions</p>
            </div>
        `;
        carouselControls.classList.add('hidden');
        return;
    }
    
    // Show the current outfit
    renderCurrentOutfit();
    
    // Update carousel indicators
    renderCarouselIndicators();
    
    // Show controls if we have multiple outfits
    if (outfits.length > 1) {
        carouselControls.classList.remove('hidden');
    } else {
        carouselControls.classList.add('hidden');
    }
}

function renderCurrentOutfit() {
    const outfit = outfits[currentOutfitIndex];
    
    // Create HTML for outfit card
    let outfitCardHTML = `
        <div class="outfit-card">
            <h3>${outfit.title}</h3>
            <p>${outfit.description}</p>
    `;
    
    // Add clothing visualization
    const clothingVisualization = createClothingVisualization(outfit);
    outfitCardHTML += `<div id="clothing-visualization-container"></div>`;
    
    // Continue with rest of outfit details
    outfitCardHTML += `
            <div class="outfit-items">
                <div class="item-category">
                    <h4>Tops</h4>
                    <ul class="item-list">
                        ${outfit.tops.map(item => `<li>${item}</li>`).join('')}
                    </ul>
                </div>
                
                <div class="item-category">
                    <h4>Bottoms</h4>
                    <ul class="item-list">
                        ${outfit.bottoms.map(item => `<li>${item}</li>`).join('')}
                    </ul>
                </div>
                
                <div class="item-category">
                    <h4>Shoes</h4>
                    <ul class="item-list">
                        ${outfit.shoes.map(item => `<li>${item}</li>`).join('')}
                    </ul>
                </div>
                
                <div class="item-category">
                    <h4>Accessories</h4>
                    <ul class="item-list">
                        ${outfit.accessories.map(item => `<li>${item}</li>`).join('')}
                    </ul>
                </div>
            </div>
            
            ${outfit.notes && outfit.notes.length > 0 ? `
                <div class="style-notes">
                    <h4>Style Notes:</h4>
                    <ul class="item-list">
                        ${outfit.notes.map(note => `<li>${note}</li>`).join('')}
                    </ul>
                </div>
            ` : ''}
        </div>
    `;
    
    // Update the lookbook carousel with the outfit
    lookbookCarousel.innerHTML = outfitCardHTML;
    
    // Append the clothing visualization after HTML is set
    const visualizationContainer = document.getElementById('clothing-visualization-container');
    if (visualizationContainer) {
        visualizationContainer.appendChild(clothingVisualization);
    }
}

function renderCarouselIndicators() {
    carouselIndicators.innerHTML = '';
    
    for (let i = 0; i < outfits.length; i++) {
        const indicator = document.createElement('div');
        indicator.classList.add('indicator');
        if (i === currentOutfitIndex) {
            indicator.classList.add('active');
        }
        
        indicator.addEventListener('click', () => {
            currentOutfitIndex = i;
            renderOutfits();
        });
        
        carouselIndicators.appendChild(indicator);
    }
}

function showPreviousOutfit() {
    if (outfits.length === 0) return;
    
    currentOutfitIndex = (currentOutfitIndex === 0) 
        ? outfits.length - 1 
        : currentOutfitIndex - 1;
        
    renderOutfits();
}

function showNextOutfit() {
    if (outfits.length === 0) return;
    
    currentOutfitIndex = (currentOutfitIndex === outfits.length - 1) 
        ? 0 
        : currentOutfitIndex + 1;
        
    renderOutfits();
}

function handleFilterClick(e) {
    const btn = e.target;
    const filter = btn.getAttribute('data-filter');
    const filterGroup = btn.closest('.filter-group');
    const filterType = filterGroup.id.split('-')[0]; // style, season, or occasion
    
    // Toggle active state
    if (btn.classList.contains('active')) {
        btn.classList.remove('active');
        userPreferences[filterType] = '';
    } else {
        // Remove active from siblings
        filterGroup.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
        
        // Add active to this button
        btn.classList.add('active');
        userPreferences[filterType] = filter;
    }
    
    // Regenerate outfits if we have enough preferences
    if (hasEnoughPreferences()) {
        showLookbookLoading();
        
        setTimeout(async () => {
            try {
                // Try to use API
                const message = `Generate outfits for my ${userPreferences.style} style, for ${userPreferences.season || 'any season'} and ${userPreferences.occasion || 'casual'} occasions`;
                const outfitResults = await callGeminiAPI(message, "outfits");
                outfits = parseOutfitResults(outfitResults);
                
                // Fallback if API returned no valid outfits
                if (outfits.length === 0) {
                    generateOutfits();
                }
            } catch (error) {
                console.error("Error generating outfits from filter click:", error);
                // Fallback to local generation
                generateOutfits();
            }
            renderOutfits();
        }, 1000);
    }
}

// Function to create clothing SVG visuals
function createClothingVisualization(outfit) {
    const colors = {
        tops: ['#f8c9b9', '#e3d5f2', '#c7e5d6', '#f1a5a5', '#a8d7e0', '#d6c6ff'],
        bottoms: ['#212529', '#394a59', '#455b6d', '#3c3c50', '#2c2c3e'],
        shoes: ['#212529', '#483d68', '#3a2f54', '#1a1a2e'],
        accessories: ['#f5b39e', '#d86464', '#b4dac3', '#c25e5e']
    };

    // Function to safely get random items from arrays
    function getRandomItem(array) {
        if (!array || array.length === 0) return null;
        return array[Math.floor(Math.random() * array.length)];
    }

    // Create clothing preview container
    const previewContainer = document.createElement('div');
    previewContainer.className = 'clothing-preview';

    // Process tops
    if (outfit.tops && outfit.tops.length > 0) {
        const topItem = document.createElement('div');
        topItem.className = 'clothing-item';
        
        // Decide if it's a t-shirt or jacket based on the description
        const topTemplate = outfit.tops[0].toLowerCase().includes('jacket') || 
                           outfit.tops[0].toLowerCase().includes('blazer') || 
                           outfit.tops[0].toLowerCase().includes('coat') ? 
                           document.getElementById('jacket-template') : 
                           document.getElementById('tshirt-template');
        
        if (topTemplate) {
            const topSvg = topTemplate.cloneNode(true);
            topSvg.removeAttribute('id');
            
            // Set color
            const fillElement = topSvg.querySelector('.clothing-fill');
            if (fillElement) {
                fillElement.setAttribute('fill', getRandomItem(colors.tops));
            }
            
            topItem.appendChild(topSvg);
            topItem.innerHTML += `<p>${outfit.tops[0]}</p>`;
            previewContainer.appendChild(topItem);
        }
    }

    // Process bottoms
    if (outfit.bottoms && outfit.bottoms.length > 0) {
        const bottomItem = document.createElement('div');
        bottomItem.className = 'clothing-item';
        
        // Decide if it's pants or a dress
        const isDress = outfit.bottoms[0].toLowerCase().includes('dress') || 
                       outfit.bottoms[0].toLowerCase().includes('skirt');
        
        const bottomTemplate = isDress ? 
                             document.getElementById('dress-template') : 
                             document.getElementById('pants-template');
        
        if (bottomTemplate) {
            const bottomSvg = bottomTemplate.cloneNode(true);
            bottomSvg.removeAttribute('id');
            
            // Set color
            const fillElement = bottomSvg.querySelector('.clothing-fill');
            if (fillElement) {
                fillElement.setAttribute('fill', getRandomItem(colors.bottoms));
            }
            
            bottomItem.appendChild(bottomSvg);
            bottomItem.innerHTML += `<p>${outfit.bottoms[0]}</p>`;
            previewContainer.appendChild(bottomItem);
        }
    }

    // Process shoes
    if (outfit.shoes && outfit.shoes.length > 0) {
        const shoeItem = document.createElement('div');
        shoeItem.className = 'clothing-item';
        
        const shoeTemplate = document.getElementById('shoe-template');
        
        if (shoeTemplate) {
            const shoeSvg = shoeTemplate.cloneNode(true);
            shoeSvg.removeAttribute('id');
            
            // Set color
            const fillElement = shoeSvg.querySelector('.clothing-fill');
            if (fillElement) {
                fillElement.setAttribute('fill', getRandomItem(colors.shoes));
            }
            
            shoeItem.appendChild(shoeSvg);
            shoeItem.innerHTML += `<p>${outfit.shoes[0]}</p>`;
            previewContainer.appendChild(shoeItem);
        }
    }

    // Process one accessory if available
    if (outfit.accessories && outfit.accessories.length > 0) {
        const accessoryItem = document.createElement('div');
        accessoryItem.className = 'clothing-item';
        
        // Create a custom accessory SVG based on type
        const accessoryType = outfit.accessories[0].toLowerCase();
        let accessorySvg = null;
        
        if (accessoryType.includes('hat') || accessoryType.includes('cap') || accessoryType.includes('beanie')) {
            accessorySvg = createHatSvg(getRandomItem(colors.accessories));
        } else if (accessoryType.includes('necklace') || accessoryType.includes('jewelry') || accessoryType.includes('chain')) {
            accessorySvg = createNecklaceSvg(getRandomItem(colors.accessories));
        } else if (accessoryType.includes('bag') || accessoryType.includes('purse') || accessoryType.includes('handbag')) {
            accessorySvg = createBagSvg(getRandomItem(colors.accessories));
        } else if (accessoryType.includes('watch') || accessoryType.includes('bracelet')) {
            accessorySvg = createWatchSvg(getRandomItem(colors.accessories));
        } else if (accessoryType.includes('glasses') || accessoryType.includes('sunglasses')) {
            accessorySvg = createGlassesSvg(getRandomItem(colors.accessories));
        } else {
            accessorySvg = createDefaultAccessorySvg(getRandomItem(colors.accessories));
        }
        
        if (accessorySvg) {
            accessoryItem.appendChild(accessorySvg);
            accessoryItem.innerHTML += `<p>${outfit.accessories[0]}</p>`;
            previewContainer.appendChild(accessoryItem);
        }
    }

    return previewContainer;
}

// Helper functions to create various accessory SVGs
function createHatSvg(color) {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("width", "120");
    svg.setAttribute("height", "60");
    svg.setAttribute("viewBox", "0 0 120 60");
    
    const hatPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
    hatPath.setAttribute("d", "M90,40c0-16.6-13.4-30-30-30S30,23.4,30,40c0,0-10,5-10,10s60,10,60,10s10-5,10-10S90,40,90,40z");
    hatPath.setAttribute("fill", color);
    hatPath.setAttribute("stroke", "#212529");
    hatPath.setAttribute("stroke-width", "2");
    
    svg.appendChild(hatPath);
    return svg;
}

function createNecklaceSvg(color) {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("width", "120");
    svg.setAttribute("height", "60");
    svg.setAttribute("viewBox", "0 0 120 60");
    
    const chainPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
    chainPath.setAttribute("d", "M30,20c0,0,30,40,60,0");
    chainPath.setAttribute("fill", "none");
    chainPath.setAttribute("stroke", color);
    chainPath.setAttribute("stroke-width", "3");
    chainPath.setAttribute("stroke-linecap", "round");
    
    const pendantPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
    pendantPath.setAttribute("d", "M60,40l-10-10h20L60,40z");
    pendantPath.setAttribute("fill", color);
    pendantPath.setAttribute("stroke", "#212529");
    pendantPath.setAttribute("stroke-width", "1");
    
    svg.appendChild(chainPath);
    svg.appendChild(pendantPath);
    return svg;
}

function createBagSvg(color) {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("width", "120");
    svg.setAttribute("height", "60");
    svg.setAttribute("viewBox", "0 0 120 60");
    
    const bagPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
    bagPath.setAttribute("d", "M80,20H40c-5,0-10,5-10,10v20c0,5,5,10,10,10h40c5,0,10-5,10-10V30C90,25,85,20,80,20z");
    bagPath.setAttribute("fill", color);
    bagPath.setAttribute("stroke", "#212529");
    bagPath.setAttribute("stroke-width", "2");
    
    const handlePath = document.createElementNS("http://www.w3.org/2000/svg", "path");
    handlePath.setAttribute("d", "M45,20c0-5,5-10,15-10s15,5,15,10");
    handlePath.setAttribute("fill", "none");
    handlePath.setAttribute("stroke", "#212529");
    handlePath.setAttribute("stroke-width", "2");
    
    svg.appendChild(bagPath);
    svg.appendChild(handlePath);
    return svg;
}

function createWatchSvg(color) {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("width", "120");
    svg.setAttribute("height", "60");
    svg.setAttribute("viewBox", "0 0 120 60");
    
    const watchFace = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    watchFace.setAttribute("cx", "60");
    watchFace.setAttribute("cy", "30");
    watchFace.setAttribute("r", "20");
    watchFace.setAttribute("fill", color);
    watchFace.setAttribute("stroke", "#212529");
    watchFace.setAttribute("stroke-width", "2");
    
    const band1 = document.createElementNS("http://www.w3.org/2000/svg", "path");
    band1.setAttribute("d", "M40,30c0,0-10-5-10-10s10-10,10-10");
    band1.setAttribute("fill", "none");
    band1.setAttribute("stroke", color);
    band1.setAttribute("stroke-width", "6");
    
    const band2 = document.createElementNS("http://www.w3.org/2000/svg", "path");
    band2.setAttribute("d", "M80,30c0,0,10,5,10,10s-10,10-10,10");
    band2.setAttribute("fill", "none");
    band2.setAttribute("stroke", color);
    band2.setAttribute("stroke-width", "6");
    
    svg.appendChild(band1);
    svg.appendChild(band2);
    svg.appendChild(watchFace);
    return svg;
}

function createGlassesSvg(color) {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("width", "120");
    svg.setAttribute("height", "60");
    svg.setAttribute("viewBox", "0 0 120 60");
    
    const leftLens = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    leftLens.setAttribute("cx", "40");
    leftLens.setAttribute("cy", "30");
    leftLens.setAttribute("r", "15");
    leftLens.setAttribute("fill", "none");
    leftLens.setAttribute("stroke", color);
    leftLens.setAttribute("stroke-width", "3");
    
    const rightLens = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    rightLens.setAttribute("cx", "80");
    rightLens.setAttribute("cy", "30");
    rightLens.setAttribute("r", "15");
    rightLens.setAttribute("fill", "none");
    rightLens.setAttribute("stroke", color);
    rightLens.setAttribute("stroke-width", "3");
    
    const bridge = document.createElementNS("http://www.w3.org/2000/svg", "line");
    bridge.setAttribute("x1", "55");
    bridge.setAttribute("y1", "30");
    bridge.setAttribute("x2", "65");
    bridge.setAttribute("y2", "30");
    bridge.setAttribute("stroke", color);
    bridge.setAttribute("stroke-width", "3");
    
    const leftArm = document.createElementNS("http://www.w3.org/2000/svg", "line");
    leftArm.setAttribute("x1", "25");
    leftArm.setAttribute("y1", "30");
    leftArm.setAttribute("x2", "15");
    leftArm.setAttribute("y2", "20");
    leftArm.setAttribute("stroke", color);
    leftArm.setAttribute("stroke-width", "3");
    
    const rightArm = document.createElementNS("http://www.w3.org/2000/svg", "line");
    rightArm.setAttribute("x1", "95");
    rightArm.setAttribute("y1", "30");
    rightArm.setAttribute("x2", "105");
    rightArm.setAttribute("y2", "20");
    rightArm.setAttribute("stroke", color);
    rightArm.setAttribute("stroke-width", "3");
    
    svg.appendChild(leftLens);
    svg.appendChild(rightLens);
    svg.appendChild(bridge);
    svg.appendChild(leftArm);
    svg.appendChild(rightArm);
    return svg;
}

function createDefaultAccessorySvg(color) {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("width", "120");
    svg.setAttribute("height", "60");
    svg.setAttribute("viewBox", "0 0 120 60");
    
    const accessoryPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
    accessoryPath.setAttribute("d", "M60,20l15,10l-5,20h-20l-5-20L60,20z");
    accessoryPath.setAttribute("fill", color);
    accessoryPath.setAttribute("stroke", "#212529");
    accessoryPath.setAttribute("stroke-width", "2");
    
    svg.appendChild(accessoryPath);
    return svg;
} 