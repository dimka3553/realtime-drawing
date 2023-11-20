FROM node:latest

WORKDIR /usr/src/app

COPY ./backend ./

RUN npm install

EXPOSE 8080

CMD npm run start