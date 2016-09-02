FROM node:6.2.2

ENV NODE_ENV=development

WORKDIR /var/www/html

ADD ./package.json /var/www/html/

RUN npm install

ADD . /var/www/html

ENTRYPOINT ./run.sh
