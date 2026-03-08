FROM node:24

RUN corepack enable && corepack prepare pnpm@latest --activate

RUN mkdir -p /var/www/app

COPY . /var/www/app
WORKDIR /var/www/app

RUN pnpm install
RUN pnpm build

EXPOSE 3000
EXPOSE 3001

CMD ["pnpm", "start"]