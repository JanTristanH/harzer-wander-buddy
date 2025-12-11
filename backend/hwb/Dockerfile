FROM node:22

WORKDIR /usr/src/app

RUN apt-get update \
 && apt-get install -y python3 python3-distutils make g++ \
 && rm -rf /var/lib/apt/lists/*

COPY ./package*.json ./
RUN npm i @sap/cds -g \
 && npm ci
COPY . .

RUN rm -rf db/data

WORKDIR /usr/src/app/app/frontendhwb
RUN npm ci && npm run build

WORKDIR /usr/src/app

COPY start.sh ./
RUN chmod +x start.sh

EXPOSE 4004
CMD ["./start.sh"]
