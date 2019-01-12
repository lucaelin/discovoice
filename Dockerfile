FROM node:10-alpine

WORKDIR /usr/src/app

COPY package*.json ./

RUN apk add --no-cache git make gcc g++ python && npm i && apk del git make gcc g++ python

COPY . .

CMD [ "npm", "start" ]