FROM node:18-alpine

WORKDIR /usr/src/app

# Install app dependencies
# A wildcard is used to ensure both package.json AND package-lock.json are copied
# where available (npm@5+)
COPY ./package*.json ./

# Bundle app source
COPY . .

RUN npm i @sap/cds -g \
    && npm install

# Build ui5 app

WORKDIR app/frontendhwb

RUN npm ci
RUN npm run build

WORKDIR /

# Make the script executable
COPY start.sh ./
RUN chmod +x start.sh

# Run the script on container startup
CMD ["./start.sh"]