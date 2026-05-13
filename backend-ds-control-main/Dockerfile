FROM node:24

RUN corepack enable && corepack prepare pnpm@9.15.9 --activate

RUN mkdir -p /var/www/app

COPY . /var/www/app
WORKDIR /var/www/app

RUN pnpm install --ignore-workspace --no-frozen-lockfile
RUN pnpm --ignore-workspace build

EXPOSE 3000
EXPOSE 3001

CMD ["node", "build/src/server.js"]
