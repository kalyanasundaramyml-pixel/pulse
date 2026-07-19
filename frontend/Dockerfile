FROM node:20-alpine AS build
WORKDIR /app

# Trust an optional corporate root CA (e.g. Zscaler) so npm can fetch over
# HTTPS when built on a machine behind a TLS-inspecting proxy. Drop your org's
# CA cert(s) as .crt files into ./certs before building; no-op if empty.
RUN apk add --no-cache ca-certificates
COPY certs/ /usr/local/share/ca-certificates/corporate/
RUN update-ca-certificates
ENV NODE_EXTRA_CA_CERTS=/etc/ssl/certs/ca-certificates.crt

COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

FROM nginx:1.27-alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
