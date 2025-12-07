FROM node:22-alpine

WORKDIR /usr/src/app

# Install build dependencies for native modules (better-sqlite3, etc.)
RUN apk add --no-cache python3 make g++ \
    # node-gyp looks for "python", so add a symlink
 && ln -sf /usr/bin/python3 /usr/bin/python

# Copy package metadata first (for better layer caching)
COPY ./package*.json ./

# Install CAP CLI globally and app deps
RUN npm i @sap/cds -g \
 && npm install

# Bundle app source
COPY . .

# ensure no data is in db/data directory
RUN rm -rf db/data

# Build UI5 app
WORKDIR /usr/src/app/app/frontendhwb

RUN npm ci
RUN npm run build

WORKDIR /usr/src/app

# Make the script executable
COPY start.sh ./
RUN chmod +x start.sh

EXPOSE 4004

CMD ["./start.sh"]
