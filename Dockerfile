FROM node:18-alpine

# Install pnpm
RUN npm install -g pnpm

# Install Chrome dependencies
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    freetype-dev \
    harfbuzz \
    ca-certificates \
    ttf-freefont \
    xvfb \
    dbus

# Tell Puppeteer to skip installing Chrome. We'll be using the installed package.
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

# Create app directory
WORKDIR /usr/src/app

# Copy package files
COPY package.json pnpm-lock.yaml ./

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source code and public files
COPY src ./src
COPY public ./public
COPY tsconfig.json ./
COPY .env ./

# Build TypeScript
RUN pnpm build

# Create reports directory
RUN mkdir -p reports

# Create a non-privileged user
RUN addgroup -g 1001 -S appuser
RUN adduser -S appuser -u 1001

# Give ownership of the app to appuser
RUN chown -R appuser:appuser /usr/src/app

USER appuser

# Expose port for web interface
EXPOSE 3000

CMD ["pnpm", "web"]