FROM node:alpine
WORKDIR /usr/src/app
COPY package.json package-lock.json /usr/src/app/
RUN npm install
COPY index.js /usr/src/app/
ENTRYPOINT npm start
