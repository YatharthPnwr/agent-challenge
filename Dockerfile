FROM ollama/ollama:0.7.0

# Qwen2.5:7b - Docker
ENV MODEL_NAME_AT_ENDPOINT=qwen2.5:7b
ENV PORT=8080

# Unset API_BASE_URL to prevent playground from using external endpoint
ENV API_BASE_URL=http://127.0.0.1:11434/api

# Install system dependencies and Node.js
RUN apt-get update && apt-get install -y \
  curl \
  && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
  && apt-get install -y nodejs \
  && rm -rf /var/lib/apt/lists/* \
  && npm install -g pnpm

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm install

COPY . .

RUN pnpm run build

# Debug: Print environment variables
RUN echo "MODEL_NAME_AT_ENDPOINT: $MODEL_NAME_AT_ENDPOINT"

# Override the ollama entrypoint
ENTRYPOINT ["/bin/sh", "-c"]

CMD ["echo Starting with MODEL_NAME_AT_ENDPOINT: $MODEL_NAME_AT_ENDPOINT && ollama serve & sleep 5 && ollama pull ${MODEL_NAME_AT_ENDPOINT} && pnpm dev"]
