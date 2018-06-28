# (Dev) Just install packages, we get the source code from the volume mount.
FROM node:10
ADD yarn.lock /app/yarn.lock
ADD package.json /app/package.json
WORKDIR /app
RUN yarn
CMD ["yarn", "nodemon", "src/server.js"]
