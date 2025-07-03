FROM node:24-alpine

WORKDIR /usr/src/app

COPY package*.json ./
RUN npm install

COPY . .
COPY .env .env

RUN chmod 600 config/keys/backendPrivateKey.pem config/keys/backendPublicKey.pem

EXPOSE 3001
CMD ["npm", "start"]
