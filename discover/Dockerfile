FROM node:alpine
WORKDIR /usr/src/app
COPY package.json package-lock.json /usr/src/app/
RUN npm install
COPY index.js /usr/src/app/
ENTRYPOINT ["npm", "start"]
CMD ["52.519298", "13.380096", "52.519298", "13.380096"]
