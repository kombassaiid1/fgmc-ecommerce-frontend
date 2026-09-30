FROM node:22.12-alpine

WORKDIR /app

# Install deps only
COPY package.json package-lock.json ./
RUN npm i --legacy-peer-deps

# Copy full source (including prisma/)
COPY . .

# Build time environment variables
ARG BACKEND_API_URL=https://api.cliniquemachineacoudre.fr/
ENV BACKEND_API_URL=$BACKEND_API_URL

ARG NEXT_PUBLIC_BACKEND_API_URL=https://api.cliniquemachineacoudre.fr/
ENV NEXT_PUBLIC_BACKEND_API_URL=$NEXT_PUBLIC_BACKEND_API_URL
# Build Next.js
RUN npm run build

EXPOSE 3000
CMD ["npm", "start"]
