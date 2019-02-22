#FROM node:10-alpine
FROM node:10

WORKDIR /usr/src/app

COPY package*.json ./

#RUN apk add --no-cache git make gcc g++ python
RUN npm i
#RUN apk del git make gcc g++ python

COPY . .
COPY ./ffmpeg-binaries/bin node_modules/ffmpeg-binaries/bin

CMD [ "npm", "start" ]
