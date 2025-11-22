# FashionAI - Your Personal Style Assistant

A virtual fashion stylist built with vanilla HTML, CSS, and JavaScript that helps users create personalized fashion lookbooks based on their preferences.

## Features

- Interactive chat interface to collect user preferences
- Natural language processing to understand style preferences
- Dynamic outfit suggestions based on user input
- Filter options for style, season, and occasion
- Responsive design that works on desktop and mobile
- Light and dark mode support
- Carousel to browse multiple outfit combinations
- Integration with Gemini API for AI-powered responses

## API Integration

This application uses the Google Gemini API to generate personalized responses. The API key is already configured and ready to use.

The application leverages the Gemini API for:
- Generating chat responses based on your style preferences
- Creating personalized outfit suggestions tailored to your needs

If the API call fails for any reason, the application will fall back to using the built-in templates.

## How to Use

1. Open `index.html` in your web browser
2. Tell the virtual stylist about your preferences:
   - Style (casual, formal, streetwear, etc.)
   - Color palette preferences
   - Season (summer, winter, etc.)
   - Occasion (work, party, vacation)
   - Gender identity (if you wish to share)
3. The AI will process your preferences and generate outfit suggestions
4. Browse through the outfit carousel to see different looks
5. Use the filters to refine your style preferences

## Project Structure

- `index.html` - Main HTML structure
- `css/styles.css` - All styling with responsive design
- `js/app.js` - JavaScript code for interaction and outfit generation

## Setup

No build tools or installation required! Simply download the files and open `index.html` in your browser.

## Security Note

This demo uses an API key directly in the frontend code for simplicity. In a production environment, you should:
1. Move the API key to a server-side environment variable
2. Create a backend API endpoint to proxy requests to Gemini
3. Never expose your API key in client-side code in production

## Local Development

Since this project uses vanilla HTML, CSS, and JavaScript, you can develop locally by:

1. Cloning the repository
2. Opening `index.html` in your browser
3. Making changes to the files
4. Refreshing the browser to see your changes

## UI/UX Features

- Minimalist but vibrant theme with soft gradients
- Smooth animations and transitions
- Typing indicators and loading effects
- Responsive design for all screen sizes
- Toggle for light/dark mode

## Note

This is a frontend prototype that simulates AI responses using predefined templates. In a production environment, this would connect to a backend service with actual AI processing. 