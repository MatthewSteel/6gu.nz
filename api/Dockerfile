FROM node:10
WORKDIR /app
COPY yarn.lock package.json ./
RUN yarn
CMD ["yarn", "nodemon", "src/server.js"]
