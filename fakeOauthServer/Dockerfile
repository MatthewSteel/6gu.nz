FROM node:10
WORKDIR /app
COPY yarn.lock package.json ./
RUN yarn
copy server.js ./
CMD ["node", "server.js"]
