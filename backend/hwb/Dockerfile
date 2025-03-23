FROM node:18-alpine
EXPOSE 4004

WORKDIR /usr/src/app

# Install app dependencies
# A wildcard is used to ensure both package.json AND package-lock.json are copied
COPY ./package*.json ./

# Bundle app source
COPY . .

RUN npm i @sap/cds -g \
    && npm install

# ensure no data is in db/data directory
RUN rm -rf db/data

# Build ui5 app

WORKDIR /usr/src/app/frontendhwb

RUN npm ci
RUN npm run build

WORKDIR /usr/src/app

# Make the script executable
COPY start.sh ./
RUN chmod +x start.sh

# Run the script on container startup
CMD ["./start.sh"]