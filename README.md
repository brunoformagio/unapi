# Unapi

Unapi is an AI-powered API client that allows you to interact with any REST API using natural language. Simply input your OpenAPI (Swagger) documentation, and start chatting with your API.

![Unapi Screenshot](https://github.com/brunoformagio/unapi/raw/main/public/preview.gif)

## Features

- 🧠 **Natural Language Interface**: Talk to your API
- 📚 **OpenAPI Support**: Upload Swagger/OpenAPI files (JSON, YAML) via URL
- 🤖 **AI-Powered**: Leverages Groq's LLM for understanding intent and generating API calls
- 💬 **Interactive Chat**: Styled chat interface with message history
- 🔄 **Dynamic Field Extraction**: Automatically extracts field values from your messages
- 🔧 **Custom Base URL**: Set your own base URL for API endpoints
- 🔑 **API Key Support**: Securely handle authentication with Bearer tokens
- 📱 **Responsive Design**: Works on desktop and mobile devices

## Technologies Used

- **Next.js** - React framework for the frontend and API routes
- **TypeScript** - For type safety and better developer experience
- **Tailwind CSS** - For styling
- **Framer Motion** - For smooth animations
- **Groq API** - For AI capabilities using Llama 3 70B model
- **Zustand** - For state management
- **React Hot Toast** - For notifications
- **OpenAPI/Swagger Parser** - For parsing API documentation

## Setup Instructions

### Prerequisites

- Node.js (v18+)
- npm or pnpm
- A Groq API key

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/brunoformagio/unapi.git
   cd unapi
   ```

2. Install dependencies:
   ```bash
   npm install
   # or
   pnpm install
   ```

3. Create a `.env` file in the root directory with your Groq API key:
   ```
   # Groq API Key
   GROQ_API_KEY=your_groq_api_key_here

   # Model Settings
   UNAPI_MODEL=llama3-70b-8192

   # Temperature Settings
   UNAPI_TEMP_CLASSIFICATION=0.1
   UNAPI_TEMP_EXTRACTION=0.1
   UNAPI_TEMP_CHAT=0.7
   UNAPI_TEMP_API=0.2
   ```

4. Start the development server:
   ```bash
   npm run dev
   # or
   pnpm dev
   ```

5. Open [http://localhost:3000](http://localhost:3000) in your browser.

### Setting up Groq

1. Create a Groq account at [console.groq.com](https://console.groq.com)
2. Generate an API key from the Groq dashboard
3. Add your Groq API key to the `.env` file as shown above

## Usage Guide

1. **Upload API Documentation**:
   - paste a URL to your OpenAPI documentation

2. **Configure Base URL and Auth**:
   - Enter your API's base URL
   - If your API requires authentication, add your Bearer token

3. **Start Chatting**:
   - Type natural language requests like "Get all users" or "Create a new product with name 'Example' and price 99.99"
   - Unapi will translate your request to the appropriate API call
   - Results will be displayed directly in the chat

4. **Handle Missing Data**:
   - If your request is missing required fields, Unapi will ask for the missing information
   - Respond with the requested data to complete your API call

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| GROQ_API_KEY | Your Groq API key | (required) |
| UNAPI_MODEL | LLM model to use | llama3-70b-8192 |
| UNAPI_TEMP_CLASSIFICATION | Temperature for intent classification | 0.1 |
| UNAPI_TEMP_EXTRACTION | Temperature for field extraction | 0.1 |
| UNAPI_TEMP_CHAT | Temperature for chat responses | 0.7 |
| UNAPI_TEMP_API | Temperature for API calls | 0.2 |

## License

MIT License

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
