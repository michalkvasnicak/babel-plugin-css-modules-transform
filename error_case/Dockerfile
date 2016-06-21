FROM node:6.2.2

ENV NODE_ENV=development

WORKDIR /var/www/html

ADD . /var/www/html

RUN npm install

ENTRYPOINT npm test
