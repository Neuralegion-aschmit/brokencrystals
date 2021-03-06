FROM node:10-alpine

RUN mkdir -p /home/node/bc/node_modules && chown -R node:node /home/node/bc

WORKDIR /home/node/bc

COPY --chown=node:node package*.json ./
COPY --chown=node:node dist ./dist
COPY --chown=node:node config ./config
COPY --chown=node:node .env ./

USER node

RUN npm install

#COPY --chown=node:node . .

EXPOSE 3000

CMD [ "node", "./dist/main.js" ]