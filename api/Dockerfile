FROM node:10
WORKDIR /app
COPY yarn.lock package.json ./
RUN yarn
COPY ./src /app/src
COPY ./migrations /app/migrations
CMD ["node", "src/server.js"]
