FROM node:22-bookworm-slim

WORKDIR /app

RUN apt-get update && apt-get install -y openssl ca-certificates && rm -rf /var/lib/apt/lists/*


COPY package*.json ./

RUN npm ci

COPY . .

RUN DATABASE_URL="mysql://localhost:3306/build" npx prisma generate

RUN npm run build

ENV NODE_ENV=production
ENV PORT=5000

EXPOSE 5000

CMD ["npm", "start"]
