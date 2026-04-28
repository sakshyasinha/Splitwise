FROM node:22-slim

WORKDIR /usr/src/app

# Install dependencies first for better caching
COPY package.json package-lock.json* ./
RUN npm ci --only=production || npm install --production

# Copy source
COPY . .

EXPOSE 5000

ENV NODE_ENV=production

CMD ["node", "server.js"]
