#FROM node:10-alpine
FROM node:12

WORKDIR /usr/src/app

COPY package*.json ./

#RUN apk add --no-cache git make gcc g++ python
RUN apt-get update && apt-get install -y \
    ffmpeg \
 && rm -rf /var/lib/apt/lists/*
RUN npm i
#RUN apk del git make gcc g++ python

COPY . .

CMD [ "npm", "start" ]
