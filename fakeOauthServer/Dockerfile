# (Dev) Just install packages, we get the source code from the volume mount.
FROM node:10
ADD yarn.lock /yarn.lock
ADD package.json /package.json
RUN yarn
ADD server.js /server.js
CMD ["node", "server.js"]
