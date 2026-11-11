FROM node:22.12-alpine

WORKDIR /app

# Install deps only
COPY package.json package-lock.json ./
RUN npm i --legacy-peer-deps

# Copy full source (including prisma/)
COPY . .

# Les variables NEXT_PUBLIC_* sont intégrées au bundle pendant la compilation.
ARG BACKEND_API_URL
ENV BACKEND_API_URL=${BACKEND_API_URL}
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
ARG NEXT_PUBLIC_BACKEND_API_URL
ENV NEXT_PUBLIC_BACKEND_API_URL=${NEXT_PUBLIC_BACKEND_API_URL}
ARG NEXT_PUBLIC_SITE_URL
ENV NEXT_PUBLIC_SITE_URL=${NEXT_PUBLIC_SITE_URL}

# Build Next.js
RUN npm run build

ENV NODE_ENV=production HOSTNAME=0.0.0.0 PORT=3000
EXPOSE 3000
CMD ["npm", "start", "--", "--hostname", "0.0.0.0", "--port", "3000"]
