FROM node:22-bookworm-slim

WORKDIR /usr/src/app

# Required for native Node modules (e.g. sqlite3 via node-gyp)
RUN apt-get update \
&& apt-get install -y --no-install-recommends python3 make g++ \
&& rm -rf /var/lib/apt/lists/*

# Install app dependencies
# A wildcard is used to ensure both package.json AND package-lock.json are copied
COPY backend/hwb/package*.json ./

# Bundle app source
COPY backend/hwb ./

RUN npm i @sap/cds -g \
&& npm install

# ensure no data is in db/data directory
RUN rm -rf db/data

# Build ui5 app

WORKDIR app/frontendhwb

RUN npm ci
RUN npm run build

WORKDIR /usr/src/app

# Make the script executable
COPY backend/hwb/start.sh ./
RUN chmod +x start.sh

EXPOSE 4004

# Run the script on container startup
CMD ["./start.sh"]
