FROM node:20

WORKDIR /app

COPY package.json .yarnrc.yml yarn.lock ./

RUN corepack enable && corepack prepare yarn@4.4.1 --activate

RUN yarn

COPY . .

RUN yarn build

EXPOSE 3000

CMD ["yarn", "start"]