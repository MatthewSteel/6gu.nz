# (Dev) Just install packages, we get the source code from the volume mount.
FROM node:10
WORKDIR /app
COPY yarn.lock package.json ./
RUN yarn
CMD ["yarn", "start"]
