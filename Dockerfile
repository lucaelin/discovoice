#FROM node:10-alpine
FROM node:12

WORKDIR /usr/src/app

COPY package*.json ./

#RUN apk add --no-cache git make gcc g++ python

RUN npm i
#RUN apk del git make gcc g++ python

COPY . .

CMD [ "npm", "start" ]
