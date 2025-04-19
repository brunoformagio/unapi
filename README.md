# unapi

- Projeto: Unapi
- Stack: Next.js (Fullstack com App Router)

# Estrutura inicial de pastas:

/unapi
├── app
│   ├── page.tsx               // Página inicial com explicação e CTA
│   ├── chat
│   │   └── page.tsx           // Interface de chat com o assistente
│   └── api
│       ├── parse-doc          // POST: recebe doc OpenAPI/Postman
│       └── execute-endpoint   // POST: executa chamada real da API
├── lib
│   ├── openapiParser.ts       // Função para ler e normalizar OpenAPI/Swagger
│   ├── intentResolver.ts      // Função com lógica IA: intenção → endpoint + payload
│   └── apiExecutor.ts         // Faz chamada real (Axios/Fetch)
├── components
│   ├── ChatWindow.tsx         // Componente visual do chat
│   ├── EndpointLog.tsx        // Exibe chamadas feitas (input/output)
│   └── UploadBox.tsx          // Componente de upload da doc da API
├── prompts
│   └── agentPrompt.ts         // Prompt base do assistente IA
├── public
│   └── ...                    // Assets e ícones
├── styles
│   └── globals.css            // Estilos com Tailwind
├── .env.local                 // Armazena API Key OpenAI etc.
├── middleware.ts              // (opcional) Controle de acesso
├── next.config.js
├── package.json
└── README.md

# Bibliotecas:
- openai (API GPT-4o)
- yaml, swagger-parser (leitura de docs)
- axios (requisições seguras)
- zod (validação de dados)
- zustand ou jotai (estado do chat)
- tailwindcss + shadcn/ui (UI)

* Roadmap:
- 1. Upload e parsing de doc OpenAPI/Postman → salvar rotas disponíveis
- 2. Chat com IA → interpretar intenção → sugerir endpoint
- 3. Execução real da rota com parâmetros sugeridos
- 4. Logs e histórico de chamadas
- 5. Segurança (sandbox/dry-run, headers protegidos)
- 6. Dashboard com docs, analytics e tokens gerados por user

- MVP: upload doc + chat funcional com execução real
